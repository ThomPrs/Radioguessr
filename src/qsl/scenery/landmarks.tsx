// Monuments célèbres, dessinés à l'encre en coordonnées locales : sol en y = 0, hauteur ≈ 80.
// Le composant Landmark les place sur l'horizon (x, base) à l'échelle s.

import type { JSX } from 'preact';
import type { Landmark as LandmarkId } from '../../../shared/country-look';
import { Acacia } from './biomes';
import { INK, PAPER } from './common';

type Draw = (c: { fill: string; fill2: string; rich: boolean; mono: boolean }) => JSX.Element;

const SW = { stroke: INK, 'stroke-width': 1.2, 'stroke-linejoin': 'round' } as const;

const DRAW: Record<LandmarkId, Draw> = {
  eiffel: ({ fill, mono }) => (
    <g>
      <path d="M-22 0 Q-10 -30 -4 -62 L-2 -84 L2 -84 L4 -62 Q10 -30 22 0 L15 0 Q8 -14 0 -16 Q-8 -14 -15 0 Z" fill={INK} />
      <rect x="-12" y="-34" width="24" height="3" fill={INK} />
      <rect x="-7" y="-58" width="14" height="2.5" fill={INK} />
      <line x1="0" y1="-84" x2="0" y2="-92" stroke={INK} stroke-width="1.4" />
      {!mono && <path d="M-9 -12 Q0 -26 9 -12" stroke={fill} stroke-width="1.5" fill="none" />}
    </g>
  ),
  bigben: ({ fill, mono }) => (
    <g>
      <rect x="-8" y="-70" width="16" height="70" fill={INK} />
      <rect x="-10" y="-58" width="20" height="16" fill={INK} />
      <circle cx="0" cy="-50" r="6" fill={mono ? PAPER : fill} {...SW} />
      <path d="M0 -50 l0 -4 M0 -50 l3 1" stroke={INK} stroke-width="1" />
      <path d="M-8 -70 L0 -92 L8 -70 Z" fill={INK} />
      <line x1="0" y1="-92" x2="0" y2="-98" stroke={INK} stroke-width="1.2" />
      <rect x="-30" y="-24" width="22" height="24" fill={INK} />
      <path d="M-30 -24 l3 -6 l3 6 l3 -6 l3 6 l3 -6 l3 6 l3 -6 l1 6" fill={INK} />
    </g>
  ),
  liberty: ({ fill, mono }) => (
    <g>
      <path d="M-14 0 L-11 -26 L11 -26 L14 0 Z" fill={INK} />
      <rect x="-8" y="-34" width="16" height="8" fill={INK} />
      <path d="M-6 -34 L-5 -60 Q0 -66 5 -60 L6 -34 Z" fill={mono ? INK : fill} {...SW} />
      <circle cx="0" cy="-66" r="4" fill={mono ? INK : fill} {...SW} />
      <path d="M-5 -70 l-3 -4 M0 -71 v-5 M5 -70 l3 -4" stroke={INK} stroke-width="1.2" />
      <path d="M4 -58 L10 -80" stroke={INK} stroke-width="2.5" />
      <path d="M8 -80 L12 -80 L11 -84 Q10 -88 9 -84 Z" fill="#e2b84a" stroke={INK} stroke-width="0.8" />
    </g>
  ),
  colosseum: ({ fill, rich, mono }) => (
    <g>
      <path d="M-40 0 L-40 -34 Q0 -42 40 -40 L40 0 Z" fill={INK} />
      {[-32, -22, -12, -2, 8, 18, 28].map((x) =>
        [-30, -18].map((y) => <path key={`${x}${y}`} d={`M${x} ${y + 9} v-5 a3 3 0 0 1 6 0 v5 Z`} fill={rich && !mono ? fill : PAPER} />),
      )}
      {[-30, -18, -6, 6, 18, 30].map((x) => <path key={x} d={`M${x} 0 v-5 a3 3 0 0 1 6 0 v5 Z`} fill={PAPER} />)}
    </g>
  ),
  pyramids: ({ fill, mono }) => (
    <g>
      <path d="M-52 0 L-30 -30 L-8 0 Z" fill={INK} />
      <path d="M-20 0 L8 -46 L36 0 Z" fill={INK} />
      <path d="M8 -46 L36 0 L20 0 Z" fill={mono ? PAPER : fill} opacity="0.55" />
      <path d="M30 0 L44 -20 L58 0 Z" fill={INK} />
    </g>
  ),
  tajmahal: ({ fill, mono }) => (
    <g>
      <rect x="-34" y="-6" width="68" height="6" fill={INK} />
      <rect x="-20" y="-30" width="40" height="24" fill={PAPER} {...SW} />
      <path d="M-5 -6 v-14 a5 5 0 0 1 10 0 v14 Z" fill={INK} />
      <path d="M-14 -30 Q-18 -50 0 -58 Q18 -50 14 -30 Z" fill={mono ? PAPER : fill} {...SW} />
      <line x1="0" y1="-58" x2="0" y2="-66" stroke={INK} stroke-width="1.2" />
      {[-30, 30].map((x) => (
        <g key={x}>
          <rect x={x - 2} y="-40" width="4" height="34" fill={PAPER} {...SW} />
          <path d={`M${x - 3} -40 a3 3 0 0 1 6 0 Z`} fill={INK} />
        </g>
      ))}
    </g>
  ),
  fuji: ({ fill, mono }) => (
    <g>
      <path d="M-70 0 Q-30 -30 -12 -56 L12 -56 Q30 -30 70 0 Z" fill={mono ? INK : fill} opacity={mono ? 1 : 0.8} />
      <path d="M-12 -56 L12 -56 L18 -46 L10 -48 L4 -42 L-2 -48 L-9 -44 L-18 -46 Z" fill={PAPER} />
      <g transform="translate(38 0)">
        <rect x="-12" y="-28" width="3" height="28" fill="#c0392b" />
        <rect x="9" y="-28" width="3" height="28" fill="#c0392b" />
        <path d="M-17 -30 Q0 -34 17 -30 L17 -27 Q0 -30 -17 -27 Z" fill={INK} />
        <rect x="-13" y="-23" width="26" height="2.5" fill="#c0392b" />
      </g>
    </g>
  ),
  greatwall: ({ fill, mono }) => (
    <g>
      <path d="M-70 0 Q-40 -30 -10 -16 Q20 -2 40 -26 Q55 -40 70 -30 L70 -24 Q55 -34 40 -20 Q20 4 -10 -10 Q-40 -24 -70 6 Z" fill={INK} />
      {[
        [-40, -22],
        [40, -27],
      ].map(([x, y]) => (
        <g key={x}>
          <rect x={x! - 6} y={y! - 12} width="12" height="12" fill={INK} />
          <path d={`M${x! - 7} ${y! - 12} L${x} ${y! - 18} L${x! + 7} ${y! - 12} Z`} fill={mono ? INK : fill} />
        </g>
      ))}
    </g>
  ),
  basil: ({ fill, fill2, mono }) => {
    const dome = (x: number, y: number, s: number, c: string, k: string) => (
      <g key={k}>
        <rect x={x - s * 0.5} y={y} width={s} height={-y} fill={INK} />
        <path d={`M${x - s} ${y} Q${x - s * 1.2} ${y - s * 1.4} ${x} ${y - s * 2.2} Q${x + s * 1.2} ${y - s * 1.4} ${x + s} ${y} Z`} fill={mono ? INK : c} {...SW} />
        <path d={`M${x - s * 0.6} ${y - s * 0.4} Q${x} ${y - s * 1.6} ${x + s * 0.6} ${y - s * 0.4}`} stroke={PAPER} stroke-width="1" fill="none" />
        <line x1={x} y1={y - s * 2.2} x2={x} y2={y - s * 2.2 - 6} stroke={INK} stroke-width="1.2" />
      </g>
    );
    return (
      <g>
        <rect x="-36" y="-22" width="72" height="22" fill={INK} />
        {dome(0, -46, 9, fill, 'a')}
        {dome(-22, -30, 7, fill2, 'b')}
        {dome(22, -30, 7, fill2, 'c')}
        {dome(-11, -36, 6, fill, 'd')}
        {dome(11, -36, 6, fill, 'e')}
      </g>
    );
  },
  opera: ({ mono, fill }) => (
    <g>
      <rect x="-50" y="-6" width="100" height="6" fill={INK} />
      {[
        [-38, 26],
        [-18, 34],
        [4, 40],
        [26, 30],
      ].map(([x, h], i) => (
        <path key={i} d={`M${x} -6 Q${x! + 2} ${-6 - h!} ${x! + 18} ${-6 - h!} Q${x! + 10} ${-6 - h! * 0.4} ${x! + 16} -6 Z`} fill={PAPER} {...SW} />
      ))}
      {!mono && <rect x="-60" y="-1" width="120" height="1" fill={fill} />}
    </g>
  ),
  christ: () => (
    <g>
      <path d="M-50 0 Q-20 -30 -6 -42 L6 -42 Q24 -24 50 0 Z" fill={INK} />
      <rect x="-1.5" y="-64" width="3" height="22" fill={INK} />
      <rect x="-14" y="-60" width="28" height="3" fill={INK} />
      <circle cx="0" cy="-67" r="2.5" fill={INK} />
    </g>
  ),
  mayan: ({ fill, mono }) => (
    <g>
      {[0, 1, 2, 3, 4].map((k) => (
        <rect key={k} x={-40 + k * 7} y={-10 - k * 10} width={80 - k * 14} height="11" fill={INK} />
      ))}
      <rect x="-5" y="-50" width="10" height="50" fill={mono ? PAPER : fill} opacity="0.7" />
      <rect x="-9" y="-62" width="18" height="12" fill={INK} />
      <rect x="-3" y="-58" width="6" height="8" fill={PAPER} />
    </g>
  ),
  machupicchu: ({ fill, mono }) => (
    <g>
      <path d="M-10 0 L8 -64 Q14 -70 20 -60 L40 0 Z" fill={INK} />
      <path d="M-60 0 Q-40 -26 -16 -30 L-6 0 Z" fill={INK} />
      {[0, 1, 2, 3].map((k) => (
        <path key={k} d={`M${-50 + k * 6} ${-6 - k * 6} h${30 - k * 3}`} stroke={mono ? PAPER : fill} stroke-width="1.5" />
      ))}
    </g>
  ),
  parthenon: ({ fill, mono }) => (
    <g>
      <path d="M-50 0 Q-25 -18 0 -20 Q25 -18 50 0 Z" fill={INK} />
      <rect x="-30" y="-24" width="60" height="4" fill={INK} />
      {[-26, -18, -10, -2, 6, 14, 22].map((x) => (
        <rect key={x} x={x} y="-44" width="4" height="20" fill={PAPER} {...SW} />
      ))}
      <rect x="-31" y="-48" width="62" height="4" fill={INK} />
      <path d="M-31 -48 L0 -58 L31 -48 Z" fill={mono ? INK : fill} {...SW} />
    </g>
  ),
  windmills: () => (
    <g>
      <path d="M-60 0 Q0 -16 60 0 Z" fill={INK} />
      {[-30, 0, 28].map((x, i) => (
        <g key={x} transform={`translate(${x} ${-8 - (i === 1 ? 4 : 0)})`}>
          <path d="M-6 0 L-4 -22 L4 -22 L6 0 Z" fill={PAPER} {...SW} />
          <path d="M-5 -22 L0 -29 L5 -22 Z" fill={INK} />
          <path d="M0 -22 L-14 -36 M0 -22 L14 -36 M0 -22 L-14 -8 M0 -22 L14 -8" stroke={INK} stroke-width="2" />
        </g>
      ))}
    </g>
  ),
  dutchmill: ({ fill, fill2, mono }) => (
    <g>
      <path d="M-10 0 L-7 -40 L7 -40 L10 0 Z" fill={INK} />
      <path d="M-9 -40 L0 -50 L9 -40 Z" fill={INK} />
      <g stroke={INK} stroke-width="1">
        {[0, 90, 180, 270].map((deg) => (
          <g key={deg} transform={`translate(0 -38) rotate(${deg + 20})`}>
            <rect x="-2" y="-34" width="5" height="32" fill={PAPER} />
          </g>
        ))}
      </g>
      {Array.from({ length: 12 }, (_, i) => (
        <circle key={i} cx={-40 + i * 7} cy={-3 - (i % 2) * 2} r="2.4" fill={mono ? INK : i % 2 ? fill : fill2} />
      ))}
    </g>
  ),
  brandenburg: ({ fill, mono }) => (
    <g>
      <rect x="-36" y="-8" width="72" height="8" fill={INK} />
      {[-32, -20, -8, 4, 16, 28].map((x) => (
        <rect key={x} x={x} y="-40" width="5" height="32" fill={INK} />
      ))}
      <rect x="-38" y="-48" width="76" height="8" fill={INK} />
      <rect x="-10" y="-58" width="20" height="10" fill={mono ? INK : fill} {...SW} />
    </g>
  ),
  mosque: ({ fill, mono }) => (
    <g>
      <rect x="-26" y="-18" width="52" height="18" fill={INK} />
      <path d="M-22 -18 Q-22 -44 0 -48 Q22 -44 22 -18 Z" fill={mono ? INK : fill} {...SW} />
      <path d="M-34 -14 Q-34 -24 -26 -26 L-26 -14 Z M34 -14 Q34 -24 26 -26 L26 -14 Z" fill={INK} />
      {[-44, -32, 32, 44].map((x) => (
        <g key={x}>
          <rect x={x - 2} y="-58" width="4" height="58" fill={INK} />
          <rect x={x - 3.5} y="-44" width="7" height="2" fill={INK} />
          <path d={`M${x - 2.5} -58 L${x} -68 L${x + 2.5} -58 Z`} fill={INK} />
        </g>
      ))}
    </g>
  ),
  burj: ({ fill, rich, mono }) => (
    <g>
      <path d="M-12 0 L-10 -30 L-6 -30 L-6 -60 L-3 -60 L-3 -86 L-1 -86 L0 -104 L1 -86 L3 -86 L3 -60 L6 -60 L6 -30 L10 -30 L12 0 Z" fill={INK} />
      {rich && !mono && [-20, -40, -70].map((y) => <rect key={y} x="-1" y={y} width="2" height="3" fill={fill} />)}
    </g>
  ),
  cntower: ({ fill, mono }) => (
    <g>
      <path d="M-6 0 L-2 -70 L2 -70 L6 0 Z" fill={INK} />
      <ellipse cx="0" cy="-60" rx="9" ry="5" fill={mono ? INK : fill} {...SW} />
      <rect x="-1" y="-96" width="2" height="30" fill={INK} />
      <path d="M-20 -20 C-20 -30 -14 -34 -12 -28 C-10 -34 -4 -30 -6 -22 C-4 -16 -12 -10 -14 -6 C-16 -10 -24 -14 -20 -20 Z" fill={mono ? INK : '#d80621'} />
    </g>
  ),
  angkor: ({ fill, mono }) => {
    const tower = (x: number, h: number, k: string) => (
      <path key={k} d={`M${x - 7} -8 Q${x - 8} ${-8 - h * 0.6} ${x} ${-8 - h} Q${x + 8} ${-8 - h * 0.6} ${x + 7} -8 Z`} fill={INK} />
    );
    return (
      <g>
        <rect x="-50" y="-8" width="100" height="8" fill={INK} />
        {tower(-36, 26, 'a')}
        {tower(-18, 34, 'b')}
        {tower(0, 48, 'c')}
        {tower(18, 34, 'd')}
        {tower(36, 26, 'e')}
        {!mono && <rect x="-60" y="-1" width="120" height="1.5" fill={fill} />}
      </g>
    );
  },
  thaitemple: ({ fill, fill2, mono }) => (
    <g>
      <rect x="-24" y="-16" width="48" height="16" fill={INK} />
      {[0, 1, 2].map((k) => (
        <path key={k} d={`M${-30 + k * 6} ${-16 - k * 9} L0 ${-30 - k * 9} L${30 - k * 6} ${-16 - k * 9} Z`} fill={mono ? INK : k % 2 ? fill2 : fill} {...SW} />
      ))}
      <path d="M-2 -48 L0 -66 L2 -48 Z" fill={INK} />
      <path d="M-30 -16 q-4 -4 -2 -8 M30 -16 q4 -4 2 -8" stroke={INK} stroke-width="1.5" fill="none" />
    </g>
  ),
  giraffes: () => {
    const giraffe = (x: number, s: number, k: string) => (
      <g key={k} transform={`translate(${x} 0) scale(${s})`}>
        <path d="M-10 0 L-9 -16 L-12 -18 L8 -20 L10 -16 L10 0 M7 -18 L9 -20 L18 -50 L22 -52 L26 -49 L20 -46 L13 -18 Z" fill={INK} />
        <path d="M-9 0 v-16 M-3 0 v-16 M5 0 v-16 M9 0 v-16" stroke={INK} stroke-width="2" />
      </g>
    );
    return (
      <g>
        <Acacia x={-30} base={0} h={30} />
        {giraffe(8, 1, 'a')}
        {giraffe(34, 0.75, 'b')}
      </g>
    );
  },
  matterhorn: () => (
    <g>
      <path d="M-50 0 L-12 -40 L-4 -76 L4 -72 L18 -38 L56 0 Z" fill={INK} />
      <path d="M-4 -76 L4 -72 L10 -56 L4 -58 L0 -50 L-6 -56 L-10 -48 Z" fill={PAPER} />
    </g>
  ),
  fjord: ({ fill, mono }) => (
    <g>
      <path d="M-70 0 L-70 -60 Q-50 -66 -36 -40 L-22 0 Z" fill={INK} />
      <path d="M70 0 L70 -54 Q50 -60 34 -30 L22 0 Z" fill={INK} />
      <path d="M-22 0 L22 0 L18 -6 L-18 -6 Z" fill={mono ? PAPER : fill} opacity="0.6" />
      <path d="M-6 -4 h10 l-2 3 h-6 Z M0 -4 v-8 l6 7" fill={INK} stroke={INK} stroke-width="0.8" />
    </g>
  ),
  volcano: ({ fill, mono }) => (
    <g>
      <path d="M-60 0 L-12 -52 L12 -52 L60 0 Z" fill={INK} />
      <path d="M-12 -52 L12 -52 L6 -42 L0 -46 L-6 -40 Z" fill={mono ? PAPER : fill} />
      <path d="M0 -56 Q-10 -66 0 -72 Q10 -78 2 -88 Q12 -84 14 -92" stroke={INK} stroke-width="3" fill="none" stroke-linecap="round" opacity="0.6" />
    </g>
  ),
  moai: () => {
    const head = (x: number, s: number, k: string) => (
      <g key={k} transform={`translate(${x} 0) scale(${s})`}>
        <path d="M-9 0 L-9 -30 Q-10 -44 -2 -46 L6 -46 Q9 -42 8 -30 L10 -22 L7 -20 L8 0 Z" fill={INK} />
        <rect x="-10" y="-50" width="16" height="5" fill={INK} />
      </g>
    );
    return (
      <g>
        <rect x="-44" y="-4" width="88" height="4" fill={INK} />
        {head(-24, 0.9, 'a')}
        {head(0, 1.05, 'b')}
        {head(24, 0.9, 'c')}
      </g>
    );
  },
  atomium: ({ fill, mono }) => {
    const pts: [number, number][] = [[0, -70], [-20, -50], [20, -50], [0, -46], [-20, -26], [20, -26], [0, -22]];
    return (
      <g>
        <path d="M0 0 L0 -22 M-14 0 L-20 -26 M14 0 L20 -26" stroke={INK} stroke-width="2.5" />
        {pts.map(([x, y], i) => pts.slice(i + 1).map(([x2, y2], j) => (Math.hypot(x - x2, y - y2) < 32 ? <line key={`${i}-${j}`} x1={x} y1={y} x2={x2} y2={y2} stroke={INK} stroke-width="2" /> : null)))}
        {pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="6" fill={mono ? PAPER : fill} {...SW} />
        ))}
      </g>
    );
  },
  koreanpalace: ({ fill, mono }) => (
    <g>
      <rect x="-30" y="-14" width="60" height="14" fill={INK} />
      <path d="M-14 0 v-8 a4 4 0 0 1 8 0 v8 Z M6 0 v-8 a4 4 0 0 1 8 0 v8 Z" fill={PAPER} />
      <path d="M-44 -12 Q-32 -16 -28 -24 L28 -24 Q32 -16 44 -12 Z" fill={INK} />
      <rect x="-22" y="-34" width="44" height="10" fill={mono ? INK : fill} {...SW} />
      <path d="M-36 -32 Q-26 -36 -22 -44 L22 -44 Q26 -36 36 -32 Z" fill={INK} />
    </g>
  ),
  obelisk: ({ fill, mono }) => (
    <g>
      <path d="M-6 0 L-4 -78 L0 -86 L4 -78 L6 0 Z" fill={INK} />
      <rect x="-1" y="-60" width="2" height="4" fill={mono ? PAPER : fill} />
      <rect x="-40" y="-3" width="80" height="3" fill={INK} />
    </g>
  ),
  koutoubia: ({ fill, mono }) => (
    <g>
      <rect x="-9" y="-70" width="18" height="70" fill={INK} />
      <rect x="-5" y="-82" width="10" height="12" fill={INK} />
      <circle cx="0" cy="-86" r="2.5" fill={mono ? INK : '#e2b84a'} />
      <path d="M-4 -40 v-8 a4 4 0 0 1 8 0 v8 Z M-4 -58 v-6 a4 4 0 0 1 8 0 v6 Z" fill={mono ? PAPER : fill} />
      <rect x="-40" y="-14" width="30" height="14" fill={INK} />
    </g>
  ),
  tram: ({ fill, mono }) => (
    <g>
      <path d="M-60 0 Q-20 -6 60 -26 L60 0 Z" fill={INK} opacity="0.5" />
      <g transform="translate(0 -12) rotate(-8)">
        <rect x="-22" y="-20" width="44" height="20" rx="4" fill={mono ? PAPER : '#f2b705'} {...SW} />
        {[-17, -7, 3, 13].map((x) => (
          <rect key={x} x={x} y="-16" width="7" height="7" fill={INK} />
        ))}
        <rect x="-22" y="-5" width="44" height="3" fill={mono ? INK : fill} />
        <line x1="0" y1="-20" x2="6" y2="-34" stroke={INK} stroke-width="1.2" />
        <circle cx="-12" cy="1" r="3" fill={INK} />
        <circle cx="12" cy="1" r="3" fill={INK} />
      </g>
    </g>
  ),
  kilimanjaro: () => (
    <g>
      <path d="M-80 0 Q-50 -26 -24 -42 L24 -44 Q50 -26 80 0 Z" fill={INK} />
      <path d="M-24 -42 L24 -44 L30 -38 L18 -36 L8 -40 L-4 -36 L-16 -39 L-30 -37 Z" fill={PAPER} />
      <Acacia x={-40} base={0} h={20} />
    </g>
  ),
};

interface Props {
  id: LandmarkId;
  x: number;
  base: number;
  s: number;
  fill: string;
  fill2: string;
  rich: boolean;
  mono: boolean;
}

export function Landmark({ id, x, base, s, ...c }: Props) {
  return <g transform={`translate(${x.toFixed(1)} ${base.toFixed(1)}) scale(${s.toFixed(2)})`}>{DRAW[id](c)}</g>;
}

/** Demi-largeur approximative d'un monument (pour écarter l'architecture autour). */
export const LANDMARK_HALF_WIDTH: Partial<Record<LandmarkId, number>> = {
  fuji: 70,
  greatwall: 70,
  kilimanjaro: 80,
  fjord: 70,
  opera: 60,
  angkor: 55,
  windmills: 60,
  pyramids: 58,
  volcano: 60,
  matterhorn: 55,
  christ: 50,
  machupicchu: 60,
  parthenon: 50,
};
