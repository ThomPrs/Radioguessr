// Logique pure d'un salon de duel : aucune E/S, testable avec une horloge simulée.
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
  otherSeat,
  type DuelEntry,
  type HistoryItem,
  type PlayerView,
  type RoomStatus,
  type RoomView,
  type RoundView,
  type Seat,
} from '../../shared/duel.js';
import { computeHints, localTimeLabel, utcOffsetLabel } from '../../shared/hints.js';
import { ZONES } from '../../shared/timezones-data.js';
import type { HintKind, Station } from '../../shared/types.js';

export interface PlayerRecord {
  id: string;
  tokenHash: string;
  name: string;
  joinedAt: number;
}

export interface Meta {
  code: string;
  createdAt: number;
  /** Pour chaque manche : la station principale puis les secours. */
  rounds: Station[][];
}

/** Champs du hash Redis. */
export const F = {
  meta: 'meta',
  player: (s: Seat) => `p:${s}`,
  seen: (s: Seat) => `seen:${s}`,
  left: (s: Seat) => `left:${s}`,
  start: (i: number) => `r${i}:start`,
  active: (i: number) => `r${i}:active`,
  skip: (i: number, from: number) => `r${i}:skip${from}`,
  entry: (i: number, s: Seat) => `r${i}:g:${s}`,
  hints: (i: number, s: Seat) => `r${i}:h:${s}`,
  ready: (i: number, s: Seat) => `r${i}:ready:${s}`,
};

export const SEATS: Seat[] = ['host', 'guest'];

