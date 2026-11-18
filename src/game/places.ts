// Ville la plus proche d'une station (villes Natural Earth), pour les cartes QSL.

import { haversineKm } from '../../shared/scoring';
import type { Station } from '../../shared/types';

type PlaceRow = [string, number, number, string]; // [nom, lat, lon, iso]

const MAX_CITY_DISTANCE_KM = 120;

let places: PlaceRow[] | null = null;
let loading: Promise<void> | null = null;

/** Précharge la liste (appelée au début de la partie, pour que la révélation soit instantanée). */
export function preloadPlaces(): Promise<void> {
  loading ??= fetch('/data/places.json')
    .then((r) => (r.ok ? (r.json() as Promise<PlaceRow[]>) : []))
    .then((rows) => {
      places = rows;
    })
    .catch(() => {
      places = [];
    });
  return loading;
}

/** Ville la plus proche dans le même pays, à moins de 120 km ; null sinon ou si pas encore chargé. */
export function nearestCity(station: Station): string | null {
  if (!places) return null;
  let best: string | null = null;
  let bestD = MAX_CITY_DISTANCE_KM;
  for (const [name, lat, lon, iso] of places) {
    if (iso !== station.countryCode) continue;
    const d = haversineKm(station, { lat, lon });
    if (d < bestD) {
      bestD = d;
      best = name;
    }
  }
  return best;
}
