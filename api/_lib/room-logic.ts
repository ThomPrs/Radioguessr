// Logique pure d'un salon multijoueur : aucune E/S, testable avec une horloge simulée.
//
// Les fonctions serverless n'ont pas de minuteur : l'avancement (fin des 90 s, manche suivante…)
// est déduit à chaque lecture à partir des horodatages stockés. Les seules écritures que cette
// déduction réclame sont idempotentes (HSETNX du début de la manche suivante).

import {
  ABANDON_MS,
  CONNECTED_MS,
  DUEL_ROUNDS,
  REVEAL_TIME_MS,
  ROUND_TIME_MS,
  type ChatMessage,
  type DuelEntry,
  type HistoryItem,
  type PlayerView,
  type RoomStatus,
  type RoomView,
  type RoundView,
} from '../../shared/duel.js';
import { DEFAULT_AVATAR, type Avatar } from '../../shared/avatars.js';
import { computeHints, localTimeLabel, utcOffsetLabel } from '../../shared/hints.js';
import { ZONES } from '../../shared/timezones-data.js';
import type { HintKind, Station } from '../../shared/types.js';

export interface PlayerRecord {
  id: string;
  tokenHash: string;
  name: string;
  joinedAt: number;
  color: number;
  avatar?: Avatar;
  pin?: string | null;
}

export interface Meta {
  code: string;
  createdAt: number;
  hostId: string;
  /** Pour chaque manche : la station principale puis les secours. */
  rounds: Station[][];
}

/** Champs du hash Redis. */
export const F = {
  meta: 'meta',
  count: 'count',
  player: (pid: string) => `p:${pid}`,
  seen: (pid: string) => `seen:${pid}`,
  left: (pid: string) => `left:${pid}`,
  start: (i: number) => `r${i}:start`,
  active: (i: number) => `r${i}:active`,
  skip: (i: number, from: number) => `r${i}:skip${from}`,
  entry: (i: number, pid: string) => `r${i}:g:${pid}`,
  hints: (i: number, pid: string) => `r${i}:h:${pid}`,
  ready: (i: number, pid: string) => `r${i}:ready:${pid}`,
  chatSeq: 'chat:seq',
  chat: (n: number) => `chat:${n}`,
  chatAt: (pid: string) => `chatAt:${pid}`,
};

export interface Snapshot {
  meta: Meta;
  /** Joueurs dans l'ordre d'arrivée. */
  players: PlayerRecord[];
  seen: Record<string, number>;
  left: Record<string, boolean>;
  raw: Record<string, string>;
}

function json<T>(s: string | undefined): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

export function parseSnapshot(raw: Record<string, string>): Snapshot | null {
  const meta = json<Meta>(raw[F.meta]);
  if (!meta?.hostId) return null; // salon d'un ancien format (2 places fixes) : traité comme introuvable
  const players: PlayerRecord[] = [];
  const seen: Record<string, number> = {};
  const left: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k.startsWith('p:')) {
      const p = json<PlayerRecord>(v);
      if (p) players.push(p);
    } else if (k.startsWith('seen:')) seen[k.slice(5)] = Number(v);
    else if (k.startsWith('left:')) left[k.slice(5)] = true;
  }
  players.sort((a, b) => a.joinedAt - b.joinedAt || a.color - b.color);
  return { meta, players, seen, left, raw };
}

export function playerById(snap: Snapshot, pid: string): PlayerRecord | undefined {
  return snap.players.find((p) => p.id === pid);
}

// ── Accès aux données d'une manche ─────────────────────────────────────────

export function activeIndex(snap: Snapshot, i: number): number {
  return Number(snap.raw[F.active(i)] ?? 0);
}

export function activeStation(snap: Snapshot, i: number): Station {
  const candidates = snap.meta.rounds[i]!;
  return candidates[Math.min(activeIndex(snap, i), candidates.length - 1)]!;
}

