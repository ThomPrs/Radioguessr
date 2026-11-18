// Petits utilitaires HTTP pour les fonctions (signature Web : Request → Response).

import { normalizeCode, type DuelErrorCode } from '../../shared/duel.js';
import { DuelError, type Credentials } from './rooms.js';
import { StoreConfigError } from './store.js';

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof DuelError) return json({ error: err.code, message: err.message }, err.status);
  if (err instanceof StoreConfigError) return json({ error: 'server' satisfies DuelErrorCode, message: err.message }, 503);
  console.error(err);
  return json({ error: 'server' satisfies DuelErrorCode }, 500);
}

export function credentials(req: Request): Credentials {
  return { playerId: req.headers.get('x-player-id'), token: req.headers.get('x-player-token') };
}

/** Code du salon depuis l'URL /api/rooms/CODE. */
export function codeFromUrl(req: Request): string {
  const parts = new URL(req.url).pathname.split('/').filter(Boolean);
  return normalizeCode(decodeURIComponent(parts[parts.length - 1] ?? ''));
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new DuelError('bad-request', 400, 'JSON invalide');
  }
}
