// Cartes Joker : catalogue, vérification des règles (« peut-on jouer ce joker maintenant ? »),
// effets sur le score et tirage du courrier. Partagé par le navigateur et le serveur.

import { HINT_COST, rawScore } from './scoring.js';
import { weightedIndex, type Rng } from './rng.js';
import type { HintKind } from './types.js';

export type JokerId =
  | 'double'
  | 'filet'
  | 'indices'
  | 'radar'
  | 'seconde'
  | 'antenne'
  | 'brouilleur'
  | 'brouillard'
  | 'taxe'
  | 'espion'
  | 'pickpocket'
  | 'bouclier';

/** « perso » : solo et multijoueur ; « multi » : vise un adversaire, multijoueur seulement. */
export type JokerKind = 'perso' | 'multi';
export type JokerRarity = 'common' | 'rare' | 'epic';

export interface JokerDef {
  id: JokerId;
  name: string;
  kind: JokerKind;
  /** Le joker se joue sur soi, ou sur un adversaire choisi. */
  target: 'self' | 'opponent';
  rarity: JokerRarity;
  /** Il agit sur sa propre épingle : il faut ne pas avoir encore validé. */
  beforeGuess: boolean;
}

export const JOKERS: readonly JokerDef[] = [
  { id: 'double', name: 'Double fréquence', kind: 'perso', target: 'self', rarity: 'rare', beforeGuess: true },
  { id: 'filet', name: 'Filet de sécurité', kind: 'perso', target: 'self', rarity: 'common', beforeGuess: true },
  { id: 'indices', name: 'Indices offerts', kind: 'perso', target: 'self', rarity: 'common', beforeGuess: true },
  { id: 'radar', name: 'Radar', kind: 'perso', target: 'self', rarity: 'rare', beforeGuess: true },
  { id: 'seconde', name: 'Seconde écoute', kind: 'perso', target: 'self', rarity: 'epic', beforeGuess: true },
  { id: 'antenne', name: 'Antenne longue', kind: 'perso', target: 'self', rarity: 'common', beforeGuess: true },
  { id: 'brouilleur', name: 'Brouilleur', kind: 'multi', target: 'opponent', rarity: 'common', beforeGuess: false },
  { id: 'brouillard', name: 'Brouillard', kind: 'multi', target: 'opponent', rarity: 'rare', beforeGuess: false },
  { id: 'taxe', name: 'Taxe', kind: 'multi', target: 'opponent', rarity: 'rare', beforeGuess: false },
  { id: 'espion', name: 'Espion', kind: 'multi', target: 'opponent', rarity: 'rare', beforeGuess: true },
  { id: 'pickpocket', name: 'Pickpocket', kind: 'multi', target: 'opponent', rarity: 'epic', beforeGuess: false },
  { id: 'bouclier', name: 'Bouclier', kind: 'multi', target: 'self', rarity: 'rare', beforeGuess: false },
];

export const JOKER_IDS = new Set<string>(JOKERS.map((j) => j.id));
export const HAND_SIZE = 2;
export const STARTER_JOKERS: JokerId[] = ['double', 'indices'];
/** Un courrier (une nouvelle carte) toutes les N parties jouées. */
export const MAIL_EVERY = 3;
export const JOKER_RARITY_WEIGHTS: Record<JokerRarity, number> = { common: 60, rare: 30, epic: 10 };

// Valeurs des effets
export const FLOOR_SCORE = 2_500;
export const RADAR_RADIUS_KM = 2_000;
export const ANTENNA_BONUS_MS = 30_000;
export const JAMMER_MS = 10_000;
export const PICKPOCKET_POINTS = 500;

export function jokerById(id: string | null | undefined): JokerDef | undefined {
  return id ? JOKERS.find((j) => j.id === id) : undefined;
}

/** Main propre : identifiants connus, sans doublon, 2 au maximum. */
export function cleanHand(raw: unknown): JokerId[] {
  if (!Array.isArray(raw)) return [];
  const out: JokerId[] = [];
  for (const id of raw) if (typeof id === 'string' && JOKER_IDS.has(id) && !out.includes(id as JokerId)) out.push(id as JokerId);
  return out.slice(0, HAND_SIZE);
}

// ── Règles ─────────────────────────────────────────────────────────────────

export interface PlayContext {
  mode: 'solo' | 'duel';
  /** Jokers activés pour cette partie. */
  enabled: boolean;
  hand: readonly string[];
  /** Jokers déjà joués pendant la partie. */
  used: readonly string[];
  /** Une manche est en cours d'écoute. */
  listening: boolean;
  /** J'ai déjà validé mon épingle dans cette manche. */
  guessed: boolean;
  /** Seconde écoute : une épingle est posée (pas encore validée). */
  pinPlaced?: boolean;
  /** Joker visant un adversaire : cible choisie et adversaires encore en jeu. */
  target?: string | null;
  opponents?: readonly string[];
}

