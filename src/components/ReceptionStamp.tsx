// Tampon de réception « QSL · SINPO · CONFIRMÉ » posé sur le recto d'une carte.
//
// Dessiné en SVG avec un filtre SVG interne (encre baveuse) : aucune propriété CSS « filter »
// ni « mix-blend-mode » sur l'élément, sinon Firefox aplatit la carte 3D (verso en miroir).
// Comme il fait partie du recto, il pivote avec la carte quand on la retourne.

interface Props {
  sinpo: string;
  gold: boolean;
  /** Angle « de travers » propre à la carte. */
  rotation: number;
  label: string;
  seed: number;
}

export function ReceptionStamp({ sinpo, gold, rotation, label, seed }: Props) {
  const id = `rstamp-${seed.toString(36)}`;
  const ink = gold ? '#a8841a' : '#d9483b';
  return (
    <div class="reception-stamp" style={{ '--rot': `${rotation}deg` } as Record<string, string>} aria-hidden="true">
      <svg viewBox="0 0 100 100">
        <defs>
          <filter id={id} x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed % 97} result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.6" />
          </filter>
        </defs>
        <g filter={`url(#${id})`} fill={ink} stroke={ink} opacity="0.88">
          <circle cx="50" cy="50" r="46" fill="none" stroke-width="3" />
          <circle cx="50" cy="50" r="40" fill="none" stroke-width="1.4" />
          <text x="50" y="31" text-anchor="middle" font-family="Special Elite, monospace" font-size="10" letter-spacing="3" stroke="none">
            QSL
          </text>
          <text x="50" y="59" text-anchor="middle" font-family="Archivo Black, sans-serif" font-size="17" letter-spacing="0.5" stroke="none">
            {sinpo}
          </text>
          <text x="50" y="76" text-anchor="middle" font-family="Special Elite, monospace" font-size="8" letter-spacing="2" stroke="none">
            {label}
          </text>
        </g>
      </svg>
    </div>
  );
}