export interface Snapshot {
  meta: Meta;
  players: Partial<Record<Seat, PlayerRecord>>;
  seen: Partial<Record<Seat, number>>;
  left: Partial<Record<Seat, boolean>>;
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
  if (!meta) return null;
  const snap: Snapshot = { meta, players: {}, seen: {}, left: {}, raw };
  for (const s of SEATS) {
    const p = json<PlayerRecord>(raw[F.player(s)]);
    if (p) snap.players[s] = p;
    if (raw[F.seen(s)]) snap.seen[s] = Number(raw[F.seen(s)]);
    if (raw[F.left(s)]) snap.left[s] = true;
  }
  return snap;
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

export function entryOf(snap: Snapshot, i: number, s: Seat): DuelEntry | null {
  return json<DuelEntry>(snap.raw[F.entry(i, s)]);
}

export function hintsOf(snap: Snapshot, i: number, s: Seat): HintKind[] {
  return json<HintKind[]>(snap.raw[F.hints(i, s)]) ?? [];
}

/** Joueur parti (bouton « quitter ») ou silencieux depuis trop longtemps. */
export function isGone(snap: Snapshot, s: Seat, now: number): boolean {
  if (snap.left[s]) return true;
  const seen = snap.seen[s] ?? snap.players[s]?.joinedAt;
  return seen != null && now - seen > ABANDON_MS;
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

/** Les deux joueurs « présents » ont-ils tous validé ? Un joueur parti ne bloque personne. */
function everyoneDid(snap: Snapshot, now: number, did: (s: Seat) => boolean): boolean {
  return SEATS.every((s) => !snap.players[s] || did(s) || isGone(snap, s, now));
}

export function derive(snap: Snapshot, now: number): Derived {
  const writes: Derived['writes'] = [];
  if (!snap.players.guest) return { status: 'waiting', current: null, revealed: [], writes };

  const start0 = roundStart(snap, 0);
  if (start0 == null || now < start0) return { status: 'countdown', current: null, revealed: [], writes };

  const revealed: number[] = [];
  for (let i = 0; i < DUEL_ROUNDS; i++) {
    let start = roundStart(snap, i);
    if (start == null) {
      // La manche précédente vient de se terminer : on la démarre (écriture idempotente).
      start = now;
      writes.push({ field: F.start(i), value: String(now) });
    }
    const deadline = start + ROUND_TIME_MS;

    const allGuessed = everyoneDid(snap, now, (s) => entryOf(snap, i, s) != null);
    const lastGuess = Math.max(0, ...SEATS.map((s) => entryOf(snap, i, s)?.at ?? 0));
    const revealAt = allGuessed ? Math.min(Math.max(lastGuess, start), deadline) : now >= deadline ? deadline : null;

    if (revealAt == null || now < revealAt) {
      return { status: 'playing', current: { index: i, start, deadline, revealAt: null, nextAt: null }, revealed, writes };
    }

    const nextAt = revealAt + REVEAL_TIME_MS;
    const allReady = everyoneDid(snap, now, (s) => snap.raw[F.ready(i, s)] === '1');
    revealed.push(i);
    if (!allReady && now < nextAt) {
      return { status: 'playing', current: { index: i, start, deadline, revealAt, nextAt }, revealed, writes };
    }
  }
  return { status: 'finished', current: null, revealed, writes };
}

// ── Vue envoyée à un joueur ────────────────────────────────────────────────

function playerView(snap: Snapshot, s: Seat, now: number): PlayerView | null {
  const p = snap.players[s];
  if (!p) return null;
  const seen = snap.seen[s] ?? p.joinedAt;
  return { name: p.name, connected: !snap.left[s] && now - seen <= CONNECTED_MS, gone: isGone(snap, s, now) };
}

/** Entrée d'un joueur, ou entrée « sans réponse » s'il n'a rien envoyé avant la révélation. */
function finalEntry(snap: Snapshot, i: number, s: Seat): DuelEntry | null {
  if (!snap.players[s]) return null;
  return entryOf(snap, i, s) ?? { lat: null, lon: null, at: 0, distanceKm: null, hints: hintsOf(snap, i, s), score: 0 };
}

export function hintValue(station: Station, kind: HintKind, now: number): string {
  const h = computeHints(station, ZONES);
  if (kind === 'language') return h.language ?? '—';
  if (kind === 'continent') return h.continent;
  if (!h.timezone) return '—';
  const at = new Date(now);
  return `${utcOffsetLabel(h.timezone, at)} · il y est ${localTimeLabel(h.timezone, at)}`;
}

export function buildView(snap: Snapshot, seat: Seat, now: number, d: Derived = derive(snap, now)): RoomView {
  const opp = otherSeat(seat);

  const history: HistoryItem[] = d.revealed.map((i) => ({
    index: i,
    station: activeStation(snap, i),
    you: finalEntry(snap, i, seat),
    opponent: finalEntry(snap, i, opp),
  }));

  let round: RoundView | null = null;
  if (d.current) {
    const i = d.current.index;
    const isRevealed = d.current.revealAt != null;
    const station = activeStation(snap, i);
    const myHints = hintsOf(snap, i, seat);
    round = {
      index: i,
      phase: isRevealed ? 'revealed' : 'listening',
      candidate: activeIndex(snap, i),
      streamUrl: station.streamUrl,
      startAt: d.current.start,
      deadline: d.current.deadline,
      nextAt: d.current.nextAt,
      you: {
        guessed: entryOf(snap, i, seat) != null,
        hints: myHints,
        hintValues: Object.fromEntries(myHints.map((k) => [k, hintValue(station, k, now)])),
        ready: snap.raw[F.ready(i, seat)] === '1',
        entry: isRevealed ? finalEntry(snap, i, seat) : entryOf(snap, i, seat),
      },
      opponent: {
        guessed: entryOf(snap, i, opp) != null,
        ready: snap.raw[F.ready(i, opp)] === '1',
        // La punaise de l'adversaire reste secrète jusqu'à la révélation.
        entry: isRevealed ? finalEntry(snap, i, opp) : null,
      },
      station: isRevealed ? station : null,
    };
  }

  const total = (s: Seat) => history.reduce((sum, h) => sum + ((s === seat ? h.you : h.opponent)?.score ?? 0), 0);

  return {
    code: snap.meta.code,
    status: d.status,
    serverNow: now,
    you: seat,
    me: playerView(snap, seat, now)!,
    opponent: playerView(snap, opp, now),
    startAt: roundStart(snap, 0),
    round,
    history,
    totals: { you: total(seat), opponent: total(opp) },
  };
}
