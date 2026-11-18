// Calcul des indices d'une station : langue, continent, fuseau horaire.

import { countryLanguage, languageNameFr } from './language.js';
import { haversineKm } from './scoring.js';
import type { Continent, Station } from './types.js';

export const CONTINENT_FR: Record<Continent, string> = {
  AF: 'Afrique',
  AN: 'Antarctique',
  AS: 'Asie',
  EU: 'Europe',
  NA: 'Amérique du Nord',
  OC: 'Océanie',
  SA: 'Amérique du Sud',
};

/** Ligne de public/data/timezones.json : [pays, lat, lon, zone IANA]. */
export type ZoneRow = [string[], number, number, string];

/** Zone IANA la plus proche de la station, en priorité parmi celles de son pays. */
export function nearestZone(station: Station, zones: readonly ZoneRow[]): string | null {
  const inCountry = zones.filter((z) => z[0].includes(station.countryCode));
  const pool = inCountry.length > 0 ? inCountry : zones;
  let best: string | null = null;
  let bestD = Infinity;
  for (const [, lat, lon, zone] of pool) {
    const d = haversineKm(station, { lat, lon });
    if (d < bestD) {
      bestD = d;
      best = zone;
    }
  }
  return best;
}

/** « UTC+5:30 », « UTC−3 », « UTC+0 » pour une zone à un instant donné. */
export function utcOffsetLabel(zone: string, at: Date = new Date()): string {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' })
    .formatToParts(at)
    .find((p) => p.type === 'timeZoneName')?.value;
  const m = part ? /GMT([+-])(\d{2}):(\d{2})/.exec(part) : null;
  if (!m) return 'UTC+0';
  const h = Number(m[2]);
  const min = m[3] === '00' ? '' : `:${m[3]}`;
  return `UTC${m[1] === '-' ? '−' : '+'}${h}${min}`;
}

/** Heure locale « 14 h 32 » dans la zone. */
export function localTimeLabel(zone: string, at: Date = new Date()): string {
  const s = new Intl.DateTimeFormat('fr-FR', { timeZone: zone, hour: '2-digit', minute: '2-digit' }).format(at);
  return s.replace(':', ' h ');
}

export interface StationHints {
  /** null si la langue est inconnue : l'indice est alors indisponible (et gratuit). */
  language: string | null;
  continent: string;
  /** Zone IANA ; le libellé est calculé au moment où l'indice est révélé. */
  timezone: string | null;
}

export function computeHints(station: Station, zones: readonly ZoneRow[]): StationHints {
  const code = station.languageCode ?? countryLanguage(station.countryCode);
  return {
    language: code ? languageNameFr(code) : null,
    continent: CONTINENT_FR[station.continent],
    timezone: nearestZone(station, zones),
  };
}
