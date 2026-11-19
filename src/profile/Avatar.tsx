// Portraits d'opérateurs radio (SVG), sur un fond de couleur au choix.

import type { JSX } from 'preact';
import { useId } from 'preact/hooks';
import { AVATAR_BGS, DEFAULT_AVATAR, type Avatar, type AvatarFace } from '../../shared/avatars';

const INK = '#3a3632';
const PAPER = '#ede3cf';
const RED = '#d9483b';
const GOLD = '#e2b84a';

const SKIN: Record<AvatarFace, string> = {
  operatrice: '#f1c9a5',
  marin: '#d9a27a',
  pilote: '#f1c9a5',
  astronome: '#a8714a',
  chat: '#c9822b',
  robot: '#cfd3d8',
  barbu: '#d9a27a',
  beret: '#f1c9a5',
  casquette: '#7a4e2d',
  lunettes: '#d9a27a',
  chignon: '#a8714a',
  'haut-de-forme': '#f1c9a5',
};

interface Props {
  avatar?: Avatar | null;
  size?: number;
  title?: string;
}

export function AvatarView({ avatar, size = 48, title }: Props) {
  const a = avatar ?? DEFAULT_AVATAR;
  if (a.photo && a.usePhoto !== false && (a.usePhoto || a.hasPhoto)) return <PhotoAvatar avatar={a} size={size} title={title} />;
  const skin = SKIN[a.face];
  return (
    <svg class="avatar" viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={title ?? a.face}>
      <defs>
        <clipPath id={`av-${a.face}-${a.bg}`}>
          <circle cx="50" cy="50" r="48" />
        </clipPath>
      </defs>
      <g clip-path={`url(#av-${a.face}-${a.bg})`}>
        <rect width="100" height="100" fill={AVATAR_BGS[a.bg] ?? AVATAR_BGS[0]} />
        <circle cx="50" cy="50" r="40" fill="#fff" opacity="0.08" />
        {/* Buste */}
        <path d="M14 104 C14 78 30 70 50 70 C70 70 86 78 86 104 Z" fill={a.face === 'robot' ? '#8fa3b8' : a.face === 'marin' ? '#fbf6ea' : INK} stroke={INK} stroke-width="2" />
        {a.face === 'marin' && <path d="M38 72 L50 86 L62 72" fill={RED} stroke={INK} stroke-width="1.5" />}
        {a.face !== 'robot' && a.face !== 'chat' && <rect x="44" y="60" width="12" height="12" fill={skin} />}
        {/* Tête */}
        {a.face === 'robot' ? (
          <rect x="30" y="24" width="40" height="38" rx="6" fill={skin} stroke={INK} stroke-width="2" />
        ) : (
          <circle cx="50" cy="44" r="19" fill={skin} stroke={INK} stroke-width="2" />
        )}
        <Face face={a.face} skin={skin} />
      </g>
      <circle cx="50" cy="50" r="47" fill="none" stroke={INK} stroke-width="3" />
    </svg>
  );
}

function Eyes({ y = 44 }: { y?: number }) {
  return (
    <g fill={INK}>
      <circle cx="43" cy={y} r="2" />
      <circle cx="57" cy={y} r="2" />
      <path d={`M45 ${y + 8} Q50 ${y + 11} 55 ${y + 8}`} fill="none" stroke={INK} stroke-width="1.6" stroke-linecap="round" />
    </g>
  );
}

