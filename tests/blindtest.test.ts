import { describe, expect, it } from 'vitest';
import { NEWS_MAX, judgeGuess, newsScore, normalizeArtist, normalizeTitle, pickNewsSlot, type TrackInfo } from '../shared/blindtest';
import { mulberry32 } from '../shared/rng';

const tr = (id: number, title: string, artist: string, artistId: number, titleShort = title): TrackInfo => ({ id, title, titleShort, artist, artistId, cover: '' });

describe('normalisation', () => {
  it('titres', () => {
    expect(normalizeTitle('Alors on danse (Radio Edit)')).toBe('alors on danse');
    expect(normalizeTitle('Alors On Danse')).toBe('alors on danse');
    expect(normalizeTitle('Bohemian Rhapsody - Remastered 2011')).toBe('bohemian rhapsody');
    expect(normalizeTitle('Désenchantée')).toBe('desenchantee');
    expect(normalizeTitle('Cuenta feat. Meryl & Shay')).toBe('cuenta');
    expect(normalizeTitle('Rock & Roll [Live]')).toBe('rock and roll');
  });
  it('artistes', () => {
    expect(normalizeArtist('The Beatles')).toBe(normalizeArtist('Beatles'));
    expect(normalizeArtist('Mylène Farmer')).toBe('mylenefarmer');
  });
});

describe('verdict', () => {
  const answer = tr(6297555, 'Alors on danse (Radio Edit)', 'Stromae', 5542, 'Alors on danse');
  it('même morceau, autre version : bonne chanson', () => {
    expect(judgeGuess(answer, answer)).toBe('song');
    expect(judgeGuess(answer, tr(7293958, 'Alors On Danse', 'Stromae', 5542))).toBe('song');
  });
  it('reprise par un autre artiste : raté (ou artiste invité non retenu)', () => {
    expect(judgeGuess(answer, tr(946177172, 'Alors On Danse (feat. Stromae)', 'Dubdogz', 99))).toBe('none');
  });
  it('bon artiste, mauvais titre', () => {
    expect(judgeGuess(answer, tr(1, 'Papaoutai', 'Stromae', 5542))).toBe('artist');
  });
  it('rien choisi', () => {
    expect(judgeGuess(answer, null)).toBe('none');
  });
});

describe('barème', () => {
  it('1 500 au maximum, dégressif, 400 pour l’artiste', () => {
    expect(newsScore('song', 0)).toBe(NEWS_MAX);
    expect(newsScore('song', 15_000)).toBe(1250);
    expect(newsScore('song', 60_000)).toBe(1000);
    expect(newsScore('artist', 1000)).toBe(400);
    expect(newsScore('none', 0)).toBe(0);
  });
  it('toujours entre deux manches', () => {
    const rng = mulberry32(5);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(pickNewsSlot(rng));
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
  });
});
