// Paysages par biome : arrière-plan (au loin) et sol + végétation (premier plan).

import type { JSX } from 'preact';
import type { Biome } from '../../../shared/country-look';
import { H, INK, PAPER, W, f, hills, r, type Ink } from './common';

type El = JSX.Element;

// ── Végétation ─────────────────────────────────────────────────────────────

export function Palm({ x, base, h, key }: { x: number; base: number; h: number; key?: string }) {
  const top = base - h;
  const lean = h * 0.15;
  const fronds = [-160, -125, -90, -55, -20].map((deg, i) => {
    const a = (deg * Math.PI) / 180;
    const len = h * 0.42;
    const ex = x + lean + Math.cos(a) * len;
    const ey = top + Math.sin(a) * len * 0.5 + len * 0.35;
    return <path key={i} d={`M${f(x + lean)} ${f(top)} Q${f((x + lean + ex) / 2)} ${f(top - len * 0.25)} ${f(ex)} ${f(ey)}`} stroke={INK} stroke-width="2.2" fill="none" stroke-linecap="round" />;
  });
  return (
    <g key={key}>
      <path d={`M${f(x)} ${f(base + 1)} Q${f(x + lean * 0.2)} ${f(base - h * 0.5)} ${f(x + lean)} ${f(top)}`} stroke={INK} stroke-width="2.4" fill="none" />
      {fronds}
    </g>
  );
}

export function Acacia({ x, base, h }: { x: number; base: number; h: number }) {
  const top = base - h;
  return (
    <g>
      <path d={`M${f(x)} ${f(base + 1)} L${f(x)} ${f(top + 4)} M${f(x)} ${f(top + h * 0.45)} L${f(x - h * 0.35)} ${f(top + 3)} M${f(x)} ${f(top + h * 0.4)} L${f(x + h * 0.4)} ${f(top + 3)}`} stroke={INK} stroke-width="1.8" fill="none" />
      <ellipse cx={f(x)} cy={f(top + 1)} rx={f(h * 0.75)} ry={f(h * 0.13)} fill={INK} />
    </g>
  );
}

function Pine({ x, base, h, fill }: { x: number; base: number; h: number; fill: string }) {
  return (
    <path
      d={`M${f(x)} ${f(base - h)} L${f(x + h * 0.28)} ${f(base - h * 0.45)} L${f(x + h * 0.14)} ${f(base - h * 0.45)} L${f(x + h * 0.36)} ${f(base + 1)} L${f(x - h * 0.36)} ${f(base + 1)} L${f(x - h * 0.14)} ${f(base - h * 0.45)} L${f(x - h * 0.28)} ${f(base - h * 0.45)} Z`}
      fill={fill}
    />
  );
}

function RoundTree({ x, base, s }: { x: number; base: number; s: number }) {
  return (
    <g>
      <line x1={f(x)} y1={f(base - s)} x2={f(x)} y2={f(base + 1)} stroke={INK} stroke-width="2" />
      <circle cx={f(x)} cy={f(base - s - s * 0.5)} r={f(s * 0.85)} fill={INK} />
    </g>
  );
}

function Cypress({ x, base, h }: { x: number; base: number; h: number }) {
  return <path d={`M${f(x)} ${f(base - h)} Q${f(x + h * 0.16)} ${f(base - h * 0.5)} ${f(x + h * 0.08)} ${f(base + 1)} L${f(x - h * 0.08)} ${f(base + 1)} Q${f(x - h * 0.16)} ${f(base - h * 0.5)} ${f(x)} ${f(base - h)} Z`} fill={INK} />;
}

// ── Arrière-plan ───────────────────────────────────────────────────────────

