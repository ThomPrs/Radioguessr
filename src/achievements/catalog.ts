// Succès tamponnés : objectifs à remplir, rangés par famille dans le carnet du profil.
// Chaque succès se vérifie sur la sauvegarde, et éventuellement sur la partie qui vient de se terminer.

import type { NewsAnswer } from '../../shared/blindtest';
import { PINS } from '../../shared/pins';
import type { Continent } from '../../shared/types';
import type { SaveData } from '../state/save';

export type AchievementFamily = 'explorer' | 'precision' | 'news' | 'multi' | 'collection';

export const FAMILY_ORDER: AchievementFamily[] = ['explorer', 'precision', 'news', 'multi', 'collection'];

/** Ce qu'on retient d'une partie terminée (solo ou multijoueur) pour les succès. */
export interface GameFacts {
  mode: 'world' | 'duel';
  /** Distance de chaque manche (null : pas de réponse). */
  distances: (number | null)[];
  /** Nombre total d'indices achetés. */
  hintsUsed: number;
  total: number;
  news: NewsAnswer | null;
  /** Multijoueur : nombre de joueurs et résultat. */
  players?: number;
  result?: 'won' | 'lost' | 'draw';
}

export interface AchievementContext {
  save: SaveData;
  game?: GameFacts;
}

export interface AchievementDef {
  id: string;
  family: AchievementFamily;
  /** Texte court au centre du tampon. */
  mark: string;
  check: (ctx: AchievementContext) => boolean;
}

/** Continents habités (l'Antarctique n'a pas de radio à capter). */
const INHABITED: Continent[] = ['AF', 'AS', 'EU', 'NA', 'OC', 'SA'];

const cards = (c: AchievementContext) => Object.values(c.save.album);
const countries = (c: AchievementContext) => Object.keys(c.save.album).length;
const dists = (c: AchievementContext) => (c.game?.distances ?? []).filter((d): d is number => d != null);
const ownedPins = (c: AchievementContext) => PINS.filter((p) => (c.save.pins[p.id] ?? 0) > 0);
const games = (c: AchievementContext) =>
  c.save.stats.gamesPlayed + c.save.stats.duels.won + c.save.stats.duels.lost + c.save.stats.duels.draw;

export const SOLO_TOP_SCORE = 20_000;

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  // ── Explorateur : l'album ────────────────────────────────────────────────
  { id: 'first-qsl', family: 'explorer', mark: '1', check: (c) => countries(c) >= 1 },
  { id: 'countries-10', family: 'explorer', mark: '10', check: (c) => countries(c) >= 10 },
  { id: 'countries-25', family: 'explorer', mark: '25', check: (c) => countries(c) >= 25 },
  { id: 'countries-50', family: 'explorer', mark: '50', check: (c) => countries(c) >= 50 },
  {
    id: 'all-continents',
    family: 'explorer',
    mark: '6',
    check: (c) => {
      const seen = new Set(cards(c).map((card) => card.continent));
      return INHABITED.every((k) => seen.has(k));
    },
  },
  { id: 'gold-card', family: 'explorer', mark: 'OR', check: (c) => cards(c).some((card) => card.rarity === 'gold') },

  // ── Précision : la partie qui vient de finir ─────────────────────────────
  { id: 'bullseye', family: 'precision', mark: '50 km', check: (c) => dists(c).some((d) => d < 50) },
  { id: 'spot-on', family: 'precision', mark: '5 km', check: (c) => dists(c).some((d) => d < 5) },
  {
    id: 'no-hints',
    family: 'precision',
    mark: '0',
    check: (c) => c.game?.mode === 'world' && c.game.hintsUsed === 0 && c.game.distances.length >= 5,
  },
  { id: 'solo-20k', family: 'precision', mark: '20 000', check: (c) => c.game?.mode === 'world' && c.game.total >= SOLO_TOP_SCORE },
  { id: 'antipodes', family: 'precision', mark: '15 000', check: (c) => dists(c).some((d) => d > 15_000) },

  // ── Breaking News ────────────────────────────────────────────────────────
  { id: 'news-song', family: 'news', mark: '♪', check: (c) => c.game?.news?.verdict === 'song' },
  { id: 'news-ear', family: 'news', mark: '4 500', check: (c) => (c.game?.news?.score ?? 0) >= 4_500 },

  // ── Multijoueur ──────────────────────────────────────────────────────────
  { id: 'first-win', family: 'multi', mark: '1er', check: (c) => c.save.stats.duels.won >= 1 },
  { id: 'wins-10', family: 'multi', mark: '10', check: (c) => c.save.stats.duels.won >= 10 },
  { id: 'big-room', family: 'multi', mark: '4+', check: (c) => c.game?.mode === 'duel' && (c.game.players ?? 0) >= 4 },

  // ── Collection et fidélité ───────────────────────────────────────────────
  { id: 'pins-10', family: 'collection', mark: '10', check: (c) => ownedPins(c).length >= 10 },
  { id: 'pin-legendary', family: 'collection', mark: '★', check: (c) => ownedPins(c).some((p) => p.rarity === 'legendary') },
  { id: 'games-10', family: 'collection', mark: '10', check: (c) => games(c) >= 10 },
  { id: 'games-50', family: 'collection', mark: '50', check: (c) => games(c) >= 50 },
];

/** Succès remplis dans ce contexte et pas encore obtenus. */
export function newlyEarned(ctx: AchievementContext): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => !ctx.save.achievements[a.id] && a.check(ctx));
}
