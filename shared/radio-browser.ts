// Client Radio Browser (radio-browser.info) utilisable dans le navigateur et dans /api.

import { continentOf } from './countries.js';
import { parseLanguage } from './language.js';
import { shuffle, weightedIndex, type Rng } from './rng.js';
import type { Codec, Continent, Station } from './types.js';

const FALLBACK_MIRRORS = [
  'de1.api.radio-browser.info',
  'de2.api.radio-browser.info',
  'fi1.api.radio-browser.info',
  'nl1.api.radio-browser.info',
];
const DISCOVERY_URL = 'https://all.api.radio-browser.info/json/servers';
const REQUEST_TIMEOUT_MS = 7000;

/** Brut renvoyé par /json/stations/* (on ne type que ce qu'on lit). */
export interface RawStation {
  stationuuid: string;
  name: string;
  url_resolved: string;
  codec: string;
  hls: number;
  lastcheckok: number;
  countrycode: string;
  country: string;
  state: string | null;
  language: string | null;
  languagecodes: string | null;
  tags: string | null;
  geo_lat: number | null;
  geo_long: number | null;
}

interface RawCountry {
  name: string;
  iso_3166_1: string;
  stationcount: number;
}

export interface CountryInfo {
  code: string;
  name: string;
  continent: Continent;
  stationCount: number;
}

// ── Miroirs ────────────────────────────────────────────────────────────────

let mirrorsPromise: Promise<string[]> | null = null;

async function fetchWithTimeout(url: string, timeoutMs: number, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Liste des miroirs : découverte dynamique + liste de secours, ordre aléatoire (répartition de charge). */
function getMirrors(): Promise<string[]> {
  mirrorsPromise ??= (async () => {
    let discovered: string[] = [];
    try {
      const res = await fetchWithTimeout(DISCOVERY_URL, 4000);
      if (res.ok) {
        const list = (await res.json()) as { name: string }[];
        discovered = [...new Set(list.map((s) => s.name))];
      }
    } catch {
      // Découverte en panne : on se rabat sur la liste fixe.
    }
    const rest = FALLBACK_MIRRORS.filter((m) => !discovered.includes(m));
    return [...shuffle(discovered), ...rest];
  })();
  return mirrorsPromise;
}

let preferredMirror: string | null = null;

/** GET JSON sur un miroir, avec repli sur les suivants en cas d'échec. */
export async function rbGet<T>(path: string, headers?: Record<string, string>): Promise<T> {
  const mirrors = await getMirrors();
  const ordered = preferredMirror ? [preferredMirror, ...mirrors.filter((m) => m !== preferredMirror)] : mirrors;
  let lastError: unknown;
  for (const host of ordered) {
    try {
      const res = await fetchWithTimeout(`https://${host}${path}`, REQUEST_TIMEOUT_MS, headers ? { headers } : undefined);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as T;
      preferredMirror = host;
      return data;
    } catch (err) {
      lastError = err;
      if (preferredMirror === host) preferredMirror = null;
    }
  }
  throw new Error(`Radio Browser injoignable (${String(lastError)})`);
}

// ── Filtrage et normalisation ──────────────────────────────────────────────

const PLAYABLE_CODECS: readonly Codec[] = ['MP3', 'AAC', 'AAC+'];

const FREQ_RE = /(?:\bFM\s*)?\b(\d{2,3}(?:[.,]\d{1,2})?)\s*(?:FM|MHz)?\b/i;

/** Extrait une fréquence FM plausible (87,5–108 MHz) du nom ou des tags. */
export function extractFrequency(...texts: (string | null | undefined)[]): string | undefined {
  for (const text of texts) {
    if (!text) continue;
    // On exige un marqueur « FM » ou « MHz » à proximité pour éviter les faux positifs (« Radio 101 »).
    if (!/\bFM\b|MHz/i.test(text)) continue;
    const m = FREQ_RE.exec(text);
    if (!m?.[1]) continue;
    const value = Number(m[1].replace(',', '.'));
    if (value >= 87.5 && value <= 108) return `${value.toFixed(1).replace('.', ',')} MHz`;
  }
  return undefined;
}

/** Renvoie une Station si la station brute est jouable et localisable, sinon null. */
export function normalizeStation(raw: RawStation): Station | null {
  const codec = raw.codec?.toUpperCase() as Codec;
  if (!PLAYABLE_CODECS.includes(codec)) return null;
  if (raw.hls) return null; // HLS non lisible nativement hors Safari
  if (raw.lastcheckok !== 1) return null;
  if (!raw.url_resolved?.startsWith('https://')) return null;

  const lat = raw.geo_lat;
  const lon = raw.geo_long;
  if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) < 0.01 && Math.abs(lon) < 0.01) return null; // « 0,0 » = coordonnées par défaut
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;

  const countryCode = raw.countrycode?.toUpperCase();
  const continent = countryCode ? continentOf(countryCode) : undefined;
  if (!countryCode || !continent) return null;

  const station: Station = {
    id: raw.stationuuid,
    name: raw.name.trim(),
    streamUrl: raw.url_resolved,
    codec,
    lat,
    lon,
    countryCode,
    country: raw.country,
    continent,
  };
  const state = raw.state?.trim();
  if (state) station.state = state;
  const languageCode = parseLanguage(raw.languagecodes, raw.language);
  if (languageCode) station.languageCode = languageCode;
  const frequency = extractFrequency(raw.name, raw.tags);
  if (frequency) station.frequency = frequency;
  return station;
}

