// POST /api/rooms  { name, avatar?, pin? }  → crée un salon, renvoie le code et l'identité de l'hôte.

import { errorResponse, json, readJson } from '../_lib/http.js';
import { createRoom } from '../_lib/rooms.js';

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await readJson<{ name?: unknown; avatar?: unknown; pin?: unknown }>(req);
    return json(await createRoom(body.name, Date.now(), undefined, { avatar: body.avatar, pin: body.pin }), 201);
  } catch (err) {
    return errorResponse(err);
  }
}