export type PlayRefusal = 'disabled' | 'unknown' | 'not-in-hand' | 'used' | 'solo' | 'closed' | 'guessed' | 'no-pin' | 'target';

/** Vérifie qu'un joker peut être joué maintenant. Même règle pour l'écran, le moteur solo et le serveur. */
export function canPlay(id: string, ctx: PlayContext): { ok: true } | { ok: false; reason: PlayRefusal } {
  const j = jokerById(id);
  if (!j) return { ok: false, reason: 'unknown' };
  if (!ctx.enabled) return { ok: false, reason: 'disabled' };
  if (!ctx.hand.includes(j.id)) return { ok: false, reason: 'not-in-hand' };
  if (ctx.used.includes(j.id)) return { ok: false, reason: 'used' };
  if (j.kind === 'multi' && ctx.mode === 'solo') return { ok: false, reason: 'solo' };
  if (!ctx.listening) return { ok: false, reason: 'closed' };
  if (j.beforeGuess && ctx.guessed) return { ok: false, reason: 'guessed' };
  if (j.id === 'seconde' && !ctx.pinPlaced) return { ok: false, reason: 'no-pin' };
  if (j.target === 'opponent' && (!ctx.target || !(ctx.opponents ?? []).includes(ctx.target))) return { ok: false, reason: 'target' };
  return { ok: true };
}

/** Jokers jouables dans un mode donné (le solo écarte les jokers multi). */
export function playableIn(mode: 'solo' | 'duel', hand: readonly string[]): JokerDef[] {
  return hand.map(jokerById).filter((j): j is JokerDef => !!j && (mode === 'duel' || j.kind === 'perso'));
}

// ── Score ──────────────────────────────────────────────────────────────────

export interface ScoreMods {
  double?: boolean;
  floor?: boolean;
  freeHints?: boolean;
  /** Indice taxé (Taxe) : son coût est compté deux fois. */
  taxedHint?: HintKind | null;
}

/**
 * Score d'une manche avec les jokers : brut − indices (sauf Indices offerts, Taxe en plus),
 * puis Filet de sécurité (minimum, seulement si une épingle est posée), puis Double fréquence.
 */
export function scoreWithJokers(distanceKm: number | null, hints: readonly HintKind[], mods: ScoreMods = {}): { raw: number; score: number } {
  const raw = distanceKm == null ? 0 : rawScore(distanceKm);
  const unique = [...new Set(hints)];
  let cost = mods.freeHints ? 0 : unique.reduce((s, h) => s + HINT_COST[h], 0);
  if (!mods.freeHints && mods.taxedHint && unique.includes(mods.taxedHint)) cost += HINT_COST[mods.taxedHint];
  let score = Math.max(0, raw - cost);
  if (mods.floor && distanceKm != null) score = Math.max(score, FLOOR_SCORE);
  if (mods.double) score *= 2;
  return { raw, score };
}

/** Points volés par Pickpocket : jamais plus que ce que la cible a marqué sur la manche. */
export function stolenPoints(targetRoundScore: number): number {
  return Math.min(PICKPOCKET_POINTS, Math.max(0, targetRoundScore));
}

// ── Radar ──────────────────────────────────────────────────────────────────

/** Centre du cercle radar : décalé au hasard, la station reste à l'intérieur (au plus 75 % du rayon du centre). */
export function radarCenter(station: { lat: number; lon: number }, rng: Rng = Math.random): { lat: number; lon: number } {
  const distKm = rng() * RADAR_RADIUS_KM * 0.75;
  const bearing = rng() * 2 * Math.PI;
  const R = 6371.0088;
  const d = distKm / R;
  const lat1 = (station.lat * Math.PI) / 180;
  const lon1 = (station.lon * Math.PI) / 180;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(bearing));
  const lon2 = lon1 + Math.atan2(Math.sin(bearing) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  const lon = ((((lon2 * 180) / Math.PI + 540) % 360) - 180);
  return { lat: (lat2 * 180) / Math.PI, lon };
}

// ── Courrier ───────────────────────────────────────────────────────────────

/** Tire une carte pas encore possédée (rareté pondérée parmi celles qui restent) ; null si collection complète. */
export function drawJoker(owned: Record<string, unknown>, rng: Rng = Math.random): JokerDef | null {
  const left = JOKERS.filter((j) => !owned[j.id]);
  if (left.length === 0) return null;
  const rarities = (['common', 'rare', 'epic'] as JokerRarity[]).filter((r) => left.some((j) => j.rarity === r));
  const rarity = rarities[weightedIndex(rarities.map((r) => JOKER_RARITY_WEIGHTS[r]), rng)]!;
  const pool = left.filter((j) => j.rarity === rarity);
  return pool[Math.floor(rng() * pool.length)]!;
}
