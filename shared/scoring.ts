// Distance, score, rareté. Partagé front / serveur (le duel calcule les scores côté serveur).

import type { HintKind } from './types.js';

export interface LatLon {
  lat: number;
  lon: number;
}

export const MAX_ROUND_SCORE = 5000;
export const SCORE_DECAY_KM = 2000;
export const ROUNDS_PER_GAME = 5;
export const QSL_MAX_DISTANCE_KM = 1500;

export const HINT_COST: Record<HintKind, number> = {
  language: 500,
  continent: 1000,
  timezone: 750,
};

const EARTH_RADIUS_KM = 6371.0088;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Distance orthodromique (formule de haversine), en km. */
export function haversineKm(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 5000 × e^(−d/2000), arrondi. */
export function rawScore(distanceKm: number): number {
  return Math.round(MAX_ROUND_SCORE * Math.exp(-distanceKm / SCORE_DECAY_KM));
}

export function hintsCost(hints: readonly HintKind[]): number {
  return [...new Set(hints)].reduce((sum, h) => sum + HINT_COST[h], 0);
}

/** Score d'une manche : brut moins le coût des indices, jamais négatif. */
export function roundScore(distanceKm: number | null, hints: readonly HintKind[]): { raw: number; score: number } {
  const raw = distanceKm == null ? 0 : rawScore(distanceKm);
  return { raw, score: Math.max(0, raw - hintsCost(hints)) };
}

export type Rarity = 'gold' | 'high' | 'medium' | 'simple';

/** Rareté de la carte QSL selon la précision ; null = pas de carte. */
export function rarityFor(distanceKm: number): Rarity | null {
  if (distanceKm < 50) return 'gold';
  if (distanceKm < 250) return 'high';
  if (distanceKm < 750) return 'medium';
  if (distanceKm < QSL_MAX_DISTANCE_KM) return 'simple';
  return null;
}

/**
 * Points intermédiaires de l'arc de grand cercle a→b, découpés en segments
 * qui ne traversent jamais l'antiméridien (carte non répétée).
 */
export function greatCircleSegments(a: LatLon, b: LatLon, steps = 64): [number, number][][] {
  const φ1 = toRad(a.lat), λ1 = toRad(a.lon), φ2 = toRad(b.lat), λ2 = toRad(b.lon);
  const d = haversineKm(a, b) / EARTH_RADIUS_KM;
  const points: [number, number][] = [];
  if (d < 1e-9) return [[[a.lat, a.lon]]];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    points.push([toDeg(Math.atan2(z, Math.hypot(x, y))), toDeg(Math.atan2(y, x))]);
  }
  const segments: [number, number][][] = [[]];
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    const prev = points[i - 1];
    if (prev && Math.abs(p[1] - prev[1]) > 180) {
      // Traversée de l'antiméridien : on termine au bord et on repart de l'autre côté.
      const sign = prev[1] > 0 ? 1 : -1;
      const lonP = p[1] + sign * 360;
      const t = (sign * 180 - prev[1]) / (lonP - prev[1]);
      const latEdge = prev[0] + t * (p[0] - prev[0]);
      segments[segments.length - 1]!.push([latEdge, sign * 180]);
      segments.push([[latEdge, -sign * 180]]);
    }
    segments[segments.length - 1]!.push(p);
  }
  return segments;
}
