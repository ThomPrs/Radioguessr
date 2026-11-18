// Dessin d'une épingle entière, debout, à l'encre : traits d'encre, aplats, hachures, reflet crème.
// Même direction artistique que les cartes QSL. Boîte 40 × 80, pointe en (20, 78).

import type { JSX } from 'preact';
import { STARTER_PIN, pinById, type PinDef, type PinKind } from '../../shared/pins';

export const PIN_BOX = { w: 40, h: 80, tipX: 20, tipY: 78 } as const;

/** Centre de la tête, pour le halo de couleur en multijoueur. */
export const HEAD_CENTER: Record<PinKind, [number, number]> = {
  push: [20, 12],
  ball: [20, 14],
  tack: [20, 21],
  flag: [27, 14],
  drop: [20, 21],
  dart: [20, 16],
  nail: [20, 19],
  star: [20, 16],
};

const INK = '#3a3632';
const CREAM = '#fbf6ea';
const LOCKED_FILL = '#d8cfbd';
const SW = 1.6; // épaisseur du trait d'encre

interface Props {
  id: string;
  /** Hauteur en pixels (la largeur vaut la moitié). */
  height?: number;
  /** false : silhouette à l'encre seule (épingle pas encore obtenue). */
  owned?: boolean;
  /** Couleur du halo derrière la tête (multijoueur). */
  halo?: string;
  title?: string;
}

/** Couleurs effectives : grisées pour une épingle verrouillée. */
interface Ink {
  main: string;
  light: string;
  dark: string;
  accent: string;
  hatch: string; // identifiant du motif de hachures
}

export function PinArt({ id, height = 80, owned = true, halo, title }: Props) {
  const pin = pinById(id) ?? pinById(STARTER_PIN)!;
  const hatch = `pa-hatch-${owned ? 'on' : 'off'}`;
  const c: Ink = owned
    ? { main: pin.colors.main, light: pin.colors.light, dark: pin.colors.dark, accent: pin.colors.accent ?? pin.colors.dark, hatch }
    : { main: LOCKED_FILL, light: '#ece5d6', dark: '#b8ad98', accent: '#b8ad98', hatch };
  const [hx, hy] = HEAD_CENTER[pin.kind];
  return (
    <svg
      class={`pin-art rarity-${pin.rarity} material-${pin.material}${owned ? '' : ' is-locked'}`}
      viewBox={`0 0 ${PIN_BOX.w} ${PIN_BOX.h}`}
      width={height / 2}
      height={height}
      role="img"
      aria-label={title ?? pin.name}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <pattern id={hatch} width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="3" stroke={INK} stroke-width="0.9" opacity={owned ? 0.55 : 0.35} />
        </pattern>
      </defs>

      {/* Ombre au point d'impact : ellipse hachurée */}
      <ellipse cx={PIN_BOX.tipX + 4} cy={PIN_BOX.tipY} rx="7" ry="2" fill={`url(#${hatch})`} />
      {halo && <circle class="pin-halo" cx={hx} cy={hy} r="15.5" fill={halo} opacity="0.3" stroke={halo} stroke-width="2.5" />}
      <g stroke={INK} stroke-width={SW} stroke-linejoin="round" stroke-linecap="round" opacity={owned ? 1 : 0.7}>
        <Shape pin={pin} c={c} owned={owned} />
      </g>
    </svg>
  );
}

/** Aiguille : trait d'encre fin, liseré clair. */
function Needle({ y0, w = 2.2 }: { y0: number; w?: number }) {
  return (
    <g>
      <path d={`M${20 - w / 2} ${y0} L${20 + w / 2} ${y0} L20 ${PIN_BOX.tipY} Z`} fill="#cfd3d8" stroke-width="1" />
      <path d={`M${20 - w / 4} ${y0 + 2} L20 ${PIN_BOX.tipY - 6}`} stroke={CREAM} stroke-width="0.6" />
    </g>
  );
}

/** Reflet : petit croissant crème, sans trait. */
function Glint({ d }: { d: string }) {
  return <path d={d} fill={CREAM} stroke="none" />;
}

/** Étincelle dessinée (or, cristal) : petite croix à quatre branches. */
function Spark({ x, y, s = 3, cls = '' }: { x: number; y: number; s?: number; cls?: string }) {
  return (
    <path
      class={`pin-spark ${cls}`}
      d={`M${x} ${y - s} L${x + s * 0.28} ${y - s * 0.28} L${x + s} ${y} L${x + s * 0.28} ${y + s * 0.28} L${x} ${y + s} L${x - s * 0.28} ${y + s * 0.28} L${x - s} ${y} L${x - s * 0.28} ${y - s * 0.28} Z`}
      fill={CREAM}
      stroke-width="0.9"
    />
  );
}

