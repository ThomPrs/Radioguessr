// Épingles à collectionner : ce sont les marqueurs que le joueur plante sur la carte.
// Catalogue, raretés, tirage au sort.

import { weightedIndex, type Rng } from './rng.js';

export type PinRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface PinDef {
  id: string;
  name: string;
  rarity: PinRarity;
  /** Couleur d'émail du fond. */
  bg: string;
}

/** Probabilité de chaque rareté lors d'un tirage. */
export const RARITY_WEIGHTS: Record<PinRarity, number> = { common: 60, rare: 27, epic: 10, legendary: 3 };
export const RARITY_ORDER: PinRarity[] = ['common', 'rare', 'epic', 'legendary'];

export const PINS: readonly PinDef[] = [
  // Communes (10)
  { id: 'micro', name: 'Micro de studio', rarity: 'common', bg: '#2f5d8c' },
  { id: 'antenne', name: 'Antenne télescopique', rarity: 'common', bg: '#4f7a4a' },
  { id: 'casque', name: 'Casque d’écoute', rarity: 'common', bg: '#d9483b' },
  { id: 'vinyle', name: 'Disque vinyle', rarity: 'common', bg: '#c9822b' },
  { id: 'boussole', name: 'Boussole', rarity: 'common', bg: '#2b8a8a' },
  { id: 'phare', name: 'Phare', rarity: 'common', bg: '#2f5d8c' },
  { id: 'par-avion', name: 'Par avion', rarity: 'common', bg: '#ede3cf' },
  { id: 'morse', name: 'Manipulateur morse', rarity: 'common', bg: '#7a4a2c' },
  { id: 'cadran', name: 'Cadran FM', rarity: 'common', bg: '#3a3632' },
  { id: 'punaise', name: 'Punaise rouge', rarity: 'common', bg: '#ede3cf' },
  // Rares (8)
  { id: 'globe', name: 'Globe terrestre', rarity: 'rare', bg: '#2f5d8c' },
  { id: 'montgolfiere', name: 'Montgolfière', rarity: 'rare', bg: '#8ec3d6' },
  { id: 'satellite', name: 'Satellite', rarity: 'rare', bg: '#1f2a44' },
  { id: 'hydravion', name: 'Hydravion', rarity: 'rare', bg: '#8ec3d6' },
  { id: 'carte-qsl', name: 'Carte QSL', rarity: 'rare', bg: '#d9483b' },
  { id: 'soixante-treize', name: '« 73 »', rarity: 'rare', bg: '#3a3632' },
  { id: 'galene', name: 'Poste à galène', rarity: 'rare', bg: '#7a4a2c' },
  { id: 'voilier', name: 'Voilier', rarity: 'rare', bg: '#2b8a8a' },
  // Épiques (4)
  { id: 'aurore', name: 'Aurore boréale', rarity: 'epic', bg: '#14213d' },
  { id: 'tour-nuit', name: 'Émetteur de nuit', rarity: 'epic', bg: '#1f2a44' },
  { id: 'dirigeable', name: 'Dirigeable', rarity: 'epic', bg: '#c9822b' },
  { id: 'echo-lunaire', name: 'Écho lunaire', rarity: 'epic', bg: '#14213d' },
  // Légendaires (2)
  { id: 'oreille-or', name: 'Oreille d’or 55555', rarity: 'legendary', bg: '#d9483b' },
  { id: 'tour-du-monde', name: 'Tour du monde DX', rarity: 'legendary', bg: '#2f5d8c' },
];

export const PIN_IDS = new Set(PINS.map((p) => p.id));

/** Épingle de départ, possédée par tout le monde (la punaise rouge classique). */
export const STARTER_PIN = 'punaise';

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
