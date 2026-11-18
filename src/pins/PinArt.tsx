// Dessin d'une épingle entière, debout : tête, aiguille, ombre. Boîte 40 × 80, pointe en (20, 78).
// Le rendu dépend de la forme (punaise, tête de verre, drapeau…) et de la matière (plastique, verre, or…).

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

const NEEDLE = '#8a8f96';

interface Props {
  id: string;
  /** Hauteur en pixels (la largeur vaut la moitié). */
  height?: number;
  /** false : silhouette grisée (épingle pas encore obtenue). */
  owned?: boolean;
  /** Couleur du halo derrière la tête (multijoueur). */
  halo?: string;
  title?: string;
}

export function PinArt({ id, height = 80, owned = true, halo, title }: Props) {
  const pin = pinById(id) ?? pinById(STARTER_PIN)!;
  const g = `pa-${pin.id}`; // préfixe des dégradés (identiques pour toutes les copies de la même épingle)
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
        <radialGradient id={`${g}-r`} cx="0.36" cy="0.3" r="0.75">
          <stop offset="0" stop-color={pin.colors.light} />
          <stop offset="0.45" stop-color={pin.colors.main} />
          <stop offset="1" stop-color={pin.colors.dark} />
        </radialGradient>
        <linearGradient id={`${g}-l`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color={pin.colors.dark} />
          <stop offset="0.35" stop-color={pin.colors.light} />
          <stop offset="0.6" stop-color={pin.colors.main} />
          <stop offset="1" stop-color={pin.colors.dark} />
        </linearGradient>
        <linearGradient id={`${g}-n`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#6b6f76" />
          <stop offset="0.45" stop-color="#e6e8eb" />
          <stop offset="1" stop-color="#6b6f76" />
        </linearGradient>
      </defs>

      {/* Ombre au point d'impact */}
      <ellipse cx={PIN_BOX.tipX + 4} cy={PIN_BOX.tipY} rx="7" ry="2" fill="#3a3632" opacity="0.28" />
      {halo && <circle class="pin-halo" cx={hx} cy={hy} r="15.5" fill={halo} opacity="0.35" stroke={halo} stroke-width="2.5" />}
      <Shape pin={pin} g={g} />
    </svg>
  );
}

/** Aiguille métallique de y0 jusqu'à la pointe. */
function Needle({ y0, g, width = 2 }: { y0: number; g: string; width?: number }) {
  return (
    <g>
      <path d={`M${20 - width / 2} ${y0} L${20 + width / 2} ${y0} L20.3 ${PIN_BOX.tipY} L19.7 ${PIN_BOX.tipY} Z`} fill={`url(#${g}-n)`} />
      <path d={`M20 ${y0} V${PIN_BOX.tipY - 1}`} stroke={NEEDLE} stroke-width="0.3" opacity="0.6" />
    </g>
  );
}

/** Reflet spéculaire. */
function Shine({ cx, cy, rx = 3, ry = 2, o = 0.7 }: { cx: number; cy: number; rx?: number; ry?: number; o?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#fff" opacity={o} transform={`rotate(-30 ${cx} ${cy})`} />;
}

function Sparkle({ x, y, s = 3 }: { x: number; y: number; s?: number }) {
  return (
    <path
      class="pin-sparkle"
      d={`M${x} ${y - s} L${x + s * 0.25} ${y - s * 0.25} L${x + s} ${y} L${x + s * 0.25} ${y + s * 0.25} L${x} ${y + s} L${x - s * 0.25} ${y + s * 0.25} L${x - s} ${y} L${x - s * 0.25} ${y - s * 0.25} Z`}
      fill="#fff"
    />
  );
}

function Shape({ pin, g }: { pin: PinDef; g: string }): JSX.Element {
  const { main, light, dark, accent } = pin.colors;
  const edge = { stroke: dark, 'stroke-width': 0.8 };
  switch (pin.kind) {
    // ── Punaise ronde : tête bombée, prise, collerette ──
    case 'push':
      return (
        <g>
          <Needle y0={30} g={g} />
          <ellipse cx="20" cy="29" rx="8.5" ry="3" fill={`url(#${g}-l)`} {...edge} />
          <path d="M14.5 12 L16 27.5 H24 L25.5 12 Z" fill={`url(#${g}-l)`} {...edge} />
          <ellipse cx="20" cy="11" rx="12" ry="8" fill={`url(#${g}-r)`} {...edge} />
          <Shine cx={15.5} cy={8} rx={3.5} ry={1.8} />
          {pin.material === 'gold' && (
            <>
              <Sparkle x={27} y={6} s={3.2} />
              <Sparkle x={13} y={20} s={2.2} />
            </>
          )}
        </g>
      );

    // ── Épingle à tête sphérique : verre, nacre, cristal ──
    case 'ball': {
      const head =
        pin.material === 'crystal' ? (
          <g>
            <path d="M20 2 L29 8 L31 17 L25 25 L15 25 L9 17 L11 8 Z" fill={main} {...edge} />
            <path d="M20 2 L29 8 L20 12 Z" fill={light} />
            <path d="M11 8 L20 12 L9 17 Z" fill={light} opacity="0.7" />
            <path d="M20 12 L31 17 L25 25 Z" fill={dark} opacity="0.6" />
            <path d="M20 12 L25 25 L15 25 Z" fill={dark} opacity="0.35" />
            <path d="M20 12 L29 8 L31 17 Z" fill={light} opacity="0.35" />
            <Sparkle x={14} y={8} s={2.5} />
          </g>
        ) : (
          <g>
            <circle cx="20" cy="14" r="11" fill={`url(#${g}-r)`} opacity={pin.material === 'glass' ? 0.94 : 1} {...edge} />
            {accent && pin.material === 'glass' && (
              // Verre « aurore boréale » : voiles colorés pris dans la sphère
              <g opacity="0.75">
                <path d="M10 15 Q15 9 20 13 T30 11 L30 15 Q24 19 20 16 T10 19 Z" fill={light} />
                <path d="M10 11 Q16 6 22 9 T30 7 L30 10 Q24 13 20 11 T10 14 Z" fill={accent} opacity="0.8" />
              </g>
            )}
            {pin.material === 'pearl' && <path d="M12 18 A9 9 0 0 0 27 19" fill="none" stroke={accent} stroke-width="1.6" opacity="0.6" />}
            {pin.material === 'glass' && <ellipse cx="22" cy="21" rx="5" ry="2" fill={light} opacity="0.45" />}
            <Shine cx={16} cy={9.5} rx={3.2} ry={2} o={0.85} />
          </g>
        );
      return (
        <g>
          <Needle y0={24} g={g} width={1.6} />
          {head}
        </g>
      );
    }

    // ── Punaise plate de bureau : disque vu de biais ──
    case 'tack':
      return (
        <g>
          <Needle y0={24} g={g} width={1.8} />
          <ellipse cx="20" cy="23" rx="15" ry="5.5" fill={dark} />
          <ellipse cx="20" cy="21" rx="15" ry="5.5" fill={`url(#${g}-l)`} {...edge} />
          <ellipse cx="20" cy="21" rx="10" ry="3.4" fill="none" stroke={light} stroke-width="0.8" opacity="0.8" />
          <ellipse cx="20" cy="21" rx="2.4" ry="1" fill={dark} opacity="0.6" />
          <Shine cx={13} cy={19.5} rx={3.5} ry={1} o={0.8} />
        </g>
      );

    // ── Petit drapeau sur aiguille ──
    case 'flag': {
      const cloth = 'M20 5 Q28 2 37 6 L37 22 Q28 18 20 22 Z';
      let motif: JSX.Element | null = null;
      if (pin.id === 'drapeau-avion') {
        motif = (
          <g clip-path={`url(#${g}-clip)`}>
            {Array.from({ length: 7 }, (_, i) => (
              <path key={i} d={`M${14 + i * 5} 26 L${20 + i * 5} 0 L${22.5 + i * 5} 0 L${16.5 + i * 5} 26 Z`} fill={i % 2 ? dark : accent} />
            ))}
          </g>
        );
      } else if (pin.id === 'drapeau-damier') {
        motif = (
          <g clip-path={`url(#${g}-clip)`}>
            {Array.from({ length: 16 }, (_, i) => {
              const cx = i % 4;
              const cy = Math.floor(i / 4);
              return (cx + cy) % 2 ? <rect key={i} x={20 + cx * 4.5} y={2 + cy * 5.5} width="4.5" height="5.5" fill={accent} /> : null;
            })}
          </g>
        );
      } else if (pin.id === 'drapeau-73') {
        motif = (
          <g>
            <path d={cloth} fill="none" stroke={accent} stroke-width="1.2" stroke-dasharray="1.5 1.2" transform="translate(28.5 13.5) scale(0.82) translate(-28.5 -13.5)" />
            <text x="28.5" y="17.5" text-anchor="middle" font-family="Archivo Black, sans-serif" font-size="9" fill={accent}>
              73
            </text>
          </g>
        );
      }
      return (
        <g>
          <defs>
            <clipPath id={`${g}-clip`}>
              <path d={cloth} />
            </clipPath>
          </defs>
          <Needle y0={4} g={g} width={1.6} />
          <path d={cloth} fill={main} {...edge} />
          {motif}
          <path d="M20 5 Q28 2 37 6 L37 9 Q28 5 20 8 Z" fill="#fff" opacity="0.2" />
          <circle cx="20" cy="3.5" r="2.4" fill="#e2b84a" stroke="#8a6d12" stroke-width="0.6" />
        </g>
      );
    }

    // ── Goutte de cartographe : la pointe de la goutte est le point visé ──
    case 'drop':
      return (
        <g>
          <path d="M20 76 C14 60 5 44 5 22 A15 15 0 1 1 35 22 C35 44 26 60 20 76 Z" fill={`url(#${g}-r)`} {...edge} />
          {pin.id === 'rose-des-vents' ? (
            <g>
              <circle cx="20" cy="21" r="9" fill="#fbf6ea" stroke={accent} stroke-width="1.2" />
              <path d="M20 13 L22 21 L20 29 L18 21 Z" fill={accent} />
              <path d="M12 21 L20 19 L28 21 L20 23 Z" fill={dark} />
              <path d="M20 13 L22 21 L20 21 Z" fill="#d9483b" />
            </g>
          ) : (
            <circle cx="20" cy="21" r="5.5" fill={accent} {...edge} />
          )}
          <Shine cx={13} cy={13} rx={3.5} ry={2} o={0.6} />
        </g>
      );

    // ── Fléchette : empennage, fût, pointe ──
    case 'dart':
      return (
        <g>
          <Needle y0={50} g={g} width={2.2} />
          <path d="M20 2 L31 6 L22 20 Z" fill={accent} {...edge} />
          <path d="M20 2 L9 6 L18 20 Z" fill={accent} {...edge} />
          <path d="M19.2 2 H20.8 V32 H19.2 Z" fill={dark} />
          <rect x="16.5" y="30" width="7" height="21" rx="2.5" fill={`url(#${g}-l)`} {...edge} />
          {[34, 38, 42, 46].map((y) => (
            <path key={y} d={`M16.5 ${y} H23.5`} stroke={light} stroke-width="0.7" opacity="0.7" />
          ))}
        </g>
      );

    // ── Clou de tapissier : tête bombée, tige épaisse ──
    case 'nail':
      return (
        <g>
          <path d="M18.6 24 H21.4 L20.4 78 H19.6 Z" fill={`url(#${g}-n)`} />
          <ellipse cx="20" cy="24" rx="12" ry="3.5" fill={dark} />
          <path d="M8 23 A12 10 0 0 1 32 23 Z" fill={`url(#${g}-r)`} {...edge} />
          <Shine cx={15} cy={16} rx={3} ry={1.8} o={0.8} />
        </g>
      );

    // ── Étoile polaire : tête en étoile dorée, halo ──
    case 'star': {
      const pts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? 14 : 6;
        pts.push(`${(20 + Math.cos(a) * r).toFixed(1)} ${(16 + Math.sin(a) * r).toFixed(1)}`);
      }
      return (
        <g>
          <Needle y0={22} g={g} />
          <circle cx="20" cy="16" r="15" fill={light} opacity="0.45" class="pin-glow" />
          <path d={`M${pts.join(' L')} Z`} fill={`url(#${g}-r)`} {...edge} />
          <Sparkle x={14} y={10} s={2.6} />
          <Sparkle x={29} y={22} s={2} />
        </g>
      );
    }
  }
}
