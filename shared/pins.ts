// Épingles à collectionner : les marqueurs que le joueur plante sur la carte.
// De vrais objets (punaises, épingles à tête de verre, drapeaux…) ; la rareté joue sur la matière.

import { weightedIndex, type Rng } from './rng.js';

export type PinRarity = 'common' | 'rare' | 'epic' | 'legendary';

/** Forme de l'objet planté. */
export type PinKind = 'push' | 'ball' | 'tack' | 'flag' | 'drop' | 'dart' | 'nail' | 'star';

/** Matière : règle le rendu (brillance, transparence, reflets). */
export type PinMaterial = 'plastic' | 'glass' | 'metal' | 'pearl' | 'crystal' | 'gold' | 'fabric';

export interface PinDef {
  id: string;
  name: string;
  rarity: PinRarity;
  kind: PinKind;
  material: PinMaterial;
  colors: {
    main: string;
    light: string;
    dark: string;
    /** Couleur secondaire (rayures, motif, empennage…). */
    accent?: string;
  };
}

/** Probabilité de chaque rareté lors d'un tirage. */
export const RARITY_WEIGHTS: Record<PinRarity, number> = { common: 60, rare: 27, epic: 10, legendary: 3 };
export const RARITY_ORDER: PinRarity[] = ['common', 'rare', 'epic', 'legendary'];

export const PINS: readonly PinDef[] = [
  // Communes (10)
  { id: 'punaise', name: 'Punaise rouge', rarity: 'common', kind: 'push', material: 'plastic', colors: { main: '#d9483b', light: '#ff8a7a', dark: '#8f2a20' } },
  { id: 'punaise-bleue', name: 'Punaise bleue', rarity: 'common', kind: 'push', material: 'plastic', colors: { main: '#2f5d8c', light: '#7fa8d6', dark: '#1a3757' } },
  { id: 'punaise-verte', name: 'Punaise verte', rarity: 'common', kind: 'push', material: 'plastic', colors: { main: '#4f7a4a', light: '#93c28c', dark: '#2c4a29' } },
  { id: 'punaise-jaune', name: 'Punaise jaune', rarity: 'common', kind: 'push', material: 'plastic', colors: { main: '#e2b84a', light: '#ffe08a', dark: '#9a7414' } },
  { id: 'punaise-blanche', name: 'Punaise blanche', rarity: 'common', kind: 'push', material: 'plastic', colors: { main: '#f2ede2', light: '#ffffff', dark: '#a39a88' } },
  { id: 'verre-rouge', name: 'Tête de verre rouge', rarity: 'common', kind: 'ball', material: 'glass', colors: { main: '#c8352a', light: '#ff9c8f', dark: '#7a1a12' } },
  { id: 'verre-bleu', name: 'Tête de verre bleue', rarity: 'common', kind: 'ball', material: 'glass', colors: { main: '#2b6cb0', light: '#9cc8f0', dark: '#163e6a' } },
  { id: 'plate-laiton', name: 'Punaise plate en laiton', rarity: 'common', kind: 'tack', material: 'metal', colors: { main: '#c9a24a', light: '#f3dc96', dark: '#7d6224' } },
  { id: 'plate-argent', name: 'Punaise plate argentée', rarity: 'common', kind: 'tack', material: 'metal', colors: { main: '#b9bec5', light: '#f1f3f5', dark: '#6b6f76' } },
  { id: 'drapeau-rouge', name: 'Drapeau rouge', rarity: 'common', kind: 'flag', material: 'fabric', colors: { main: '#d9483b', light: '#f07a6e', dark: '#8f2a20' } },
  // Rares (8)
  { id: 'drapeau-avion', name: 'Drapeau « par avion »', rarity: 'rare', kind: 'flag', material: 'fabric', colors: { main: '#fbf6ea', light: '#ffffff', dark: '#2f5d8c', accent: '#d9483b' } },
  { id: 'drapeau-damier', name: 'Drapeau à damier', rarity: 'rare', kind: 'flag', material: 'fabric', colors: { main: '#f2ede2', light: '#ffffff', dark: '#3a3632', accent: '#3a3632' } },
  { id: 'perle-nacre', name: 'Perle de nacre', rarity: 'rare', kind: 'ball', material: 'pearl', colors: { main: '#efe7f2', light: '#ffffff', dark: '#b7a6c4', accent: '#bfe3e6' } },
  { id: 'verre-ambre', name: 'Verre ambré', rarity: 'rare', kind: 'ball', material: 'glass', colors: { main: '#d98a1f', light: '#ffd28a', dark: '#7a4a0c' } },
  { id: 'goutte-encre', name: 'Goutte d’encre', rarity: 'rare', kind: 'drop', material: 'plastic', colors: { main: '#2f5d8c', light: '#7fa8d6', dark: '#1a3757', accent: '#fbf6ea' } },
  { id: 'goutte-rouge', name: 'Goutte de cartographe', rarity: 'rare', kind: 'drop', material: 'plastic', colors: { main: '#d9483b', light: '#ff8a7a', dark: '#8f2a20', accent: '#fbf6ea' } },
  { id: 'clou-cuivre', name: 'Clou de cuivre', rarity: 'rare', kind: 'nail', material: 'metal', colors: { main: '#b8673a', light: '#f0b088', dark: '#6b3517' } },
  { id: 'flechette', name: 'Fléchette', rarity: 'rare', kind: 'dart', material: 'plastic', colors: { main: '#3a3632', light: '#8a837b', dark: '#1d1b19', accent: '#d9483b' } },
  // Épiques (4)
  { id: 'rose-des-vents', name: 'Goutte rose des vents', rarity: 'epic', kind: 'drop', material: 'metal', colors: { main: '#2b8a8a', light: '#8fd6d0', dark: '#145252', accent: '#e2b84a' } },
  { id: 'cristal', name: 'Cristal facetté', rarity: 'epic', kind: 'ball', material: 'crystal', colors: { main: '#8a5a9e', light: '#e2c9f0', dark: '#4a2a5a' } },
  { id: 'verre-aurore', name: 'Verre « aurore boréale »', rarity: 'epic', kind: 'ball', material: 'glass', colors: { main: '#1f3a5f', light: '#52d39a', dark: '#0b1324', accent: '#a46ad9' } },
  { id: 'drapeau-73', name: 'Fanion brodé « 73 »', rarity: 'epic', kind: 'flag', material: 'fabric', colors: { main: '#2f5d8c', light: '#4f80b3', dark: '#1a3757', accent: '#e2b84a' } },
  // Légendaires (2)
  { id: 'punaise-or', name: 'Punaise en or massif', rarity: 'legendary', kind: 'push', material: 'gold', colors: { main: '#e2b84a', light: '#fff1b8', dark: '#8a6d12' } },
  { id: 'etoile-polaire', name: 'Étoile polaire', rarity: 'legendary', kind: 'star', material: 'gold', colors: { main: '#f3d778', light: '#fffbe0', dark: '#a8841a' } },
];

