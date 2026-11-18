import { describe, expect, it } from 'vitest';
import { extractFrequency, normalizeStation, pickCountry, type CountryInfo, type RawStation } from '../shared/radio-browser';
import { mulberry32 } from '../shared/rng';

const base: RawStation = {
  stationuuid: 'u1',
  name: 'Ritoque FM',
  url_resolved: 'https://example.cl/stream',
  codec: 'MP3',
  hls: 0,
  lastcheckok: 1,
  countrycode: 'CL',
  country: 'Chile',
  state: 'Valparaíso',
  language: 'español chile,english',
  tags: '',
  geo_lat: -33.0,
  geo_long: -71.6,
};

describe('normalizeStation', () => {
  it('garde une station valide', () => {
    const s = normalizeStation(base);
    expect(s).toMatchObject({ countryCode: 'CL', continent: 'SA', language: 'español chile', codec: 'MP3' });
  });
  it.each([
    ['http', { url_resolved: 'http://example.cl/stream' }],
    ['codec OGG', { codec: 'OGG' }],
    ['HLS', { hls: 1 }],
    ['check KO', { lastcheckok: 0 }],
    ['sans coordonnées', { geo_lat: null }],
    ['coordonnées 0,0', { geo_lat: 0, geo_long: 0 }],
    ['pays inconnu', { countrycode: '' }],
  ])('rejette : %s', (_label, patch) => {
    expect(normalizeStation({ ...base, ...patch } as RawStation)).toBeNull();
  });
});

describe('extractFrequency', () => {
  it('trouve une fréquence FM', () => {
    expect(extractFrequency('Radio Bío-Bío 98.5 FM')).toBe('98,5 MHz');
    expect(extractFrequency('FM 101,3 Lyon')).toBe('101,3 MHz');
  });
  it('ignore les nombres sans marqueur ou hors bande', () => {
    expect(extractFrequency('Radio 101')).toBeUndefined();
    expect(extractFrequency('Top 40 FM')).toBeUndefined();
  });
});

describe('pickCountry', () => {
  const countries: CountryInfo[] = [
    { code: 'US', name: 'USA', continent: 'NA', stationCount: 8000 },
    { code: 'DE', name: 'Germany', continent: 'EU', stationCount: 4000 },
    { code: 'FR', name: 'France', continent: 'EU', stationCount: 1500 },
    { code: 'CL', name: 'Chile', continent: 'SA', stationCount: 400 },
    { code: 'SN', name: 'Senegal', continent: 'AF', stationCount: 30 },
    { code: 'JP', name: 'Japan', continent: 'AS', stationCount: 300 },
  ];

  it('respecte les exclusions et le plafond par continent', () => {
    const c = pickCountry(countries, { excludeCountries: ['US'], continentCounts: { EU: 2 }, rng: mulberry32(1) });
    expect(c && ['CL', 'SN', 'JP']).toContain(c?.code);
  });

  it('les gros pays ne dominent pas', () => {
    const rng = mulberry32(42);
    let us = 0;
    const N = 5000;
    for (let i = 0; i < N; i++) if (pickCountry(countries, { rng })?.code === 'US') us++;
    // Poids brut : 8000/14230 ≈ 56 %. Avec √ : ≈ 34 %.
    expect(us / N).toBeLessThan(0.4);
  });
});
