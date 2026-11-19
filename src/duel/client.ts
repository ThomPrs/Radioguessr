// Appels à l'API des salons, et mémorisation de l'identité pour la reconnexion.

import type { PlayerLook } from '../../shared/avatars';
import type { DuelAction, DuelErrorCode, JoinResponse, RoomView } from '../../shared/duel';
import type { HintKind } from '../../shared/types';

export class ApiError extends Error {
  constructor(
    readonly code: DuelErrorCode | 'network',
    readonly status: number,
    /** Détail renvoyé par le serveur, affiché pour aider au diagnostic. */
    readonly detail = '',
  ) {
    super(code);
  }
}

export interface Identity {
  code: string;
  playerId: string;
  token: string;
  savedAt: number;
}

const ID_KEY = (code: string) => `radioguessr:duel:${code}`;
const LAST_KEY = 'radioguessr:duel:last';
/** Identité de l'onglet courant (deux onglets = deux joueurs possibles). */
const TAB_KEY = 'radioguessr:duel:tab';
const IDENTITY_TTL_MS = 2 * 3600 * 1000;

function parse(raw: string | null): Identity | null {
  try {
    const id = raw ? (JSON.parse(raw) as Identity) : null;
    return id && Date.now() - id.savedAt < IDENTITY_TTL_MS ? id : null;
  } catch {
    return null;
  }
}

export function saveIdentity(r: JoinResponse): Identity {
  const id: Identity = { code: r.code, playerId: r.playerId, token: r.token, savedAt: Date.now() };
  try {
    sessionStorage.setItem(TAB_KEY, JSON.stringify(id)); // rechargement de l'onglet
    localStorage.setItem(ID_KEY(r.code), JSON.stringify(id)); // reprise après fermeture
    localStorage.setItem(LAST_KEY, r.code);
  } catch {
    // navigation privée : pas de reconnexion possible après rechargement, mais la partie marche
  }
  return id;
}

/** Identité de CET onglet pour ce salon (reconnexion), jamais celle d'un autre onglet. */
export function loadIdentity(code: string): Identity | null {
  try {
    const id = parse(sessionStorage.getItem(TAB_KEY));
    return id?.code === code ? id : null;
  } catch {
    return null;
  }
}

/** Duel en cours dans cet onglet (rechargement de la page). */
export function tabIdentity(): Identity | null {
  try {
    return parse(sessionStorage.getItem(TAB_KEY));
  } catch {
    return null;
  }
}

/** Duel à reprendre : celui de l'onglet, sinon le dernier rejoint sur cet appareil. */
export function lastIdentity(): Identity | null {
  const tab = tabIdentity();
  if (tab) return tab;
  try {
    const code = localStorage.getItem(LAST_KEY);
    return code ? parse(localStorage.getItem(ID_KEY(code))) : null;
  } catch {
    return null;
  }
}

export function forgetIdentity(code: string): void {
  try {
    if (tabIdentity()?.code === code) sessionStorage.removeItem(TAB_KEY);
    localStorage.removeItem(ID_KEY(code));
    if (localStorage.getItem(LAST_KEY) === code) localStorage.removeItem(LAST_KEY);
  } catch {
    // sans importance
  }
}

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown, id?: Identity | null): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (id) {
    headers['X-Player-Id'] = id.playerId;
    headers['X-Player-Token'] = id.token;
  }
  let res: Response;
  try {
    res = await fetch(path, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  } catch {
    throw new ApiError('network', 0);
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: DuelErrorCode; message?: string };
  if (!res.ok) {
    // 404 sans réponse JSON : l'API n'existe pas sur ce déploiement (ancienne version en ligne ?)
    const code: DuelErrorCode = data.error ?? 'server';
    const detail = data.message ?? (data.error ? '' : `HTTP ${res.status}${res.status === 404 ? ' — API absente de ce déploiement' : ''}`);
    throw new ApiError(code, res.status, detail);
  }
  return data;
}

export const api = {
  create: (name: string, look: PlayerLook & { hand?: string[] }) => request<JoinResponse>('POST', '/api/rooms', { name, ...look }),
  join: (code: string, name: string, id: Identity | null, look: PlayerLook & { hand?: string[] }) =>
    request<JoinResponse>('POST', `/api/rooms/${code}`, { action: 'join', name, ...look } satisfies DuelAction, id),
  photos: (id: Identity) => request<{ photos: Record<string, string> }>('GET', `/api/rooms/${id.code}?photos=1`, undefined, id),
  get: (id: Identity, chatSince = 0) => request<RoomView>('GET', `/api/rooms/${id.code}?chat=${chatSince}`, undefined, id),
  act: (id: Identity, action: Exclude<DuelAction, { action: 'join' }>, chatSince = 0) =>
    request<{ view: RoomView; hint?: string }>('POST', `/api/rooms/${id.code}?chat=${chatSince}`, action, id),
};

export type { HintKind };
