import { describe, expect, it } from 'vitest';
import { computeHints, nearestZone, utcOffsetLabel, type ZoneRow } from '../shared/hints';
import { languageNameFr, parseLanguage } from '../shared/language';
import type { Station } from '../shared/types';

const station = (p: Partial<Station>): Station => ({
  id: 'x', name: 'x', streamUrl: 'https://x', codec: 'MP3', lat: 0, lon: 0,
  countryCode: 'FR', country: 'France', continent: 'EU', ...p,
});

describe('langue', () => {
  it.each([
    ['en', null, 'en'],
    ['', 'español chile,english', 'es'],
    ['', 'Brazilian Portuguese', 'pt'],
    ['', 'română', 'ro'],
    ['', 'brezhoneg', 'br'],
    ['', 'multiculti', undefined],
  ])('codes=%j texte=%j → %s', (codes, text, expected) => {
    expect(parseLanguage(codes, text)).toBe(expected);
  });
  it('nom français', () => {
    expect(languageNameFr('es')).toBe('Espagnol');
    expect(languageNameFr('de')).toBe('Allemand');
  });
  it('repli sur la langue du pays', () => {
    expect(computeHints(station({ countryCode: 'BR', continent: 'SA' }), []).language).toBe('Portugais');
    expect(computeHints(station({ countryCode: 'BR', continent: 'SA', languageCode: 'en' }), []).language).toBe('Anglais');
  });
});

describe('fuseau horaire', () => {
  const zones: ZoneRow[] = [
    [['US'], 40.71, -74.01, 'America/New_York'],
    [['US'], 34.05, -118.24, 'America/Los_Angeles'],
    [['FR', 'MC'], 48.87, 2.33, 'Europe/Paris'],
    [['IN'], 22.53, 88.37, 'Asia/Kolkata'],
  ];
  it('zone la plus proche dans le pays', () => {
    expect(nearestZone(station({ countryCode: 'US', lat: 37.77, lon: -122.42 }), zones)).toBe('America/Los_Angeles');
    // Près de Paris mais pays = US : on reste dans les zones américaines.
    expect(nearestZone(station({ countryCode: 'US', lat: 48, lon: 2 }), zones)).toBe('America/New_York');
  });
  it('libellé de décalage', () => {
    expect(utcOffsetLabel('Asia/Kolkata')).toBe('UTC+5:30');
    expect(utcOffsetLabel('UTC')).toBe('UTC+0');
    expect(utcOffsetLabel('America/Sao_Paulo')).toBe('UTC−3');
  });
});
