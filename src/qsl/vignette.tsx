// Vignette procédurale d'une carte QSL : silhouette (ville, montagne, port, plaine) + pylône radio.
// 2 à 3 couleurs : encre, papier, accent du continent. Bichromie (encre seule) pour les cartes simples.

import { mulberry32, type Rng } from '../../shared/rng';
import type { Rarity } from '../../shared/scoring';

const W = 300;
const H = 150;
const INK = '#3a3632';
const PAPER = '#ede3cf';

export type Scene = 'city' | 'mountain' | 'port' | 'plain';
const SCENES: Scene[] = ['city', 'mountain', 'port', 'plain'];

interface Props {
  seed: number;
  accent: string;
  rarity: Rarity;
  /** Pour varier la scène : plus de montagnes aux hautes latitudes, etc. */
  lat: number;
}

const r = (rng: Rng, min: number, max: number) => min + rng() * (max - min);
const f = (n: number) => n.toFixed(1);

export function pickScene(seed: number, lat: number): Scene {
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const weights = Math.abs(lat) > 50 ? [2, 3, 2, 2] : [3, 2, 2, 2];
  let x = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < SCENES.length; i++) {
    x -= weights[i]!;
    if (x < 0) return SCENES[i]!;
  }
  return 'city';
}

export function Vignette({ seed, accent, rarity, lat }: Props) {
  const rng = mulberry32(seed);
  const scene = pickScene(seed, lat);
  const mono = rarity === 'simple';
  const rich = rarity === 'gold' || rarity === 'high';
  const fill = mono ? INK : accent;
  const horizon = H * 0.72;
  const id = `v${seed.toString(36)}`;

  const sunX = r(rng, 40, 260);
  const sunY = r(rng, 28, 60);
  const sunR = r(rng, 14, 24);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} class="vignette" role="img" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id={`${id}-hatch`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="4" stroke={INK} stroke-width="1" />
        </pattern>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color={mono ? PAPER : accent} stop-opacity={mono ? 1 : 0.35} />
          <stop offset="1" stop-color={PAPER} />
        </linearGradient>
      </defs>

      <rect width={W} height={H} fill={`url(#${id}-sky)`} />

      {/* Soleil (ou lune), rayons pour les cartes dorées */}
      {rarity === 'gold' &&
        Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return (
            <line
              key={i}
              x1={f(sunX + Math.cos(a) * (sunR + 4))}
              y1={f(sunY + Math.sin(a) * (sunR + 4))}
              x2={f(sunX + Math.cos(a) * (sunR + 14))}
              y2={f(sunY + Math.sin(a) * (sunR + 14))}
              stroke={fill}
              stroke-width="2"
              stroke-linecap="round"
            />
          );
        })}
      <circle cx={f(sunX)} cy={f(sunY)} r={f(sunR)} fill={mono ? `url(#${id}-hatch)` : fill} opacity={mono ? 0.6 : 0.8} />

      {/* Arrière-plan : collines lointaines */}
      <path d={hills(rng, horizon - 18, 14, 5)} fill={mono ? `url(#${id}-hatch)` : fill} opacity={mono ? 0.35 : 0.45} />

      {scene === 'city' && <City rng={rng} horizon={horizon} fill={fill} rich={rich} />}
      {scene === 'mountain' && <Mountains rng={rng} horizon={horizon} fill={fill} rich={rich} />}
      {scene === 'port' && <Port rng={rng} horizon={horizon} fill={fill} rich={rich} mono={mono} />}
      {scene === 'plain' && <Plain rng={rng} horizon={horizon} rich={rich} />}

      <Mast x={scene === 'port' ? r(rng, 30, 70) : r(rng, 220, 270)} base={horizon} />

      {rarity === 'gold' && <Birds rng={rng} />}

      {/* Sol */}
      <rect y={horizon} width={W} height={H - horizon} fill={scene === 'port' ? 'none' : INK} />
    </svg>
  );
}

function hills(rng: Rng, baseY: number, amp: number, n: number): string {
  let d = `M0 ${H} L0 ${f(baseY)}`;
  const step = W / n;
  for (let i = 0; i < n; i++) {
    const x1 = i * step + step / 2;
    const y1 = baseY - r(rng, amp * 0.3, amp);
    d += ` Q${f(x1)} ${f(y1)} ${f((i + 1) * step)} ${f(baseY - r(rng, 0, amp * 0.3))}`;
  }
  return `${d} L${W} ${H} Z`;
}

