import { beforeEach, describe, expect, it } from 'vitest';
import { cleanLook } from '../shared/avatars';
import { PINS, RARITY_WEIGHTS, STARTER_PIN, drawPin } from '../shared/pins';
import { mulberry32 } from '../shared/rng';
import { awardPin, defaultSave, migrate, save, updateProfile } from '../src/state/save';

describe('migrate', () => {
  it('données absentes ou illisibles → valeurs par défaut', () => {
    expect(migrate(null)).toEqual(defaultSave());
    expect(migrate('n’importe quoi')).toEqual(defaultSave());
  });
  it('version 0 (sans numéro) → v2 en gardant l’album', () => {
    const m = migrate({ album: { FR: { countryCode: 'FR' } } });
    expect(m.version).toBe(2);
    expect(Object.keys(m.album)).toEqual(['FR']);
    expect(m.prefs.radioVolume).toBe(0.8);
  });
  it('v1 → v2 : album et statistiques conservés, épingles et profil ajoutés', () => {
    const m = migrate({ version: 1, album: { CL: { countryCode: 'CL' } }, stats: { gamesPlayed: 3 }, prefs: { muted: true } });
    expect(m.version).toBe(2);
    expect(Object.keys(m.album)).toEqual(['CL']);
    expect(m.stats.gamesPlayed).toBe(3);
    expect(m.stats.duels).toEqual({ won: 0, lost: 0, draw: 0 });
    expect(m.prefs).toMatchObject({ muted: true, sfxVolume: 0.6 });
    expect(m.pins).toEqual({ punaise: 1 }); // épingle de départ
    expect(m.profile).toMatchObject({ avatar: { face: 'operatrice', bg: 0 }, pin: 'punaise' });
  });
  it('v2 : épingles inconnues ignorées, punaise ajoutée, épingle plantée seulement si possédée', () => {
    const m = migrate({ version: 2, pins: { globe: 2, inconnue: 5 }, profile: { name: '  Bob  ', avatar: { face: 'robot', bg: 3 }, pin: 'phare' } });
    expect(m.pins).toEqual({ globe: 2, punaise: 1 });
    expect(m.profile).toEqual({ name: 'Bob', avatar: { face: 'robot', bg: 3 }, pin: 'punaise' });
    expect(migrate({ version: 2, pins: { globe: 1 }, profile: { pin: 'globe' } }).profile.pin).toBe('globe');
  });
  it('version future : on repart à zéro sans planter', () => {
    expect(migrate({ version: 99 })).toEqual(defaultSave());
  });
});

describe('épingles', () => {
  beforeEach(() => {
    save.value = defaultSave();
  });

  it('les doublons sont comptés ; l’épingle plantée ne change pas toute seule', () => {
    expect(save.value.profile.pin).toBe(STARTER_PIN);
    expect(awardPin('globe')).toBe(1);
    expect(awardPin('phare')).toBe(1);
    expect(awardPin('globe')).toBe(2);
    expect(save.value.pins).toEqual({ punaise: 1, globe: 2, phare: 1 });
    expect(save.value.profile.pin).toBe(STARTER_PIN);
    expect(awardPin('nexiste-pas')).toBe(0);
  });

  it('profil : épingle non possédée refusée, pseudo nettoyé', () => {
    awardPin('voilier');
    updateProfile({ name: '   Radio   Amateur  ', pin: 'satellite' });
    expect(save.value.profile).toMatchObject({ name: 'Radio Amateur', pin: 'punaise' });
    updateProfile({ pin: 'voilier', avatar: { face: 'chat', bg: 2 } });
    expect(save.value.profile).toMatchObject({ pin: 'voilier', avatar: { face: 'chat', bg: 2 } });
  });

  it('tirage : 60 / 27 / 10 / 3 % par rareté', () => {
    const rng = mulberry32(7);
    const n = 20_000;
    const counts = { common: 0, rare: 0, epic: 0, legendary: 0 };
    for (let i = 0; i < n; i++) counts[drawPin(rng).rarity]++;
    for (const [r, w] of Object.entries(RARITY_WEIGHTS)) {
      expect(counts[r as keyof typeof counts] / n).toBeCloseTo(w / 100, 1);
    }
    expect(PINS).toHaveLength(24);
  });

  it('la punaise de départ n’est jamais tirée', () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 5000; i++) expect(drawPin(rng).id).not.toBe(STARTER_PIN);
  });

  it('apparence reçue d’un client : valeurs inconnues remplacées', () => {
    expect(cleanLook({ avatar: { face: 'pirate', bg: 99 }, pin: '<script>' })).toEqual({ avatar: { face: 'operatrice', bg: 0 }, pin: 'punaise' });
    expect(cleanLook({ avatar: { face: 'chat', bg: 4 }, pin: 'globe' })).toEqual({ avatar: { face: 'chat', bg: 4 }, pin: 'globe' });
    expect(cleanLook(null).pin).toBe('punaise');
  });
});
