// Vérifie le stockage Upstash avec le VRAI SDK, configuré exactement comme en production
// (url + jeton, automaticDeserialization: false). Seul le réseau est simulé : un faux serveur REST
// répond comme Upstash (HGETALL → liste plate, entiers pour HSETNX / HINCRBY).
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createRoom, getRoom, joinRoom } from '../api/_lib/rooms';
import { createUpstashStore, pairsToRecord, setStore } from '../api/_lib/store';
import { COUNTDOWN_MS } from '../shared/duel';
import type { Station } from '../shared/types';

function fakeUpstash() {
  const db = new Map<string, Map<string, string>>();
  const h = (k: string) => {
    let m = db.get(k);
    if (!m) db.set(k, (m = new Map()));
    return m;
  };
  return {
    async request(body: unknown): Promise<{ result: unknown }> {
      const [cmd, key, ...args] = (body as (string | number)[]).map(String);
      let result: unknown;
      switch (cmd!.toLowerCase()) {
        case 'hgetall':
          result = [...(db.get(key!) ?? new Map())].flat();
          break;
        case 'hset':
          for (let i = 0; i < args.length; i += 2) h(key!).set(args[i]!, args[i + 1]!);
          result = args.length / 2;
          break;
        case 'hsetnx':
          result = h(key!).has(args[0]!) ? 0 : (h(key!).set(args[0]!, args[1]!), 1);
          break;
        case 'hincrby': {
          const v = Number(h(key!).get(args[0]!) ?? 0) + Number(args[1]);
          h(key!).set(args[0]!, String(v));
          result = v;
          break;
        }
        case 'hdel':
          result = args.filter((f) => h(key!).delete(f)).length;
          break;
        case 'expire':
          result = 1;
          break;
        default:
          throw new Error(`commande non simulée : ${cmd}`);
      }
      return { result };
    },
  };
}

const realFetch = globalThis.fetch;
afterAll(() => {
  globalThis.fetch = realFetch;
});

const ROUNDS: Station[][] = Array.from({ length: 5 }, (_, i) => [
  { id: `s${i}`, name: `R${i}`, streamUrl: `https://s/${i}`, codec: 'MP3', lat: i, lon: i, countryCode: 'FR', country: 'FR', continent: 'EU' },
]);

beforeEach(() => {
  const server = fakeUpstash();
  globalThis.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as unknown[];
    // Le SDK regroupe les commandes (auto-pipeline) : corps = liste de commandes, réponse = liste de { result }.
    const payload = Array.isArray(body[0])
      ? await Promise.all(body.map((cmd) => server.request(cmd)))
      : await server.request(body);
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  setStore(createUpstashStore('https://fake.upstash.io', 'jeton-de-test'));
});

describe('UpstashStore (format de réponse réel)', () => {
  it('convertit la liste plate de HGETALL', () => {
    expect(pairsToRecord(['a', '1', 'b', '{"x":2}'])).toEqual({ a: '1', b: '{"x":2}' });
    expect(pairsToRecord([])).toBeNull();
  });

  it('un duel complet fonctionne avec le SDK Upstash', async () => {
    const t0 = 1_800_000_000_000;
    const host = await createRoom('Alice', t0, ROUNDS);
    const hc = { playerId: host.playerId, token: host.token };
    expect((await getRoom(host.code, hc, t0)).status).toBe('waiting');
    const guest = await joinRoom(host.code, 'Bob', { playerId: null, token: null }, t0 + 1000);
    const gc = { playerId: guest.playerId, token: guest.token };
    const t = t0 + 1000 + COUNTDOWN_MS;
    expect((await getRoom(host.code, hc, t)).round?.phase).toBe('listening');
    await act(host.code, hc, { action: 'guess', round: 0, lat: 0, lon: 0 }, t + 1000);
    const r = await act(host.code, gc, { action: 'guess', round: 0, lat: 1, lon: 1 }, t + 2000);
    expect(r.view.round?.phase).toBe('revealed');
    expect(r.view.totals.opponent).toBe(5000);
  });
});
