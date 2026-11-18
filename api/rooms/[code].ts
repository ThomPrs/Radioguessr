// GET  /api/rooms/CODE?chat=N  → état du salon vu par le joueur (polling ~1 s), messages après N
// POST /api/rooms/CODE?chat=N  { action, … } → rejoindre, lancer, punaise, indice, flux muet, prêt, chat, quitter

import type { DuelAction } from '../../shared/duel.js';
import { codeFromUrl, credentials, errorResponse, json, readJson } from '../_lib/http.js';
import { act, getRoom, joinRoom } from '../_lib/rooms.js';

/** Dernier message de chat déjà reçu par le joueur (?chat=N). */
function chatSince(req: Request): number {
  const n = Number(new URL(req.url).searchParams.get('chat') ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function GET(req: Request): Promise<Response> {
  try {
    return json(await getRoom(codeFromUrl(req), credentials(req), Date.now(), chatSince(req)));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const code = codeFromUrl(req);
    const body = await readJson<DuelAction>(req);
    if (body.action === 'join') return json(await joinRoom(code, body.name, credentials(req)));
    return json(await act(code, credentials(req), body, Date.now(), chatSince(req)));
  } catch (err) {
    return errorResponse(err);
  }
}