// ── Requêtes ───────────────────────────────────────────────────────────────

export async function fetchCountries(headers?: Record<string, string>): Promise<CountryInfo[]> {
  const raw = await rbGet<RawCountry[]>('/json/countries', headers);
  const out: CountryInfo[] = [];
  for (const c of raw) {
    const code = c.iso_3166_1?.toUpperCase();
    const continent = code ? continentOf(code) : undefined;
    if (!code || !continent || continent === 'AN') continue;
    if (c.stationcount < 3) continue;
    out.push({ code, name: c.name, continent, stationCount: c.stationcount });
  }
  return out;
}

/** Stations jouables et géolocalisées d'un pays, dans un ordre aléatoire. */
export async function fetchCountryStations(
  countryCode: string,
  limit = 40,
  headers?: Record<string, string>,
): Promise<Station[]> {
  const params = new URLSearchParams({
    countrycode: countryCode,
    has_geo_info: 'true',
    is_https: 'true',
    hidebroken: 'true',
    order: 'random',
    limit: String(limit),
  });
  const raw = await rbGet<RawStation[]>(`/json/stations/search?${params}`, headers);
  const seen = new Set<string>();
  const out: Station[] = [];
  for (const r of raw) {
    const s = normalizeStation(r);
    if (!s || seen.has(s.streamUrl)) continue;
    seen.add(s.streamUrl);
    out.push(s);
  }
  return out;
}

// ── Diversité géographique ─────────────────────────────────────────────────

export interface PickOptions {
  excludeCountries?: Iterable<string>;
  /** Nombre de pays déjà tirés par continent (pour plafonner). */
  continentCounts?: Partial<Record<Continent, number>>;
  maxPerContinent?: number;
  rng?: Rng;
}

/**
 * Tire un pays avec un poids √(nombre de stations) : les gros pays (US, DE…) restent
 * plus probables mais n'écrasent plus les autres. Pas de doublon de pays, plafond par continent.
 */
export function pickCountry(countries: readonly CountryInfo[], opts: PickOptions = {}): CountryInfo | null {
  const exclude = new Set(opts.excludeCountries ?? []);
  const max = opts.maxPerContinent ?? 2;
  const counts = opts.continentCounts ?? {};
  let pool = countries.filter((c) => !exclude.has(c.code) && (counts[c.continent] ?? 0) < max);
  if (pool.length === 0) pool = countries.filter((c) => !exclude.has(c.code));
  if (pool.length === 0) return null;
  const idx = weightedIndex(
    pool.map((c) => Math.sqrt(c.stationCount)),
    opts.rng,
  );
  return pool[idx] ?? null;
}
