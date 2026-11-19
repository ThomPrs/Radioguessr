// Vignette d'une carte QSL : le pays en image. Ciel aux couleurs du drapeau, paysage du biome,
// architecture de la région, monument célèbre éventuel, pylône radio et drapeau-timbre.
// Procédural et déterministe : la même carte donne toujours la même image.

import {
  architectureOf,
  biomeOf,
  flagOf,
  landmarkOf,
  paletteOf,
} from '../../shared/country-look';
import { mulberry32, type Rng } from '../../shared/rng';
import type { Rarity } from '../../shared/scoring';
import { Skyline } from './scenery/architecture';
import { BiomeBackdrop, BiomeGround } from './scenery/biomes';
import { H, INK, PAPER, W, f, r, type Ink } from './scenery/common';
import { FlagStamp } from './scenery/FlagStamp';
import { LANDMARK_HALF_WIDTH, Landmark } from './scenery/landmarks';

interface Props {
  seed: number;
  /** Couleur du continent, si le pays n'a pas de drapeau connu. */
  accent: string;
  rarity: Rarity;
  lat: number;
  countryCode: string;
}

export function Vignette({ seed, accent, rarity, countryCode }: Props) {
  const rng = mulberry32(seed);
  const pal = paletteOf(countryCode, accent);
  const flag = flagOf(countryCode);
  const biome = biomeOf(countryCode);
  const arch = architectureOf(countryCode);
  const landmark = landmarkOf(countryCode);
  const mono = rarity === 'simple';
  const rich = rarity === 'gold' || rarity === 'high';
  const fill = mono ? INK : pal.accent;
  const horizon = H * 0.74;
  const id = `v${countryCode}${seed.toString(36)}`;
  const ink: Ink = { rng, horizon, fill, fill2: mono ? INK : pal.accent2, rich, mono, hatch: `url(#${id}-hatch)` };

  const sunX = r(rng, 150, 270);
  const sunY = r(rng, 24, 50);
  const sunR = r(rng, 11, 18);

  // Monument au centre (un peu décalé selon la graine) ; l'architecture l'entoure.
  const lmX = landmark ? r(rng, 120, 175) : 0;
  const lmS = landmark ? r(rng, 0.85, 1.0) : 1;
  const half = landmark ? (LANDMARK_HALF_WIDTH[landmark] ?? 34) * lmS + 6 : 0;
  // Pylône radio : à droite, ou à gauche quand le monument occupe la droite.
  const mastX = r(rng, 248, 280);
  const zones: [number, number][] = landmark
    ? [
        [-4, lmX - half],
        [lmX + half, mastX - 14],
      ]
    : [[-4, mastX - 14]];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} class="vignette" role="img" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id={`${id}-hatch`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="4" stroke={INK} stroke-width="1" />
        </pattern>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color={mono ? PAPER : pal.sky} />
          <stop offset="1" stop-color={PAPER} />
        </linearGradient>
      </defs>

      <rect width={W} height={H} fill={`url(#${id}-sky)`} />

      {/* Soleil, rayons pour les cartes or */}
      {rarity === 'gold' &&
        Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return (
            <line
              key={i}
              x1={f(sunX + Math.cos(a) * (sunR + 4))}
              y1={f(sunY + Math.sin(a) * (sunR + 4))}
              x2={f(sunX + Math.cos(a) * (sunR + 13))}
              y2={f(sunY + Math.sin(a) * (sunR + 13))}
              stroke={fill}
              stroke-width="2"
              stroke-linecap="round"
            />
          );
        })}
      <circle cx={f(sunX)} cy={f(sunY)} r={f(sunR)} fill={mono ? `url(#${id}-hatch)` : pal.accent2} opacity={mono ? 0.6 : 0.85} />

      <BiomeBackdrop biome={biome} ink={ink} />

      {zones.map(([a, b], i) => (
        <Skyline key={i} arch={arch} ink={ink} x0={a} x1={b} />
      ))}

      <BiomeGround biome={biome} ink={ink} avoid={[...(landmark ? [[lmX - half, lmX + half] as [number, number]] : []), [mastX - 14, mastX + 14], [0, 56]]} />

      {landmark && <Landmark id={landmark} x={lmX} base={horizon + 1} s={lmS} fill={fill} fill2={ink.fill2} rich={rich} mono={mono} />}

      <Mast x={mastX} base={horizon} />

      {rarity === 'gold' && <Birds rng={rng} />}

      {/* Drapeau-timbre, en couleur même sur les cartes simples */}
      {flag && <FlagStamp flag={flag} x={10} y={horizon - 4} uid={id} />}
    </svg>
  );
}

/** Pylône d'émission en treillis avec ondes. */
function Mast({ x, base }: { x: number; base: number }) {
  const h = 74;
  const top = base - h;
  const lattice = [];
  for (let k = 0; k < 6; k++) {
    const y1 = base - (k * h) / 6;
    const y2 = base - ((k + 1) * h) / 6;
    const w1 = 9 * (1 - k / 6);
    const w2 = 9 * (1 - (k + 1) / 6);
    lattice.push(<line key={`a${k}`} x1={f(x - w1)} y1={f(y1)} x2={f(x + w2)} y2={f(y2)} stroke={INK} stroke-width="0.8" />);
    lattice.push(<line key={`b${k}`} x1={f(x + w1)} y1={f(y1)} x2={f(x - w2)} y2={f(y2)} stroke={INK} stroke-width="0.8" />);
  }
  return (
    <g>
      <path d={`M${f(x - 9)} ${f(base)} L${f(x)} ${f(top)} L${f(x + 9)} ${f(base)}`} stroke={INK} stroke-width="1.6" fill="none" />
      {lattice}
      <circle cx={f(x)} cy={f(top)} r="2.5" fill={INK} />
      {[8, 14, 20].map((rad) => (
        <g key={rad} stroke={INK} stroke-width="1.2" fill="none" stroke-linecap="round">
          <path d={`M${f(x - rad * 0.7)} ${f(top - rad * 0.7)} A${rad} ${rad} 0 0 0 ${f(x - rad * 0.7)} ${f(top + rad * 0.7)}`} />
          <path d={`M${f(x + rad * 0.7)} ${f(top - rad * 0.7)} A${rad} ${rad} 0 0 1 ${f(x + rad * 0.7)} ${f(top + rad * 0.7)}`} />
        </g>
      ))}
    </g>
  );
}

function Birds({ rng }: { rng: Rng }) {
  return (
    <g stroke={INK} stroke-width="1.2" fill="none" stroke-linecap="round">
      {Array.from({ length: 4 }, (_, k) => {
        const bx = r(rng, 60, 200);
        const by = r(rng, 12, 40);
        const s = r(rng, 3, 5);
        return <path key={k} d={`M${f(bx - s)} ${f(by)} q${f(s / 2)} ${f(-s / 2)} ${f(s)} 0 q${f(s / 2)} ${f(-s / 2)} ${f(s)} 0`} />;
      })}
    </g>
  );
}
