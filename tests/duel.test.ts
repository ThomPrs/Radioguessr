import { beforeEach, describe, expect, it } from 'vitest';
import { act, createRoom, getRoom, joinRoom, type Credentials } from '../api/_lib/rooms';
import { MemoryStore, findRedisEnv, setStore } from '../api/_lib/store';
import { ABANDON_MS, CHAT_KEEP, COUNTDOWN_MS, MAX_PLAYERS, REVEAL_TIME_MS, ROUND_TIME_MS, rankPlayers } from '../shared/duel';
import type { Station } from '../shared/types';

const st = (id: string, lat: number, lon: number): Station => ({
  id, name: `Radio ${id}`, streamUrl: `https://stream/${id}`, codec: 'MP3', lat, lon, countryCode: 'FR', country: 'FR', continent: 'EU', languageCode: 'fr',
});
// 5 manches, 3 candidats chacune
const ROUNDS: Station[][] = Array.from({ length: 5 }, (_, i) => [st(`r${i}a`, 10 * i, 10 * i), st(`r${i}b`, 10 * i + 1, 10 * i), st(`r${i}c`, 10 * i + 2, 10 * i)]);
const NOBODY: Credentials = { playerId: null, token: null };
const T0 = 1_800_000_000_000;

let code: string;
let alice: Credentials;
let bob: Credentials;
let carol: Credentials;

const cred = (r: { playerId: string; token: string }): Credentials => ({ playerId: r.playerId, token: r.token });

/** Salon à 3 joueurs, lancé ; renvoie l'instant de début de la manche 1. */
async function setup3(now = T0) {
  const h = await createRoom('Alice', now, ROUNDS);
  code = h.code;
  alice = cred(h);
  bob = cred(await joinRoom(code, 'Bob', NOBODY, now + 100));
  carol = cred(await joinRoom(code, 'Carol', NOBODY, now + 200));
  await act(code, alice, { action: 'start' }, now + 1000);
  return now + 1000 + COUNTDOWN_MS;
}

beforeEach(() => setStore(new MemoryStore()));

