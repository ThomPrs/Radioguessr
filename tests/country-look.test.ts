import { describe, expect, it } from 'vitest';
import albumCountries from '../shared/album-countries.json';
import { FLAG_LAYOUTS, LANDMARKS, architectureOf, biomeOf, flagOf, landmarkOf, paletteOf } from '../shared/country-look';

const HEX = /^#[0-9a-f]{6}$/i;
const codes = albumCountries as string[];

describe('identité visuelle des pays', () => {
  it('chaque pays de l’album a un drapeau valide', () => {
    for (const code of codes) {
      const f = flagOf(code);
      expect(f, code).not.toBeNull();
      expect(FLAG_LAYOUTS, code).toContain(f!.layout);
      for (const c of f!.colors) expect(c, code).toMatch(HEX);
      if (f!.emblem) expect(f!.emblem, code).toMatch(HEX);
      const need = { quart: 4, rhombus: 3, saltire: 2, tri: 2, hoist: 2, nordic: 2, disc: 2, diag: 2 } as Record<string, number>;
      expect(f!.colors.length, code).toBeGreaterThanOrEqual(need[f!.layout] ?? 1);
    }
  });

  it('palette : ni blanche ni noire, couleur du continent si pays inconnu', () => {
    const lum = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    };
    for (const code of codes) {
      const p = paletteOf(code, '#2f5d8c');
      for (const c of [p.sky, p.accent, p.accent2]) {
        expect(c, code).toMatch(HEX);
        expect(lum(c), `${code} ${c}`).toBeGreaterThan(0.08);
        expect(lum(c), `${code} ${c}`).toBeLessThan(0.97);
      }
    }
    expect(paletteOf('ZZ', '#2f5d8c').accent).toBe('#2f5d8c');
    expect(paletteOf('FR', '#000000').accent).not.toBe('#000000');
  });

  it('biome et architecture pour tous, monuments des grands pays', () => {
    for (const code of codes) {
      expect(biomeOf(code), code).toBeTruthy();
      expect(architectureOf(code), code).toBeTruthy();
    }
    expect(biomeOf('EG')).toBe('desert');
    expect(architectureOf('JP')).toBe('eastasian');
    expect(architectureOf('MA')).toBe('islamic');
    expect(landmarkOf('FR')).toBe('eiffel');
    expect(landmarkOf('ZZ')).toBeNull();
    expect(Object.keys(LANDMARKS).length).toBeGreaterThanOrEqual(30);
    for (const code of Object.keys(LANDMARKS)) expect(codes, code).toContain(code);
  });
});