function City({ rng, horizon, fill, rich }: { rng: Rng; horizon: number; fill: string; rich: boolean }) {
  const buildings: preact.JSX.Element[] = [];
  let x = r(rng, -10, 10);
  let i = 0;
  while (x < W) {
    const w = r(rng, 12, 30);
    const h = r(rng, 18, 70);
    const top = horizon - h;
    buildings.push(<rect key={`b${i}`} x={f(x)} y={f(top)} width={f(w)} height={f(h + 1)} fill={INK} />);
    const roof = rng();
    if (roof < 0.15) buildings.push(<circle key={`d${i}`} cx={f(x + w / 2)} cy={f(top)} r={f(w / 2.2)} fill={INK} />);
    else if (roof < 0.3) buildings.push(<line key={`s${i}`} x1={f(x + w / 2)} y1={f(top)} x2={f(x + w / 2)} y2={f(top - r(rng, 8, 20))} stroke={INK} stroke-width="1.5" />);
    if (rich) {
      for (let wy = top + 5; wy < horizon - 6; wy += 7) {
        for (let wx = x + 3; wx < x + w - 4; wx += 6) {
          if (rng() < 0.45) buildings.push(<rect key={`w${i}-${f(wx)}-${f(wy)}`} x={f(wx)} y={f(wy)} width="2.5" height="3" fill={fill} />);
        }
      }
    }
    x += w + r(rng, 0, 4);
    i++;
  }
  return <g>{buildings}</g>;
}

function Mountains({ rng, horizon, fill, rich }: { rng: Rng; horizon: number; fill: string; rich: boolean }) {
  const peaks: preact.JSX.Element[] = [];
  let x = -30;
  let i = 0;
  while (x < W) {
    const w = r(rng, 70, 130);
    const h = r(rng, 50, 95);
    const px = x + w / 2;
    const py = horizon - h;
    peaks.push(<path key={`p${i}`} d={`M${f(x)} ${f(horizon + 1)} L${f(px)} ${f(py)} L${f(x + w)} ${f(horizon + 1)} Z`} fill={INK} />);
    if (rich) {
      const s = h * 0.28;
      peaks.push(
        <path
          key={`n${i}`}
          d={`M${f(px - s * 0.55)} ${f(py + s)} L${f(px)} ${f(py)} L${f(px + s * 0.55)} ${f(py + s)} L${f(px + s * 0.2)} ${f(py + s * 0.75)} L${f(px - s * 0.15)} ${f(py + s * 0.95)} Z`}
          fill={PAPER}
        />,
      );
    }
    x += w * r(rng, 0.55, 0.8);
    i++;
  }
  // Sapins au premier plan
  for (let k = 0; k < 9; k++) {
    const tx = r(rng, 0, W);
    const th = r(rng, 10, 18);
    peaks.push(<path key={`t${k}`} d={`M${f(tx - th / 3)} ${f(horizon + 1)} L${f(tx)} ${f(horizon - th)} L${f(tx + th / 3)} ${f(horizon + 1)} Z`} fill={rich ? fill : INK} />);
  }
  return <g>{peaks}</g>;
}

