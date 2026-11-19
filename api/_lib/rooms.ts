// Service des salons multijoueurs : création, lecture (polling), actions des joueurs, chat.

import {
  CHAT_KEEP,
  CHAT_MIN_INTERVAL_MS,
  COUNTDOWN_MS,
  DUEL_ROUNDS,
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  PLAYER_COLORS,
  REACTIONS,
  REACTION_MIN_INTERVAL_MS,
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
import { pickNewsSlot, type NewsAnswer } from '../../shared/blindtest.js';
import { checkGuess, music, pickTrack } from './music.js';
import { fetchCountries, fetchCountryStations, pickCountry } from '../../shared/radio-browser.js';
import { haversineKm } from '../../shared/scoring.js';
import { canPlay, cleanHand, jokerById, scoreWithJokers, type JokerId, type PlayRefusal } from '../../shared/jokers.js';
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
  newsAnswerOf,
  newsInfo,
  newsPlan,
  handOf,
  jokerPlays,
  jokersEnabled,
  personalDeadline,
  scoreMods,
  type JokerPlay,
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

async function newPlayer(name: string, now: number, color: number, look: PlayerLook, hand: JokerId[] = []): Promise<{ record: PlayerRecord; token: string; photo: string | null }> {
  const token = randomHex(16);
  // La photo n'est pas dans la fiche (lue à chaque rafraîchissement) : elle est rangée à part.
  const { photo, usePhoto, ...rest } = look.avatar;
  const shown = photo && usePhoto ? photo : null;
  const avatar = { ...rest, ...(shown ? { hasPhoto: true } : {}) };
  return { record: { id: randomHex(8), tokenHash: await sha256(token), name, joinedAt: now, color, avatar, pin: look.pin, hand }, token, photo: shown };
}

const photosKey = (code: string) => `room:${code}:photos`;

async function savePhoto(store: Store, code: string, pid: string, photo: string | null): Promise<void> {
  if (!photo) return;
  await store.hset(photosKey(code), { [pid]: photo });
  await store.expire(photosKey(code), ROOM_TTL_SECONDS);
}

/** Photos des joueurs du salon (demandées une fois, puis gardées en cache par le navigateur). */
export async function getPhotos(code: string, cred: Credentials): Promise<{ photos: Record<string, string> }> {
  const store = getStore();
  const snap = await load(store, code);
  if (!(await playerOf(snap, cred))) throw new DuelError('forbidden', 403);
  const all = (await store.hgetall(photosKey(code))) ?? {};
  // Seulement les joueurs encore dans le salon.
  const photos = Object.fromEntries(Object.entries(all).filter(([pid]) => snap.players.some((p) => p.id === pid)));
  return { photos };
}

/** Main de jokers reçue d'un client (la possession des cartes n'est pas vérifiable : comme l'épingle). */
function handFrom(lookRaw: unknown): JokerId[] {
  return cleanHand((lookRaw as { hand?: unknown } | undefined)?.hand);
}

const REFUSAL: Record<PlayRefusal, string> = {
  disabled: 'Jokers désactivés dans ce salon',
  unknown: 'Joker inconnu',
  'not-in-hand': 'Ce joker n’est pas dans votre main',
  used: 'Joker déjà joué dans cette partie',
  solo: 'Joker réservé au multijoueur',
  closed: 'Manche close',
  guessed: 'Épingle déjà validée',
  'no-pin': 'Posez d’abord votre épingle',
  target: 'Cible invalide',
};

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
    // Révélation de la Breaking News : titre, artiste et pochette du morceau (une seule fois).
    const plan = newsPlan(snap);
    if (plan && !newsInfo(snap) && (d.newsDone || d.news?.phase === 'reveal')) {
      const t = await music().track(plan.trackId).catch(() => null);
      if (t) {
        const { preview: _p, ...info } = t;
        d.writes.push({ field: F.newsInfo, value: JSON.stringify(info) });
      }
    }
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

/** Choix des stations d'un nouveau salon (remplaçable dans les tests). */
let stationPicker: () => Promise<Station[][]> = () => pickRoomStations();
export function setStationPicker(fn: () => Promise<Station[][]>): void {
  stationPicker = fn;
}

/** Ouvre un salon sous un code libre, avec ses joueurs et ses champs de départ ; renvoie le code. */
async function openRoom(
  store: Store,
  now: number,
  rounds: Station[][],
  hostId: string,
  players: PlayerRecord[],
  extra: Record<string, string> = {},
): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    let code = '';
    const bytes = new Uint8Array(ROOM_CODE_LENGTH);
    crypto.getRandomValues(bytes);
    for (const b of bytes) code += ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length];
    const meta: Meta = { code, createdAt: now, hostId, rounds };
    if (!(await store.hsetnx(key(code), F.meta, JSON.stringify(meta)))) continue; // code déjà pris
    const fields: Record<string, string> = { [F.count]: String(players.length), ...extra };
    for (const p of players) {
      fields[F.player(p.id)] = JSON.stringify(p);
      fields[F.seen(p.id)] = String(now);
    }
    await store.hset(key(code), fields);
    await store.expire(key(code), ROOM_TTL_SECONDS);
    return code;
  }
  throw new DuelError('server', 500, 'Impossible de générer un code');
}

