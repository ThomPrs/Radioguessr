// Mode Multijoueur : constantes et types échangés entre le serveur (/api) et le navigateur.

import type { Avatar } from './avatars.js';
import type { NewsAnswer, TrackInfo } from './blindtest.js';
import type { HintKind, Station } from './types.js';

export const DUEL_ROUNDS = 5;
export const ROOM_CODE_LENGTH = 5;
/** Lettres sans ambiguïté à la lecture (pas de 0/O, 1/I/L). */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_TTL_SECONDS = 2 * 3600;

export const MAX_PLAYERS = 8;
export const MIN_PLAYERS_TO_START = 2;

export const COUNTDOWN_MS = 4_000; // avant la première manche
export const ROUND_TIME_MS = 90_000; // temps maximum d'écoute
export const REVEAL_TIME_MS = 30_000; // révélation avant passage automatique
export const CONNECTED_MS = 6_000; // au-delà sans polling : « déconnecté »
export const ABANDON_MS = 120_000; // au-delà : joueur parti
export const POLL_INTERVAL_MS = 1_000;
export const MAX_NAME_LENGTH = 20;

export const CHAT_MAX_LENGTH = 200;
export const CHAT_KEEP = 40; // messages conservés par salon
export const CHAT_MIN_INTERVAL_MS = 1_000; // anti-spam : un message par seconde et par joueur

/** Une couleur d'encre par joueur, attribuée dans l'ordre d'arrivée. */
export const PLAYER_COLORS = ['#d9483b', '#2f5d8c', '#4f7a4a', '#c9822b', '#8a5a9e', '#2b8a8a', '#7a4a2c', '#c2577a'] as const;

export type RoomStatus = 'waiting' | 'countdown' | 'playing' | 'news' | 'finished';

export type NewsPhase = 'intro' | 'listen' | 'reveal';

/** Breaking News vue par un joueur. */
export interface NewsView {
  phase: NewsPhase;
  startAt: number;
  /** Fin du jingle : l'extrait démarre. */
  listenAt: number;
  deadline: number;
  /** Reprise automatique de la partie (pendant la révélation). */
  nextAt: number | null;
  trackId: number;
  you: { answered: boolean; ready: boolean; entry: NewsAnswer | null };
  /** Qui a répondu (sans la réponse) pendant l'écoute. */
  answered: Record<string, boolean>;
  /** À la révélation : le morceau et les réponses de chacun. */
  reveal: { answer: TrackInfo | null; entries: Record<string, NewsAnswer | null> } | null;
}

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
  id: string;
  name: string;
  avatar: Avatar;
  /** Épingle affichée à côté du pseudo. */
  pin: string | null;
  color: number; // indice dans PLAYER_COLORS
  isHost: boolean;
  connected: boolean;
  /** Parti volontairement, ou silencieux depuis plus de 2 minutes. */
  gone: boolean;
  total: number;
  /** Manche en cours : rapport envoyé / prêt pour la suite. */
  guessed: boolean;
  ready: boolean;
}

export interface ChatMessage {
  id: number;
  pid: string | null; // null : message système
  name: string;
  color: number;
  text: string;
  at: number;
  kind: 'msg' | 'system';
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
  /** Rapports de tous les joueurs, révélés uniquement en phase « revealed ». */
  entries: Record<string, DuelEntry | null> | null;
  /** Révélée uniquement en phase « revealed ». */
  station: Station | null;
}

export interface HistoryItem {
  index: number;
  station: Station;
  entries: Record<string, DuelEntry | null>;
}

export interface RoomView {
  code: string;
  status: RoomStatus;
  serverNow: number;
  youId: string;
  hostId: string;
  players: PlayerView[];
  startAt: number | null; // début de la première manche (compte à rebours)
  round: RoundView | null;
  history: HistoryItem[];
  /** Messages plus récents que l'identifiant demandé (?chat=). */
  chat: ChatMessage[];
  /** Option Breaking News choisie par l'hôte. */
  breakingNews: boolean;
  /** Breaking News en cours (statut « news »). */
  news: NewsView | null;
  /** Résultat de la Breaking News une fois passée (tableau des résultats). */
  newsResult: { answer: TrackInfo | null; entries: Record<string, NewsAnswer | null> } | null;
}

export interface JoinResponse {
  code: string;
  playerId: string;
  token: string;
}

export type DuelAction =
  | { action: 'join'; name: string; avatar?: Avatar; pin?: string | null }
  | { action: 'start' }
  | { action: 'guess'; round: number; lat: number; lon: number }
  | { action: 'hint'; round: number; kind: HintKind }
  | { action: 'skip'; round: number; from: number }
  | { action: 'ready'; round: number }
  | { action: 'chat'; text: string }
  | { action: 'options'; breakingNews: boolean }
  | { action: 'news-answer'; guessId: number }
  | { action: 'news-ready' }
  | { action: 'leave' };

export type DuelErrorCode = 'not-found' | 'full' | 'started' | 'forbidden' | 'bad-request' | 'too-fast' | 'stations' | 'server';

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

export function cleanChat(raw: unknown): string {
  // Caractères de contrôle retirés, espaces regroupés, longueur bornée.
  const s = typeof raw === 'string' ? raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() : '';
  return s.slice(0, CHAT_MAX_LENGTH);
}

/** Classement : rang de chaque joueur (ex æquo = même rang). */
export function rankPlayers(players: readonly PlayerView[]): { player: PlayerView; rank: number }[] {
  const sorted = [...players].sort((a, b) => b.total - a.total);
  return sorted.map((player) => ({ player, rank: sorted.findIndex((p) => p.total === player.total) + 1 }));
}
