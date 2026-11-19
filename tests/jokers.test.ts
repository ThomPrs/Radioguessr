import { beforeEach, describe, expect, it } from 'vitest';
import {
  FLOOR_SCORE,
  JOKERS,
  MAIL_EVERY,
  RADAR_RADIUS_KM,
  STARTER_JOKERS,
  canPlay,
  cleanHand,
  drawJoker,
  playableIn,
  radarCenter,
  scoreWithJokers,
  stolenPoints,
  type PlayContext,
} from '../shared/jokers';
import { mulberry32 } from '../shared/rng';
import { haversineKm, rawScore } from '../shared/scoring';
import { t } from '../src/i18n/fr';
import { defaultSave, migrate, putInHand, save, tickMail } from '../src/state/save';

const ctx = (over: Partial<PlayContext> = {}): PlayContext => ({
  mode: 'solo',
  enabled: true,
  hand: ['double', 'brouilleur'],
  used: [],
  listening: true,
  guessed: false,
  ...over,
});

describe('catalogue', () => {
  it('identifiants uniques, un texte d’effet chacun, 6 perso et 6 multi', () => {
    expect(new Set(JOKERS.map((j) => j.id)).size).toBe(JOKERS.length);
    for (const j of JOKERS) expect(t.jokers.effect[j.id], j.id).toBeTruthy();
    expect(JOKERS.filter((j) => j.kind === 'perso')).toHaveLength(6);
    expect(JOKERS.filter((j) => j.kind === 'multi')).toHaveLength(6);
  });
  it('main nettoyée : connus, sans doublon, 2 au plus', () => {
    expect(cleanHand(['double', 'double', 'inconnu', 'radar', 'taxe'])).toEqual(['double', 'radar']);
    expect(cleanHand('n’importe quoi')).toEqual([]);
  });
});

describe('canPlay : vérification du type et des règles', () => {
  it('joker perso jouable en solo', () => {
    expect(canPlay('double', ctx())).toEqual({ ok: true });
  });
  it('joker multi refusé en solo', () => {
    expect(canPlay('brouilleur', ctx({ target: 'b', opponents: ['b'] }))).toEqual({ ok: false, reason: 'solo' });
    expect(playableIn('solo', ['double', 'brouilleur']).map((j) => j.id)).toEqual(['double']);
    expect(playableIn('duel', ['double', 'brouilleur']).map((j) => j.id)).toEqual(['double', 'brouilleur']);
  });
  it('une seule fois par partie, seulement s’il est dans la main', () => {
    expect(canPlay('double', ctx({ used: ['double'] }))).toEqual({ ok: false, reason: 'used' });
    expect(canPlay('radar', ctx())).toEqual({ ok: false, reason: 'not-in-hand' });
  });
  it('jokers coupés, manche close, épingle déjà validée', () => {
    expect(canPlay('double', ctx({ enabled: false }))).toMatchObject({ reason: 'disabled' });
    expect(canPlay('double', ctx({ listening: false }))).toMatchObject({ reason: 'closed' });
    expect(canPlay('double', ctx({ guessed: true }))).toMatchObject({ reason: 'guessed' });
  });
  it('Seconde écoute : il faut une épingle posée', () => {
    expect(canPlay('seconde', ctx({ hand: ['seconde'] }))).toMatchObject({ reason: 'no-pin' });
    expect(canPlay('seconde', ctx({ hand: ['seconde'], pinPlaced: true }))).toEqual({ ok: true });
  });
  it('cible : un adversaire encore en jeu, jamais soi-même', () => {
    const duel = ctx({ mode: 'duel', opponents: ['b', 'c'] });
    expect(canPlay('brouilleur', duel)).toMatchObject({ reason: 'target' });
    expect(canPlay('brouilleur', { ...duel, target: 'z' })).toMatchObject({ reason: 'target' });
    expect(canPlay('brouilleur', { ...duel, target: 'b' })).toEqual({ ok: true });
    // une attaque reste possible après avoir validé sa propre épingle
    expect(canPlay('brouilleur', { ...duel, target: 'c', guessed: true })).toEqual({ ok: true });
  });
});

