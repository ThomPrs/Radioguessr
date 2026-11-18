// Service musical de la Breaking News : tubes Deezer (extraits officiels de 30 s), recherche, vérification.
// Deezer n'envoie pas d'en-têtes CORS : le navigateur passe par nos fonctions /api.

import { judgeGuess, newsScore, type NewsVerdict, type TrackInfo } from '../../shared/blindtest.js';
import { HITS } from '../../shared/hits-data.js';

export interface TrackWithPreview extends TrackInfo {
  preview: string;
}

/** Morceau du réservoir : identifiant Deezer et langue (pour équilibrer français / international). */
export interface PoolEntry {
  id: number;
  fr: boolean;
}

export interface MusicProvider {
  /** Réservoir de morceaux ; par défaut, les mégatubes de shared/hits-data.ts. */
  pool?(): Promise<PoolEntry[]>;
  track(id: number): Promise<TrackWithPreview | null>;
  search(q: string): Promise<TrackInfo[]>;
}

const API = 'https://api.deezer.com';
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
  private searchCache = new Map<string, { at: number; tracks: TrackInfo[] }>();

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

/**
 * Tire un mégatube : une chance sur deux d'être français. On vérifie que l'extrait est encore
 * disponible chez Deezer (retrait, droits…) ; sinon on en tire un autre, jusqu'à 3 fois.
 */
export async function pickTrack(rng: () => number = Math.random): Promise<number> {
  const pool: PoolEntry[] = provider.pool ? await provider.pool() : HITS;
  if (pool.length === 0) throw new Error('Aucun morceau disponible');
  const fr = pool.filter((h) => h.fr);
  const intl = pool.filter((h) => !h.fr);
  const tried = new Set<number>();
  for (let attempt = 0; attempt < 3; attempt++) {
    const side = fr.length && intl.length ? (rng() < 0.5 ? fr : intl) : pool;
    const candidates = side.filter((h) => !tried.has(h.id));
    const pick = (candidates.length ? candidates : side)[Math.floor(rng() * (candidates.length || side.length))]!;
    tried.add(pick.id);
    if ((await provider.track(pick.id))?.preview) return pick.id;
  }
  throw new Error('Aucun extrait disponible');
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
