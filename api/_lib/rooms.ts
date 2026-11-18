// Service des salons multijoueurs : création, lecture (polling), actions des joueurs, chat.

import {
  CHAT_KEEP,
  CHAT_MIN_INTERVAL_MS,
  COUNTDOWN_MS,
  DUEL_ROUNDS,
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  PLAYER_COLORS,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  ROOM_TTL_SECONDS,
  cleanChat,
  cleanName,
  isValidCode,
  type ChatMessage,
  type DuelAction,
  type DuelEntry,
  type DuelErrorCode,
  type JoinResponse,
  type RoomView,
} from '../../shared/duel.js';
import { cleanLook, type PlayerLook } from '../../shared/avatars.js';
import { fetchCountries, fetchCountryStations, pickCountry } from '../../shared/radio-browser.js';
import { haversineKm, roundScore } from '../../shared/scoring.js';
import type { Continent, HintKind, Station } from '../../shared/types.js';
import {
  F,
  activeIndex,
  activeStation,
  buildView,
  derive,
  effectiveHost,
  entryOf,
  hintValue,
  hintsOf,
  isGone,
  parseSnapshot,
  playerById,
  roundStart,
  type Meta,
  type PlayerRecord,
  type Snapshot,
} from './room-logic.js';
import { getStore, type Store } from './store.js';

const RB_HEADERS = { 'User-Agent': 'Radioguessr/1.0' };
const PRIMARY_PER_ROUND = 3;
const SEEN_WRITE_EVERY_MS = 3000;
const GRACE_MS = 1500; // tolérance réseau sur les délais

export class DuelError extends Error {
  constructor(
    readonly code: DuelErrorCode,
    readonly status: number,
    message: string = code,
  ) {
    super(message);
  }
}

const key = (code: string) => `room:${code}`;

// ── Identité des joueurs ───────────────────────────────────────────────────

function randomHex(bytes: number): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface Credentials {
  playerId: string | null;
  token: string | null;
}

async function playerOf(snap: Snapshot, cred: Credentials): Promise<PlayerRecord | null> {
  if (!cred.playerId || !cred.token) return null;
  const p = playerById(snap, cred.playerId);
  return p && p.tokenHash === (await sha256(cred.token)) ? p : null;
}

async function newPlayer(name: string, now: number, color: number, look: PlayerLook): Promise<{ record: PlayerRecord; token: string }> {
  const token = randomHex(16);
  return { record: { id: randomHex(8), tokenHash: await sha256(token), name, joinedAt: now, color, avatar: look.avatar, pin: look.pin }, token };
}

/** Première couleur libre (les couleurs des joueurs partis pendant l'attente sont réutilisées). */
function freeColor(snap: Snapshot): number {
  const used = new Set(snap.players.map((p) => p.color));
  for (let c = 0; c < PLAYER_COLORS.length; c++) if (!used.has(c)) return c;
  return snap.players.length % PLAYER_COLORS.length;
}

// ── Choix des stations (côté serveur : tout le salon entend les mêmes) ─────

export async function pickRoomStations(): Promise<Station[][]> {
  const countries = await fetchCountries(RB_HEADERS);
  const chosen: string[] = [];
  const perContinent: Partial<Record<Continent, number>> = {};
  const pool: typeof countries = [];
  // On tire plus de pays que de manches : certains n'auront aucune station exploitable.
  for (let k = 0; k < DUEL_ROUNDS + 5; k++) {
    const c = pickCountry(countries, { excludeCountries: chosen, continentCounts: perContinent });
    if (!c) break;
    chosen.push(c.code);
    perContinent[c.continent] = (perContinent[c.continent] ?? 0) + 1;
    pool.push(c);
  }
  const lists = await Promise.all(pool.map((c) => fetchCountryStations(c.code, 20, RB_HEADERS).catch(() => [] as Station[])));
  // MP3 d'abord : c'est le format le plus largement lisible par les navigateurs.
  const usable = lists.filter((l) => l.length > 0).map((l) => [...l].sort((a, b) => Number(b.codec === 'MP3') - Number(a.codec === 'MP3')));
  if (usable.length < DUEL_ROUNDS) throw new DuelError('stations', 503, 'Pas assez de stations disponibles');

  const primaries = usable.slice(0, DUEL_ROUNDS);
  const spares = usable.slice(DUEL_ROUNDS).flat();
  return primaries.map((list, i) => {
    const candidates = list.slice(0, PRIMARY_PER_ROUND);
    // Secours d'un autre pays, au cas où tous les flux du pays principal seraient muets.
    const extra = spares.filter((_, j) => j % DUEL_ROUNDS === i).slice(0, 2);
    return [...candidates, ...extra];
  });
}

// ── Lecture ────────────────────────────────────────────────────────────────

async function load(store: Store, code: string): Promise<Snapshot> {
  if (!isValidCode(code)) throw new DuelError('not-found', 404);
  const raw = await store.hgetall(key(code));
  const snap = raw ? parseSnapshot(raw) : null;
  if (!snap) throw new DuelError('not-found', 404);
  return snap;
}