export function roundStart(snap: Snapshot, i: number): number | null {
  const v = snap.raw[F.start(i)];
  return v ? Number(v) : null;
}

export function entryOf(snap: Snapshot, i: number, pid: string): DuelEntry | null {
  return json<DuelEntry>(snap.raw[F.entry(i, pid)]);
}

export function hintsOf(snap: Snapshot, i: number, pid: string): HintKind[] {
  return json<HintKind[]>(snap.raw[F.hints(i, pid)]) ?? [];
}

/** Joueur parti (bouton « quitter ») ou silencieux depuis trop longtemps. */
export function isGone(snap: Snapshot, pid: string, now: number): boolean {
  if (snap.left[pid]) return true;
  const p = playerById(snap, pid);
  if (!p) return true; // retiré du salon (départ pendant l'attente)
  const seen = snap.seen[pid] ?? p.joinedAt;
  return now - seen > ABANDON_MS;
}

/** Hôte effectif : le créateur, ou à défaut le plus ancien joueur encore présent. */
export function effectiveHost(snap: Snapshot, now: number): string {
  if (!isGone(snap, snap.meta.hostId, now)) return snap.meta.hostId;
  return snap.players.find((p) => !isGone(snap, p.id, now))?.id ?? snap.meta.hostId;
}

// ── Déduction de l'état ────────────────────────────────────────────────────

export interface RoundTiming {
  index: number;
  start: number;
  deadline: number;
  revealAt: number | null; // null tant que l'écoute continue
  nextAt: number | null;
}

export interface Derived {
  status: RoomStatus;
  /** Manche courante (en écoute ou en révélation) ; null en attente ou terminé. */
  current: RoundTiming | null;
  /** Manches terminées ou révélées. */
  revealed: number[];
  /** Écritures idempotentes à faire (début de la manche suivante). */
  writes: { field: string; value: string }[];
}

/** Tous les joueurs encore présents ont-ils fait l'action ? Un joueur parti ne bloque personne. */
function everyoneDid(snap: Snapshot, now: number, did: (pid: string) => boolean): boolean {
  return snap.players.every((p) => did(p.id) || isGone(snap, p.id, now));
}

export function derive(snap: Snapshot, now: number): Derived {
  const writes: Derived['writes'] = [];
  const start0 = roundStart(snap, 0);
  if (start0 == null) return { status: 'waiting', current: null, revealed: [], writes };
  if (now < start0) return { status: 'countdown', current: null, revealed: [], writes };

  const revealed: number[] = [];
  for (let i = 0; i < DUEL_ROUNDS; i++) {
    let start = roundStart(snap, i);
    if (start == null) {
      // La manche précédente vient de se terminer : on la démarre (écriture idempotente).
      start = now;
      writes.push({ field: F.start(i), value: String(now) });
    }
    const deadline = start + ROUND_TIME_MS;

    const allGuessed = everyoneDid(snap, now, (pid) => entryOf(snap, i, pid) != null);
    const lastGuess = Math.max(0, ...snap.players.map((p) => entryOf(snap, i, p.id)?.at ?? 0));
    const revealAt = allGuessed ? Math.min(Math.max(lastGuess, start), deadline) : now >= deadline ? deadline : null;

    if (revealAt == null || now < revealAt) {
      return { status: 'playing', current: { index: i, start, deadline, revealAt: null, nextAt: null }, revealed, writes };
    }

    const nextAt = revealAt + REVEAL_TIME_MS;
    const allReady = everyoneDid(snap, now, (pid) => snap.raw[F.ready(i, pid)] === '1');
    revealed.push(i);
    if (!allReady && now < nextAt) {
      return { status: 'playing', current: { index: i, start, deadline, revealAt, nextAt }, revealed, writes };
    }
  }
  return { status: 'finished', current: null, revealed, writes };
}

// ── Chat ───────────────────────────────────────────────────────────────────

