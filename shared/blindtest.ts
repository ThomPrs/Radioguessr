// Breaking News : blind test musical une fois par partie. Règles pures (correspondance, barème, timing).

import type { Rng } from './rng.js';

export interface TrackInfo {
  id: number;
  title: string;
  /** Titre sans la version (« Alors on danse » pour « Alors on danse (Radio Edit) »). */
  titleShort: string;
  artist: string;
  artistId: number;
  cover: string;
}

export type NewsVerdict = 'song' | 'artist' | 'none';

export const NEWS_INTRO_MS = 7_000; // flash spécial : coupure, alerte, journal, compte à rebours
export const NEWS_LISTEN_MS = 30_000; // durée d'un extrait
export const NEWS_REVEAL_MS = 15_000; // révélation avant reprise automatique
export const NEWS_SONG_BASE = 1_000;
export const NEWS_SPEED_BONUS = 500;
export const NEWS_ARTIST_ONLY = 400;
export const NEWS_MAX = NEWS_SONG_BASE + NEWS_SPEED_BONUS;

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Titre comparable : sans accents, casse, version (« (Radio Edit) », « - Remastered »), invités (« feat. »). */
export function normalizeTitle(raw: string): string {
  return stripAccents(raw.toLowerCase())
    .replace(/\s*[([].*?[)\]]/g, ' ') // (Radio Edit), [Live]…
    .replace(/\s+-\s+.*$/, ' ') // - Remastered 2011, - Live…
    .replace(/\b(feat|ft|featuring)\b.*$/, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function normalizeArtist(raw: string): string {
  return stripAccents(raw.toLowerCase())
    .replace(/&/g, ' and ')
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]+/g, '');
}

/** Bonne chanson (même morceau, quelle que soit la version), bon artiste seulement, ou raté. */
export function judgeGuess(answer: TrackInfo, guess: TrackInfo | null): NewsVerdict {
  if (!guess) return 'none';
  const sameArtist = answer.artistId === guess.artistId || normalizeArtist(answer.artist) === normalizeArtist(guess.artist);
  if (answer.id === guess.id) return 'song';
  const sameTitle =
    normalizeTitle(answer.titleShort || answer.title) === normalizeTitle(guess.titleShort || guess.title) ||
    normalizeTitle(answer.title) === normalizeTitle(guess.title);
  if (sameTitle && sameArtist) return 'song';
  return sameArtist ? 'artist' : 'none';
}

/** Points : chanson = 1 000 + rapidité (500 → 0 sur les 30 s) ; artiste seul = 400 ; sinon 0. Max 1 500. */
export function newsScore(verdict: NewsVerdict, elapsedMs: number): number {
  if (verdict === 'artist') return NEWS_ARTIST_ONLY;
  if (verdict !== 'song') return 0;
  const speed = Math.max(0, Math.min(1, 1 - elapsedMs / NEWS_LISTEN_MS));
  return NEWS_SONG_BASE + Math.round(NEWS_SPEED_BONUS * speed);
}

/**
 * Manche (indice 0..3) après laquelle tombe la Breaking News : toujours entre deux manches
 * d'une partie de 5 (jamais avant la première ni après la dernière).
 */
export function pickNewsSlot(rng: Rng = Math.random, rounds = 5): number {
  return Math.floor(rng() * (rounds - 1));
}

/** Réponse d'un joueur à la Breaking News. */
export interface NewsAnswer {
  guessId: number | null;
  /** Libellé choisi (« Titre — Artiste »), affiché à la révélation. */
  guessLabel: string;
  at: number;
  verdict: NewsVerdict;
  score: number;
}
