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
  it('5 000 au maximum, dégressif, 1 500 pour l’artiste', () => {
    expect(NEWS_MAX).toBe(5000);
    expect(newsScore('song', 0)).toBe(5000);
    expect(newsScore('song', 15_000)).toBe(4250);
    expect(newsScore('song', 60_000)).toBe(3500);
    expect(newsScore('artist', 1000)).toBe(1500);
    expect(newsScore('none', 0)).toBe(0);
  });
  it('toujours entre deux manches', () => {
    const rng = mulberry32(5);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(pickNewsSlot(rng));
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
  });
});

import { HITS } from '../shared/hits-data';
import { setMusicProvider, pickTrack } from '../api/_lib/music';

describe('mégatubes', () => {
  it('liste fournie, sans doublon, moitié français', () => {
    expect(HITS.length).toBeGreaterThanOrEqual(180);
    expect(new Set(HITS.map((h) => h.id)).size).toBe(HITS.length);
    const fr = HITS.filter((h) => h.fr).length / HITS.length;
    expect(fr).toBeGreaterThan(0.4);
    expect(fr).toBeLessThan(0.6);
  });
  it('versions d’origine uniquement', () => {
    for (const h of HITS) expect(h.title, `${h.artist} — ${h.title}`).not.toMatch(/\b(live|remix|extended|karaok|rerecord)/i);
  });
  it('tirage équilibré, extrait vérifié', async () => {
    const tracks = new Map(HITS.map((h) => [h.id, h]));
    setMusicProvider({
      track: async (id) => {
        const h = tracks.get(id);
        return h ? { id, title: h.title, titleShort: h.title, artist: h.artist, artistId: 1, cover: '', preview: 'https://p' } : null;
      },
      search: async () => [],
    });
    const rng = mulberry32(11);
    let fr = 0;
    for (let i = 0; i < 2000; i++) if (tracks.get(await pickTrack(rng))!.fr) fr++;
    expect(fr / 2000).toBeGreaterThan(0.45);
    expect(fr / 2000).toBeLessThan(0.55);
  });
});