/** `lookRaw` : avatar et épingle envoyés par le client, nettoyés (valeurs inconnues → défaut). */
export async function createRoom(nameRaw: unknown, now = Date.now(), stations?: Station[][], lookRaw?: unknown): Promise<JoinResponse> {
  const name = cleanName(nameRaw);
  if (!name) throw new DuelError('bad-request', 400, 'Pseudo manquant');
  const store = getStore();
  const rounds = stations ?? (await stationPicker());
  const { record, token, photo } = await newPlayer(name, now, 0, cleanLook(lookRaw), handFrom(lookRaw));
  const code = await openRoom(store, now, rounds, record.id, [record]);
  await savePhoto(store, code, record.id, photo);
  return { code, playerId: record.id, token };
}

/**
 * Revanche : nouveau salon (nouvelles stations, mêmes options) où les joueurs encore là sont recopiés
 * avec la même identité (même jeton) : personne n'a de code à saisir. Un seul salon même si
 * plusieurs joueurs cliquent en même temps (verrou HSETNX).
 */
async function createRematch(store: Store, snap: Snapshot, me: PlayerRecord, now: number): Promise<void> {
  const k = key(snap.meta.code);
  if (snap.raw[F.rematch] || !(await store.hsetnx(k, F.rematchLock, me.id))) return; // déjà lancée
  try {
    const rounds = await stationPicker();
    const players = snap.players.filter((p) => !isGone(snap, p.id, now));
    const hostId = players.some((p) => p.id === snap.meta.hostId) ? snap.meta.hostId : me.id;
    const extra: Record<string, string> = {};
    for (const f of [F.newsOpt, F.jokersOpt]) if (snap.raw[f]) extra[f] = snap.raw[f]!;
    const code = await openRoom(store, now, rounds, hostId, players, extra);
    const photos = await store.hgetall(photosKey(snap.meta.code));
    const kept = Object.fromEntries(Object.entries(photos ?? {}).filter(([pid]) => players.some((p) => p.id === pid)));
    if (Object.keys(kept).length) {
      await store.hset(photosKey(code), kept);
      await store.expire(photosKey(code), ROOM_TTL_SECONDS);
    }
    await store.hset(k, { [F.rematch]: JSON.stringify({ code, by: me.id }) });
    await postChat(store, snap.meta.code, systemMessage(`${me.name} propose une revanche !`, now));
  } catch (err) {
    await store.hdel(k, F.rematchLock); // échec (stations introuvables…) : on pourra réessayer
    throw err;
  }
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
  const { record, token, photo } = await newPlayer(name, now, freeColor(snap), cleanLook(lookRaw), handFrom(lookRaw));
  await store.hset(k, { [F.player(record.id)]: JSON.stringify(record), [F.seen(record.id)]: String(now) });
  await savePhoto(store, code, record.id, photo);
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
  // Écoute ouverte pour moi : mon chrono personnel compte (Antenne longue).
  const listening = (round: number) =>
    d.status === 'playing' && cur != null && cur.index === round && cur.revealAt == null && now <= personalDeadline(snap, round, pid, cur.start) + GRACE_MS;

  let hint: string | undefined;
  switch (body.action) {
    case 'start': {
      if (d.status !== 'waiting') break; // déjà lancé : sans effet
      if (effectiveHost(snap, now) !== pid) throw new DuelError('forbidden', 403, 'Seul l’hôte peut lancer la partie');
      const present = snap.players.filter((p) => !isGone(snap, p.id, now)).length;
      if (present < MIN_PLAYERS_TO_START) throw new DuelError('bad-request', 409, 'Il faut au moins deux joueurs');
      // Breaking News : manche et morceau tirés au lancement (si Deezer ne répond pas, on joue sans).
      if (snap.raw[F.newsOpt] === '1' && !snap.raw[F.newsTrack]) {
        const trackId = await pickTrack().catch(() => null);
        if (trackId) await store.hset(k, { [F.newsAfter]: String(pickNewsSlot()), [F.newsTrack]: String(trackId) });
      }
      if (await store.hsetnx(k, F.start(0), String(now + COUNTDOWN_MS))) {
        await postChat(store, code, systemMessage(`${me.name} lance la partie. Bonne écoute !`, now));
      }
      break;
    }
    case 'options': {
      if (d.status !== 'waiting') throw new DuelError('started', 409, 'Partie déjà lancée');
      if (effectiveHost(snap, now) !== pid) throw new DuelError('forbidden', 403, 'Seul l’hôte règle les options');
      const opts: Record<string, string> = {};
      if (body.breakingNews !== undefined) opts[F.newsOpt] = body.breakingNews ? '1' : '0';
      if (body.jokers !== undefined) opts[F.jokersOpt] = body.jokers ? '1' : '0';
      if (Object.keys(opts).length) await store.hset(k, opts);
      break;
    }
    case 'news-answer': {
      const n = d.news;
      if (d.status !== 'news' || n?.phase !== 'listen' || now > n.deadline + GRACE_MS) throw new DuelError('bad-request', 409, 'Breaking News close');
      if (newsAnswerOf(snap, pid)) break; // une seule réponse
      const guessId = Number(body.guessId);
      if (!Number.isInteger(guessId) || guessId <= 0) throw new DuelError('bad-request', 400, 'Réponse invalide');
      const plan = newsPlan(snap)!;
      const res = await checkGuess(plan.trackId, guessId, Math.max(0, now - n.listenAt));
      const at = Math.min(now, n.deadline);
      const entry: NewsAnswer = {
        guessId,
        guessLabel: res.guess ? `${res.guess.title} — ${res.guess.artist}` : '',
        at,
        verdict: res.verdict,
        score: res.score,
      };
      await store.hsetnx(k, F.newsAns(pid), JSON.stringify(entry));
      await store.hsetnx(k, F.newsInfo, JSON.stringify(res.answer));
      break;
    }
    case 'news-ready': {
      if (d.news?.phase === 'reveal') await store.hset(k, { [F.newsReady(pid)]: '1' });
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
      const myEnd = personalDeadline(snap, body.round, pid, cur!.start);
      const entry: DuelEntry = { lat, lon, at: Math.min(now, myEnd), distanceKm, hints, score: scoreWithJokers(distanceKm, hints, scoreMods(snap, body.round, pid)).score };
      await store.hsetnx(k, F.entry(body.round, pid), JSON.stringify(entry)); // une seule punaise par manche
      break;
    }
    case 'hint': {
      if (!listening(body.round) || entryOf(snap, body.round, pid)) throw new DuelError('bad-request', 409, 'Indice impossible');
      if (!['language', 'continent', 'timezone'].includes(body.kind)) throw new DuelError('bad-request', 400);
      const hints = hintsOf(snap, body.round, pid);
      if (!hints.includes(body.kind)) {
        await store.hset(k, { [F.hints(body.round, pid)]: JSON.stringify([...hints, body.kind]) });
        // Taxe reçue : cet indice compte double (une Taxe pour un indice).
        if (Number(snap.raw[F.taxPending(pid)] ?? 0) > 0 && !snap.raw[F.taxed(body.round, pid)]) {
          if (await store.hsetnx(k, F.taxed(body.round, pid), body.kind)) await store.hincrby(k, F.taxPending(pid), -1);
        }
      }
      hint = hintValue(activeStation(snap, body.round), body.kind as HintKind, now);
      break;
    }
    case 'joker': {
      const j = jokerById(body.id);
      const i = Number(body.round);
      const target = typeof body.target === 'string' ? body.target : null;
      const opponents = snap.players.filter((p) => p.id !== pid && !isGone(snap, p.id, now)).map((p) => p.id);
      const plays = jokerPlays(snap);
      const lat = Number(body.lat);
      const lon = Number(body.lon);
      const hasPin = body.lat != null && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
      const verdict = canPlay(String(body.id), {
        mode: 'duel',
        enabled: jokersEnabled(snap),
        hand: handOf(snap, pid),
        used: plays.filter((p) => p.pid === pid).map((p) => p.id),
        listening: listening(i),
        guessed: entryOf(snap, i, pid) != null,
        pinPlaced: hasPin,
        target,
        opponents,
      });
      if (!verdict.ok || !j) throw new DuelError('bad-request', 409, REFUSAL[verdict.ok ? 'unknown' : verdict.reason]);
      const play: JokerPlay = { pid, id: j.id, round: i, target: j.target === 'opponent' ? target : null, at: now };
      if (j.id === 'seconde') play.probeKm = haversineKm({ lat, lon }, activeStation(snap, i));
      const victim = play.target ? playerById(snap, play.target) : undefined;
      // Bouclier de la cible : il arrête la première attaque de la manche (le joker de l'attaquant est perdu).
      if (victim && plays.some((p) => p.pid === victim.id && p.id === 'bouclier' && p.round === i)) {
        if (await store.hsetnx(k, F.shieldUsed(i, victim.id), pid)) play.blocked = true;
      }
      if (!(await store.hsetnx(k, F.joker(pid, j.id), JSON.stringify(play)))) break; // déjà joué (double clic)
      if (j.id === 'taxe' && victim && !play.blocked) await store.hincrby(k, F.taxPending(victim.id), 1);
      // Le Bouclier reste secret : on ne l'annonce qu'au moment où il arrête une attaque.
      if (j.id !== 'bouclier') {
        const on = victim ? ` sur ${victim.name}` : '';
        const stop = play.blocked ? ` Le Bouclier de ${victim!.name} l’arrête !` : '';
        await postChat(store, code, systemMessage(`${me.name} joue « ${j.name} »${on}.${stop}`, now));
      }
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
    case 'react': {
      if (!(REACTIONS as readonly string[]).includes(body.kind)) throw new DuelError('bad-request', 400, 'Réaction inconnue');
      let last = 0;
      try {
        last = Number((JSON.parse(snap.raw[F.react(pid)] ?? '{}') as { at?: number }).at ?? 0);
      } catch {
        // champ illisible : on l'ignore
      }
      if (now - last < REACTION_MIN_INTERVAL_MS) throw new DuelError('too-fast', 429, 'Une réaction toutes les 2 secondes');
      await store.hset(k, { [F.react(pid)]: JSON.stringify({ kind: body.kind, at: now }) });
      break;
    }
    case 'rematch': {
      if (d.status !== 'finished') throw new DuelError('bad-request', 409, 'La partie n’est pas terminée');
      await createRematch(store, snap, me, now);
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
