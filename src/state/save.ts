// Sauvegarde locale (localStorage) : album, épingles, profil, statistiques, préférences.
// Le document porte un numéro de version ; les migrations s'appliquent en chaîne au chargement.

import { signal, effect } from '@preact/signals';
import { DEFAULT_AVATAR, cleanLook, type Avatar } from '../../shared/avatars';
import { cleanName } from '../../shared/duel';
import { PIN_IDS, STARTER_PIN, normalizePinId } from '../../shared/pins';
import { collect, type CollectOutcome, type QslCard } from '../../shared/qsl';
import { newlyEarned, type AchievementDef, type GameFacts } from '../achievements/catalog';
import { HAND_SIZE, MAIL_EVERY, STARTER_JOKERS, cleanHand, drawJoker, type JokerDef } from '../../shared/jokers';
import type { Round } from '../../shared/types';

export const SAVE_KEY = 'radioguessr:save';
export const SAVE_VERSION = 2;
/** Ancienne clé du pseudo multijoueur (avant le profil). */
const LEGACY_NAME_KEY = 'radioguessr:duel-name';

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
  /** Album : afficher les cases grisées des pays pas encore obtenus. */
  albumShowMissing: boolean;
  /** Solo : Breaking News (blind test) activée. */
  breakingNews: boolean;
  /** Solo : cartes Joker activées. */
  jokers: boolean;
}

export interface Profile {
  name: string;
  avatar: Avatar;
  /** Épingle plantée sur la carte (doit faire partie de la collection). */
  pin: string;
}

export interface SaveV1 {
  version: 1;
  album: Record<string, QslCard>;
  stats: Stats;
  prefs: Prefs;
}

export interface SaveV2 {
  version: 2;
  album: Record<string, QslCard>;
  /** Épingles possédées : identifiant → nombre d'exemplaires (doublons compris). */
  pins: Record<string, number>;
  profile: Profile;
  stats: Stats;
  prefs: Prefs;
  /** Succès obtenus : identifiant → date ISO. */
  achievements: Record<string, string>;
  /** Dernière visite du carnet : les succès plus récents sont marqués « nouveau ». */
  achievementsSeenAt: string | null;
  /** Cartes Joker possédées. */
  jokers: Record<string, true>;
  /** Main : les 2 jokers emportés en partie. */
  hand: string[];
  /** Parties jouées depuis le dernier courrier (une carte toutes les MAIL_EVERY parties). */
  mail: number;
  /** Nombre total de jokers joués (succès). */
  jokersPlayed: number;
}

export type SaveData = SaveV2;

function legacyName(): string {
  try {
    return cleanName(localStorage.getItem(LEGACY_NAME_KEY) ?? '');
  } catch {
    return '';
  }
}

export function defaultSave(): SaveData {
  return {
    version: 2,
    album: {},
    pins: { [STARTER_PIN]: 1 },
    profile: { name: '', avatar: { ...DEFAULT_AVATAR }, pin: STARTER_PIN },
    stats: { gamesPlayed: 0, bestScore: 0, totalScore: 0, roundsPlayed: 0, bestDistanceKm: null, duels: { won: 0, lost: 0, draw: 0 } },
    prefs: { radioVolume: 0.8, sfxVolume: 0.6, muted: false, motion: 'system', albumShowMissing: true, breakingNews: true, jokers: true },
    achievements: {},
    achievementsSeenAt: null,
    jokers: Object.fromEntries(STARTER_JOKERS.map((id) => [id, true as const])),
    hand: [...STARTER_JOKERS],
    mail: 0,
    jokersPlayed: 0,
  };
}

/**
 * Migrations : MIGRATIONS[n] transforme une sauvegarde de version n en version n+1.
 * La version 0 désigne une donnée sans numéro (prototype) : on garde ce qui ressemble à un album.
 */
const MIGRATIONS: Record<number, (old: Record<string, unknown>) => Record<string, unknown>> = {
  0: (old) => ({ ...defaultSave(), version: 1, album: typeof old.album === 'object' && old.album ? old.album : {} }),
  // v1 → v2 : arrivée des épingles et du profil ; le pseudo multijoueur déjà saisi devient celui du profil.
  1: (old) => ({ ...old, pins: {}, profile: { name: legacyName(), avatar: { ...DEFAULT_AVATAR }, pin: STARTER_PIN } }),
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
  const pins: Record<string, number> = {};
  // Les anciennes épingles (badges illustrés) sont converties en épingles de même rareté, doublons cumulés.
  for (const [rawId, n] of Object.entries(d.pins ?? {})) {
    const id = normalizePinId(rawId);
    if (id && Number(n) > 0) pins[id] = (pins[id] ?? 0) + Math.floor(Number(n));
  }
  pins[STARTER_PIN] = Math.max(1, pins[STARTER_PIN] ?? 0); // la punaise de départ est toujours là
  const look = cleanLook({ avatar: d.profile?.avatar, pin: d.profile?.pin }); // convertit aussi l'ancien identifiant
  return {
    version: 2,
    album: d.album ?? {},
    pins,
    profile: {
      name: cleanName(d.profile?.name ?? ''),
      avatar: look.avatar,
      // On ne plante qu'une épingle réellement possédée.
      pin: pins[look.pin] ? look.pin : STARTER_PIN,
    },
    stats: { ...def.stats, ...d.stats, duels: { ...def.stats.duels, ...d.stats?.duels } },
    prefs: { ...def.prefs, ...d.prefs },
    achievements: d.achievements && typeof d.achievements === 'object' ? d.achievements : {},
    achievementsSeenAt: typeof d.achievementsSeenAt === 'string' ? d.achievementsSeenAt : null,
    ...cleanJokers(d),
  };
}

