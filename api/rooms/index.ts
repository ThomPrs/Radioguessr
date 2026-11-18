// POST /api/rooms  { name }  → crée un salon, renvoie le code et l'identité de l'hôte.

import { errorResponse, json, readJson } from '../_lib/http.js';
import { createRoom } from '../_lib/rooms.js';

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await readJson<{ name?: unknown }>(req);
    return json(await createRoom(body.name), 201);
  } catch (err) {
    return errorResponse(err);
  }
}
