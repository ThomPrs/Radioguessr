import { beforeEach, describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, newlyEarned, type GameFacts } from '../src/achievements/catalog';
import { t } from '../src/i18n/fr';
import { defaultSave, migrate, save, unlockAchievements, type SaveData } from '../src/state/save';
import type { QslCard } from '../shared/qsl';

const card = (code: string, continent: QslCard['continent'], rarity: QslCard['rarity'] = 'simple') =>
  ({ countryCode: code, continent, rarity }) as QslCard;

const solo = (over: Partial<GameFacts> = {}): GameFacts => ({
  mode: 'world',
  distances: [800, 1200, 300, 2500, 900],
  hintsUsed: 2,
  total: 12_000,
  news: null,
  ...over,
});

const ids = (s: SaveData, game?: GameFacts) => newlyEarned({ save: s, game }).map((a) => a.id);

describe('catalogue', () => {
  it('identifiants uniques, chacun avec un nom et un objectif', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) expect(t.stamps.list[a.id], a.id).toHaveLength(2);
  });
  it('sauvegarde neuve, aucune partie : rien', () => {
    expect(ids(defaultSave())).toEqual([]);
  });
});

describe('vérifications', () => {
  it('album : pays, continents, carte en or', () => {
    const s = defaultSave();
    s.album = { FR: card('FR', 'EU'), JP: card('JP', 'AS'), BR: card('BR', 'SA'), US: card('US', 'NA'), KE: card('KE', 'AF', 'gold') };
    expect(ids(s)).toEqual(['first-qsl', 'gold-card']);
    s.album.AU = card('AU', 'OC');
    expect(ids(s)).toContain('all-continents');
  });
  it('précision et Breaking News, sur la partie terminée', () => {
    const s = defaultSave();
    expect(ids(s, solo())).toEqual([]);
    expect(ids(s, solo({ distances: [40, 3, 16_000, null, 900] }))).toEqual(['bullseye', 'spot-on', 'antipodes']);
    expect(ids(s, solo({ hintsUsed: 0, total: 21_000 }))).toEqual(['no-hints', 'solo-20k']);
    expect(ids(s, solo({ news: { guessId: 1, guessLabel: '', at: 0, verdict: 'song', score: 4_600 } }))).toEqual(['news-song', 'news-ear']);
  });
  it('« sans filet » et « 20 000 » : solo uniquement', () => {
    expect(ids(defaultSave(), solo({ mode: 'duel', hintsUsed: 0, total: 30_000, players: 2 }))).toEqual([]);
  });
  it('multijoueur, épingles, parties jouées', () => {
    const s = defaultSave();
    s.stats.duels.won = 10;
    s.stats.gamesPlayed = 40;
    s.pins = { punaise: 1, 'punaise-or': 1 };
    expect(ids(s, solo({ mode: 'duel', players: 4, result: 'won' }))).toEqual(['first-win', 'wins-10', 'big-room', 'pin-legendary', 'games-10', 'games-50']);
  });
});

describe('enregistrement', () => {
  beforeEach(() => {
    save.value = defaultSave();
  });
  it('un succès n’est obtenu qu’une fois', () => {
    save.value = { ...save.value, album: { FR: card('FR', 'EU') } };
    expect(unlockAchievements().map((a) => a.id)).toEqual(['first-qsl']);
    expect(save.value.achievements['first-qsl']).toMatch(/^\d{4}-/);
    expect(unlockAchievements()).toEqual([]);
  });
  it('migrate ajoute le carnet aux anciennes sauvegardes et garde celui existant', () => {
    expect(migrate({ version: 2 }).achievements).toEqual({});
    expect(migrate({ version: 2, achievements: { 'first-qsl': '2026-01-01' } }).achievements).toEqual({ 'first-qsl': '2026-01-01' });
  });
});