/** Relief lointain, dessiné juste après le ciel. */
export function BiomeBackdrop({ biome, ink }: { biome: Biome; ink: Ink }) {
  const { rng, horizon, fill, mono, hatch } = ink;
  const far = mono ? hatch : fill;
  const els: El[] = [];
  switch (biome) {
    case 'desert': {
      // Dunes douces, en deux plans
      els.push(<path key="d1" d={hills(rng, horizon - 14, 16, 3)} fill={far} opacity={mono ? 0.35 : 0.35} />);
      els.push(<path key="d2" d={hills(rng, horizon - 4, 10, 2)} fill={far} opacity={mono ? 0.5 : 0.55} />);
      break;
    }
    case 'mountain':
    case 'snow': {
      let x = -40;
      let i = 0;
      while (x < W) {
        const w = r(rng, 80, 140);
        const h = r(rng, 40, biome === 'mountain' ? 80 : 55);
        const px = x + w / 2;
        const py = horizon - h;
        els.push(<path key={`m${i}`} d={`M${f(x)} ${f(horizon + 1)} L${f(px)} ${f(py)} L${f(x + w)} ${f(horizon + 1)} Z`} fill={far} opacity={mono ? 0.45 : 0.5} />);
        const s = h * 0.3;
        els.push(<path key={`c${i}`} d={`M${f(px - s * 0.6)} ${f(py + s)} L${f(px)} ${f(py)} L${f(px + s * 0.6)} ${f(py + s)} L${f(px + s * 0.2)} ${f(py + s * 0.8)} L${f(px - s * 0.2)} ${f(py + s)} Z`} fill={PAPER} />);
        x += w * r(rng, 0.55, 0.8);
        i++;
      }
      break;
    }
    case 'island':
    case 'mediterranean':
      els.push(<path key="h" d={hills(rng, horizon - 10, 14, 3)} fill={far} opacity={0.35} />);
      break;
    case 'steppe':
      els.push(<path key="h" d={hills(rng, horizon - 6, 8, 2)} fill={far} opacity={0.35} />);
      break;
    default:
      els.push(<path key="h" d={hills(rng, horizon - 16, 14, 5)} fill={far} opacity={mono ? 0.35 : 0.45} />);
  }
  return <g>{els}</g>;
}

// ── Sol et premier plan ────────────────────────────────────────────────────

