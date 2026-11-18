// Appels au service musical de la Breaking News (/api/music/*) et lecteur d'extrait.

import { effect } from '@preact/signals';
import type { NewsVerdict, TrackInfo } from '../../shared/blindtest';
import { save } from '../state/save';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export interface CheckResult {
  verdict: NewsVerdict;
  score: number;
  answer: TrackInfo;
  guess: TrackInfo | null;
}

export const musicApi = {
  pick: () => get<{ trackId: number }>('/api/music/pick').then((r) => r.trackId),
  preview: (id: number) => get<{ preview: string }>(`/api/music/preview?id=${id}`).then((r) => r.preview),
  search: (q: string) => get<{ tracks: TrackInfo[] }>(`/api/music/search?q=${encodeURIComponent(q)}`).then((r) => r.tracks),
  check: async (trackId: number, guessId: number | null, elapsedMs: number): Promise<CheckResult> => {
    const res = await fetch('/api/music/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackId, guessId, elapsedMs }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as CheckResult;
  },
};

/** Lecteur dédié à l'extrait (distinct du flux de la station), au volume de la radio. */
class NewsAudio {
  private readonly audio = new Audio();
  constructor() {
    this.audio.preload = 'auto';
    effect(() => {
      const { radioVolume, muted } = save.value.prefs;
      this.audio.volume = radioVolume;
      this.audio.muted = muted;
    });
  }
  load(url: string): void {
    this.audio.src = url;
    this.audio.load();
  }
  async play(): Promise<boolean> {
    try {
      await this.audio.play();
      return true;
    } catch {
      return false;
    }
  }
  stop(): void {
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
  }
}

let newsAudio: NewsAudio | null = null;
export function getNewsAudio(): NewsAudio {
  newsAudio ??= new NewsAudio();
  return newsAudio;
}