function Port({ rng, horizon, fill, rich, mono }: { rng: Rng; horizon: number; fill: string; rich: boolean; mono: boolean }) {
  const els: preact.JSX.Element[] = [];
  const shore = r(rng, 150, 210);
  // Quai et maisons basses à droite
  let x = shore;
  let i = 0;
  while (x < W) {
    const w = r(rng, 10, 20);
    const h = r(rng, 12, 28);
    els.push(<rect key={`h${i}`} x={f(x)} y={f(horizon - h)} width={f(w)} height={f(h + 1)} fill={INK} />);
    els.push(<path key={`r${i}`} d={`M${f(x - 1)} ${f(horizon - h)} L${f(x + w / 2)} ${f(horizon - h - 6)} L${f(x + w + 1)} ${f(horizon - h)} Z`} fill={INK} />);
    x += w + 1;
    i++;
  }
  // Phare
  const lx = shore - 14;
  els.push(<path key="lh" d={`M${f(lx - 5)} ${f(horizon)} L${f(lx - 3)} ${f(horizon - 46)} L${f(lx + 3)} ${f(horizon - 46)} L${f(lx + 5)} ${f(horizon)} Z`} fill={INK} />);
  els.push(<rect key="lamp" x={f(lx - 4)} y={f(horizon - 53)} width="8" height="7" fill={fill} stroke={INK} stroke-width="1" />);
  if (rich) els.push(<path key="beam" d={`M${f(lx)} ${f(horizon - 50)} L${f(lx - 80)} ${f(horizon - 70)} L${f(lx - 80)} ${f(horizon - 40)} Z`} fill={fill} opacity="0.25" />);
  // Mer
  if (!mono) els.push(<rect key="sea" y={f(horizon)} width={W} height={f(H - horizon)} fill={fill} opacity={0.5} />);
  els.push(<rect key="quay" x={f(shore - 22)} y={f(horizon)} width={f(W - shore + 22)} height={f(H - horizon)} fill={INK} />);
  for (let k = 0; k < 4; k++) {
    const wy = horizon + 6 + k * 8;
    let d = `M0 ${f(wy)}`;
    for (let wx = 0; wx < shore - 22; wx += 12) d += ` q3 -3 6 0 t6 0`;
    els.push(<path key={`wv${k}`} d={d} stroke={INK} stroke-width="1" fill="none" />);
  }
  // Bateau
  const bx = r(rng, 70, shore - 60);
  els.push(<path key="hull" d={`M${f(bx - 16)} ${f(horizon + 2)} L${f(bx + 16)} ${f(horizon + 2)} L${f(bx + 11)} ${f(horizon + 9)} L${f(bx - 11)} ${f(horizon + 9)} Z`} fill={INK} />);
  els.push(<path key="sail" d={`M${f(bx)} ${f(horizon + 1)} L${f(bx)} ${f(horizon - 26)} L${f(bx + 14)} ${f(horizon - 2)} Z`} fill={rich ? PAPER : INK} stroke={INK} stroke-width="1" />);
  return <g>{els}</g>;
}

function Plain({ rng, horizon, rich }: { rng: Rng; horizon: number; rich: boolean }) {
  const els: preact.JSX.Element[] = [<path key="hill" d={hills(rng, horizon, 22, 3)} fill={INK} />];
  // Arbres ronds
  for (let k = 0; k < 6; k++) {
    const tx = r(rng, 10, W - 10);
    const ty = horizon - r(rng, 4, 14);
    const tr = r(rng, 5, 9);
    els.push(<line key={`tt${k}`} x1={f(tx)} y1={f(ty)} x2={f(tx)} y2={f(ty + tr + 6)} stroke={INK} stroke-width="2" />);
    els.push(<circle key={`tc${k}`} cx={f(tx)} cy={f(ty)} r={f(tr)} fill={INK} />);
  }
  // Ferme
  const fx = r(rng, 60, 160);
  const fy = horizon - 10;
  els.push(<rect key="farm" x={f(fx)} y={f(fy - 14)} width="26" height="16" fill={INK} />);
  els.push(<path key="roof" d={`M${f(fx - 3)} ${f(fy - 14)} L${f(fx + 13)} ${f(fy - 26)} L${f(fx + 29)} ${f(fy - 14)} Z`} fill={INK} />);
  if (rich) els.push(<rect key="win" x={f(fx + 10)} y={f(fy - 9)} width="6" height="6" fill={PAPER} />);
  return <g>{els}</g>;
}

/** Pylône d'émission en treillis avec ondes. */
function Mast({ x, base }: { x: number; base: number }) {
  const h = 78;
  const top = base - h;
  const lattice: preact.JSX.Element[] = [];
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
        const bx = r(rng, 60, 240);
        const by = r(rng, 15, 50);
        const s = r(rng, 3, 5);
        return <path key={k} d={`M${f(bx - s)} ${f(by)} q${f(s / 2)} ${f(-s / 2)} ${f(s)} 0 q${f(s / 2)} ${f(-s / 2)} ${f(s)} 0`} />;
      })}
    </g>
  );
}