/** Sol et végétation, dessinés devant l'architecture. `free` : zones horizontales où planter des arbres. */
export function BiomeGround({ biome, ink, avoid }: { biome: Biome; ink: Ink; avoid: [number, number][] }) {
  const { rng, horizon, fill, mono } = ink;
  const els: El[] = [];
  const spot = (min = 8, max = W - 8): number | null => {
    for (let k = 0; k < 6; k++) {
      const x = r(rng, min, max);
      if (!avoid.some(([a, b]) => x > a && x < b)) return x;
    }
    return null;
  };
  const plant = (n: number, draw: (x: number, i: number) => El) => {
    for (let i = 0; i < n; i++) {
      const x = spot();
      if (x != null) els.push(draw(x, i));
    }
  };

  switch (biome) {
    case 'desert': {
      els.push(<rect key="g" y={f(horizon)} width={W} height={f(H - horizon)} fill={mono ? PAPER : fill} opacity={mono ? 1 : 0.55} />);
      for (let k = 0; k < 4; k++) {
        const y = horizon + 6 + k * 9;
        els.push(<path key={`l${k}`} d={`M${f(r(rng, -20, 40))} ${f(y)} q40 -5 80 0 t80 0 t80 0`} stroke={INK} stroke-width="0.9" fill="none" opacity="0.6" />);
      }
      els.push(<line key="hz" x1="0" y1={f(horizon)} x2={W} y2={f(horizon)} stroke={INK} stroke-width="1.2" />);
      plant(2, (x, i) => <Palm key={`p${i}`} x={x} base={horizon + 3} h={r(rng, 22, 32)} />);
      break;
    }
    case 'savanna': {
      els.push(<rect key="g" y={f(horizon)} width={W} height={f(H - horizon)} fill={INK} />);
      plant(3, (x, i) => <Acacia key={`a${i}`} x={x} base={horizon} h={r(rng, 18, 30)} />);
      for (let k = 0; k < 14; k++) {
        const gx = r(rng, 0, W);
        els.push(<path key={`gr${k}`} d={`M${f(gx)} ${f(horizon + 1)} l-2 -5 M${f(gx)} ${f(horizon + 1)} l1 -6 M${f(gx)} ${f(horizon + 1)} l3 -4`} stroke={INK} stroke-width="1" />);
      }
      break;
    }
    case 'tropical': {
      els.push(<rect key="g" y={f(horizon)} width={W} height={f(H - horizon)} fill={INK} />);
      plant(4, (x, i) => <Palm key={`p${i}`} x={x} base={horizon} h={r(rng, 26, 42)} />);
      plant(5, (x, i) => <circle key={`b${i}`} cx={f(x)} cy={f(horizon - 3)} r={f(r(rng, 5, 9))} fill={INK} />);
      break;
    }
    case 'island': {
      // Mer, plage, palmiers
      els.push(<rect key="sea" y={f(horizon)} width={W} height={f(H - horizon)} fill={mono ? PAPER : fill} opacity={mono ? 1 : 0.5} />);
      for (let k = 0; k < 4; k++) {
        const wy = horizon + 7 + k * 8;
        let d = `M0 ${f(wy)}`;
        for (let wx = 0; wx < W; wx += 12) d += ` q3 -3 6 0 t6 0`;
        els.push(<path key={`wv${k}`} d={d} stroke={INK} stroke-width="1" fill="none" />);
      }
      els.push(<path key="beach" d={`M${f(W * 0.45)} ${f(horizon + 1)} Q${f(W * 0.7)} ${f(horizon - 4)} ${W} ${f(horizon - 2)} L${W} ${H} L${f(W * 0.62)} ${H} Z`} fill={INK} />);
      els.push(<line key="hz" x1="0" y1={f(horizon)} x2={W} y2={f(horizon)} stroke={INK} stroke-width="1.2" />);
      plant(2, (x, i) => <Palm key={`p${i}`} x={Math.max(x, W * 0.62)} base={horizon} h={r(rng, 26, 38)} />);
      break;
    }
    case 'mediterranean': {
      // Bande de mer au loin, sol d'encre, cyprès
      els.push(<rect key="sea" y={f(horizon - 3)} width={W} height="4" fill={mono ? INK : fill} opacity={0.55} />);
      els.push(<rect key="g" y={f(horizon)} width={W} height={f(H - horizon)} fill={INK} />);
      plant(3, (x, i) => <Cypress key={`c${i}`} x={x} base={horizon} h={r(rng, 20, 32)} />);
      break;
    }
    case 'snow': {
      // Neige : sol papier cerné d'encre, sapins
      els.push(<path key="g" d={hills(rng, horizon + 2, 6, 3)} fill={PAPER} stroke={INK} stroke-width="1.4" />);
      plant(6, (x, i) => <Pine key={`t${i}`} x={x} base={horizon + 3} h={r(rng, 12, 22)} fill={INK} />);
      break;
    }
    case 'mountain': {
      els.push(<rect key="g" y={f(horizon)} width={W} height={f(H - horizon)} fill={INK} />);
      plant(7, (x, i) => <Pine key={`t${i}`} x={x} base={horizon} h={r(rng, 10, 18)} fill={ink.rich && !mono ? fill : INK} />);
      break;
    }
    case 'steppe': {
      els.push(<rect key="g" y={f(horizon)} width={W} height={f(H - horizon)} fill={INK} />);
      for (let k = 0; k < 22; k++) {
        const gx = r(rng, 0, W);
        els.push(<path key={`gr${k}`} d={`M${f(gx)} ${f(horizon + 1)} l-1.5 -4 M${f(gx)} ${f(horizon + 1)} l1.5 -4`} stroke={INK} stroke-width="1" />);
      }
      break;
    }
    default: {
      els.push(<path key="g" d={hills(rng, horizon, 8, 3)} fill={INK} />);
      plant(5, (x, i) => <RoundTree key={`t${i}`} x={x} base={horizon} s={r(rng, 5, 8)} />);
    }
  }
  return <g>{els}</g>;
}