/** Collection de jokers : cartes de départ toujours présentes, main limitée aux cartes possédées. */
function cleanJokers(d: Partial<SaveData>): Pick<SaveData, 'jokers' | 'hand' | 'mail' | 'jokersPlayed'> {
  const jokers: Record<string, true> = {};
  for (const id of STARTER_JOKERS) jokers[id] = true;
  for (const [id, v] of Object.entries(d.jokers ?? {})) if (v && cleanHand([id]).length) jokers[id] = true;
  const hand = d.hand === undefined ? [...STARTER_JOKERS] : cleanHand(d.hand).filter((id) => jokers[id]);
  return {
    jokers,
    hand,
    mail: Number.isInteger(d.mail) && d.mail! >= 0 ? d.mail! : 0,
    jokersPlayed: Number.isInteger(d.jokersPlayed) && d.jokersPlayed! >= 0 ? d.jokersPlayed! : 0,
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

/** `bonus` : points hors manches (Breaking News). */
export function recordGame(rounds: readonly Round[], bonus = 0): void {
  const s = save.value.stats;
  const total = rounds.reduce((sum, r) => sum + r.score, 0) + bonus;
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

export function recordDuel(result: 'won' | 'lost' | 'draw'): void {
  const s = save.value.stats;
  save.value = { ...save.value, stats: { ...s, duels: { ...s.duels, [result]: s.duels[result] + 1 } } };
}

/** Ajoute une épingle à la collection ; renvoie le nombre d'exemplaires possédés ensuite. */
export function awardPin(id: string): number {
  if (!PIN_IDS.has(id)) return 0;
  const count = (save.value.pins[id] ?? 0) + 1;
  save.value = { ...save.value, pins: { ...save.value.pins, [id]: count } };
  return count;
}

export function updateProfile(patch: Partial<Profile>): void {
  const next = { ...save.value.profile, ...patch };
  if (patch.name !== undefined) next.name = cleanName(patch.name);
  if (!save.value.pins[next.pin]) next.pin = STARTER_PIN;
  save.value = { ...save.value, profile: next };
}

export function updatePrefs(patch: Partial<Prefs>): void {
  save.value = { ...save.value, prefs: { ...save.value.prefs, ...patch } };
}

/**
 * Enregistre les succès remplis (sur la sauvegarde, et sur la partie qui vient de finir si on la donne).
 * Renvoie ceux qui viennent d'être obtenus.
 */
export function unlockAchievements(game?: GameFacts): AchievementDef[] {
  const earned = newlyEarned({ save: save.value, game });
  if (earned.length === 0) return [];
  const at = new Date().toISOString();
  const achievements = { ...save.value.achievements };
  for (const a of earned) achievements[a.id] = at;
  save.value = { ...save.value, achievements };
  return earned;
}

export function markAchievementsSeen(): void {
  save.value = { ...save.value, achievementsSeenAt: new Date().toISOString() };
}

/** Met une carte possédée dans la main : elle remplace la plus ancienne si la main est pleine. */
export function putInHand(id: string): void {
  if (!save.value.jokers[id] || save.value.hand.includes(id)) return;
  const hand = [...save.value.hand, id].slice(-HAND_SIZE);
  save.value = { ...save.value, hand };
}

export function removeFromHand(id: string): void {
  save.value = { ...save.value, hand: save.value.hand.filter((h) => h !== id) };
}

/**
 * Compte une partie pour le courrier. Toutes les MAIL_EVERY parties, une carte pas encore possédée arrive
 * (rien si la collection est complète). Renvoie la carte reçue.
 */
export function tickMail(rng?: () => number): JokerDef | null {
  const count = save.value.mail + 1;
  if (count < MAIL_EVERY) {
    save.value = { ...save.value, mail: count };
    return null;
  }
  const card = drawJoker(save.value.jokers, rng);
  const jokers = card ? { ...save.value.jokers, [card.id]: true as const } : save.value.jokers;
  // Main incomplète : la nouvelle carte s'y range d'elle-même.
  const hand = card && save.value.hand.length < HAND_SIZE ? [...save.value.hand, card.id] : save.value.hand;
  save.value = { ...save.value, jokers, hand, mail: 0 };
  return card;
}

export function countJokerPlayed(): void {
  save.value = { ...save.value, jokersPlayed: save.value.jokersPlayed + 1 };
}
