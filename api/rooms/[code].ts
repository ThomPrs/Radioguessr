// GET  /api/rooms/CODE  → état du salon vu par le joueur (polling ~1 s)
// POST /api/rooms/CODE  { action, … } → rejoindre, punaise, indice, flux muet, prêt, quitter

import type { DuelAction } from '../../shared/duel.js';
import { codeFromUrl, credentials, errorResponse, json, readJson } from '../_lib/http.js';
import { act, getRoom, joinRoom } from '../_lib/rooms.js';

export async function GET(req: Request): Promise<Response> {
  try {
    return json(await getRoom(codeFromUrl(req), credentials(req)));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const code = codeFromUrl(req);
    const body = await readJson<DuelAction>(req);
    if (body.action === 'join') return json(await joinRoom(code, body.name, credentials(req)));
    return json(await act(code, credentials(req), body));
  } catch (err) {
    return errorResponse(err);
  }
}