function Shape({ pin, c, owned }: { pin: PinDef; c: Ink; owned: boolean }): JSX.Element {
  const shade = `url(#${c.hatch})`;
  switch (pin.kind) {
    // ── Punaise ronde : tête bombée, prise, collerette ──
    case 'push':
      return (
        <g>
          <Needle y0={30} />
          <ellipse cx="20" cy="29" rx="8.5" ry="3" fill={c.dark} />
          <path d="M14.5 12 L16 27.5 H24 L25.5 12 Z" fill={c.main} />
          <path d="M21.5 13 L22.5 27 H24 L25.5 12 Z" fill={shade} stroke="none" />
          <ellipse cx="20" cy="11" rx="12" ry="8" fill={c.main} />
          <path d="M8.4 12.6 A12 8 0 0 0 31.6 12.6 A12 5.5 0 0 1 8.4 12.6 Z" fill={c.dark} stroke="none" />
          <Glint d="M12 9 Q14 5 19 4.6 Q15 6.6 13.6 9.6 Z" />
          {pin.material === 'gold' && owned && (
            <>
              <Spark x={28} y={5} s={3.2} cls="twinkle-a" />
              <Spark x={11} y={20} s={2.4} cls="twinkle-b" />
            </>
          )}
        </g>
      );

    // ── Épingle à tête sphérique : verre, nacre, cristal ──
    case 'ball': {
      let head: JSX.Element;
      if (pin.material === 'crystal') {
        head = (
          <g>
            <path d="M20 2 L29 8 L31 17 L25 25 L15 25 L9 17 L11 8 Z" fill={c.main} />
            <path d="M20 2 L29 8 L20 12 Z M11 8 L20 12 L9 17 Z" fill={c.light} stroke-width="1" />
            <path d="M20 12 L31 17 L25 25 Z" fill={c.dark} stroke-width="1" />
            <path d="M20 12 L25 25 L15 25 Z" fill={shade} stroke-width="1" />
            {owned && <Spark x={14} y={7} s={2.6} cls="twinkle-a" />}
          </g>
        );
      } else {
        head = (
          <g>
            <circle cx="20" cy="14" r="11" fill={c.main} />
            {pin.colors.accent && pin.material === 'glass' && owned && (
              // Verre « aurore boréale » : voiles colorés pris dans la sphère
              <g stroke-width="0.9">
                <path d="M10 15 Q15 9 20 13 T30 11 L30.4 15 Q24 19 20 16 T10.4 19 Z" fill={c.light} />
                <path d="M10.6 10.5 Q16 6 22 9 T29.6 7.5 L30 10 Q24 13 20 11 T10.2 14 Z" fill={c.accent} />
              </g>
            )}
            <path d="M9.6 17.5 A11 11 0 0 0 30.4 17.5 A11 8 0 0 1 9.6 17.5 Z" fill={pin.material === 'pearl' ? c.dark : shade} stroke="none" />
            {pin.material === 'pearl' && <path d="M13 18 Q20 23 27 17" fill="none" stroke={c.accent} stroke-width="1.2" />}
            <Glint d="M13 10 Q15 5.4 20 4.6 Q16 7.4 15 11 Z" />
            {pin.material === 'glass' && <path d="M24.5 20.5 L26.5 19 M26.8 22 L28 21.2" stroke={CREAM} stroke-width="1.1" />}
          </g>
        );
      }
      return (
        <g>
          <Needle y0={24} w={1.8} />
          {head}
        </g>
      );
    }

    // ── Punaise plate de bureau : disque vu de biais, hachures métalliques ──
    case 'tack':
      return (
        <g>
          <Needle y0={24} w={2} />
          <ellipse cx="20" cy="23" rx="15" ry="5.5" fill={c.dark} />
          <ellipse cx="20" cy="21" rx="15" ry="5.5" fill={c.main} />
          <path d="M8 19.5 H32 M7 21 H33 M8.5 22.6 H31.5" stroke={c.dark} stroke-width="0.6" opacity="0.7" />
          <ellipse cx="20" cy="21" rx="9" ry="3" fill={c.light} stroke-width="1" />
          <ellipse cx="20" cy="21" rx="2.2" ry="0.9" fill={c.dark} stroke-width="0.8" />
        </g>
      );

    // ── Petit drapeau sur aiguille ──
    case 'flag': {
      const cloth = 'M20 5 Q28 2 37 6 L37 22 Q28 18 20 22 Z';
      let motif: JSX.Element | null = null;
      if (pin.id === 'drapeau-avion' && owned) {
        motif = (
          <g clip-path="url(#pa-flag-clip)" stroke="none">
            {Array.from({ length: 7 }, (_, i) => (
              <path key={i} d={`M${14 + i * 5} 26 L${20 + i * 5} 0 L${22.5 + i * 5} 0 L${16.5 + i * 5} 26 Z`} fill={i % 2 ? c.dark : c.accent} />
            ))}
          </g>
        );
      } else if (pin.id === 'drapeau-damier' && owned) {
        motif = (
          <g clip-path="url(#pa-flag-clip)" stroke="none">
            {Array.from({ length: 16 }, (_, i) => {
              const cx = i % 4;
              const cy = Math.floor(i / 4);
              return (cx + cy) % 2 ? <rect key={i} x={20 + cx * 4.5} y={2 + cy * 5.5} width="4.5" height="5.5" fill={c.accent} /> : null;
            })}
          </g>
        );
      } else if (pin.id === 'drapeau-73' && owned) {
        motif = (
          <text x="28.5" y="17.5" text-anchor="middle" font-family="Archivo Black, sans-serif" font-size="9" fill={c.accent} stroke="none">
            73
          </text>
        );
      }
      return (
        <g>
          <defs>
            <clipPath id="pa-flag-clip">
              <path d={cloth} />
            </clipPath>
          </defs>
          <Needle y0={4} w={1.8} />
          <path d={cloth} fill={c.main} />
          {motif}
          <path d={cloth} fill="none" />
          {/* Plis du tissu */}
          <path d="M26 4.5 Q27 12 26 20 M31.5 4.6 Q33 12 31.8 19.6" fill="none" stroke-width="0.8" opacity="0.6" />
          <circle cx="20" cy="3.5" r="2.4" fill="#e2b84a" stroke-width="1" />
        </g>
      );
    }

    // ── Goutte de cartographe : la pointe de la goutte est le point visé ──
    case 'drop':
      return (
        <g>
          <path d="M20 76 C14 60 5 44 5 22 A15 15 0 1 1 35 22 C35 44 26 60 20 76 Z" fill={c.main} />
          <path d="M28 10 A15 15 0 0 1 35 22 C35 44 26 60 20 76 C24 58 30 42 29 24 Z" fill={shade} stroke="none" />
          {pin.id === 'rose-des-vents' && owned ? (
            <g stroke-width="1">
              <circle cx="20" cy="21" r="9" fill={CREAM} />
              <path d="M20 13 L22 21 L20 29 L18 21 Z" fill={c.accent} />
              <path d="M12 21 L20 19 L28 21 L20 23 Z" fill={c.dark} />
              <path d="M20 13 L22 21 L20 21 Z" fill="#d9483b" />
            </g>
          ) : (
            <circle cx="20" cy="21" r="5.5" fill={owned ? (pin.colors.accent ?? CREAM) : LOCKED_FILL} />
          )}
          <Glint d="M9.5 15 Q11 9 16 7.4 Q12.4 10.6 11.6 15.8 Z" />
        </g>
      );

    // ── Fléchette : empennage, fût, pointe ──
    case 'dart':
      return (
        <g>
          <Needle y0={50} w={2.4} />
          <path d="M20 2 L31 6 L22 20 Z" fill={c.accent} />
          <path d="M20 2 L9 6 L18 20 Z" fill={c.accent} />
          <path d="M20 2 L9 6 L13.5 13 Z" fill={shade} stroke="none" />
          <path d="M20 2 V32" stroke-width="1.6" />
          <rect x="16.5" y="30" width="7" height="21" rx="2.5" fill={c.main} />
          <path d="M16.5 34 H23.5 M16.5 38 H23.5 M16.5 42 H23.5 M16.5 46 H23.5" stroke-width="0.8" />
          <path d="M21.5 31 V50" stroke={CREAM} stroke-width="0.8" />
        </g>
      );

    // ── Clou de tapissier : tête bombée, tige ──
    case 'nail':
      return (
        <g>
          <path d="M18.6 24 H21.4 L20.3 78 H19.7 Z" fill="#cfd3d8" stroke-width="1" />
          <ellipse cx="20" cy="24" rx="12" ry="3.5" fill={c.dark} />
          <path d="M8 23 A12 10 0 0 1 32 23 Z" fill={c.main} />
          <path d="M24 13.8 A12 10 0 0 1 32 23 H25 Q25.5 17 24 13.8 Z" fill={shade} stroke="none" />
          <Glint d="M12.4 19 Q13.6 15 18 13.6 Q14.6 16.4 14.4 19.6 Z" />
        </g>
      );

    // ── Étoile polaire : tête en étoile, rayons à l'encre ──
    case 'star': {
      const pts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? 14 : 6;
        pts.push(`${(20 + Math.cos(a) * r).toFixed(1)} ${(16 + Math.sin(a) * r).toFixed(1)}`);
      }
      return (
        <g>
          <Needle y0={22} />
          {owned && (
            <g class="pin-rays" stroke-width="1.1">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
                const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
                return <path key={k} d={`M${20 + Math.cos(a) * 16} ${16 + Math.sin(a) * 16} L${20 + Math.cos(a) * 19} ${16 + Math.sin(a) * 19}`} />;
              })}
            </g>
          )}
          <path d={`M${pts.join(' L')} Z`} fill={c.main} />
          <path d={`M20 16 L${pts[2]} L${pts[3]} L${pts[4]} Z`} fill={c.dark} stroke="none" />
          <Glint d="M17 8 Q18 5 20 3.5 Q19 6.6 18.6 9 Z" />
          {owned && <Spark x={30} y={26} s={2.4} cls="twinkle-b" />}
        </g>
      );
    }
  }
}