function Face({ face, skin }: { face: AvatarFace; skin: string }): JSX.Element {
  const s = { stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' as const };
  switch (face) {
    case 'operatrice':
      return (
        <g>
          <path d="M31 46 C30 26 44 20 50 20 C60 20 71 28 69 46 C66 36 58 32 50 32 C42 32 34 36 31 46 Z" fill="#7a4a2c" {...s} />
          <path d="M28 44 A22 22 0 0 1 72 44" fill="none" stroke={INK} stroke-width="4" />
          <rect x="24" y="40" width="9" height="14" rx="3" fill={RED} {...s} />
          <rect x="67" y="40" width="9" height="14" rx="3" fill={RED} {...s} />
          <path d="M33 52 Q40 62 46 58" fill="none" stroke={INK} stroke-width="2" />
          <Eyes />
        </g>
      );
    case 'marin':
      return (
        <g>
          <path d="M30 34 H70 L66 26 H34 Z" fill="#fbf6ea" {...s} />
          <rect x="34" y="20" width="32" height="8" rx="3" fill="#fbf6ea" {...s} />
          <path d="M34 30 H66" stroke="#2f5d8c" stroke-width="3" />
          <Eyes />
        </g>
      );
    case 'pilote':
      return (
        <g>
          <path d="M30 44 C30 26 42 22 50 22 C58 22 70 26 70 44 L66 40 H34 Z" fill="#7a4a2c" {...s} />
          <circle cx="42" cy="36" r="6" fill="#8ec3d6" {...s} />
          <circle cx="58" cy="36" r="6" fill="#8ec3d6" {...s} />
          <path d="M48 36 H52" stroke={INK} stroke-width="2" />
          <path d="M28 64 Q50 74 72 64 L74 70 Q50 82 26 70 Z" fill="#fbf6ea" {...s} />
          <Eyes y={47} />
        </g>
      );
    case 'astronome':
      return (
        <g>
          <path d="M31 40 C30 28 40 23 50 23 C60 23 70 28 69 40 C64 34 58 32 50 32 C42 32 36 34 31 40 Z" fill={INK} {...s} />
          <circle cx="43" cy="44" r="5" fill="none" {...s} />
          <circle cx="57" cy="44" r="5" fill="none" {...s} />
          <path d="M48 44 H52" {...s} />
          <path d="M70 18 L72 23 L77 23 L73 26 L75 31 L70 28 L65 31 L67 26 L63 23 L68 23 Z" fill={GOLD} stroke="none" />
          <path d="M45 54 Q50 57 55 54" fill="none" stroke={INK} stroke-width="1.6" />
        </g>
      );
    case 'chat':
      return (
        <g>
          <path d="M33 66 C24 52 28 30 50 30 C72 30 76 52 67 66 Z" fill={skin} {...s} />
          <path d="M34 36 L32 20 L44 30 Z M66 36 L68 20 L56 30 Z" fill={skin} {...s} />
          <path d="M28 40 A22 22 0 0 1 72 40" fill="none" stroke={INK} stroke-width="4" />
          <rect x="23" y="38" width="9" height="13" rx="3" fill="#2f5d8c" {...s} />
          <rect x="68" y="38" width="9" height="13" rx="3" fill="#2f5d8c" {...s} />
          <ellipse cx="43" cy="46" rx="2.5" ry="4" fill={INK} />
          <ellipse cx="57" cy="46" rx="2.5" ry="4" fill={INK} />
          <path d="M48 53 L52 53 L50 56 Z" fill={RED} />
          <path d="M36 56 H26 M36 59 L27 62 M64 56 H74 M64 59 L73 62" stroke={INK} stroke-width="1.2" />
        </g>
      );
    case 'robot':
      return (
        <g>
          <path d="M50 24 V14" stroke={INK} stroke-width="2" />
          <circle cx="50" cy="12" r="4" fill={RED} {...s} />
          <rect x="37" y="36" width="10" height="8" rx="2" fill="#8ec3d6" {...s} />
          <rect x="53" y="36" width="10" height="8" rx="2" fill="#8ec3d6" {...s} />
          <rect x="40" y="50" width="20" height="5" rx="1" fill={INK} />
          <path d="M44 50 V55 M48 50 V55 M52 50 V55 M56 50 V55" stroke="#cfd3d8" stroke-width="1" />
        </g>
      );
    case 'barbu':
      return (
        <g>
          <path d="M31 40 C31 26 42 23 50 23 C58 23 69 26 69 40 C64 33 58 31 50 31 C42 31 36 33 31 40 Z" fill="#7a4a2c" {...s} />
          <path d="M31 46 C32 64 42 68 50 68 C58 68 68 64 69 46 C64 56 58 58 50 58 C42 58 36 56 31 46 Z" fill="#7a4a2c" {...s} />
          <circle cx="43" cy="43" r="2" fill={INK} />
          <circle cx="57" cy="43" r="2" fill={INK} />
          <path d="M44 52 Q50 50 56 52" fill="none" stroke={PAPER} stroke-width="2" />
        </g>
      );
    case 'beret':
      return (
        <g>
          <ellipse cx="47" cy="28" rx="22" ry="8" fill={RED} {...s} transform="rotate(-10 47 28)" />
          <path d="M47 20 V15" stroke={INK} stroke-width="2.5" />
          <path d="M31 40 Q30 50 34 56" fill="none" stroke={INK} stroke-width="3" />
          <Eyes />
        </g>
      );
    case 'casquette':
      return (
        <g>
          <path d="M31 36 C31 24 42 21 50 21 C58 21 69 24 69 36 Z" fill="#2f5d8c" {...s} />
          <path d="M50 34 H80 Q82 38 76 39 H50 Z" fill="#2f5d8c" {...s} />
          <circle cx="50" cy="22" r="2" fill={PAPER} />
          <Eyes />
        </g>
      );
    case 'lunettes':
      return (
        <g>
          <path d="M31 38 C31 24 42 22 50 22 C58 22 69 24 69 38 L64 32 L58 34 L50 30 L42 34 L36 32 Z" fill={GOLD} {...s} />
          <rect x="35" y="39" width="12" height="9" rx="3" fill="#fff" opacity="0.6" {...s} />
          <rect x="53" y="39" width="12" height="9" rx="3" fill="#fff" opacity="0.6" {...s} />
          <path d="M47 43 H53" {...s} />
          <circle cx="41" cy="44" r="1.8" fill={INK} />
          <circle cx="59" cy="44" r="1.8" fill={INK} />
          <path d="M45 54 Q50 57 55 54" fill="none" stroke={INK} stroke-width="1.6" />
        </g>
      );
    case 'chignon':
      return (
        <g>
          <circle cx="50" cy="20" r="9" fill={INK} {...s} />
          <path d="M31 44 C30 28 42 25 50 25 C58 25 70 28 69 44 C65 35 58 33 50 33 C42 33 35 35 31 44 Z" fill={INK} {...s} />
          <circle cx="64" cy="50" r="2.5" fill={GOLD} />
          <Eyes />
        </g>
      );
    case 'haut-de-forme':
      return (
        <g>
          <rect x="36" y="8" width="28" height="22" fill={INK} {...s} />
          <path d="M36 24 H64" stroke={RED} stroke-width="3" />
          <path d="M26 31 H74" stroke={INK} stroke-width="4" stroke-linecap="round" />
          <circle cx="57" cy="44" r="5" fill="none" stroke={GOLD} stroke-width="1.8" />
          <path d="M62 46 Q66 56 62 62" fill="none" stroke={GOLD} stroke-width="1" />
          <circle cx="43" cy="44" r="2" fill={INK} />
          <circle cx="57" cy="44" r="1.8" fill={INK} />
          <path d="M42 54 Q50 60 58 54 Q50 57 42 54 Z" fill="#7a4a2c" />
        </g>
      );
  }
}

/**
 * Photo du joueur dans le cercle d'encre. Effet « photo de presse » : niveaux de gris passés en
 * bichromie encre / papier, teinte de la couleur de fond, trame de points par-dessus.
 */
function PhotoAvatar({ avatar: a, size, title }: { avatar: Avatar; size: number; title?: string | undefined }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const bg = AVATAR_BGS[a.bg] ?? AVATAR_BGS[0];
  return (
    <svg class="avatar is-photo" viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={title ?? 'photo'}>
      <defs>
        <clipPath id={`avc-${uid}`}>
          <circle cx="50" cy="50" r="48" />
        </clipPath>
        {a.press && (
          <>
            <filter id={`avf-${uid}`} x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB">
              <feColorMatrix type="saturate" values="0" result="gray" />
              <feComponentTransfer in="gray" result="duo">
                <feFuncR type="table" tableValues="0.227 0.93" />
                <feFuncG type="table" tableValues="0.212 0.89" />
                <feFuncB type="table" tableValues="0.196 0.81" />
              </feComponentTransfer>
              <feFlood flood-color={bg} flood-opacity="0.45" result="tint" />
              <feBlend in="duo" in2="tint" mode="multiply" />
            </filter>
            <pattern id={`avp-${uid}`} width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <circle cx="1.5" cy="1.5" r="0.75" fill={INK} opacity="0.3" />
            </pattern>
          </>
        )}
      </defs>
      <g clip-path={`url(#avc-${uid})`}>
        <rect width="100" height="100" fill={a.press ? PAPER : bg} />
        <image href={a.photo} x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice" filter={a.press ? `url(#avf-${uid})` : undefined} />
        {a.press && <rect width="100" height="100" fill={`url(#avp-${uid})`} />}
      </g>
      <circle cx="50" cy="50" r="47" fill="none" stroke={INK} stroke-width="3" />
    </svg>
  );
}
