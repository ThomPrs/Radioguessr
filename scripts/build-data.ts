// Prépare les données statiques du jeu dans public/data/ (à lancer une fois : npm run build:data).
//   countries.json  — Natural Earth 1:50m, coordonnées arrondies, propriétés {iso, name, cont}
//   places.json     — villes Natural Earth 1:10m : [nom, lat, lon, iso][]
//   timezones.json  — IANA zone1970.tab : [iso[], lat, lon, zone][]
// Exécution : node scripts/build-data.ts (Node ≥ 22.18, types effacés nativement)

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const CACHE = join(ROOT, 'scripts', '.cache');
const OUT = join(ROOT, 'public', 'data');
const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson';

const SOURCES = {
  countries: `${NE}/ne_50m_admin_0_countries.geojson`,
  places: `${NE}/ne_10m_populated_places_simple.geojson`,
  zones: 'https://data.iana.org/time-zones/data/zone1970.tab',
};

const CONTINENTS: Record<string, string> = {
  Africa: 'AF',
  Antarctica: 'AN',
  Asia: 'AS',
  Europe: 'EU',
  'North America': 'NA',
  Oceania: 'OC',
  'South America': 'SA',
  'Seven seas (open ocean)': 'AF', // îles de l'océan Indien (Maurice, Seychelles…)
};

async function cached(name: keyof typeof SOURCES): Promise<string> {
  const file = join(CACHE, name);
  if (existsSync(file)) return readFile(file, 'utf8');
  console.log(`↓ ${SOURCES[name]}`);
  const res = await fetch(SOURCES[name]);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const text = await res.text();
  await writeFile(file, text);
  return text;
}

type Pos = number[];
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Arrondit à 0,01° (~1 km) et supprime les points consécutifs devenus identiques. */
function simplifyRing(ring: Pos[]): Pos[] | null {
  const out: Pos[] = [];
  for (const p of ring) {
    const q = [r2(p[0]!), r2(p[1]!)];
    const last = out[out.length - 1];
    if (!last || last[0] !== q[0] || last[1] !== q[1]) out.push(q);
  }
  return out.length >= 4 ? out : null;
}

function simplifyGeometry(g: { type: string; coordinates: unknown }) {
  if (g.type === 'Polygon') {
    const rings = (g.coordinates as Pos[][]).map(simplifyRing).filter((r): r is Pos[] => r !== null);
    return rings.length ? { type: 'Polygon', coordinates: rings } : null;
  }
  const polys = (g.coordinates as Pos[][][])
    .map((poly) => poly.map(simplifyRing).filter((r): r is Pos[] => r !== null))
    .filter((p) => p.length > 0);
  return polys.length ? { type: 'MultiPolygon', coordinates: polys } : null;
}

async function buildCountries() {
  const src = JSON.parse(await cached('countries')) as {
    features: { properties: Record<string, string>; geometry: { type: string; coordinates: unknown } }[];
  };
  const features = [];
  for (const f of src.features) {
    const p = f.properties;
    const iso = p.ISO_A2_EH !== '-99' ? p.ISO_A2_EH : p.ISO_A2;
    const geometry = simplifyGeometry(f.geometry);
    if (!geometry) continue;
    features.push({
      type: 'Feature',
      properties: { iso: iso === '-99' ? '' : iso, name: p.NAME_FR || p.NAME, cont: CONTINENTS[p.CONTINENT!] ?? '' },
      geometry,
    });
  }
  return { type: 'FeatureCollection', features };
}

async function buildPlaces() {
  const src = JSON.parse(await cached('places')) as {
    features: { properties: { name: string; latitude: number; longitude: number; iso_a2: string } }[];
  };
  return src.features
    .map((f) => f.properties)
    .filter((p) => p.iso_a2 && p.iso_a2 !== '-99')
    .map((p) => [p.name, r2(p.latitude), r2(p.longitude), p.iso_a2]);
}

/** Convertit « +4851+00220 » / « -332650-0703955 » (ISO 6709) en degrés décimaux. */
function parseIso6709(s: string): [number, number] {
  const m = /^([+-]\d+)([+-]\d+)$/.exec(s);
  if (!m) throw new Error(`coordonnées invalides : ${s}`);
  const conv = (v: string, degDigits: number) => {
    const sign = v[0] === '-' ? -1 : 1;
    const d = v.slice(1);
    const deg = Number(d.slice(0, degDigits));
    const min = Number(d.slice(degDigits, degDigits + 2));
    const sec = d.length > degDigits + 2 ? Number(d.slice(degDigits + 2)) : 0;
    return sign * (deg + min / 60 + sec / 3600);
  };
  return [r2(conv(m[1]!, 2)), r2(conv(m[2]!, 3))];
}

async function buildZones() {
  const text = await cached('zones');
  const rows = [];
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const [codes, coord, zone] = line.split('\t');
    if (!codes || !coord || !zone) continue;
    const [lat, lon] = parseIso6709(coord);
    rows.push([codes.split(','), lat, lon, zone]);
  }
  return rows;
}

await mkdir(CACHE, { recursive: true });
await mkdir(OUT, { recursive: true });
const outputs = {
  'countries.json': await buildCountries(),
  'places.json': await buildPlaces(),
  'timezones.json': await buildZones(),
};
for (const [name, data] of Object.entries(outputs)) {
  const json = JSON.stringify(data);
  await writeFile(join(OUT, name), json);
  console.log(`✓ public/data/${name}  ${(json.length / 1024).toFixed(0)} ko`);
}
