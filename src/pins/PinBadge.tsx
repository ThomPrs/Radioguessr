// Dessin SVG d'une épingle (pin's émaillé) : forme selon la rareté, contour métallique, émail, reflet.

import type { JSX } from 'preact';
import { pinById, type PinDef, type PinRarity } from '../../shared/pins';

const PAPER = '#ede3cf';
const INK = '#3a3632';
const RED = '#d9483b';
const BLUE = '#2f5d8c';
const GOLD = '#e2b84a';
const SKY = '#8ec3d6';
const GREEN = '#4f7a4a';

const ROSETTE = (() => {
  // Rosace à 14 lobes pour les légendaires
  const pts: string[] = [];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 47 : 40;
    pts.push(`${(50 + Math.cos(a) * r).toFixed(1)} ${(50 + Math.sin(a) * r).toFixed(1)}`);
  }
  return `M${pts.join(' L')} Z`;
})();

const SHAPES: Record<PinRarity, string> = {
  common: 'M50 6 A44 44 0 1 1 49.9 6 Z',
  rare: 'M24 8 H76 Q92 8 92 24 V76 Q92 92 76 92 H24 Q8 92 8 76 V24 Q8 8 24 8 Z',
  epic: 'M50 4 L90 17 V50 C90 74 72 89 50 97 C28 89 10 74 10 50 V17 Z',
  legendary: ROSETTE,
};

const METAL: Record<PinRarity, { rim: string; dark: string }> = {
  common: { rim: '#cfd3d8', dark: '#6b6f76' },
  rare: { rim: GOLD, dark: '#8a6d12' },
  epic: { rim: GOLD, dark: '#8a6d12' },
  legendary: { rim: '#f3d778', dark: '#8a6d12' },
};

interface Props {
  id: string;
  /** Taille en pixels (carré). */
  size?: number;
  /** false : silhouette grisée (épingle pas encore obtenue). */
  owned?: boolean;
  title?: string;
}

export function PinBadge({ id, size = 64, owned = true, title }: Props) {
  const pin = pinById(id);
  if (!pin) return null;
  const metal = METAL[pin.rarity];
  const clip = `pin-clip-${pin.id}`;
  return (
    <svg
      class={`pin-badge rarity-${pin.rarity}${owned ? '' : ' is-locked'}`}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={title ?? pin.name}
    >
      <defs>
        <clipPath id={clip}>
          <path d={SHAPES[pin.rarity]} transform="translate(50 50) scale(0.84) translate(-50 -50)" />
        </clipPath>
      </defs>
      {/* Ombre portée, contour métal, bord sombre */}
      <path d={SHAPES[pin.rarity]} fill="rgb(0 0 0 / 0.3)" transform="translate(2 3)" />
      <path d={SHAPES[pin.rarity]} fill={metal.rim} stroke={metal.dark} stroke-width="2" />
      {/* Émail et motif */}
      <g clip-path={`url(#${clip})`}>
        <rect width="100" height="100" fill={pin.bg} />
        <Motif pin={pin} line={metal.dark} />
      </g>
      <path d={SHAPES[pin.rarity]} fill="none" stroke={metal.dark} stroke-width="1.4" transform="translate(50 50) scale(0.84) translate(-50 -50)" />
      {/* Reflet d'émail */}
      <ellipse cx="34" cy="26" rx="18" ry="8" fill="#fff" opacity="0.28" transform="rotate(-30 34 26)" />
    </svg>
  );
}

