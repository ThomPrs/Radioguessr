// Sauvegarde locale (localStorage) : album, statistiques, préférences.
// Le document porte un numéro de version ; les migrations s'appliquent en chaîne au chargement.

import { signal, effect } from '@preact/signals';
import { collect, type CollectOutcome, type QslCard } from '../../shared/qsl';
import type { Round } from '../../shared/types';

export const SAVE_KEY = 'radioguessr:save';
export const SAVE_VERSION = 1;

export interface Stats {
  gamesPlayed: number;
  bestScore: number;
  totalScore: number;
  roundsPlayed: number;
  bestDistanceKm: number | null;
  duels: { won: number; lost: number; draw: number };
}

export interface Prefs {
  radioVolume: number; // 0..1
  sfxVolume: number; // 0..1
  muted: boolean;
  motion: 'system' | 'reduced' | 'full';
}

export interface SaveV1 {
  version: 1;
  album: Record<string, QslCard>;
  stats: Stats;
  prefs: Prefs;
}

export type SaveData = SaveV1;

export function defaultSave(): SaveData {
  return {
    version: 1,
    album: {},
    stats: { gamesPlayed: 0, bestScore: 0, totalScore: 0, roundsPlayed: 0, bestDistanceKm: null, duels: { won: 0, lost: 0, draw: 0 } },
    prefs: { radioVolume: 0.8, sfxVolume: 0.6, muted: false, motion: 'system' },
  };
}

/**
 * Migrations : MIGRATIONS[n] transforme une sauvegarde de version n en version n+1.
 * La version 0 désigne une donnée sans numéro (prototype) : on garde ce qui ressemble à un album.
 */
const MIGRATIONS: Record<number, (old: Record<string, unknown>) => Record<string, unknown>> = {
  0: (old) => ({ ...defaultSave(), album: typeof old.album === 'object' && old.album ? old.album : {} }),
};

/** Charge et migre une sauvegarde brute ; tout ce qui est illisible repart des valeurs par défaut. */
export function migrate(raw: unknown): SaveData {
  if (!raw || typeof raw !== 'object') return defaultSave();
  let data = raw as Record<string, unknown>;
  let version = typeof data.version === 'number' ? data.version : 0;
  if (version > SAVE_VERSION) return defaultSave(); // sauvegarde d'une version future : on ne l'abîme pas
  while (version < SAVE_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) return defaultSave();
    data = step(data);
    version += 1;
    data.version = version;
  }
  // Complète les champs manquants (ajouts mineurs sans changement de version).
  const def = defaultSave();
  const d = data as Partial<SaveData>;
  return {
    version: 1,
    album: d.album ?? {},
    stats: { ...def.stats, ...d.stats, duels: { ...def.stats.duels, ...d.stats?.duels } },
    prefs: { ...def.prefs, ...d.prefs },
  };
}

/** Vrai si la sauvegarde stockée vient d'une version plus récente du jeu : on ne doit pas l'écraser. */
let frozen = false;

function readStorage(): SaveData {
  try {
    const text = localStorage.getItem(SAVE_KEY);
    const raw: unknown = text ? JSON.parse(text) : null;
    const version = (raw as { version?: unknown } | null)?.version;
    frozen = typeof version === 'number' && version > SAVE_VERSION;
    return migrate(raw);
  } catch {
    return defaultSave();
  }
}

export const save = signal<SaveData>(readStorage());

let writeEnabled = true;
effect(() => {
  const data = save.value;
  if (!writeEnabled || frozen) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // stockage plein ou interdit (navigation privée) : le jeu continue sans sauvegarde
  }
});

// Synchronise les onglets ouverts en même temps.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== SAVE_KEY) return;
    writeEnabled = false;
    save.value = readStorage();
    writeEnabled = true;
  });
}

export function collectCard(card: QslCard): CollectOutcome {
  const result = collect(save.value.album, card);
  if (result.outcome !== 'kept') save.value = { ...save.value, album: result.album };
  return result.outcome;
}

export function recordGame(rounds: readonly Round[]): void {
  const s = save.value.stats;
  const total = rounds.reduce((sum, r) => sum + r.score, 0);
  const best = rounds.reduce<number | null>(
    (b, r) => (r.distanceKm != null && (b == null || r.distanceKm < b) ? r.distanceKm : b),
    s.bestDistanceKm,
  );
  save.value = {
    ...save.value,
    stats: {
      ...s,
      gamesPlayed: s.gamesPlayed + 1,
      bestScore: Math.max(s.bestScore, total),
      totalScore: s.totalScore + total,
      roundsPlayed: s.roundsPlayed + rounds.length,
      bestDistanceKm: best,
    },
  };
}

export function updatePrefs(patch: Partial<Prefs>): void {
  save.value = { ...save.value, prefs: { ...save.value.prefs, ...patch } };
}
