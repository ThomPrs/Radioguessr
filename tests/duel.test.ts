import { beforeEach, describe, expect, it } from 'vitest';
import { act, createRoom, getRoom, joinRoom, type Credentials } from '../api/_lib/rooms';
import { MemoryStore, setStore } from '../api/_lib/store';
import { ABANDON_MS, COUNTDOWN_MS, REVEAL_TIME_MS, ROUND_TIME_MS } from '../shared/duel';
import type { Station } from '../shared/types';

const st = (id: string, lat: number, lon: number, cc = 'FR'): Station => ({
  id, name: `Radio ${id}`, streamUrl: `https://stream/${id}`, codec: 'MP3', lat, lon, countryCode: cc, country: cc, continent: 'EU', languageCode: 'fr',
});
// 5 manches, 3 candidats chacune
const ROUNDS: Station[][] = Array.from({ length: 5 }, (_, i) => [st(`r${i}a`, 10 * i, 10 * i), st(`r${i}b`, 10 * i + 1, 10 * i), st(`r${i}c`, 10 * i + 2, 10 * i)]);

const T0 = 1_800_000_000_000;
let host: Credentials;
let guest: Credentials;
let code: string;

async function setup(now = T0) {
  const h = await createRoom('Alice', now, ROUNDS);
  code = h.code;
  host = { playerId: h.playerId, token: h.token };
  const g = await joinRoom(code, 'Bob', { playerId: null, token: null }, now + 1000);
  guest = { playerId: g.playerId, token: g.token };
  return now + 1000 + COUNTDOWN_MS; // début de la manche 1
}

beforeEach(() => setStore(new MemoryStore()));

describe('salon', () => {
  it('attente, puis compte à rebours, puis première manche', async () => {
    const h = await createRoom('Alice', T0, ROUNDS);
    expect(h.code).toMatch(/^[A-Z2-9]{5}$/);
    const cred = { playerId: h.playerId, token: h.token };
    expect((await getRoom(h.code, cred, T0)).status).toBe('waiting');
    await joinRoom(h.code, 'Bob', { playerId: null, token: null }, T0 + 1000);
    const v = await getRoom(h.code, cred, T0 + 2000);
    expect(v.status).toBe('countdown');
    expect(v.opponent?.name).toBe('Bob');
    const p = await getRoom(h.code, cred, T0 + 1000 + COUNTDOWN_MS);
    expect(p.status).toBe('playing');
    expect(p.round).toMatchObject({ index: 0, phase: 'listening', streamUrl: 'https://stream/r0a', station: null });
  });

  it('salon introuvable, complet, jeton invalide, reconnexion', async () => {
    await expect(getRoom('ZZZZZ', { playerId: 'x', token: 'y' })).rejects.toMatchObject({ code: 'not-found' });
    await setup();
    await expect(joinRoom(code, 'Carol', { playerId: null, token: null })).rejects.toMatchObject({ code: 'full' });
    await expect(getRoom(code, { playerId: host.playerId, token: 'mauvais' })).rejects.toMatchObject({ code: 'forbidden' });
    const again = await joinRoom(code, 'peu importe', guest);
    expect(again.seat).toBe('guest');
  });
});