export const PIN_IDS = new Set(PINS.map((p) => p.id));

/** Épingle de départ, possédée par tout le monde (la punaise rouge classique). */
export const STARTER_PIN = 'punaise';

/** Score d'une partie solo (Breaking News comprise) qui rapporte une enveloppe kraft. */
export const SOLO_PRIZE_SCORE = 20_000;

/**
 * Anciennes épingles (badges illustrés) → nouvelles épingles de même rareté,
 * pour que les collections déjà gagnées soient conservées.
 */
export const LEGACY_PIN_IDS: Record<string, string> = {
  micro: 'punaise-bleue',
  antenne: 'punaise-verte',
  casque: 'punaise-jaune',
  vinyle: 'punaise-blanche',
  boussole: 'verre-rouge',
  phare: 'verre-bleu',
  'par-avion': 'plate-laiton',
  morse: 'plate-argent',
  cadran: 'drapeau-rouge',
  globe: 'drapeau-avion',
  montgolfiere: 'drapeau-damier',
  satellite: 'perle-nacre',
  hydravion: 'verre-ambre',
  'carte-qsl': 'goutte-encre',
  'soixante-treize': 'goutte-rouge',
  galene: 'clou-cuivre',
  voilier: 'flechette',
  aurore: 'verre-aurore',
  'tour-nuit': 'drapeau-73',
  dirigeable: 'cristal',
  'echo-lunaire': 'rose-des-vents',
  'oreille-or': 'punaise-or',
  'tour-du-monde': 'etoile-polaire',
};

/** Identifiant actuel d'une épingle (ancien identifiant converti), ou null s'il est inconnu. */
export function normalizePinId(id: unknown): string | null {
  if (typeof id !== 'string') return null;
  if (PIN_IDS.has(id)) return id;
  return LEGACY_PIN_IDS[id] ?? null;
}

export function pinById(id: string | null | undefined): PinDef | undefined {
  return id ? PINS.find((p) => p.id === id) : undefined;
}

/**
 * Tire une épingle : d'abord la rareté (60 / 27 / 10 / 3 %), puis une épingle de cette rareté.
 * L'épingle de départ n'est jamais tirée (tout le monde l'a déjà).
 */
export function drawPin(rng: Rng = Math.random): PinDef {
  const rarity = RARITY_ORDER[weightedIndex(RARITY_ORDER.map((r) => RARITY_WEIGHTS[r]), rng)]!;
  const pool = PINS.filter((p) => p.rarity === rarity && p.id !== STARTER_PIN);
  return pool[Math.floor(rng() * pool.length)] ?? PINS[0]!;
}
