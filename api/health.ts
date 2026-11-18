// GET /api/health → diagnostic du mode Duel (aucun secret renvoyé).
//   redis : « ok », « absent » (pas de variables), ou le message d'erreur de connexion
//   radioBrowser : l'annuaire des stations répond-il depuis le serveur ?

import { json } from './_lib/http.js';
import { findRedisEnv, getStore } from './_lib/store.js';
import { rbGet } from '../shared/radio-browser.js';

export async function GET(): Promise<Response> {
  const env = findRedisEnv();
  let redis = 'absent';
  if (env || !process.env.VERCEL) {
    try {
      const store = getStore();
      const key = `health:${Date.now()}`;
      await store.hset(key, { ok: '1' });
      await store.expire(key, 60);
      redis = (await store.hgetall(key))?.ok === '1' ? 'ok' : 'lecture impossible';
      if (!env) redis += ' (mémoire locale, développement)';
    } catch (err) {
      redis = `erreur : ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  let radioBrowser = 'ok';
  try {
    await rbGet<unknown>('/json/stats', { 'User-Agent': 'Radioguessr/1.0' });
  } catch (err) {
    radioBrowser = `erreur : ${err instanceof Error ? err.message : String(err)}`;
  }

  return json({
    redis,
    redisVariable: env?.name ?? null,
    radioBrowser,
    region: process.env.VERCEL_REGION ?? 'local',
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
  });
}