describe('manche', () => {
  it('punaises secrètes puis révélation quand les deux ont validé', async () => {
    const t = await setup();
    await act(code, host, { action: 'guess', round: 0, lat: 0.5, lon: 0 }, t + 5000);
    const g = await getRoom(code, guest, t + 6000);
    expect(g.round?.opponent).toMatchObject({ guessed: true, entry: null }); // pas de fuite de la punaise
    expect(g.round?.phase).toBe('listening');
    const r = await act(code, guest, { action: 'guess', round: 0, lat: 5, lon: 0 }, t + 8000);
    expect(r.view.round?.phase).toBe('revealed');
    expect(r.view.round?.station?.id).toBe('r0a');
    expect(r.view.round?.opponent.entry?.lat).toBe(0.5);
    expect(r.view.totals.you).toBeLessThan(r.view.totals.opponent); // Bob plus loin qu'Alice
  });

  it('une seule punaise par manche', async () => {
    const t = await setup();
    await act(code, host, { action: 'guess', round: 0, lat: 0, lon: 0 }, t + 1000);
    await act(code, host, { action: 'guess', round: 0, lat: 50, lon: 50 }, t + 2000);
    const v = await getRoom(code, host, t + 3000);
    expect(v.round?.you.entry?.lat).toBe(0);
  });

  it('indices : coût déduit, valeur renvoyée, impossible après la punaise', async () => {
    const t = await setup();
    const h = await act(code, host, { action: 'hint', round: 0, kind: 'continent' }, t + 1000);
    expect(h.hint).toBe('Europe');
    expect(h.view.round?.you.hintValues.continent).toBe('Europe');
    await act(code, host, { action: 'guess', round: 0, lat: 0, lon: 0 }, t + 2000);
    await expect(act(code, host, { action: 'hint', round: 0, kind: 'language' }, t + 3000)).rejects.toMatchObject({ code: 'bad-request' });
    const v = await getRoom(code, host, t + 3000);
    expect(v.round?.you.entry?.score).toBe(4000); // 5000 − 1000
  });

  it('après 90 s sans réponse : révélation, 0 point', async () => {
    const t = await setup();
    await act(code, host, { action: 'guess', round: 0, lat: 0, lon: 0 }, t + 1000);
    const before = await getRoom(code, host, t + ROUND_TIME_MS - 1000);
    expect(before.round?.phase).toBe('listening');
    const after = await getRoom(code, host, t + ROUND_TIME_MS + 10);
    expect(after.round?.phase).toBe('revealed');
    expect(after.round?.opponent.entry).toMatchObject({ lat: null, score: 0 });
    await expect(act(code, guest, { action: 'guess', round: 0, lat: 0, lon: 0 }, t + ROUND_TIME_MS + 5000)).rejects.toMatchObject({ code: 'bad-request' });
  });

  it('flux muet : secours suivant pour les deux, une seule fois, chrono relancé', async () => {
    const t = await setup();
    await act(code, host, { action: 'guess', round: 0, lat: 0, lon: 0 }, t + 2000);
    await act(code, guest, { action: 'skip', round: 0, from: 0 }, t + 8000);
    await act(code, host, { action: 'skip', round: 0, from: 0 }, t + 8100); // doublon ignoré
    const v = await getRoom(code, host, t + 9000);
    expect(v.round).toMatchObject({ candidate: 1, streamUrl: 'https://stream/r0b', startAt: t + 8000 });
    expect(v.round?.you.guessed).toBe(false); // punaise posée sur l'ancien flux annulée
  });
});

describe('partie complète', () => {
  it('5 manches avec « prêt », puis fin et totaux', async () => {
    let t = await setup();
    for (let i = 0; i < 5; i++) {
      const v0 = await getRoom(code, host, t);
      expect(v0.round?.index).toBe(i);
      await act(code, host, { action: 'guess', round: i, lat: 10 * i, lon: 10 * i }, t + 1000);
      await act(code, guest, { action: 'guess', round: i, lat: 10 * i + 20, lon: 10 * i }, t + 2000);
      await act(code, host, { action: 'ready', round: i }, t + 3000);
      await act(code, guest, { action: 'ready', round: i }, t + 4000);
      t += 5000;
    }
    const end = await getRoom(code, host, t);
    expect(end.status).toBe('finished');
    expect(end.history).toHaveLength(5);
    expect(end.totals.you).toBe(25000);
    expect(end.totals.opponent).toBeLessThan(end.totals.you);
  });

  it('passage automatique après la révélation', async () => {
    const t = await setup();
    await act(code, host, { action: 'guess', round: 0, lat: 0, lon: 0 }, t + 1000);
    await act(code, guest, { action: 'guess', round: 0, lat: 0, lon: 0 }, t + 2000);
    const v = await getRoom(code, host, t + 2000 + REVEAL_TIME_MS + 1);
    expect(v.round).toMatchObject({ index: 1, phase: 'listening' });
  });

  it('adversaire parti : on ne l’attend plus', async () => {
    const t = await setup();
    await act(code, guest, { action: 'leave' }, t + 500);
    const r = await act(code, host, { action: 'guess', round: 0, lat: 0, lon: 0 }, t + 1000);
    expect(r.view.round?.phase).toBe('revealed');
    expect(r.view.opponent).toMatchObject({ gone: true, connected: false });
  });

  it('adversaire silencieux plus de 2 min : considéré parti', async () => {
    const t = await setup();
    const late = t + ABANDON_MS + 10_000;
    const v = await getRoom(code, host, late);
    expect(v.opponent?.gone).toBe(true);
  });
});