describe('salon et lancement', () => {
  it('attente → lancement par l’hôte → compte à rebours → manche 1', async () => {
    const h = await createRoom('Alice', T0, ROUNDS);
    code = h.code;
    alice = cred(h);
    expect(code).toMatch(/^[A-Z2-9]{5}$/);
    bob = cred(await joinRoom(code, 'Bob', NOBODY, T0 + 100));
    const w = await getRoom(code, alice, T0 + 200);
    expect(w.status).toBe('waiting'); // plus de démarrage automatique
    expect(w.players.map((p) => [p.name, p.color, p.isHost])).toEqual([['Alice', 0, true], ['Bob', 1, false]]);
    await expect(act(code, bob, { action: 'start' }, T0 + 300)).rejects.toMatchObject({ code: 'forbidden' });
    await act(code, alice, { action: 'start' }, T0 + 400);
    expect((await getRoom(code, bob, T0 + 500)).status).toBe('countdown');
    const p = await getRoom(code, bob, T0 + 400 + COUNTDOWN_MS);
    expect(p.round).toMatchObject({ index: 0, phase: 'listening', streamUrl: 'https://stream/r0a', station: null, entries: null });
  });

  it('impossible de lancer seul', async () => {
    const h = await createRoom('Alice', T0, ROUNDS);
    await expect(act(h.code, cred(h), { action: 'start' }, T0 + 1)).rejects.toMatchObject({ code: 'bad-request' });
  });

  it('8 joueurs maximum, puis « complet »', async () => {
    const h = await createRoom('J1', T0, ROUNDS);
    for (let n = 2; n <= MAX_PLAYERS; n++) await joinRoom(h.code, `J${n}`, NOBODY, T0 + n);
    await expect(joinRoom(h.code, 'J9', NOBODY, T0 + 99)).rejects.toMatchObject({ code: 'full' });
    const v = await getRoom(h.code, cred(h), T0 + 100);
    expect(v.players).toHaveLength(MAX_PLAYERS);
    expect(new Set(v.players.map((p) => p.color)).size).toBe(MAX_PLAYERS); // couleurs toutes différentes
  });

  it('refuse une arrivée après le lancement, accepte la reconnexion', async () => {
    await setup3();
    await expect(joinRoom(code, 'Dave', NOBODY)).rejects.toMatchObject({ code: 'started' });
    expect((await joinRoom(code, 'peu importe', bob)).playerId).toBe(bob.playerId);
  });

  it('salon introuvable, jeton invalide', async () => {
    await expect(getRoom('ZZZZZ', { playerId: 'x', token: 'y' })).rejects.toMatchObject({ code: 'not-found' });
    await setup3();
    await expect(getRoom(code, { playerId: alice.playerId, token: 'mauvais' })).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('départ de l’hôte pendant l’attente : l’hôte passe au suivant, la place se libère', async () => {
    const h = await createRoom('Alice', T0, ROUNDS);
    code = h.code;
    bob = cred(await joinRoom(code, 'Bob', NOBODY, T0 + 100));
    carol = cred(await joinRoom(code, 'Carol', NOBODY, T0 + 200));
    await act(code, cred(h), { action: 'leave' }, T0 + 300);
    const v = await getRoom(code, bob, T0 + 400);
    expect(v.players.map((p) => p.name)).toEqual(['Bob', 'Carol']);
    expect(v.hostId).toBe(bob.playerId);
    await act(code, bob, { action: 'start' }, T0 + 500); // le nouvel hôte peut lancer
    expect((await getRoom(code, carol, T0 + 600)).status).toBe('countdown');
  });
});

describe('manche à 3', () => {
  it('révélation seulement quand tous ont répondu ; punaises secrètes avant', async () => {
    const t = await setup3();
    await act(code, alice, { action: 'guess', round: 0, lat: 0.5, lon: 0 }, t + 1000);
    await act(code, bob, { action: 'guess', round: 0, lat: 3, lon: 0 }, t + 2000);
    const c = await getRoom(code, carol, t + 3000);
    expect(c.round?.phase).toBe('listening');
    expect(c.round?.entries).toBeNull();
    expect(c.players.filter((p) => p.guessed).map((p) => p.name)).toEqual(['Alice', 'Bob']);
    const r = await act(code, carol, { action: 'guess', round: 0, lat: 9, lon: 0 }, t + 4000);
    expect(r.view.round?.phase).toBe('revealed');
    expect(Object.keys(r.view.round!.entries!)).toHaveLength(3);
    expect(rankPlayers(r.view.players).map(({ player, rank }) => `${rank}:${player.name}`)).toEqual(['1:Alice', '2:Bob', '3:Carol']);
  });

  it('après 90 s : révélation, 0 point pour ceux qui n’ont rien envoyé', async () => {
    const t = await setup3();
    await act(code, alice, { action: 'guess', round: 0, lat: 0, lon: 0 }, t + 1000);
    const after = await getRoom(code, alice, t + ROUND_TIME_MS + 10);
    expect(after.round?.phase).toBe('revealed');
    expect(after.round?.entries?.[bob.playerId!]).toMatchObject({ lat: null, score: 0 });
  });

  it('flux muet : secours suivant pour tout le salon, punaises annulées', async () => {
    const t = await setup3();
    await act(code, alice, { action: 'guess', round: 0, lat: 0, lon: 0 }, t + 2000);
    await act(code, bob, { action: 'skip', round: 0, from: 0 }, t + 8000);
    await act(code, carol, { action: 'skip', round: 0, from: 0 }, t + 8100); // doublon ignoré
    const v = await getRoom(code, alice, t + 9000);
    expect(v.round).toMatchObject({ candidate: 1, streamUrl: 'https://stream/r0b', startAt: t + 8000 });
    expect(v.round?.you.guessed).toBe(false);
  });

  it('un joueur parti ne bloque pas les autres', async () => {
    const t = await setup3();
    await act(code, carol, { action: 'leave' }, t + 500);
    await act(code, alice, { action: 'guess', round: 0, lat: 0, lon: 0 }, t + 1000);
    const r = await act(code, bob, { action: 'guess', round: 0, lat: 0, lon: 0 }, t + 1500);
    expect(r.view.round?.phase).toBe('revealed');
    expect(r.view.players.find((p) => p.name === 'Carol')).toMatchObject({ gone: true });
  });

  it('joueur silencieux plus de 2 min : considéré parti', async () => {
    const t = await setup3();
    const v = await getRoom(code, alice, t + ABANDON_MS + 10_000);
    expect(v.players.find((p) => p.name === 'Bob')?.gone).toBe(true);
  });
});

describe('partie complète', () => {
  it('5 manches avec « prêt », classement final', async () => {
    let t = await setup3();
    for (let i = 0; i < 5; i++) {
      expect((await getRoom(code, alice, t)).round?.index).toBe(i);
      await act(code, alice, { action: 'guess', round: i, lat: 10 * i, lon: 10 * i }, t + 1000);
      await act(code, bob, { action: 'guess', round: i, lat: 10 * i + 5, lon: 10 * i }, t + 1100);
      await act(code, carol, { action: 'guess', round: i, lat: 10 * i + 20, lon: 10 * i }, t + 1200);
      for (const c of [alice, bob, carol]) await act(code, c, { action: 'ready', round: i }, t + 2000);
      t += 3000;
    }
    const end = await getRoom(code, carol, t);
    expect(end.status).toBe('finished');
    expect(end.history).toHaveLength(5);
    const ranking = rankPlayers(end.players);
    expect(ranking[0]).toMatchObject({ rank: 1, player: { name: 'Alice', total: 25000 } });
    expect(ranking.map((r) => r.player.name)).toEqual(['Alice', 'Bob', 'Carol']);
  });

  it('passage automatique après la révélation', async () => {
    const t = await setup3();
    for (const c of [alice, bob, carol]) await act(code, c, { action: 'guess', round: 0, lat: 0, lon: 0 }, t + 1000);
    const v = await getRoom(code, alice, t + 1000 + REVEAL_TIME_MS + 1);
    expect(v.round).toMatchObject({ index: 1, phase: 'listening' });
  });
});

describe('chat', () => {
  it('messages, messages système, ?chat= ne renvoie que les nouveaux', async () => {
    const h = await createRoom('Alice', T0, ROUNDS);
    code = h.code;
    alice = cred(h);
    bob = cred(await joinRoom(code, 'Bob', NOBODY, T0 + 100)); // message système n°1
    await act(code, alice, { action: 'chat', text: '  Salut   Bob !  ' }, T0 + 2000);
    const v = await getRoom(code, bob, T0 + 2100);
    expect(v.chat.map((m) => [m.kind, m.name, m.text])).toEqual([
      ['system', '', 'Bob a rejoint le salon.'],
      ['msg', 'Alice', 'Salut Bob !'],
    ]);
    const since = v.chat.at(-1)!.id;
    await act(code, bob, { action: 'chat', text: '73 !' }, T0 + 2200);
    const v2 = await getRoom(code, alice, T0 + 2300, since);
    expect(v2.chat.map((m) => m.text)).toEqual(['73 !']);
    expect(v2.chat[0]).toMatchObject({ pid: bob.playerId, color: 1 });
  });

  it('anti-spam, message vide, longueur maximale', async () => {
    const h = await createRoom('Alice', T0, ROUNDS);
    alice = cred(h);
    await act(h.code, alice, { action: 'chat', text: 'un' }, T0 + 1000);
    await expect(act(h.code, alice, { action: 'chat', text: 'deux' }, T0 + 1500)).rejects.toMatchObject({ code: 'too-fast' });
    await expect(act(h.code, alice, { action: 'chat', text: '   ' }, T0 + 3000)).rejects.toMatchObject({ code: 'bad-request' });
    const r = await act(h.code, alice, { action: 'chat', text: 'x'.repeat(500) }, T0 + 5000);
    expect(r.view.chat.at(-1)!.text).toHaveLength(200);
  });

  it(`ne garde que les ${CHAT_KEEP} derniers messages`, async () => {
    const h = await createRoom('Alice', T0, ROUNDS);
    alice = cred(h);
    for (let n = 1; n <= CHAT_KEEP + 5; n++) await act(h.code, alice, { action: 'chat', text: `m${n}` }, T0 + n * 2000);
    const v = await getRoom(h.code, alice, T0 + 999_999);
    expect(v.chat).toHaveLength(CHAT_KEEP);
    expect(v.chat[0]!.text).toBe('m6');
  });
});

describe('variables Upstash', () => {
  it('trouve les accès quel que soit le préfixe', () => {
    expect(findRedisEnv({ KV_REST_API_URL: 'https://a.upstash.io', KV_REST_API_TOKEN: 't' })?.name).toBe('KV_REST_API_URL');
    expect(findRedisEnv({ STORAGE_KV_REST_API_URL: 'https://b.upstash.io', STORAGE_KV_REST_API_TOKEN: 't' })?.url).toBe('https://b.upstash.io');
    expect(findRedisEnv({ UPSTASH_REDIS_REST_URL: 'https://c.upstash.io', UPSTASH_REDIS_REST_TOKEN: 't' })?.url).toBe('https://c.upstash.io');
    expect(findRedisEnv({ KV_REST_API_URL: 'https://a.upstash.io' })).toBeNull();
    expect(findRedisEnv({ REDIS_URL: 'rediss://x' })).toBeNull();
  });
});

describe('apparence des joueurs', () => {
  it('avatar et épingle visibles des autres, valeurs inconnues remplacées', async () => {
    const h = await createRoom('Alice', T0, ROUNDS, { avatar: { face: 'chat', bg: 2 }, pin: 'perle-nacre' });
    const b = await joinRoom(h.code, 'Bob', NOBODY, T0 + 100, { avatar: { face: 'dragon', bg: 42 }, pin: 'fausse' });
    const v = await getRoom(h.code, cred(b), T0 + 200);
    expect(v.players.map((p) => [p.name, p.avatar, p.pin])).toEqual([
      ['Alice', { face: 'chat', bg: 2 }, 'perle-nacre'],
      ['Bob', { face: 'operatrice', bg: 0 }, 'punaise'],
    ]);
  });
});

import { NEWS_INTRO_MS, NEWS_LISTEN_MS, NEWS_REVEAL_MS } from '../shared/blindtest';
import { setMusicProvider, type TrackWithPreview } from '../api/_lib/music';

describe('Breaking News', () => {
  const T = (id: number, title: string, artist: string, artistId: number): TrackWithPreview => ({
    id, title, titleShort: title, artist, artistId, cover: '', preview: `https://preview/${id}`,
  });
  const TRACKS: Record<number, TrackWithPreview> = {
    100: T(100, 'Alors on danse (Radio Edit)', 'Stromae', 1),
    101: T(101, 'Alors On Danse', 'Stromae', 1),
    102: T(102, 'Papaoutai', 'Stromae', 1),
    200: T(200, 'Footloose', 'Kenny Loggins', 2),
  };
  let store: MemoryStore;
  beforeEach(() => {
    store = new MemoryStore();
    setStore(store);
    setMusicProvider({ pool: async () => [{ id: 100, fr: true }], track: async (id) => TRACKS[id] ?? null, search: async () => [] });
  });

  /** Salon à 2 avec l'option, Breaking News forcée après la manche 1 ; renvoie le début de la manche 1. */
  async function setupNews(now = T0) {
    const h = await createRoom('Alice', now, ROUNDS);
    code = h.code;
    alice = cred(h);
    bob = cred(await joinRoom(code, 'Bob', NOBODY, now + 100));
    await expect(act(code, bob, { action: 'options', breakingNews: true }, now + 200)).rejects.toMatchObject({ code: 'forbidden' });
    const o = await act(code, alice, { action: 'options', breakingNews: true }, now + 300);
    expect(o.view.breakingNews).toBe(true);
    await act(code, alice, { action: 'start' }, now + 1000);
    await store.hset(`room:${code}`, { 'news:after': '0' }); // déterministe pour le test
    await expect(act(code, alice, { action: 'options', breakingNews: false }, now + 1500)).rejects.toMatchObject({ code: 'started' });
    return now + 1000 + COUNTDOWN_MS;
  }

  async function finishRound0(t: number) {
    await act(code, alice, { action: 'guess', round: 0, lat: 0, lon: 0 }, t + 1000);
    await act(code, bob, { action: 'guess', round: 0, lat: 0, lon: 0 }, t + 1000);
    await act(code, alice, { action: 'ready', round: 0 }, t + 2000);
    return (await act(code, bob, { action: 'ready', round: 0 }, t + 2000)).view;
  }

  it('flash → écoute → réponses → révélation → manche suivante, points ajoutés', async () => {
    const t = await setupNews();
    const v = await finishRound0(t);
    expect(v.status).toBe('news');
    expect(v.news).toMatchObject({ phase: 'intro', trackId: 100, reveal: null });
    const listenAt = v.news!.listenAt;
    await expect(act(code, alice, { action: 'news-answer', guessId: 101 }, listenAt - 500)).rejects.toMatchObject({ code: 'bad-request' });

    const a = await act(code, alice, { action: 'news-answer', guessId: 101 }, listenAt + 3000); // bonne chanson, autre version
    expect(a.view.news).toMatchObject({ phase: 'listen', you: { answered: true }, reveal: null });
    expect(a.view.news!.answered[bob.playerId!]).toBe(false);
    await act(code, alice, { action: 'news-answer', guessId: 200 }, listenAt + 4000); // seconde réponse ignorée

    const b = await act(code, bob, { action: 'news-answer', guessId: 102 }, listenAt + 6000); // bon artiste seulement
    expect(b.view.news?.phase).toBe('reveal');
    expect(b.view.news!.reveal!.answer?.title).toBe('Alors on danse (Radio Edit)');
    const entries = b.view.news!.reveal!.entries;
    expect(entries[alice.playerId!]).toMatchObject({ verdict: 'song', score: 4850 }); // 3 500 + 1 500 × 0,9
    expect(entries[bob.playerId!]).toMatchObject({ verdict: 'artist', score: 1500, guessLabel: 'Papaoutai — Stromae' });
    const totalAlice = b.view.players.find((p) => p.name === 'Alice')!.total;

    await act(code, alice, { action: 'news-ready' }, listenAt + 7000);
    const next = await act(code, bob, { action: 'news-ready' }, listenAt + 7000);
    expect(next.view.status).toBe('playing');
    expect(next.view.round).toMatchObject({ index: 1, phase: 'listening' });
    expect(next.view.newsResult?.entries[alice.playerId!]?.score).toBe(4850);
    expect(next.view.players.find((p) => p.name === 'Alice')!.total).toBe(totalAlice); // points conservés
  });

  it('sans réponse : révélation au bout de 30 s, puis reprise automatique', async () => {
    const t = await setupNews();
    const v = await finishRound0(t);
    const listenAt = v.news!.listenAt;
    expect((await getRoom(code, alice, listenAt + NEWS_LISTEN_MS - 100)).news?.phase).toBe('listen');
    const r = await getRoom(code, alice, listenAt + NEWS_LISTEN_MS + 10);
    expect(r.news?.phase).toBe('reveal');
    expect(r.news!.reveal!.answer?.artist).toBe('Stromae'); // morceau récupéré même sans réponse
    const after = await getRoom(code, alice, listenAt + NEWS_LISTEN_MS + NEWS_REVEAL_MS + 20);
    expect(after.round).toMatchObject({ index: 1, phase: 'listening' });
    expect(NEWS_INTRO_MS).toBeGreaterThan(0);
  });

  it('option désactivée : pas de Breaking News', async () => {
    const h = await createRoom('Alice', T0, ROUNDS);
    code = h.code;
    alice = cred(h);
    bob = cred(await joinRoom(code, 'Bob', NOBODY, T0 + 100));
    await act(code, alice, { action: 'start' }, T0 + 1000);
    const t = T0 + 1000 + COUNTDOWN_MS;
    const v = await finishRound0(t);
    expect(v.status).toBe('playing');
    expect(v.round?.index).toBe(1);
  });
});

describe('jokers', () => {
  /** Salon à 3 avec des mains choisies et jokers activés ; renvoie le début de la manche 1. */
  async function setupJokers(hands: [string[], string[], string[]], enabled = true, now = T0) {
    const h = await createRoom('Alice', now, ROUNDS, { hand: hands[0] });
    code = h.code;
    alice = cred(h);
    bob = cred(await joinRoom(code, 'Bob', NOBODY, now + 100, { hand: hands[1] }));
    carol = cred(await joinRoom(code, 'Carol', NOBODY, now + 200, { hand: hands[2] }));
    if (enabled) await act(code, alice, { action: 'options', jokers: true }, now + 300);
    await act(code, alice, { action: 'start' }, now + 1000);
    return now + 1000 + COUNTDOWN_MS;
  }
  const play = (who: Credentials, id: string, at: number, extra: { target?: string; lat?: number; lon?: number; round?: number } = {}) =>
    act(code, who, { action: 'joker', round: extra.round ?? 0, id, ...extra }, at);

  it('option de l’hôte, main nettoyée, refus si désactivés', async () => {
    const t = await setupJokers([['double', 'double', 'bidon', 'radar'], [], []], false);
    const v = await getRoom(code, alice, t + 10);
    expect(v.jokersEnabled).toBe(false);
    expect(v.myJokers.hand).toEqual(['double', 'radar']);
    await expect(play(alice, 'double', t + 20)).rejects.toMatchObject({ message: 'Jokers désactivés dans ce salon' });
  });

  it('vérifications : main, une fois par partie, cible, épingle validée', async () => {
    const t = await setupJokers([['double', 'brouilleur'], ['bouclier'], []]);
    await expect(play(alice, 'radar', t + 10)).rejects.toMatchObject({ message: 'Ce joker n’est pas dans votre main' });
    await expect(play(alice, 'brouilleur', t + 20)).rejects.toMatchObject({ message: 'Cible invalide' });
    await expect(play(alice, 'brouilleur', t + 30, { target: alice.playerId! })).rejects.toMatchObject({ message: 'Cible invalide' });
    await play(alice, 'double', t + 40);
    await expect(play(alice, 'double', t + 50)).rejects.toMatchObject({ message: 'Joker déjà joué dans cette partie' });
    const v = await getRoom(code, alice, t + 60);
    expect(v.myJokers.used).toEqual(['double']);
    expect(v.chat.at(-1)?.text).toBe('Alice joue « Double fréquence ».');
  });

  it('Double fréquence et Indices offerts comptent dans le score', async () => {
    const t = await setupJokers([['double', 'indices'], [], []]);
    await play(alice, 'double', t + 10);
    await play(alice, 'indices', t + 20);
    await act(code, alice, { action: 'hint', round: 0, kind: 'continent' }, t + 30);
    const r = await act(code, alice, { action: 'guess', round: 0, lat: 0, lon: 0 }, t + 40);
    expect(r.view.round?.you.entry?.score).toBe(10_000); // 5 000 sans indice payé, ×2
  });

  it('Antenne longue : 30 s de plus pour moi, la manche attend', async () => {
    const t = await setupJokers([['antenne'], [], []]);
    await play(alice, 'antenne', t + 10);
    await act(code, bob, { action: 'guess', round: 0, lat: 0, lon: 0 }, t + 20);
    await act(code, carol, { action: 'guess', round: 0, lat: 0, lon: 0 }, t + 30);
    const mid = await getRoom(code, alice, t + ROUND_TIME_MS + 10_000);
    expect(mid.round).toMatchObject({ phase: 'listening' });
    expect(mid.round?.you.deadline).toBe(t + ROUND_TIME_MS + 30_000);
    // Bob a déjà répondu ; un joueur sans Antenne ne peut plus envoyer après ses 90 s.
    const r = await act(code, alice, { action: 'guess', round: 0, lat: 1, lon: 0 }, t + ROUND_TIME_MS + 20_000);
    expect(r.view.round?.phase).toBe('revealed');
  });

  it('Brouilleur visible chez la victime ; Bouclier arrête la première attaque', async () => {
    const t = await setupJokers([['brouilleur', 'pickpocket'], ['bouclier'], []]);
    await play(alice, 'brouilleur', t + 1000, { target: carol.playerId! });
    const c = await getRoom(code, carol, t + 2000);
    expect(c.round?.you.jokers.attacks).toEqual([{ id: 'brouilleur', from: alice.playerId, until: t + 1000 + 10_000 }]);
    await play(bob, 'bouclier', t + 3000);
    await play(alice, 'pickpocket', t + 4000, { target: bob.playerId! });
    const b = await getRoom(code, bob, t + 5000);
    expect(b.round?.you.jokers.attacks).toEqual([]);
    expect(b.chat.at(-1)?.text).toBe('Alice joue « Pickpocket » sur Bob. Le Bouclier de Bob l’arrête !');
  });

  it('Pickpocket : 500 points passent de la cible au voleur', async () => {
    const t = await setupJokers([['pickpocket'], [], []]);
    await play(alice, 'pickpocket', t + 10, { target: bob.playerId! });
    await act(code, alice, { action: 'guess', round: 0, lat: 40, lon: 40 }, t + 20); // loin : peu de points
    await act(code, bob, { action: 'guess', round: 0, lat: 0, lon: 0 }, t + 30); // 5 000
    const r = await act(code, carol, { action: 'guess', round: 0, lat: 0, lon: 0 }, t + 40);
    const total = (pid: string) => r.view.players.find((p) => p.id === pid)!.total;
    const base = r.view.round!.entries!;
    expect(total(bob.playerId!)).toBe(base[bob.playerId!]!.score - 500);
    expect(total(alice.playerId!)).toBe(base[alice.playerId!]!.score + 500);
    expect(r.view.history[0]?.plays).toEqual([{ pid: alice.playerId, id: 'pickpocket', target: bob.playerId, blocked: false, points: 500 }]);
  });

  it('Taxe : le prochain indice de la cible coûte double, même dans une manche suivante', async () => {
    const t = await setupJokers([['taxe'], [], []]);
    await play(alice, 'taxe', t + 10, { target: bob.playerId! });
    await act(code, bob, { action: 'hint', round: 0, kind: 'language' }, t + 20);
    await act(code, bob, { action: 'hint', round: 0, kind: 'continent' }, t + 30); // seul le premier est taxé
    const r = await act(code, bob, { action: 'guess', round: 0, lat: 0, lon: 0 }, t + 40);
    expect(r.view.round?.you.entry?.score).toBe(5000 - 500 * 2 - 1000);
  });

  it('Radar, Seconde écoute, Espion : informations pour moi seul', async () => {
    const t = await setupJokers([['radar', 'espion'], ['seconde'], []]);
    await play(alice, 'radar', t + 10);
    await play(alice, 'espion', t + 20, { target: carol.playerId! });
    await expect(play(bob, 'seconde', t + 30)).rejects.toMatchObject({ message: 'Posez d’abord votre épingle' });
    await play(bob, 'seconde', t + 40, { lat: 0, lon: 1 });
    await act(code, carol, { action: 'guess', round: 0, lat: 7, lon: 8 }, t + 50);
    const a = await getRoom(code, alice, t + 60);
    expect(a.round?.you.jokers.radar).not.toBeNull();
    expect(a.round?.you.jokers.spied).toEqual({ pid: carol.playerId, lat: 7, lon: 8 });
    const b = await getRoom(code, bob, t + 70);
    expect(b.round?.you.jokers.probeKm).toBeCloseTo(111, 0);
    expect(b.round?.you.jokers.radar).toBeNull();
  });
});
