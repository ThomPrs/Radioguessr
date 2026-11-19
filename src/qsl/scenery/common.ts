// Constantes et petits outils communs aux décors des vignettes QSL (viewBox 300 × 150).

import type { Rng } from '../../../shared/rng';

export const W = 300;
export const H = 150;
export const INK = '#3a3632';
export const PAPER = '#ede3cf';

export const r = (rng: Rng, min: number, max: number) => min + rng() * (max - min);
export const f = (n: number) => n.toFixed(1);

/** Contexte de dessin d'une vignette. */
export interface Ink {
  rng: Rng;
  horizon: number;
  /** Couleur d'accent (encre en bichromie). */
  fill: string;
  /** Second accent. */
  fill2: string;
  /** Détails éclairés (cartes rares et or). */
  rich: boolean;
  /** Bichromie (cartes simples). */
  mono: boolean;
  /** Motif de hachures (url(#…)), pour la bichromie. */
  hatch: string;
}

/** Ligne de collines (chemin fermé jusqu'en bas). */
export function hills(rng: Rng, baseY: number, amp: number, n: number): string {
  let d = `M0 ${H} L0 ${f(baseY)}`;
  const step = W / n;
  for (let i = 0; i < n; i++) {
    const x1 = i * step + step / 2;
    const y1 = baseY - r(rng, amp * 0.3, amp);
    d += ` Q${f(x1)} ${f(y1)} ${f((i + 1) * step)} ${f(baseY - r(rng, 0, amp * 0.3))}`;
  }
  return `${d} L${W} ${H} Z`;
}
