// Tampon de succès : cercle à double bordure, nom en arc, repère au centre, dans l'encre de sa famille.

import { hashString } from '../../shared/rng';
import { t } from '../i18n/fr';
import type { AchievementDef, AchievementFamily } from './catalog';

export const FAMILY_INK: Record<AchievementFamily, string> = {
  explorer: '#2f5d8c',
  precision: '#c0392b',
  news: '#3a3632',
  multi: '#3f7a4a',
  collection: '#8a5a9e',
};

interface Props {
  def: AchievementDef;
  earned: boolean;
  size?: number;
}

export function AchievementStamp({ def, earned, size = 104 }: Props) {
  const [name] = t.stamps.list[def.id] ?? [def.id, ''];
  const ink = earned ? FAMILY_INK[def.family] : '#9a8f80';
  const rot = (hashString(def.id) % 17) - 8;
  const long = name.length > 14;
  const markSize = def.mark.length <= 2 ? 34 : def.mark.length <= 4 ? 22 : 16;
  return (
    <svg
      class={`achievement-stamp${earned ? '' : ' is-locked'}`}
      viewBox="0 0 120 120"
      width={size}
      height={size}
      style={{ transform: `rotate(${rot}deg)` }}
      aria-hidden="true"
    >
      <defs>
        <path id="stamp-arc-top" d="M 22 62 A 38 38 0 0 1 98 62" />
      </defs>
      <g filter={earned ? 'url(#ink-bleed)' : undefined} fill="none" stroke={ink}>
        <circle cx="60" cy="60" r="55" stroke-width="3.5" stroke-dasharray={earned ? undefined : '5 4'} />
        <circle cx="60" cy="60" r="48" stroke-width="1.5" />
        <path d="M 30 74 H 90" stroke-width="1.2" />
        <path d="M 30 80 H 90" stroke-width="1.2" />
      </g>
      <g fill={ink} filter={earned ? 'url(#ink-bleed)' : undefined}>
        <text font-family="Archivo Black, sans-serif" font-size={long ? 9 : 11} letter-spacing="1" text-anchor="middle">
          <textPath href="#stamp-arc-top" startOffset="50%">
            {name.toUpperCase()}
          </textPath>
        </text>
        <text x="60" y={66} font-family="Archivo Black, sans-serif" font-size={markSize} text-anchor="middle">
          {def.mark}
        </text>
        <text x="60" y="97" font-family="Special Elite, monospace" font-size="9" text-anchor="middle">
          ★ RADIOGUESSR ★
        </text>
      </g>
    </svg>
  );
}
