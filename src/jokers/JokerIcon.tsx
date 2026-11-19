// Petites icônes à l'encre des jokers (40 × 40), dans le style des épingles.

import type { JokerId } from '../../shared/jokers';

const INK = '#3a3632';

const ICONS: Record<JokerId, preact.JSX.Element> = {
  double: (
    <>
      <path d="M8 30 Q14 10 20 20 T32 10" />
      <text x="21" y="36" font-family="Archivo Black, sans-serif" font-size="11" fill={INK} stroke="none">×2</text>
    </>
  ),
  filet: (
    <>
      <path d="M6 12 Q20 34 34 12" />
      <path d="M10 18 L30 18 M13 24 L27 24 M14 12 L16 27 M20 12 L20 29 M26 12 L24 27" stroke-width="1.2" />
    </>
  ),
  indices: (
    <>
      <circle cx="17" cy="17" r="9" />
      <path d="M24 24 L33 33" stroke-width="3" />
      <text x="14" y="21" font-family="Archivo Black, sans-serif" font-size="11" fill={INK} stroke="none">?</text>
    </>
  ),
  radar: (
    <>
      <circle cx="20" cy="20" r="14" />
      <circle cx="20" cy="20" r="8" stroke-width="1.2" />
      <path d="M20 20 L31 11" />
      <circle cx="26" cy="23" r="2" fill={INK} />
    </>
  ),
  seconde: (
    <>
      <path d="M12 26 Q8 12 20 9 Q31 9 30 20 Q29 26 24 28 Q22 33 18 32" />
      <path d="M17 20 Q17 15 21 15 Q25 15 24 20" stroke-width="1.4" />
      <path d="M32 8 l4 -3 M34 14 l5 0" stroke-width="1.4" />
    </>
  ),
  antenne: (
    <>
      <path d="M20 36 L20 10 M14 36 L20 18 L26 36" />
      <path d="M12 8 Q20 1 28 8 M9 12 Q20 -3 31 12" stroke-width="1.4" />
    </>
  ),
  brouilleur: (
    <>
      <path d="M4 20 L9 12 L13 27 L18 9 L22 30 L27 13 L31 25 L36 18" />
      <path d="M6 33 L34 7" stroke-width="2.5" />
    </>
  ),
  brouillard: (
    <>
      <path d="M8 18 Q8 10 16 11 Q19 5 26 9 Q33 9 32 17 Z" />
      <path d="M6 24 H34 M10 29 H30 M14 34 H26" stroke-width="1.6" />
    </>
  ),
  taxe: (
    <>
      <circle cx="20" cy="20" r="13" />
      <circle cx="20" cy="20" r="10" stroke-width="1" />
      <path d="M14 26 L26 14" />
      <circle cx="15" cy="15" r="2" />
      <circle cx="25" cy="25" r="2" />
    </>
  ),
  espion: (
    <>
      <path d="M4 20 Q20 6 36 20 Q20 34 4 20 Z" />
      <circle cx="20" cy="20" r="5" fill={INK} />
      <circle cx="22" cy="18" r="1.4" fill="#fbf6ea" stroke="none" />
    </>
  ),
  pickpocket: (
    <>
      <path d="M12 14 Q8 34 20 35 Q32 34 28 14 Z" />
      <path d="M12 14 L16 8 L24 8 L28 14 M15 11 H25" />
      <text x="15" y="30" font-family="Archivo Black, sans-serif" font-size="12" fill={INK} stroke="none">$</text>
    </>
  ),
  bouclier: (
    <>
      <path d="M20 5 L33 10 Q33 27 20 35 Q7 27 7 10 Z" />
      <path d="M20 9 L20 31 M10 15 H30" stroke-width="1.2" />
    </>
  ),
};

export function JokerIcon({ id, size = 40 }: { id: JokerId; size?: number }) {
  return (
    <svg class="joker-icon" viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" fill="none" stroke={INK} stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      {ICONS[id]}
    </svg>
  );
}
