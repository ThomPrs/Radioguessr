// Service musical de la Breaking News : tubes Deezer (extraits officiels de 30 s), recherche, vérification.
// Deezer n'envoie pas d'en-têtes CORS : le navigateur passe par nos fonctions /api.

import { judgeGuess, newsScore, type NewsVerdict, type TrackInfo } from '../../shared/blindtest.js';

export interface TrackWithPreview extends TrackInfo {
  preview: string;
}

export interface MusicProvider {
  /** Identifiants des morceaux populaires (avec extrait). */
  pool(): Promise<number[]>;
  track(id: number): Promise<TrackWithPreview | null>;
  search(q: string): Promise<TrackInfo[]>;
}

const API = 'https://api.deezer.com';
/** Classement France (serveur à Paris), Top Worldwide, 80s / 90s / 00s Hits, variété française. */
const POOL_SOURCES = [
  '/chart/0/tracks?limit=100',
  '/playlist/3155776842/tracks?limit=100',
  '/playlist/867825522/tracks?limit=100',
  '/playlist/878989033/tracks?limit=100',
  '/playlist/248297032/tracks?limit=100',
  '/playlist/1189520191/tracks?limit=100',
];
const POOL_TTL_MS = 3600_000;
const SEARCH_TTL_MS = 10 * 60_000;

interface RawTrack {
  id: number;
  title: string;
  title_short?: string;
  preview?: string;
  readable?: boolean;
  artist: { id: number; name: string };
  album?: { cover_medium?: string; cover_small?: string };
}

function toInfo(t: RawTrack): TrackInfo {
  return {
    id: t.id,
    title: t.title,
    titleShort: t.title_short ?? t.title,
    artist: t.artist.name,
    artistId: t.artist.id,
    cover: t.album?.cover_medium ?? t.album?.cover_small ?? '',
  };
}

async function getJson<T>(path: string): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);
  try {
    const res = await fetch(API + path, { signal: ctrl.signal, headers: { 'User-Agent': 'Radioguessr/1.0' } });
    if (!res.ok) throw new Error(`Deezer HTTP ${res.status}`);
    const data = (await res.json()) as T & { error?: { message?: string } };
    if (data.error) throw new Error(`Deezer : ${data.error.message ?? 'erreur'}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

class DeezerProvider implements MusicProvider {
  private poolCache: { at: number; ids: number[] } | null = null;
  private searchCache = new Map<string, { at: number; tracks: TrackInfo[] }>();

  async pool(): Promise<number[]> {
    if (this.poolCache && Date.now() - this.poolCache.at < POOL_TTL_MS) return this.poolCache.ids;
    const lists = await Promise.all(
      POOL_SOURCES.map((p) => getJson<{ data: RawTrack[] }>(p).then((r) => r.data).catch(() => [] as RawTrack[])),
    );
    const ids = [...new Set(lists.flat().filter((t) => t.preview && t.readable !== false).map((t) => t.id))];
    if (ids.length === 0) throw new Error('Aucun morceau disponible');
    this.poolCache = { at: Date.now(), ids };
    return ids;
  }

  async track(id: number): Promise<TrackWithPreview | null> {
    try {
      const t = await getJson<RawTrack>(`/track/${id}`);
      return t.preview ? { ...toInfo(t), preview: t.preview } : null;
    } catch {
      return null;
    }
  }

  async search(q: string): Promise<TrackInfo[]> {
    const key = q.toLowerCase();
    const hit = this.searchCache.get(key);
    if (hit && Date.now() - hit.at < SEARCH_TTL_MS) return hit.tracks;
    const r = await getJson<{ data: RawTrack[] }>(`/search?q=${encodeURIComponent(q)}&limit=8`);
    const tracks = r.data.map(toInfo);
    this.searchCache.set(key, { at: Date.now(), tracks });
    if (this.searchCache.size > 500) this.searchCache.clear();
    return tracks;
  }
}

let provider: MusicProvider = new DeezerProvider();

/** Pour les tests. */
export function setMusicProvider(p: MusicProvider): void {
  provider = p;
}

export function music(): MusicProvider {
  return provider;
}

export async function pickTrack(rng: () => number = Math.random): Promise<number> {
  const ids = await provider.pool();
  return ids[Math.floor(rng() * ids.length)]!;
}

export interface CheckResult {
  verdict: NewsVerdict;
  score: number;
  answer: TrackInfo;
  guess: TrackInfo | null;
}

/** Compare la réponse choisie au morceau diffusé. */
export async function checkGuess(trackId: number, guessId: number | null, elapsedMs: number): Promise<CheckResult> {
  const answer = await provider.track(trackId);
  if (!answer) throw new Error('Morceau introuvable');
  const guess = guessId == null ? null : guessId === trackId ? answer : await provider.track(guessId);
  const verdict = judgeGuess(answer, guess);
  const { preview: _p, ...answerInfo } = answer;
  let guessInfo: TrackInfo | null = null;
  if (guess) {
    const { preview: _g, ...g } = guess as TrackWithPreview;
    guessInfo = g;
  }
  return { verdict, score: newsScore(verdict, elapsedMs), answer: answerInfo, guess: guessInfo };
}
