// Avatars dessinés (portraits) et couleurs de fond : identifiants partagés front / serveur.

import { STARTER_PIN, normalizePinId } from './pins.js';

export const AVATAR_FACES = [
  'operatrice',
  'marin',
  'pilote',
  'astronome',
  'chat',
  'robot',
  'barbu',
  'beret',
  'casquette',
  'lunettes',
  'chignon',
  'haut-de-forme',
] as const;

export type AvatarFace = (typeof AVATAR_FACES)[number];

export const AVATAR_BGS = ['#2f5d8c', '#d9483b', '#4f7a4a', '#c9822b', '#8a5a9e', '#2b8a8a'] as const;

export interface Avatar {
  face: AvatarFace;
  bg: number; // indice dans AVATAR_BGS
}

export const DEFAULT_AVATAR: Avatar = { face: 'operatrice', bg: 0 };

/** Apparence publique d'un joueur (avatar + épingle plantée sur la carte), validée côté serveur. */
export interface PlayerLook {
  avatar: Avatar;
  pin: string;
}

/** Nettoie une apparence reçue d'un client : valeurs inconnues → valeurs par défaut. */
export function cleanLook(raw: unknown): PlayerLook {
  const r = (raw && typeof raw === 'object' ? raw : {}) as { avatar?: { face?: unknown; bg?: unknown }; pin?: unknown };
  const face = AVATAR_FACES.includes(r.avatar?.face as AvatarFace) ? (r.avatar!.face as AvatarFace) : DEFAULT_AVATAR.face;
  const bgNum = Number(r.avatar?.bg);
  const bg = Number.isInteger(bgNum) && bgNum >= 0 && bgNum < AVATAR_BGS.length ? bgNum : DEFAULT_AVATAR.bg;
  const pin = normalizePinId(r.pin) ?? STARTER_PIN;
  return { avatar: { face, bg }, pin };
}
