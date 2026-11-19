// GET  /api/rooms/CODE?chat=N  → état du salon vu par le joueur (polling ~1 s), messages après N
// GET  /api/rooms/CODE?photos=1 → photos des joueurs
// POST /api/rooms/CODE?chat=N  { action, … } → rejoindre, lancer, punaise, indice, flux muet, prêt, chat, quitter

import type { DuelAction } from '../../shared/duel.js';
import { codeFromUrl, credentials, errorResponse, json, readJson } from '../_lib/http.js';
import { act, getPhotos, getRoom, joinRoom } from '../_lib/rooms.js';

/** Dernier message de chat déjà reçu par le joueur (?chat=N). */
function chatSince(req: Request): number {
  const n = Number(new URL(req.url).searchParams.get('chat') ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function GET(req: Request): Promise<Response> {
  try {
    // ?photos=1 : photos des joueurs (envoyées à part pour garder le rafraîchissement léger)
    if (new URL(req.url).searchParams.get('photos') === '1') return json(await getPhotos(codeFromUrl(req), credentials(req)));
    return json(await getRoom(codeFromUrl(req), credentials(req), Date.now(), chatSince(req)));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const code = codeFromUrl(req);
    const body = await readJson<DuelAction>(req);
    if (body.action === 'join') {
      return json(await joinRoom(code, body.name, credentials(req), Date.now(), { avatar: body.avatar, pin: body.pin, hand: body.hand }));
    }
    return json(await act(code, credentials(req), body, Date.now(), chatSince(req)));
  } catch (err) {
    return errorResponse(err);
  }
}
