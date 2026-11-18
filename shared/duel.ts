// Mode Duel : constantes et types échangés entre le serveur (/api) et le navigateur.

import type { HintKind, Station } from './types.js';

export const DUEL_ROUNDS = 5;
export const ROOM_CODE_LENGTH = 5;
/** Lettres sans ambiguïté à la lecture (pas de 0/O, 1/I/L). */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_TTL_SECONDS = 2 * 3600;

export const COUNTDOWN_MS = 4_000; // avant la première manche
export const ROUND_TIME_MS = 90_000; // temps maximum d'écoute
export const REVEAL_TIME_MS = 30_000; // révélation avant passage automatique
export const CONNECTED_MS = 6_000; // au-delà sans polling : « déconnecté »
export const ABANDON_MS = 120_000; // au-delà : adversaire parti
export const POLL_INTERVAL_MS = 1_000;
export const MAX_NAME_LENGTH = 20;

export type Seat = 'host' | 'guest';
export const otherSeat = (s: Seat): Seat => (s === 'host' ? 'guest' : 'host');

export type RoomStatus = 'waiting' | 'countdown' | 'playing' | 'finished';

/** Rapport d'un joueur sur une manche (stocké côté serveur). */
export interface DuelEntry {
  lat: number | null; // null : temps écoulé sans punaise
  lon: number | null;
  at: number;
  distanceKm: number | null;
  hints: HintKind[];
  score: number;
}

export interface PlayerView {
  name: string;
  connected: boolean;
  /** Parti volontairement, ou silencieux depuis plus de 2 minutes. */
  gone: boolean;
}

export interface RoundView {
  index: number;
  phase: 'listening' | 'revealed';
  /** Indice du flux de secours en cours (change si un flux ne démarre pas). */
  candidate: number;
  streamUrl: string;
  startAt: number;
  deadline: number;
  /** Instant où la manche suivante démarrera d'office (pendant la révélation). */
  nextAt: number | null;
  you: { guessed: boolean; hints: HintKind[]; hintValues: Partial<Record<HintKind, string>>; ready: boolean; entry: DuelEntry | null };
  opponent: { guessed: boolean; ready: boolean; entry: DuelEntry | null };
  /** Révélée uniquement en phase « revealed ». */
  station: Station | null;
}

export interface HistoryItem {
  index: number;
  station: Station;
  you: DuelEntry | null;
  opponent: DuelEntry | null;
}

export interface RoomView {
  code: string;
  status: RoomStatus;
  serverNow: number;
  you: Seat;
  me: PlayerView;
  opponent: PlayerView | null;
  startAt: number | null; // début de la première manche (compte à rebours)
  round: RoundView | null;
  history: HistoryItem[];
  totals: { you: number; opponent: number };
}

export interface JoinResponse {
  code: string;
  playerId: string;
  token: string;
  seat: Seat;
}

export type DuelAction =
  | { action: 'join'; name: string }
  | { action: 'guess'; round: number; lat: number; lon: number }
  | { action: 'hint'; round: number; kind: HintKind }
  | { action: 'skip'; round: number; from: number }
  | { action: 'ready'; round: number }
  | { action: 'leave' };

export type DuelErrorCode = 'not-found' | 'full' | 'forbidden' | 'bad-request' | 'stations' | 'server';

export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, ROOM_CODE_LENGTH);
}

export function isValidCode(code: string): boolean {
  return code.length === ROOM_CODE_LENGTH && [...code].every((c) => ROOM_CODE_ALPHABET.includes(c));
}

export function cleanName(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
  return s.slice(0, MAX_NAME_LENGTH);
}
