// Breaking News — musique :
//   GET  /api/music/pick            → { trackId }       morceau populaire au hasard
//   GET  /api/music/preview?id=     → { preview }       lien d'extrait frais (ils expirent en ~15 min)
//   GET  /api/music/search?q=       → { tracks }        autocomplétion de la réponse
//   POST /api/music/check { trackId, guessId, elapsedMs } → verdict, points, réponse (solo)

import { errorResponse, json, readJson } from '../_lib/http.js';
import { checkGuess, music, pickTrack } from '../_lib/music.js';
import { DuelError } from '../_lib/rooms.js';

function action(req: Request): string {
  return new URL(req.url).pathname.split('/').filter(Boolean).pop() ?? '';
}

function id(v: unknown): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new DuelError('bad-request', 400, 'Identifiant invalide');
  return n;
}

export async function GET(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    switch (action(req)) {
      case 'pick':
        return json({ trackId: await pickTrack() });
      case 'preview': {
        const t = await music().track(id(url.searchParams.get('id')));
        if (!t) throw new DuelError('not-found', 404, 'Extrait indisponible');
        return json({ preview: t.preview });
      }
      case 'search': {
        const q = (url.searchParams.get('q') ?? '').trim().slice(0, 80);
        return json({ tracks: q.length < 2 ? [] : await music().search(q) });
      }
      default:
        throw new DuelError('not-found', 404);
    }
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    if (action(req) !== 'check') throw new DuelError('not-found', 404);
    const body = await readJson<{ trackId?: unknown; guessId?: unknown; elapsedMs?: unknown }>(req);
    const guessId = body.guessId == null ? null : id(body.guessId);
    const elapsed = Math.max(0, Number(body.elapsedMs) || 0);
    return json(await checkGuess(id(body.trackId), guessId, elapsed));
  } catch (err) {
    return errorResponse(err);
  }
}
