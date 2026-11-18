// Poste radio d'époque (SVG) : cadran gradué, aiguille qui cherche pendant la syntonisation,
// voyant « œil magique » allumé quand une station est captée.

interface Props {
  state: 'off' | 'tuning' | 'on';
  /** Position de l'aiguille (0..1) quand une station est captée. */
  dial: number | null;
  /** Texte affiché sur l'étiquette sous le cadran. */
  label: string;
}

const DIAL_X0 = 118;
const DIAL_W = 220;
const MHZ = [88, 92, 96, 100, 104, 108];

export function RadioSet({ state, dial, label }: Props) {
  const needleX = DIAL_X0 + 6 + (dial ?? 0.5) * (DIAL_W - 12);

  return (
    <figure class={`radio-set is-${state}`} aria-label={label}>
      <svg viewBox="0 0 360 190" role="img" aria-hidden="true">
        <defs>
          <linearGradient id="rs-case" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#7a4a2c" />
            <stop offset="0.5" stop-color="#5d3720" />
            <stop offset="1" stop-color="#43261a" />
          </linearGradient>
          <linearGradient id="rs-dial" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#f6e7c1" />
            <stop offset="1" stop-color="#e8d29c" />
          </linearGradient>
          <radialGradient id="rs-glow" cx="0.5" cy="0.5" r="0.6">
            <stop offset="0" stop-color="#fff3c4" stop-opacity="0.9" />
            <stop offset="1" stop-color="#ffcc55" stop-opacity="0" />
          </radialGradient>
          <pattern id="rs-cloth" width="5" height="5" patternUnits="userSpaceOnUse">
            <rect width="5" height="5" fill="#b89a6a" />
            <path d="M0 0 L5 5 M5 0 L0 5" stroke="#9c7f52" stroke-width="0.8" />
          </pattern>
        </defs>

        {/* Boîtier en bakélite */}
        <rect x="6" y="8" width="348" height="174" rx="22" fill="url(#rs-case)" stroke="#2c1a10" stroke-width="3" />
        <rect x="14" y="14" width="332" height="8" rx="4" fill="#fff" opacity="0.12" />

        {/* Haut-parleur : toile tressée derrière des lames */}
        <rect x="22" y="30" width="84" height="120" rx="10" fill="url(#rs-cloth)" stroke="#2c1a10" stroke-width="2" />
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x="30" y={44 + i * 21} width="68" height="7" rx="3.5" fill="#43261a" />
        ))}

        {/* Cadran */}
        <rect x={DIAL_X0} y="30" width={DIAL_W} height="74" rx="6" fill="url(#rs-dial)" stroke="#2c1a10" stroke-width="2" />
        {state === 'on' && <rect x={DIAL_X0} y="30" width={DIAL_W} height="74" rx="6" fill="url(#rs-glow)" class="rs-backlight" />}
        {Array.from({ length: 41 }, (_, i) => {
          const x = DIAL_X0 + 10 + (i / 40) * (DIAL_W - 20);
          const major = i % 8 === 0;
          return <line key={i} x1={x} y1="70" x2={x} y2={major ? 58 : 64} stroke="#3a3632" stroke-width={major ? 1.4 : 0.7} />;
        })}
        {MHZ.map((f, i) => (
          <text key={f} x={DIAL_X0 + 10 + (i / 5) * (DIAL_W - 20)} y="52" text-anchor="middle" font-family="Special Elite, monospace" font-size="10" fill="#3a3632">
            {f}
          </text>
        ))}
        <text x={DIAL_X0 + 10} y="88" font-family="Special Elite, monospace" font-size="8" fill="#3a3632">FM · MHz</text>
        <text x={DIAL_X0 + DIAL_W - 10} y="88" text-anchor="end" font-family="Special Elite, monospace" font-size="8" fill="#3a3632">
          OC · GO · PO
        </text>
        <line x1={DIAL_X0 + 10} y1="94" x2={DIAL_X0 + DIAL_W - 10} y2="94" stroke="#3a3632" stroke-width="0.6" />

        {/* Aiguille */}
        <g class="rs-needle" style={{ transform: `translateX(${needleX}px)` }}>
          <line x1="0" y1="34" x2="0" y2="100" stroke="#d9483b" stroke-width="2.2" />
        </g>

        {/* Œil magique */}
        <circle cx="140" cy="135" r="13" fill="#1f2a1f" stroke="#2c1a10" stroke-width="2" />
        <circle cx="140" cy="135" r="9" class="rs-eye" />

        {/* Étiquette */}
        <rect x="164" y="122" width="124" height="26" rx="3" fill="#ede3cf" stroke="#2c1a10" stroke-width="1.5" />
        <text x="226" y="139" text-anchor="middle" font-family="Special Elite, monospace" font-size="10.5" fill="#3a3632" class="rs-label">
          {label.length > 22 ? `${label.slice(0, 21)}…` : label}
        </text>

        {/* Boutons */}
        <g class="rs-knob" style={{ transformOrigin: '318px 136px' }}>
          <circle cx="318" cy="136" r="16" fill="#2c1a10" />
          <circle cx="318" cy="136" r="12" fill="#5d3720" stroke="#1a0f08" stroke-width="1" />
          <line x1="318" y1="136" x2="318" y2="125" stroke="#ede3cf" stroke-width="2" stroke-linecap="round" />
        </g>
        <circle cx="62" cy="168" r="4" fill={state === 'off' ? '#4a2a1a' : '#d9483b'} class="rs-power" />

        {/* Pieds */}
        <rect x="40" y="180" width="40" height="7" rx="3" fill="#2c1a10" />
        <rect x="280" y="180" width="40" height="7" rx="3" fill="#2c1a10" />
      </svg>
    </figure>
  );
}
