import { describe, expect, it } from 'vitest';
import { greatCircleSegments, haversineKm, rarityFor, rawScore, roundScore } from '../shared/scoring';

const PARIS = { lat: 48.8566, lon: 2.3522 };
const NEW_YORK = { lat: 40.7128, lon: -74.006 };
const TOKYO = { lat: 35.6762, lon: 139.6503 };
const SAN_FRANCISCO = { lat: 37.7749, lon: -122.4194 };

describe('haversineKm', () => {
  it('Paris – New York ≈ 5837 km', () => {
    expect(haversineKm(PARIS, NEW_YORK)).toBeCloseTo(5837, -1);
  });
  it('distance nulle et symétrie', () => {
    expect(haversineKm(PARIS, PARIS)).toBe(0);
    expect(haversineKm(TOKYO, PARIS)).toBeCloseTo(haversineKm(PARIS, TOKYO), 6);
  });
  it('antipodes ≈ demi-circonférence', () => {
    expect(haversineKm({ lat: 0, lon: 0 }, { lat: 0, lon: 180 })).toBeCloseTo(20015, -1);
  });
});

describe('score', () => {
  it('suit 5000·e^(−d/2000)', () => {
    expect(rawScore(0)).toBe(5000);
    expect(rawScore(2000)).toBe(1839);
    expect(rawScore(20000)).toBe(0);
  });
  it('déduit les indices sans devenir négatif', () => {
    expect(roundScore(0, ['language'])).toEqual({ raw: 5000, score: 4500 });
    expect(roundScore(0, ['language', 'continent', 'timezone'])).toEqual({ raw: 5000, score: 2750 });
    expect(roundScore(8000, ['continent']).score).toBe(0);
    expect(roundScore(null, []).score).toBe(0);
  });
  it('un indice compté deux fois ne coûte qu’une fois', () => {
    expect(roundScore(0, ['language', 'language']).score).toBe(4500);
  });
});

describe('rarityFor', () => {
  it.each([
    [10, 'gold'],
    [49.9, 'gold'],
    [50, 'high'],
    [500, 'medium'],
    [1499, 'simple'],
    [1500, null],
  ])('%d km → %s', (d, r) => expect(rarityFor(d)).toBe(r));
});

describe('greatCircleSegments', () => {
  it('un seul segment en Europe–Amérique', () => {
    const segs = greatCircleSegments(PARIS, NEW_YORK);
    expect(segs).toHaveLength(1);
    expect(segs[0]![0]).toEqual([PARIS.lat, PARIS.lon]);
  });
  it('coupe à l’antiméridien sur Tokyo – San Francisco', () => {
    const segs = greatCircleSegments(TOKYO, SAN_FRANCISCO);
    expect(segs).toHaveLength(2);
    expect(segs[0]!.at(-1)![1]).toBe(180);
    expect(segs[1]![0]![1]).toBe(-180);
  });
});
