import { describe, expect, it } from 'vitest';
import { defaultSave, migrate } from '../src/state/save';

describe('migrate', () => {
  it('données absentes ou illisibles → valeurs par défaut', () => {
    expect(migrate(null)).toEqual(defaultSave());
    expect(migrate('n’importe quoi')).toEqual(defaultSave());
  });
  it('version 0 (sans numéro) → v1 en gardant l’album', () => {
    const m = migrate({ album: { FR: { countryCode: 'FR' } } });
    expect(m.version).toBe(1);
    expect(Object.keys(m.album)).toEqual(['FR']);
    expect(m.prefs.radioVolume).toBe(0.8);
  });
  it('complète les champs manquants d’une v1', () => {
    const m = migrate({ version: 1, album: {}, stats: { gamesPlayed: 3 }, prefs: { muted: true } });
    expect(m.stats.gamesPlayed).toBe(3);
    expect(m.stats.duels).toEqual({ won: 0, lost: 0, draw: 0 });
    expect(m.prefs).toMatchObject({ muted: true, sfxVolume: 0.6 });
  });
  it('version future : on repart à zéro sans planter', () => {
    expect(migrate({ version: 99 })).toEqual(defaultSave());
  });
});
