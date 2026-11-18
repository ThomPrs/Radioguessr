// Marqueur planté sur la carte : l'épingle du joueur au bout d'une aiguille, avec son ombre.
// En multijoueur : anneau à la couleur du joueur et étiquette avec son pseudo.

import { render } from 'preact';
import L from 'leaflet';
import { STARTER_PIN, pinById } from '../../shared/pins';
import { PinBadge } from './PinBadge';

const W = 44; // largeur de l'icône
const H = 64; // hauteur : la pointe de l'aiguille est en bas, au centre

export interface PinMarkerOptions {
  /** Couleur de l'anneau (multijoueur). */
  ring?: string;
  /** Pseudo affiché sur une petite bande de papier. */
  label?: string;
  /** Numéro de manche (carte récapitulative). */
  number?: number;
}

export function PinMarker({ pinId, ring, label, number }: { pinId: string } & PinMarkerOptions) {
  const id = pinById(pinId) ? pinId : STARTER_PIN;
  return (
    <div class="pin-marker" data-pin={id} style={ring ? ({ '--ring': ring } as Record<string, string>) : undefined}>
      <svg class="pin-needle" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
        <ellipse cx={W / 2 + 4} cy={H - 3} rx="7" ry="2.2" fill="#3a3632" opacity="0.3" />
        <line x1={W / 2} y1="30" x2={W / 2} y2={H - 3} stroke="#6b6f76" stroke-width="2.4" stroke-linecap="round" />
        <line x1={W / 2 - 0.6} y1="30" x2={W / 2 - 0.6} y2={H - 6} stroke="#e6e8eb" stroke-width="0.8" />
      </svg>
      <span class={`pin-head${ring ? ' has-ring' : ''}`}>
        <PinBadge id={id} size={36} />
      </span>
      {number != null && <span class="pin-number">{number}</span>}
      {label && <span class="pin-label">{label}</span>}
    </div>
  );
}

const cache = new Map<string, L.DivIcon>();

/** Icône Leaflet du marqueur (HTML statique produit une fois par combinaison). */
export function pinMarkerIcon(pinId: string, opts: PinMarkerOptions = {}): L.DivIcon {
  const key = `${pinId}|${opts.ring ?? ''}|${opts.label ?? ''}|${opts.number ?? ''}`;
  let icon = cache.get(key);
  if (!icon) {
    const el = document.createElement('div');
    render(<PinMarker pinId={pinId} {...opts} />, el);
    icon = L.divIcon({ className: 'ink-pin', html: el.innerHTML, iconSize: [W, H], iconAnchor: [W / 2, H - 3] });
    cache.set(key, icon);
  }
  return icon;
}
