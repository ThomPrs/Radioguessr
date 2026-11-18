import { describe, expect, it } from 'vitest';
import { callsignFor, collect, createQslCard, shortStationName, sinpoFor, thanksMessage } from '../shared/qsl';
import type { Station } from '../shared/types';

const station: Station = {
  id: '708b0757-a13b-42d5-adef-65aa6d459f7d', name: 'Ritoque FM', streamUrl: 'https://x', codec: 'MP3',
  lat: -32.83, lon: -71.52, countryCode: 'CL', country: 'Chile', continent: 'SA', languageCode: 'es', frequency: '98,5 MHz',
};

describe('createQslCard', () => {
  it('pas de carte au-delà de 1 500 km', () => {
    expect(createQslCard({ station, distanceKm: 1500, city: null })).toBeNull();
  });
  it('carte dorée sous 50 km', () => {
    const c = createQslCard({ station, distanceKm: 12.34, city: 'Viña del Mar' })!;
    expect(c).toMatchObject({ rarity: 'gold', sinpo: '55555', city: 'Viña del Mar', country: 'Chili', countryCode: 'CL', distanceKm: 12.3, frequency: '98,5 MHz' });
    expect(c.callsign).toMatch(/^CE · \d$/);
    expect(c.message.lang).toBe('es');
  });
  it('ville par défaut : région puis pays', () => {
    expect(createQslCard({ station: { ...station, state: 'Valparaíso' }, distanceKm: 300, city: null })!.city).toBe('Valparaíso');
    expect(createQslCard({ station, distanceKm: 300, city: null })!.city).toBe('Chili');
  });
});

describe('SINPO', () => {
  it('chiffres dans la plage de la rareté, déterministes', () => {
    expect(sinpoFor('high', 1)).toMatch(/^[45]{5}$/);
    expect(sinpoFor('medium', 1)).toMatch(/^[34]{5}$/);
    expect(sinpoFor('simple', 1)).toMatch(/^[23]{5}$/);
    expect(sinpoFor('high', 99)).toBe(sinpoFor('high', 99));
  });
});

describe('divers', () => {
  it('indicatif stable et préfixe UIT', () => {
    expect(callsignFor(station)).toBe(callsignFor(station));
    expect(callsignFor({ ...station, countryCode: 'ZZ' })).toMatch(/^ZZ · /);
  });
  it('message : langue de la station, sinon du pays, sinon anglais', () => {
    expect(thanksMessage({ ...station, languageCode: 'de' }).lang).toBe('de');
    expect(thanksMessage({ ...station, languageCode: undefined, countryCode: 'JP' }).lang).toBe('ja');
    expect(thanksMessage({ ...station, languageCode: 'xx', countryCode: 'ZZ' }).lang).toBe('en');
  });
  it('raccourcit les noms à rallonge', () => {
    expect(shortStationName('EXA FM Honduras: Tegucigalpa 100.5 FM / San Pedro Sula 89.3 FM')).toBe('EXA FM Honduras');
    expect(shortStationName('Ritoque FM')).toBe('Ritoque FM');
    expect(shortStationName('A'.repeat(50)).length).toBe(34);
  });
});

describe('collect', () => {
  const near = createQslCard({ station, distanceKm: 40, city: null })!;
  const far = createQslCard({ station, distanceKm: 900, city: null })!;
  it('nouvelle, améliorée, conservée', () => {
    const a = collect({}, far);
    expect(a.outcome).toBe('new');
    const b = collect(a.album, near);
    expect(b.outcome).toBe('upgraded');
    expect(b.album.CL!.rarity).toBe('gold');
    const c = collect(b.album, far);
    expect(c.outcome).toBe('kept');
    expect(c.album.CL!.distanceKm).toBe(40);
  });
});
