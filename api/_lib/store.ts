// Stockage des salons : un hash Redis par salon (« room:CODE »), un champ par donnée.
// Écrire champ par champ (HSETNX, HINCRBY…) évite que deux joueurs s'écrasent mutuellement.
//
// En ligne : Upstash Redis (variables posées par l'intégration Vercel Marketplace).
// En local, sans variables : stockage en mémoire (un seul processus, suffisant pour développer).

import { Redis } from '@upstash/redis';

export interface Store {
  hgetall(key: string): Promise<Record<string, string> | null>;
  /** Écrit le champ seulement s'il n'existe pas ; renvoie true si l'écriture a eu lieu. */
  hsetnx(key: string, field: string, value: string): Promise<boolean>;
  hset(key: string, fields: Record<string, string>): Promise<void>;
  hincrby(key: string, field: string, by: number): Promise<number>;
  hdel(key: string, ...fields: string[]): Promise<void>;
  expire(key: string, seconds: number): Promise<void>;
}

// ── Upstash ────────────────────────────────────────────────────────────────

class UpstashStore implements Store {
  constructor(private readonly redis: Redis) {}

  async hgetall(key: string) {
    const r = await this.redis.hgetall<Record<string, string>>(key);
    return r && Object.keys(r).length > 0 ? r : null;
  }
  async hsetnx(key: string, field: string, value: string) {
    return (await this.redis.hsetnx(key, field, value)) === 1;
  }
  async hset(key: string, fields: Record<string, string>) {
    await this.redis.hset(key, fields);
  }
  async hincrby(key: string, field: string, by: number) {
    return this.redis.hincrby(key, field, by);
  }
  async hdel(key: string, ...fields: string[]) {
    if (fields.length) await this.redis.hdel(key, ...fields);
  }
  async expire(key: string, seconds: number) {
    await this.redis.expire(key, seconds);
  }
}

// ── Mémoire (développement local et tests) ─────────────────────────────────

export class MemoryStore implements Store {
  private readonly data = new Map<string, { fields: Map<string, string>; expiresAt: number }>();

  private get(key: string) {
    const e = this.data.get(key);
    if (e && e.expiresAt <= Date.now()) {
      this.data.delete(key);
      return undefined;
    }
    return e;
  }
  private ensure(key: string) {
    let e = this.get(key);
    if (!e) {
      e = { fields: new Map(), expiresAt: Infinity };
      this.data.set(key, e);
    }
    return e;
  }
  async hgetall(key: string) {
    const e = this.get(key);
    return e && e.fields.size > 0 ? Object.fromEntries(e.fields) : null;
  }
  async hsetnx(key: string, field: string, value: string) {
    const e = this.ensure(key);
    if (e.fields.has(field)) return false;
    e.fields.set(field, value);
    return true;
  }
  async hset(key: string, fields: Record<string, string>) {
    const e = this.ensure(key);
    for (const [k, v] of Object.entries(fields)) e.fields.set(k, v);
  }
  async hincrby(key: string, field: string, by: number) {
    const e = this.ensure(key);
    const v = Number(e.fields.get(field) ?? 0) + by;
    e.fields.set(field, String(v));
    return v;
  }
  async hdel(key: string, ...fields: string[]) {
    const e = this.get(key);
    for (const f of fields) e?.fields.delete(f);
  }
  async expire(key: string, seconds: number) {
    const e = this.get(key);
    if (e) e.expiresAt = Date.now() + seconds * 1000;
  }
}

// ── Sélection ──────────────────────────────────────────────────────────────

let store: Store | null = null;

export class StoreConfigError extends Error {}

/**
 * Trouve les accès Upstash quel que soit le préfixe choisi lors de la connexion dans Vercel
 * (KV_REST_API_URL, STORAGE_KV_REST_API_URL, UPSTASH_REDIS_REST_URL…).
 */
export function findRedisEnv(env: Record<string, string | undefined> = process.env): { url: string; token: string; name: string } | null {
  const pairs: [string, string][] = [
    ['KV_REST_API_URL', 'KV_REST_API_TOKEN'],
    ['REDIS_REST_URL', 'REDIS_REST_TOKEN'],
  ];
  for (const [urlSuffix, tokenSuffix] of pairs) {
    for (const name of Object.keys(env).sort()) {
      if (!name.endsWith(urlSuffix)) continue;
      const prefix = name.slice(0, -urlSuffix.length);
      const url = env[name];
      const token = env[prefix + tokenSuffix];
      if (url?.startsWith('https://') && token) return { url, token, name };
    }
  }
  return null;
}

export function getStore(): Store {
  if (store) return store;
  const found = findRedisEnv();
  const url = found?.url;
  const token = found?.token;
  if (url && token) {
    store = new UpstashStore(new Redis({ url, token, automaticDeserialization: false }));
  } else if (process.env.VERCEL) {
    // En ligne sans Redis, la mémoire n'est pas partagée entre les instances : on refuse clairement.
    throw new StoreConfigError('Upstash Redis n’est pas configuré sur ce déploiement.');
  } else {
    store = new MemoryStore();
  }
  return store;
}

/** Pour les tests. */
export function setStore(s: Store): void {
  store = s;
}