/** Applique les écritures d'avancement (idempotentes) puis relit si besoin. */
async function loadAdvanced(store: Store, code: string, now: number): Promise<Snapshot> {
  let snap = await load(store, code);
  for (let pass = 0; pass < 3; pass++) {
    const d = derive(snap, now);
    if (d.writes.length === 0) return snap;
    for (const w of d.writes) await store.hsetnx(key(code), w.field, w.value);
    snap = await load(store, code);
  }
  return snap;
}

// ── Chat ───────────────────────────────────────────────────────────────────

async function postChat(store: Store, code: string, msg: Omit<ChatMessage, 'id'>): Promise<void> {
  const k = key(code);
  const id = await store.hincrby(k, F.chatSeq, 1);
  await store.hset(k, { [F.chat(id)]: JSON.stringify({ ...msg, id }) });
  if (id > CHAT_KEEP) await store.hdel(k, F.chat(id - CHAT_KEEP)); // on ne garde que les derniers
}

function systemMessage(text: string, now: number): Omit<ChatMessage, 'id'> {
  return { pid: null, name: '', color: 0, text, at: now, kind: 'system' };
}

// ── Opérations ─────────────────────────────────────────────────────────────

/** `lookRaw` : avatar et épingle envoyés par le client, nettoyés (valeurs inconnues → défaut). */
export async function createRoom(nameRaw: unknown, now = Date.now(), stations?: Station[][], lookRaw?: unknown): Promise<JoinResponse> {
  const name = cleanName(nameRaw);
  if (!name) throw new DuelError('bad-request', 400, 'Pseudo manquant');
  const store = getStore();
  const rounds = stations ?? (await pickRoomStations());
  const { record, token } = await newPlayer(name, now, 0, cleanLook(lookRaw));

  for (let attempt = 0; attempt < 8; attempt++) {
    let code = '';
    const bytes = new Uint8Array(ROOM_CODE_LENGTH);
    crypto.getRandomValues(bytes);
    for (const b of bytes) code += ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length];
    const meta: Meta = { code, createdAt: now, hostId: record.id, rounds };
    if (!(await store.hsetnx(key(code), F.meta, JSON.stringify(meta)))) continue; // code déjà pris
    await store.hset(key(code), { [F.player(record.id)]: JSON.stringify(record), [F.seen(record.id)]: String(now), [F.count]: '1' });
    await store.expire(key(code), ROOM_TTL_SECONDS);
    return { code, playerId: record.id, token };
  }
  throw new DuelError('server', 500, 'Impossible de générer un code');
}

export async function joinRoom(code: string, nameRaw: unknown, cred: Credentials, now = Date.now(), lookRaw?: unknown): Promise<JoinResponse> {
  const store = getStore();
  const k = key(code);
  const snap = await load(store, code);
  // Reconnexion : même joueur, même jeton (même après le lancement).
  if (await playerOf(snap, cred)) return { code, playerId: cred.playerId!, token: cred.token! };

  const name = cleanName(nameRaw);
  if (!name) throw new DuelError('bad-request', 400, 'Pseudo manquant');
  if (roundStart(snap, 0) != null) throw new DuelError('started', 409, 'Partie déjà lancée');
  // Compteur atomique : deux arrivées simultanées ne peuvent pas dépasser la limite.
  const count = await store.hincrby(k, F.count, 1);
  if (count > MAX_PLAYERS) {
    await store.hincrby(k, F.count, -1);
    throw new DuelError('full', 409, 'Salon complet');
  }
  const { record, token } = await newPlayer(name, now, freeColor(snap), cleanLook(lookRaw));
  await store.hset(k, { [F.player(record.id)]: JSON.stringify(record), [F.seen(record.id)]: String(now) });
  await postChat(store, code, systemMessage(`${name} a rejoint le salon.`, now));
  await store.expire(k, ROOM_TTL_SECONDS);
  return { code, playerId: record.id, token };
}

export async function getRoom(code: string, cred: Credentials, now = Date.now(), chatSince = 0): Promise<RoomView> {
  const store = getStore();
  const snap = await loadAdvanced(store, code, now);
  const me = await playerOf(snap, cred);
  if (!me) throw new DuelError('forbidden', 403);
  // Présence : écrite au plus toutes les 3 s pour économiser les commandes Redis.
  if (now - (snap.seen[me.id] ?? 0) >= SEEN_WRITE_EVERY_MS) {
    await store.hset(key(code), { [F.seen(me.id)]: String(now) });
    snap.seen[me.id] = now;
    await store.expire(key(code), ROOM_TTL_SECONDS);
  }
  return buildView(snap, me.id, now, chatSince);
}

export interface ActionResult {
  view: RoomView;
  /** Valeur de l'indice demandé (action « hint »). */
  hint?: string;
}

