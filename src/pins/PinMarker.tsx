// Marqueur planté sur la carte : l'épingle du joueur, debout, pointe sur le point visé.
// En multijoueur : halo à la couleur du joueur derrière la tête et étiquette avec son pseudo.

import { render } from 'preact';
import L from 'leaflet';
import { STARTER_PIN, pinById } from '../../shared/pins';
import { HEAD_CENTER, PIN_BOX, PinArt } from './PinArt';

const H = 64; // hauteur du marqueur sur la carte
const W = H / 2;
const SCALE = H / PIN_BOX.h;

export interface PinMarkerOptions {
  /** Couleur du halo (multijoueur). */
  ring?: string;
  /** Pseudo affiché sur une petite bande de papier. */
  label?: string;
  /** Numéro de manche (carte récapitulative). */
  number?: number;
}

export function PinMarker({ pinId, ring, label, number, height = H }: { pinId: string; height?: number } & PinMarkerOptions) {
  const pin = pinById(pinId) ?? pinById(STARTER_PIN)!;
  const [hx, hy] = HEAD_CENTER[pin.kind];
  const k = height / PIN_BOX.h;
  return (
    <div class="pin-marker" data-pin={pin.id} style={{ width: `${height / 2}px`, height: `${height}px`, ...(ring ? { '--ring': ring } : {}) }}>
      <PinArt id={pin.id} height={height} halo={ring} />
      {number != null && (
        <span class="pin-number" style={{ left: `${hx * k - 20}px`, top: `${hy * k - 18}px` }}>
          {number}
        </span>
      )}
      {label && (
        <span class="pin-label" style={{ left: `${hx * k + 14}px`, top: `${hy * k - 10}px` }}>
          {label}
        </span>
      )}
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
    // Ancre = pointe de l'aiguille.
    icon = L.divIcon({ className: 'ink-pin', html: el.innerHTML, iconSize: [W, H], iconAnchor: [PIN_BOX.tipX * SCALE, PIN_BOX.tipY * SCALE] });
    cache.set(key, icon);
  }
  return icon;
}