export function chatMessages(snap: Snapshot, since = 0): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const [k, v] of Object.entries(snap.raw)) {
    if (!k.startsWith('chat:') || k === F.chatSeq) continue;
    const m = json<ChatMessage>(v);
    if (m && m.id > since) out.push(m);
  }
  return out.sort((a, b) => a.id - b.id);
}

// ── Vue envoyée à un joueur ────────────────────────────────────────────────

/** Entrée d'un joueur, ou entrée « sans réponse » s'il n'a rien envoyé avant la révélation. */
function finalEntry(snap: Snapshot, i: number, pid: string): DuelEntry {
  return entryOf(snap, i, pid) ?? { lat: null, lon: null, at: 0, distanceKm: null, hints: hintsOf(snap, i, pid), score: 0 };
}

function allEntries(snap: Snapshot, i: number): Record<string, DuelEntry> {
  return Object.fromEntries(snap.players.map((p) => [p.id, finalEntry(snap, i, p.id)]));
}

export function hintValue(station: Station, kind: HintKind, now: number): string {
  const h = computeHints(station, ZONES);
  if (kind === 'language') return h.language ?? '—';
  if (kind === 'continent') return h.continent;
  if (!h.timezone) return '—';
  const at = new Date(now);
  return `${utcOffsetLabel(h.timezone, at)} · il y est ${localTimeLabel(h.timezone, at)}`;
}

export function buildView(snap: Snapshot, pid: string, now: number, chatSince = 0, d: Derived = derive(snap, now)): RoomView {
  const history: HistoryItem[] = d.revealed.map((i) => ({ index: i, station: activeStation(snap, i), entries: allEntries(snap, i) }));
  const totals: Record<string, number> = {};
  for (const h of history) for (const [id, e] of Object.entries(h.entries)) totals[id] = (totals[id] ?? 0) + (e?.score ?? 0);

  const hostId = effectiveHost(snap, now);
  const cur = d.current;
  const players: PlayerView[] = snap.players.map((p) => {
    const seen = snap.seen[p.id] ?? p.joinedAt;
    return {
      id: p.id,
      name: p.name,
      avatar: p.avatar ?? DEFAULT_AVATAR,
      pin: p.pin ?? null,
      color: p.color,
      isHost: p.id === hostId,
      connected: !snap.left[p.id] && now - seen <= CONNECTED_MS,
      gone: isGone(snap, p.id, now),
      total: totals[p.id] ?? 0,
      guessed: cur ? entryOf(snap, cur.index, p.id) != null : false,
      ready: cur ? snap.raw[F.ready(cur.index, p.id)] === '1' : false,
    };
  });

  let round: RoundView | null = null;
  if (cur) {
    const i = cur.index;
    const isRevealed = cur.revealAt != null;
    const station = activeStation(snap, i);
    const myHints = hintsOf(snap, i, pid);
    round = {
      index: i,
      phase: isRevealed ? 'revealed' : 'listening',
      candidate: activeIndex(snap, i),
      streamUrl: station.streamUrl,
      startAt: cur.start,
      deadline: cur.deadline,
      nextAt: cur.nextAt,
      you: {
        guessed: entryOf(snap, i, pid) != null,
        hints: myHints,
        hintValues: Object.fromEntries(myHints.map((k) => [k, hintValue(station, k, now)])),
        ready: snap.raw[F.ready(i, pid)] === '1',
        entry: isRevealed ? finalEntry(snap, i, pid) : entryOf(snap, i, pid),
      },
      // Les punaises des autres restent secrètes jusqu'à la révélation.
      entries: isRevealed ? allEntries(snap, i) : null,
      station: isRevealed ? station : null,
    };
  }

  return {
    code: snap.meta.code,
    status: d.status,
    serverNow: now,
    youId: pid,
    hostId,
    players,
    startAt: roundStart(snap, 0),
    round,
    history,
    chat: chatMessages(snap, chatSince),
  };
}