describe('score', () => {
  it('sans joker : comme avant', () => {
    expect(scoreWithJokers(500, ['continent'])).toEqual({ raw: rawScore(500), score: rawScore(500) - 1000 });
  });
  it('Double fréquence, Filet de sécurité, Indices offerts', () => {
    const raw = rawScore(500);
    expect(scoreWithJokers(500, ['continent'], { double: true }).score).toBe((raw - 1000) * 2);
    expect(scoreWithJokers(9000, [], { floor: true }).score).toBe(FLOOR_SCORE);
    expect(scoreWithJokers(null, [], { floor: true }).score).toBe(0); // pas d'épingle : pas de filet
    expect(scoreWithJokers(500, ['continent', 'language'], { freeHints: true }).score).toBe(raw);
    expect(scoreWithJokers(9000, [], { floor: true, double: true }).score).toBe(FLOOR_SCORE * 2);
  });
  it('Taxe : l’indice taxé compte double', () => {
    expect(scoreWithJokers(500, ['continent'], { taxedHint: 'continent' }).score).toBe(rawScore(500) - 2000);
    expect(scoreWithJokers(500, ['language'], { taxedHint: 'continent' }).score).toBe(rawScore(500) - 500);
  });
  it('Pickpocket : 500 au plus, jamais plus que la manche de la cible', () => {
    expect(stolenPoints(3000)).toBe(500);
    expect(stolenPoints(120)).toBe(120);
    expect(stolenPoints(0)).toBe(0);
  });
  it('Radar : la station est toujours dans le cercle', () => {
    const rng = mulberry32(3);
    for (const st of [{ lat: 48.8, lon: 2.3 }, { lat: -33.9, lon: 151.2 }, { lat: 64, lon: -179.5 }]) {
      for (let i = 0; i < 200; i++) expect(haversineKm(radarCenter(st, rng), st)).toBeLessThan(RADAR_RADIUS_KM);
    }
  });
});

describe('courrier', () => {
  beforeEach(() => {
    save.value = defaultSave();
  });
  it('cartes de départ dans la main ; anciennes sauvegardes complétées', () => {
    expect(save.value.hand).toEqual(STARTER_JOKERS);
    const m = migrate({ version: 2 });
    expect(Object.keys(m.jokers).sort()).toEqual([...STARTER_JOKERS].sort());
    expect(m.hand).toEqual(STARTER_JOKERS);
    expect(migrate({ version: 2, jokers: { radar: true, bidon: true }, hand: ['radar', 'taxe'] })).toMatchObject({ hand: ['radar'] });
  });
  it(`une carte toutes les ${MAIL_EVERY} parties, jamais une carte déjà possédée`, () => {
    const rng = mulberry32(7);
    const got: string[] = [];
    for (let game = 1; game <= MAIL_EVERY * 20; game++) {
      const card = tickMail(rng);
      if (game % MAIL_EVERY === 0 && got.length < JOKERS.length - STARTER_JOKERS.length) {
        expect(card, `partie ${game}`).not.toBeNull();
        expect(got).not.toContain(card!.id);
        expect(STARTER_JOKERS).not.toContain(card!.id);
        got.push(card!.id);
      } else expect(card).toBeNull();
    }
    expect(Object.keys(save.value.jokers)).toHaveLength(JOKERS.length); // collection complète, plus de courrier
  });
  it('tirage pondéré : les épiques sont plus rares que les communes', () => {
    const rng = mulberry32(1);
    const n = { common: 0, rare: 0, epic: 0 };
    for (let i = 0; i < 3000; i++) n[drawJoker({}, rng)!.rarity]++;
    expect(n.common).toBeGreaterThan(n.rare);
    expect(n.rare).toBeGreaterThan(n.epic);
  });
  it('main : la nouvelle carte remplace la plus ancienne', () => {
    save.value = { ...save.value, jokers: { ...save.value.jokers, radar: true } };
    putInHand('radar');
    expect(save.value.hand).toEqual(['indices', 'radar']);
    putInHand('taxe'); // non possédée
    expect(save.value.hand).toEqual(['indices', 'radar']);
  });
});