export async function act(code: string, cred: Credentials, body: DuelAction, now = Date.now(), chatSince = 0): Promise<ActionResult> {
  const store = getStore();
  const k = key(code);
  const snap = await loadAdvanced(store, code, now);
  const me = await playerOf(snap, cred);
  if (!me) throw new DuelError('forbidden', 403);
  const pid = me.id;
  const d = derive(snap, now);
  const cur = d.current;
  const listening = (round: number) =>
    d.status === 'playing' && cur != null && cur.index === round && cur.revealAt == null && now <= cur.deadline + GRACE_MS;

  let hint: string | undefined;
  switch (body.action) {
    case 'start': {
      if (d.status !== 'waiting') break; // déjà lancé : sans effet
      if (effectiveHost(snap, now) !== pid) throw new DuelError('forbidden', 403, 'Seul l’hôte peut lancer la partie');
      const present = snap.players.filter((p) => !isGone(snap, p.id, now)).length;
      if (present < MIN_PLAYERS_TO_START) throw new DuelError('bad-request', 409, 'Il faut au moins deux joueurs');
      if (await store.hsetnx(k, F.start(0), String(now + COUNTDOWN_MS))) {
        await postChat(store, code, systemMessage(`${me.name} lance la partie. Bonne écoute !`, now));
      }
      break;
    }
    case 'guess': {
      if (!listening(body.round)) throw new DuelError('bad-request', 409, 'Manche close');
      const lat = Number(body.lat);
      const lon = Number(body.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        throw new DuelError('bad-request', 400, 'Coordonnées invalides');
      }
      const station = activeStation(snap, body.round);
      const hints = hintsOf(snap, body.round, pid);
      const distanceKm = haversineKm({ lat, lon }, station);
      const entry: DuelEntry = { lat, lon, at: Math.min(now, cur!.deadline), distanceKm, hints, score: roundScore(distanceKm, hints).score };
      await store.hsetnx(k, F.entry(body.round, pid), JSON.stringify(entry)); // une seule punaise par manche
      break;
    }
    case 'hint': {
      if (!listening(body.round) || entryOf(snap, body.round, pid)) throw new DuelError('bad-request', 409, 'Indice impossible');
      if (!['language', 'continent', 'timezone'].includes(body.kind)) throw new DuelError('bad-request', 400);
      const hints = hintsOf(snap, body.round, pid);
      if (!hints.includes(body.kind)) await store.hset(k, { [F.hints(body.round, pid)]: JSON.stringify([...hints, body.kind]) });
      hint = hintValue(activeStation(snap, body.round), body.kind as HintKind, now);
      break;
    }
    case 'skip': {
      // Flux muet chez un joueur : on passe au secours suivant pour TOUT le salon, une seule fois par flux.
      const candidates = snap.meta.rounds[body.round]?.length ?? 0;
      if (listening(body.round) && activeIndex(snap, body.round) === body.from && body.from < candidates - 1) {
        if (await store.hsetnx(k, F.skip(body.round, body.from), '1')) {
          await store.hincrby(k, F.active(body.round), 1);
          // Nouveau flux : le chrono repart et les punaises posées sur l'ancien flux sont annulées.
          await store.hset(k, { [F.start(body.round)]: String(now) });
          await store.hdel(k, ...snap.players.flatMap((p) => [F.entry(body.round, p.id), F.hints(body.round, p.id)]));
        }
      }
      break;
    }
    case 'ready': {
      if (cur && cur.index === body.round && cur.revealAt != null) await store.hset(k, { [F.ready(body.round, pid)]: '1' });
      break;
    }
    case 'chat': {
      const text = cleanChat(body.text);
      if (!text) throw new DuelError('bad-request', 400, 'Message vide');
      const last = Number(snap.raw[F.chatAt(pid)] ?? 0);
      if (now - last < CHAT_MIN_INTERVAL_MS) throw new DuelError('too-fast', 429, 'Un message par seconde');
      await store.hset(k, { [F.chatAt(pid)]: String(now) });
      await postChat(store, code, { pid, name: me.name, color: me.color, text, at: now, kind: 'msg' });
      break;
    }
    case 'leave': {
      if (d.status === 'waiting') {
        // Avant le lancement : la place est libérée pour quelqu'un d'autre.
        await store.hdel(k, F.player(pid), F.seen(pid), F.chatAt(pid));
        await store.hincrby(k, F.count, -1);
      } else {
        await store.hset(k, { [F.left(pid)]: '1' });
      }
      await postChat(store, code, systemMessage(`${me.name} a quitté le salon.`, now));
      await store.expire(k, ROOM_TTL_SECONDS);
      // Le joueur n'est plus forcément dans le salon : on renvoie la vue telle qu'il l'a laissée.
      return { view: buildView(snap, pid, now, chatSince) };
    }
    case 'join':
      throw new DuelError('bad-request', 400);
  }
  await store.expire(k, ROOM_TTL_SECONDS);
  const fresh = await loadAdvanced(store, code, now);
  return { view: buildView(fresh, pid, now, chatSince), ...(hint != null ? { hint } : {}) };
}