function Motif({ pin, line }: { pin: PinDef; line: string }): JSX.Element {
  const s = { stroke: line, 'stroke-width': 1.6, 'stroke-linejoin': 'round' as const };
  switch (pin.id) {
    case 'micro':
      return (
        <g {...s}>
          <path d="M32 46 Q32 66 50 66 Q68 66 68 46" fill="none" stroke={PAPER} stroke-width="4" />
          <rect x="40" y="20" width="20" height="36" rx="10" fill={PAPER} />
          <path d="M42 30 H58 M42 36 H58 M42 42 H58" stroke={INK} />
          <path d="M50 66 V78" stroke={PAPER} stroke-width="4" />
          <rect x="36" y="78" width="28" height="6" rx="2" fill={PAPER} />
        </g>
      );
    case 'antenne':
      return (
        <g {...s}>
          <path d="M50 82 L62 24" stroke={PAPER} stroke-width="4" />
          <circle cx="62.5" cy="21" r="4.5" fill={RED} />
          <path d="M70 16 Q76 22 70 28 M75 12 Q84 22 75 32" fill="none" stroke={PAPER} stroke-width="2.5" />
          <rect x="36" y="78" width="28" height="8" rx="3" fill={INK} stroke={PAPER} />
        </g>
      );
    case 'casque':
      return (
        <g {...s}>
          <path d="M26 60 A24 24 0 0 1 74 60" fill="none" stroke={PAPER} stroke-width="6" />
          <rect x="18" y="54" width="16" height="24" rx="6" fill={PAPER} />
          <rect x="66" y="54" width="16" height="24" rx="6" fill={PAPER} />
          <path d="M50 64 V80" stroke={INK} stroke-dasharray="3 3" />
        </g>
      );
    case 'vinyle':
      return (
        <g {...s}>
          <circle cx="50" cy="50" r="32" fill={INK} />
          <circle cx="50" cy="50" r="25" fill="none" stroke="#5a5550" />
          <circle cx="50" cy="50" r="19" fill="none" stroke="#5a5550" />
          <circle cx="50" cy="50" r="10" fill={RED} />
          <circle cx="50" cy="50" r="2" fill={PAPER} />
          <path d="M28 34 A26 26 0 0 1 40 24" fill="none" stroke="#fff" opacity="0.5" stroke-width="2" />
        </g>
      );
    case 'boussole':
      return (
        <g {...s}>
          <circle cx="50" cy="50" r="30" fill={PAPER} />
          <path d="M50 22 L57 50 L50 50 Z" fill={RED} />
          <path d="M50 22 L43 50 L50 50 Z" fill="#a53a30" />
          <path d="M50 78 L57 50 L43 50 Z" fill={INK} />
          <circle cx="50" cy="50" r="3" fill={GOLD} />
          <text x="50" y="19" text-anchor="middle" font-family="Archivo Black, sans-serif" font-size="9" fill={PAPER} stroke="none">
            N
          </text>
        </g>
      );
    case 'phare':
      return (
        <g {...s}>
          <path d="M50 30 L18 18 L18 34 Z M50 30 L82 18 L82 34 Z" fill="#f6e7a1" opacity="0.8" stroke="none" />
          <path d="M40 84 L44 34 H56 L60 84 Z" fill={PAPER} />
          <path d="M42.5 52 H57.5 L58.5 62 H41.5 Z M41 72 H59 L60 82 H40 Z" fill={RED} stroke="none" />
          <rect x="42" y="24" width="16" height="10" fill="#f6e7a1" />
          <path d="M40 24 L50 16 L60 24 Z" fill={RED} />
          <path d="M10 88 Q20 84 30 88 T50 88 T70 88 T90 88" fill="none" stroke={PAPER} />
        </g>
      );
    case 'par-avion':
      return (
        <g {...s}>
          <rect x="18" y="30" width="64" height="42" fill="#fffaf0" />
          <path d="M18 30 L50 54 L82 30" fill="none" stroke={INK} />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <path key={i} d={`M${18 + i * 8} 72 l6 0 l-4 -6 l-6 0 Z`} fill={i % 2 ? BLUE : RED} stroke="none" />
          ))}
          <text x="50" y="66" text-anchor="middle" font-family="Archivo Black, sans-serif" font-size="7" fill={BLUE} stroke="none">
            PAR AVION
          </text>
        </g>
      );
    case 'morse':
      return (
        <g {...s}>
          <text x="50" y="34" text-anchor="middle" font-family="Archivo Black, sans-serif" font-size="14" fill={PAPER} stroke="none">
            · — ·
          </text>
          <rect x="20" y="62" width="60" height="12" rx="3" fill={GOLD} />
          <path d="M28 62 L70 52" stroke={INK} stroke-width="4" />
          <circle cx="72" cy="51" r="7" fill={INK} />
          <circle cx="34" cy="60" r="3" fill={GOLD} />
        </g>
      );
    case 'cadran':
      return (
        <g {...s}>
          <rect x="16" y="32" width="68" height="36" rx="5" fill="#f6e7c1" />
          {Array.from({ length: 9 }, (_, i) => (
            <path key={i} d={`M${24 + i * 6.5} 56 V${i % 2 ? 51 : 47}`} stroke={INK} stroke-width="1.2" />
          ))}
          <text x="50" y="44" text-anchor="middle" font-family="Special Elite, monospace" font-size="7" fill={INK} stroke="none">
            88 · 98 · 108
          </text>
          <path d="M58 34 V66" stroke={RED} stroke-width="2.5" />
        </g>
      );
    case 'punaise':
      return (
        <g {...s}>
          <path d="M50 54 L50 86" stroke={INK} stroke-width="3" stroke-linecap="round" />
          <circle cx="50" cy="38" r="20" fill={RED} />
          <circle cx="43" cy="31" r="6" fill="#fff" opacity="0.45" stroke="none" />
        </g>
      );
    case 'globe':
      return (
        <g {...s}>
          <circle cx="50" cy="50" r="31" fill={SKY} />
          <path d="M30 38 Q38 30 46 36 Q50 46 40 50 Q32 52 30 38 Z M54 28 Q66 30 70 40 Q62 44 56 40 Z M50 58 Q60 54 66 62 Q62 74 54 76 Q48 68 50 58 Z" fill={GREEN} />
          <ellipse cx="50" cy="50" rx="14" ry="31" fill="none" stroke={line} opacity="0.6" />
          <path d="M19 50 H81" stroke={line} opacity="0.6" />
        </g>
      );
    case 'montgolfiere':
      return (
        <g {...s}>
          <path d="M50 14 C24 14 22 44 38 58 L44 66 H56 L62 58 C78 44 76 14 50 14 Z" fill={PAPER} />
          <path d="M50 14 C40 20 38 44 44 66 H56 C62 44 60 20 50 14 Z" fill={RED} />
          <path d="M44 66 L44 76 M56 66 L56 76" stroke={INK} />
          <rect x="42" y="76" width="16" height="10" rx="2" fill="#9a5b2c" />
        </g>
      );
    case 'satellite':
      return (
        <g {...s}>
          {[[12, 40], [62, 40]].map(([x, y]) => (
            <g key={x}>
              <rect x={x} y={y} width="26" height="20" fill={BLUE} />
              <path d={`M${x! + 8.7} ${y} V${y! + 20} M${x! + 17.4} ${y} V${y! + 20} M${x} ${y! + 10} H${x! + 26}`} stroke={SKY} />
            </g>
          ))}
          <rect x="40" y="38" width="20" height="24" rx="3" fill={GOLD} />
          <path d="M50 38 V24 M44 20 Q50 14 56 20" fill="none" stroke={PAPER} stroke-width="2.5" />
          {[[20, 20], [80, 78], [26, 80], [84, 22]].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" fill={PAPER} stroke="none" />
          ))}
        </g>
      );
    case 'hydravion':
      return (
        <g {...s}>
          <path d="M14 46 L86 46 L86 52 L14 52 Z" fill={PAPER} />
          <path d="M30 50 C30 40 60 38 74 46 L78 52 C60 58 34 58 30 50 Z" fill={RED} />
          <path d="M74 46 L82 34 L84 46 Z" fill={RED} />
          <path d="M40 58 V66 M62 58 V66" stroke={INK} stroke-width="2" />
          <rect x="30" y="66" width="18" height="5" rx="2.5" fill={PAPER} />
          <rect x="54" y="66" width="18" height="5" rx="2.5" fill={PAPER} />
          <path d="M10 82 Q20 78 30 82 T50 82 T70 82 T90 82" fill="none" stroke={BLUE} stroke-width="2" />
        </g>
      );
    case 'carte-qsl':
      return (
        <g {...s} transform="rotate(-8 50 50)">
          <rect x="18" y="28" width="64" height="44" rx="2" fill="#fbf6ea" />
          <text x="36" y="52" text-anchor="middle" font-family="Archivo Black, sans-serif" font-size="13" fill={RED} stroke="none">
            QSL
          </text>
          <circle cx="66" cy="54" r="10" fill="none" stroke={BLUE} stroke-width="2" />
          <path d="M24 62 H50" stroke={INK} stroke-width="1" />
        </g>
      );
    case 'soixante-treize':
      return (
        <g>
          <text x="50" y="66" text-anchor="middle" font-family="Archivo Black, sans-serif" font-size="44" fill={PAPER} stroke={line} stroke-width="1.2">
            73
          </text>
          <path d="M26 76 H74" stroke={RED} stroke-width="4" stroke-linecap="round" />
        </g>
      );
    case 'galene':
      return (
        <g {...s}>
          <rect x="18" y="50" width="64" height="26" rx="3" fill="#9a5b2c" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <ellipse key={i} cx={32 + i * 4} cy="42" rx="2.5" ry="8" fill="none" stroke="#c9822b" stroke-width="2" />
          ))}
          <path d="M58 50 L64 36 L70 40" fill="none" stroke={PAPER} stroke-width="2" />
          <circle cx="70" cy="40" r="3" fill="#8fa3b8" />
          <path d="M22 76 Q16 86 30 88" fill="none" stroke={INK} stroke-width="2" />
        </g>
      );
    case 'voilier':
      return (
        <g {...s}>
          <path d="M50 16 L50 64 L22 64 Z" fill={PAPER} />
          <path d="M54 22 L54 64 L76 64 Z" fill={PAPER} />
          <path d="M18 66 H82 L74 76 H26 Z" fill={RED} />
          <path d="M10 84 Q20 80 30 84 T50 84 T70 84 T90 84" fill="none" stroke={PAPER} stroke-width="2" />
        </g>
      );
    case 'aurore':
      return (
        <g>
          <path d="M0 50 Q25 30 50 44 T100 36 V60 Q75 66 50 58 T0 66 Z" fill="#52d39a" opacity="0.75" />
          <path d="M0 40 Q30 22 60 34 T100 24 V36 Q70 46 50 40 T0 52 Z" fill="#a46ad9" opacity="0.6" />
          {[[18, 16], [40, 12], [70, 14], [84, 30], [28, 30]].map(([x, y]) => (
            <circle key={`${x}`} cx={x} cy={y} r="1.6" fill="#fff" />
          ))}
          <path d="M0 100 V78 L18 66 L32 76 L50 62 L66 76 L82 66 L100 76 V100 Z" fill="#0b1324" stroke={line} stroke-width="1.2" />
        </g>
      );
    case 'tour-nuit':
      return (
        <g {...s}>
          {[[16, 20], [80, 16], [24, 40], [74, 44]].map(([x, y]) => (
            <circle key={`${x}`} cx={x} cy={y} r="1.5" fill="#fff" stroke="none" />
          ))}
          <path d="M38 90 L50 26 L62 90" fill="none" stroke={PAPER} stroke-width="3" />
          <path d="M42 70 L58 58 M42 58 L56 46 M44 82 L60 70 M58 70 L42 58 M57 58 L44 46" stroke={PAPER} />
          <circle cx="50" cy="24" r="4" fill={RED} stroke="none" />
          {[10, 18, 26].map((r) => (
            <path key={r} d={`M${50 - r} ${24 - r * 0.6} A${r} ${r} 0 0 1 ${50 + r} ${24 - r * 0.6}`} fill="none" stroke={GOLD} stroke-width="2" />
          ))}
        </g>
      );
    case 'dirigeable':
      return (
        <g {...s}>
          <ellipse cx="50" cy="42" rx="34" ry="15" fill="#cfd3d8" />
          <path d="M18 42 H82" stroke={line} opacity="0.5" />
          <path d="M80 36 L92 26 L90 42 L92 58 L80 48 Z" fill={RED} />
          <rect x="42" y="58" width="16" height="7" rx="2" fill={INK} />
          <path d="M46 56 V58 M54 56 V58" stroke={INK} />
          <path d="M8 80 Q16 72 26 78 Q34 70 44 78 Q48 84 40 86 H12 Q4 86 8 80 Z" fill="#fff" opacity="0.85" stroke="none" />
        </g>
      );
    case 'echo-lunaire':
      return (
        <g {...s}>
          <circle cx="68" cy="28" r="16" fill={PAPER} />
          <circle cx="63" cy="24" r="3" fill="#cfc4ab" stroke="none" />
          <circle cx="72" cy="34" r="4" fill="#cfc4ab" stroke="none" />
          <path d="M30 70 L60 36" stroke={GOLD} stroke-width="2" stroke-dasharray="4 4" />
          <path d="M14 76 A18 18 0 0 0 44 60 Z" fill={PAPER} />
          <path d="M28 70 L24 86 M24 86 H36" stroke={PAPER} stroke-width="3" />
          <path d="M0 92 H100" stroke={line} />
        </g>
      );
    case 'oreille-or':
      return (
        <g {...s}>
          <path d="M28 54 A22 22 0 0 1 72 54" fill="none" stroke={GOLD} stroke-width="7" />
          <rect x="20" y="48" width="16" height="22" rx="6" fill={GOLD} />
          <rect x="64" y="48" width="16" height="22" rx="6" fill={GOLD} />
          <rect x="16" y="72" width="68" height="15" rx="3" fill={PAPER} />
          <text x="50" y="84" text-anchor="middle" font-family="Archivo Black, sans-serif" font-size="12" fill={RED} stroke="none">
            55555
          </text>
          <path d="M50 14 L53 22 L61 22 L55 27 L57 35 L50 30 L43 35 L45 27 L39 22 L47 22 Z" fill={GOLD} />
        </g>
      );
    case 'tour-du-monde':
      return (
        <g {...s}>
          <circle cx="50" cy="52" r="24" fill={SKY} />
          <path d="M36 44 Q44 38 50 44 Q48 54 40 54 Z M56 58 Q64 54 68 62 Q60 70 56 66 Z" fill={GREEN} />
          <ellipse cx="50" cy="52" rx="40" ry="12" fill="none" stroke={GOLD} stroke-width="3.5" transform="rotate(-18 50 52)" />
          <path d="M82 34 l8 -3 l-3 7 Z" fill={PAPER} />
          {[[14, 18], [86, 80], [20, 84], [82, 14]].map(([x, y]) => (
            <path key={`${x}`} d={`M${x} ${y! - 4} L${x! + 1.2} ${y! - 1.2} L${x! + 4} ${y} L${x! + 1.2} ${y! + 1.2} L${x} ${y! + 4} L${x! - 1.2} ${y! + 1.2} L${x! - 4} ${y} L${x! - 1.2} ${y! - 1.2} Z`} fill={GOLD} stroke="none" />
          ))}
        </g>
      );
    default:
      return <circle cx="50" cy="50" r="20" fill={PAPER} />;
  }
}
