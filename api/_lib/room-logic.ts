// Logique pure d'un salon multijoueur : aucune E/S, testable avec une horloge simulée.
//
// Les fonctions serverless n'ont pas de minuteur : l'avancement (fin des 90 s, manche suivante…)
// est déduit à chaque lecture à partir des horodatages stockés. Les seules écritures que cette
// déduction réclame sont idempotentes (HSETNX du début de la manche suivante).

import {
  ABANDON_MS,
  CONNECTED_MS,
  DUEL_ROUNDS,
  REVEAL_TIME_MS,
  ROUND_TIME_MS,
  REACTION_SHOW_MS,
  type ReactionKind,
  type ChatMessage,
  type DuelEntry,
  type NewsPhase,
  type NewsView,
  type HistoryItem,
  type PlayerView,
  type RoomStatus,
  type RoomView,
  type RoundView,
  type Attack,
  type MyJokerRound,
  type PublicPlay,
} from '../../shared/duel.js';
import {
  ANTENNA_BONUS_MS,
  JAMMER_MS,
  cleanHand,
  radarCenter,
  stolenPoints,
  type JokerId,
  type ScoreMods,
} from '../../shared/jokers.js';
import { hashString, mulberry32 } from '../../shared/rng.js';
import { DEFAULT_AVATAR, type Avatar } from '../../shared/avatars.js';
import { NEWS_INTRO_MS, NEWS_LISTEN_MS, NEWS_REVEAL_MS, type NewsAnswer, type TrackInfo } from '../../shared/blindtest.js';
import { computeHints, localTimeLabel, utcOffsetLabel } from '../../shared/hints.js';
import { ZONES } from '../../shared/timezones-data.js';
import type { HintKind, Station } from '../../shared/types.js';

export interface PlayerRecord {
  id: string;
  tokenHash: string;
  name: string;
  joinedAt: number;
  color: number;
  avatar?: Avatar;
  pin?: string | null;
  /** Main de jokers envoyée en rejoignant. */
  hand?: string[];
}

export interface Meta {
  code: string;
  createdAt: number;
  hostId: string;
  /** Pour chaque manche : la station principale puis les secours. */
  rounds: Station[][];
}

/** Champs du hash Redis. */
export const F = {
  meta: 'meta',
  count: 'count',
  player: (pid: string) => `p:${pid}`,
  seen: (pid: string) => `seen:${pid}`,
  left: (pid: string) => `left:${pid}`,
  start: (i: number) => `r${i}:start`,
  active: (i: number) => `r${i}:active`,
  skip: (i: number, from: number) => `r${i}:skip${from}`,
  entry: (i: number, pid: string) => `r${i}:g:${pid}`,
  hints: (i: number, pid: string) => `r${i}:h:${pid}`,
  ready: (i: number, pid: string) => `r${i}:ready:${pid}`,
  chatSeq: 'chat:seq',
  chat: (n: number) => `chat:${n}`,
  chatAt: (pid: string) => `chatAt:${pid}`,
  // Breaking News
  newsOpt: 'opt:news',
  newsAfter: 'news:after', // indice de la manche après laquelle elle tombe
  newsTrack: 'news:track',
  newsStart: 'news:start',
  newsInfo: 'news:info', // morceau (titre, artiste, pochette), pour la révélation
  newsAns: (pid: string) => `news:ans:${pid}`,
  newsReady: (pid: string) => `news:ready:${pid}`,
  // Réactions rapides et revanche
  react: (pid: string) => `react:${pid}`,
  rematchLock: 'rematch:lock',
  rematch: 'rematch', // { code, by }
  // Jokers
  jokersOpt: 'opt:jokers',
  joker: (pid: string, id: string) => `jk:${pid}:${id}`, // une seule fois par partie (HSETNX)
  taxPending: (pid: string) => `tax:${pid}`, // Taxes reçues, pas encore appliquées
  taxed: (i: number, pid: string) => `r${i}:tax:${pid}`, // indice taxé dans la manche
  shieldUsed: (i: number, pid: string) => `r${i}:shield:${pid}`,
};

// ── Jokers ─────────────────────────────────────────────────────────────────

export interface JokerPlay {
  pid: string;
  id: JokerId;
  round: number;
  target: string | null;
  at: number;
  blocked?: boolean;
  /** Seconde écoute : distance de l'épingle (non validée) à la station. */
  probeKm?: number;
}

export function jokersEnabled(snap: Snapshot): boolean {
  return snap.raw[F.jokersOpt] === '1';
}

export function handOf(snap: Snapshot, pid: string): JokerId[] {
  return cleanHand(playerById(snap, pid)?.hand);
}

export function jokerPlays(snap: Snapshot): JokerPlay[] {
  const out: JokerPlay[] = [];
  for (const [k, v] of Object.entries(snap.raw)) if (k.startsWith('jk:')) {
    const p = json<JokerPlay>(v);
    if (p) out.push(p);
  }
  return out.sort((a, b) => a.at - b.at);
}

/** Jokers joués (et non arrêtés) par un joueur pendant une manche. */
function myActive(plays: JokerPlay[], i: number, pid: string): JokerId[] {
  return plays.filter((p) => p.round === i && p.pid === pid && !p.blocked).map((p) => p.id);
}

/** Modificateurs de score d'un joueur sur une manche. */
export function scoreMods(snap: Snapshot, i: number, pid: string, plays = jokerPlays(snap)): ScoreMods {
  const mine = myActive(plays, i, pid);
  return {
    double: mine.includes('double'),
    floor: mine.includes('filet'),
    freeHints: mine.includes('indices'),
    taxedHint: (snap.raw[F.taxed(i, pid)] as HintKind | undefined) ?? null,
  };
}

/** Chrono personnel : 90 s, +30 s avec Antenne longue. */
export function personalDeadline(snap: Snapshot, i: number, pid: string, start: number, plays = jokerPlays(snap)): number {
  return start + ROUND_TIME_MS + (myActive(plays, i, pid).includes('antenne') ? ANTENNA_BONUS_MS : 0);
}

/** Centre du cercle Radar : fixe pour un joueur et une manche (même réponse à chaque lecture). */
export function radarFor(snap: Snapshot, i: number, pid: string): { lat: number; lon: number } {
  return radarCenter(activeStation(snap, i), mulberry32(hashString(`${snap.meta.code}:${i}:${activeIndex(snap, i)}:${pid}`)));
}

/** Breaking News programmée pour cette partie (tirée au lancement), ou null. */
export function newsPlan(snap: Snapshot): { after: number; trackId: number } | null {
  const after = snap.raw[F.newsAfter];
  const track = snap.raw[F.newsTrack];
  return after != null && track ? { after: Number(after), trackId: Number(track) } : null;
}

export function newsAnswerOf(snap: Snapshot, pid: string): NewsAnswer | null {
  return json<NewsAnswer>(snap.raw[F.newsAns(pid)]);
}

export function newsInfo(snap: Snapshot): TrackInfo | null {
  return json<TrackInfo>(snap.raw[F.newsInfo]);
}

export interface Snapshot {
  meta: Meta;
  /** Joueurs dans l'ordre d'arrivée. */
  players: PlayerRecord[];
  seen: Record<string, number>;
  left: Record<string, boolean>;
  raw: Record<string, string>;
}

function json<T>(s: string | undefined): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

export function parseSnapshot(raw: Record<string, string>): Snapshot | null {
  const meta = json<Meta>(raw[F.meta]);
  if (!meta?.hostId) return null; // salon d'un ancien format (2 places fixes) : traité comme introuvable
  const players: PlayerRecord[] = [];
  const seen: Record<string, number> = {};
  const left: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k.startsWith('p:')) {
      const p = json<PlayerRecord>(v);
      if (p) players.push(p);
    } else if (k.startsWith('seen:')) seen[k.slice(5)] = Number(v);
    else if (k.startsWith('left:')) left[k.slice(5)] = true;
  }
  players.sort((a, b) => a.joinedAt - b.joinedAt || a.color - b.color);
  return { meta, players, seen, left, raw };
}

export function playerById(snap: Snapshot, pid: string): PlayerRecord | undefined {
  return snap.players.find((p) => p.id === pid);
}

// ── Accès aux données d'une manche ─────────────────────────────────────────

export function activeIndex(snap: Snapshot, i: number): number {
  return Number(snap.raw[F.active(i)] ?? 0);
}

export function activeStation(snap: Snapshot, i: number): Station {
  const candidates = snap.meta.rounds[i]!;
  return candidates[Math.min(activeIndex(snap, i), candidates.length - 1)]!;
}

export function roundStart(snap: Snapshot, i: number): number | null {
  const v = snap.raw[F.start(i)];
  return v ? Number(v) : null;
}

export function entryOf(snap: Snapshot, i: number, pid: string): DuelEntry | null {
  return json<DuelEntry>(snap.raw[F.entry(i, pid)]);
}

export function hintsOf(snap: Snapshot, i: number, pid: string): HintKind[] {
  return json<HintKind[]>(snap.raw[F.hints(i, pid)]) ?? [];
}

/** Joueur parti (bouton « quitter ») ou silencieux depuis trop longtemps. */
export function isGone(snap: Snapshot, pid: string, now: number): boolean {
  if (snap.left[pid]) return true;
  const p = playerById(snap, pid);
  if (!p) return true; // retiré du salon (départ pendant l'attente)
  const seen = snap.seen[pid] ?? p.joinedAt;
  return now - seen > ABANDON_MS;
}

/** Hôte effectif : le créateur, ou à défaut le plus ancien joueur encore présent. */
export function effectiveHost(snap: Snapshot, now: number): string {
  if (!isGone(snap, snap.meta.hostId, now)) return snap.meta.hostId;
  return snap.players.find((p) => !isGone(snap, p.id, now))?.id ?? snap.meta.hostId;
}

// ── Déduction de l'état ────────────────────────────────────────────────────

export interface RoundTiming {
  index: number;
  start: number;
  deadline: number;
  revealAt: number | null; // null tant que l'écoute continue
  nextAt: number | null;
}

export interface NewsTiming {
  phase: NewsPhase;
  start: number;
  listenAt: number;
  deadline: number;
  revealAt: number | null;
  nextAt: number | null;
}

export interface Derived {
  status: RoomStatus;
  /** Breaking News en cours (statut « news »). */
  news?: NewsTiming;
  /** La Breaking News est passée (pour afficher son résultat). */
  newsDone?: boolean;
  /** Manche courante (en écoute ou en révélation) ; null en attente ou terminé. */
  current: RoundTiming | null;
  /** Manches terminées ou révélées. */
  revealed: number[];
  /** Écritures idempotentes à faire (début de la manche suivante). */
  writes: { field: string; value: string }[];
}

/** Tous les joueurs encore présents ont-ils fait l'action ? Un joueur parti ne bloque personne. */
function everyoneDid(snap: Snapshot, now: number, did: (pid: string) => boolean): boolean {
  return snap.players.every((p) => did(p.id) || isGone(snap, p.id, now));
}

export function derive(snap: Snapshot, now: number): Derived {
  const writes: Derived['writes'] = [];
  const start0 = roundStart(snap, 0);
  if (start0 == null) return { status: 'waiting', current: null, revealed: [], writes };
  if (now < start0) return { status: 'countdown', current: null, revealed: [], writes };

  const revealed: number[] = [];
  let newsDone = false;
  for (let i = 0; i < DUEL_ROUNDS; i++) {
    let start = roundStart(snap, i);
    // Manche démarrée : si une Breaking News la précédait, elle est terminée.
    if (i > 0 && newsPlan(snap)?.after === i - 1 && snap.raw[F.newsStart]) newsDone = true;
    if (start == null) {
      // La manche précédente vient de se terminer : on la démarre (écriture idempotente).
      start = now;
      writes.push({ field: F.start(i), value: String(now) });
    }
    // Chacun a son chrono (Antenne longue) : la manche dure jusqu'au plus long.
    const plays = jokerPlays(snap);
    const ends = Object.fromEntries(snap.players.map((p) => [p.id, personalDeadline(snap, i, p.id, start!, plays)]));
    const deadline = Math.max(start + ROUND_TIME_MS, ...Object.values(ends));

    // Fini pour un joueur : rapport envoyé, ou son chrono est écoulé.
    const doneAt = (pid: string): number | null => entryOf(snap, i, pid)?.at ?? (now >= ends[pid]! ? ends[pid]! : null);
    const allGuessed = everyoneDid(snap, now, (pid) => doneAt(pid) != null);
    const lastGuess = Math.max(0, ...snap.players.map((p) => (isGone(snap, p.id, now) ? (entryOf(snap, i, p.id)?.at ?? 0) : (doneAt(p.id) ?? 0))));
    const revealAt = allGuessed ? Math.min(Math.max(lastGuess, start), deadline) : now >= deadline ? deadline : null;

    if (revealAt == null || now < revealAt) {
      return { status: 'playing', current: { index: i, start, deadline, revealAt: null, nextAt: null }, revealed, writes, newsDone };
    }

    const nextAt = revealAt + REVEAL_TIME_MS;
    const allReady = everyoneDid(snap, now, (pid) => snap.raw[F.ready(i, pid)] === '1');
    revealed.push(i);
    if (!allReady && now < nextAt) {
      return { status: 'playing', current: { index: i, start, deadline, revealAt, nextAt }, revealed, writes, newsDone };
    }

    // Breaking News entre cette manche et la suivante.
    const plan = newsPlan(snap);
    if (plan && plan.after === i && i < DUEL_ROUNDS - 1) {
      const n = deriveNews(snap, now, writes);
      if (n) return { status: 'news', news: n, current: null, revealed, writes };
      newsDone = true;
    }
  }
  return { status: 'finished', current: null, revealed, writes, newsDone };
}

/**
 * Phase de la Breaking News (jingle → écoute → révélation), ou null si elle est terminée.
 * Le début est écrit une seule fois (HSETNX) ; tout le reste se déduit des horodatages.
 */
function deriveNews(snap: Snapshot, now: number, writes: Derived['writes']): NewsTiming | null {
  let start = snap.raw[F.newsStart] ? Number(snap.raw[F.newsStart]) : null;
  if (start == null) {
    start = now;
    writes.push({ field: F.newsStart, value: String(now) });
  }
  const listenAt = start + NEWS_INTRO_MS;
  const deadline = listenAt + NEWS_LISTEN_MS;
  if (now < listenAt) return { phase: 'intro', start, listenAt, deadline, revealAt: null, nextAt: null };

  const allAnswered = everyoneDid(snap, now, (pid) => newsAnswerOf(snap, pid) != null);
  const lastAnswer = Math.max(0, ...snap.players.map((p) => newsAnswerOf(snap, p.id)?.at ?? 0));
  const revealAt = allAnswered ? Math.min(Math.max(lastAnswer, listenAt), deadline) : now >= deadline ? deadline : null;
  if (revealAt == null || now < revealAt) return { phase: 'listen', start, listenAt, deadline, revealAt: null, nextAt: null };

  const nextAt = revealAt + NEWS_REVEAL_MS;
  const allReady = everyoneDid(snap, now, (pid) => snap.raw[F.newsReady(pid)] === '1');
  if (!allReady && now < nextAt) return { phase: 'reveal', start, listenAt, deadline, revealAt, nextAt };
  return null;
}

function newsEntries(snap: Snapshot): Record<string, NewsAnswer | null> {
  return Object.fromEntries(snap.players.map((p) => [p.id, newsAnswerOf(snap, p.id)]));
}

// ── Chat ───────────────────────────────────────────────────────────────────

export function chatMessages(snap: Snapshot, since = 0): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const [k, v] of Object.entries(snap.raw)) {
    if (!k.startsWith('chat:') || k === F.chatSeq) continue;
    const m = json<ChatMessage>(v);
    if (m && m.id > since) out.push(m);
  }
  return out.sort((a, b) => a.id - b.id);
}

// ── Vue envoyée à un joueur ────────────────────────────────────────────────

/** Entrée d'un joueur, ou entrée « sans réponse » s'il n'a rien envoyé avant la révélation. */
function finalEntry(snap: Snapshot, i: number, pid: string): DuelEntry {
  return entryOf(snap, i, pid) ?? { lat: null, lon: null, at: 0, distanceKm: null, hints: hintsOf(snap, i, pid), score: 0 };
}

function allEntries(snap: Snapshot, i: number): Record<string, DuelEntry> {
  return Object.fromEntries(snap.players.map((p) => [p.id, finalEntry(snap, i, p.id)]));
}

export function hintValue(station: Station, kind: HintKind, now: number): string {
  const h = computeHints(station, ZONES);
  if (kind === 'language') return h.language ?? '—';
  if (kind === 'continent') return h.continent;
  if (!h.timezone) return '—';
  const at = new Date(now);
  return `${utcOffsetLabel(h.timezone, at)} · il y est ${localTimeLabel(h.timezone, at)}`;
}

export function buildView(snap: Snapshot, pid: string, now: number, chatSince = 0, d: Derived = derive(snap, now)): RoomView {
  const plays = jokerPlays(snap);
  const history: HistoryItem[] = d.revealed.map((i) => {
    const entries = allEntries(snap, i);
    return { index: i, station: activeStation(snap, i), entries, plays: publicPlays(plays, i, entries) };
  });
  const totals: Record<string, number> = {};
  for (const h of history) {
    for (const [id, e] of Object.entries(h.entries)) totals[id] = (totals[id] ?? 0) + (e?.score ?? 0);
    // Pickpocket : les points passent de la cible au voleur.
    for (const p of h.plays ?? []) if (p.points && p.target) {
      totals[p.pid] = (totals[p.pid] ?? 0) + p.points;
      totals[p.target] = (totals[p.target] ?? 0) - p.points;
    }
  }
  // Points de la Breaking News (comptés dès la révélation)
  const newsRevealed = d.newsDone || d.news?.phase === 'reveal';
  if (newsRevealed) for (const p of snap.players) totals[p.id] = (totals[p.id] ?? 0) + (newsAnswerOf(snap, p.id)?.score ?? 0);

  const hostId = effectiveHost(snap, now);
  const cur = d.current;
  const players: PlayerView[] = snap.players.map((p) => {
    const seen = snap.seen[p.id] ?? p.joinedAt;
    return {
      id: p.id,
      name: p.name,
      avatar: p.avatar ?? DEFAULT_AVATAR,
      pin: p.pin ?? null,
      color: p.color,
      isHost: p.id === hostId,
      connected: !snap.left[p.id] && now - seen <= CONNECTED_MS,
      gone: isGone(snap, p.id, now),
      total: totals[p.id] ?? 0,
      reaction: recentReaction(snap, p.id, now),
      guessed: cur ? entryOf(snap, cur.index, p.id) != null : false,
      ready: cur ? snap.raw[F.ready(cur.index, p.id)] === '1' : false,
    };
  });

  let round: RoundView | null = null;
  if (cur) {
    const i = cur.index;
    const isRevealed = cur.revealAt != null;
    const station = activeStation(snap, i);
    const myHints = hintsOf(snap, i, pid);
    const mine = plays.filter((p) => p.round === i && p.pid === pid && !p.blocked);
    const spy = mine.find((p) => p.id === 'espion');
    const spiedEntry = spy?.target ? entryOf(snap, i, spy.target) : null;
    const attacks: Attack[] = plays
      .filter((p) => p.round === i && p.target === pid && !p.blocked)
      .map((p) => ({
        id: p.id,
        from: p.pid,
        // Brouilleur : 10 s ; Brouillard : toute la manche ; les autres : simple avis de 6 s.
        until: p.id === 'brouilleur' ? p.at + JAMMER_MS : p.id === 'brouillard' ? cur.deadline : p.at + 6000,
      }));
    const jokers: MyJokerRound = {
      active: mine.map((p) => p.id),
      radar: mine.some((p) => p.id === 'radar') ? radarFor(snap, i, pid) : null,
      probeKm: mine.find((p) => p.id === 'seconde')?.probeKm ?? null,
      spied: spy?.target && spiedEntry?.lat != null ? { pid: spy.target, lat: spiedEntry.lat, lon: spiedEntry.lon! } : null,
      attacks,
    };
    round = {
      index: i,
      phase: isRevealed ? 'revealed' : 'listening',
      candidate: activeIndex(snap, i),
      streamUrl: station.streamUrl,
      startAt: cur.start,
      deadline: cur.deadline,
      nextAt: cur.nextAt,
      you: {
        guessed: entryOf(snap, i, pid) != null,
        hints: myHints,
        hintValues: Object.fromEntries(myHints.map((k) => [k, hintValue(station, k, now)])),
        ready: snap.raw[F.ready(i, pid)] === '1',
        entry: isRevealed ? finalEntry(snap, i, pid) : entryOf(snap, i, pid),
        deadline: personalDeadline(snap, i, pid, cur.start, plays),
        jokers,
      },
      // Les punaises des autres restent secrètes jusqu'à la révélation.
      entries: isRevealed ? allEntries(snap, i) : null,
      station: isRevealed ? station : null,
    };
  }

  return {
    code: snap.meta.code,
    status: d.status,
    serverNow: now,
    youId: pid,
    hostId,
    players,
    startAt: roundStart(snap, 0),
    round,
    history,
    chat: chatMessages(snap, chatSince),
    breakingNews: snap.raw[F.newsOpt] === '1',
    news: d.news ? buildNewsView(snap, pid, d.news) : null,
    newsResult: d.newsDone ? { answer: newsInfo(snap), entries: newsEntries(snap) } : null,
    jokersEnabled: jokersEnabled(snap),
    rematch: json<{ code: string; by: string }>(snap.raw[F.rematch]),
    myJokers: { hand: handOf(snap, pid), used: plays.filter((p) => p.pid === pid).map((p) => p.id) },
  };
}

function recentReaction(snap: Snapshot, pid: string, now: number): { kind: ReactionKind; at: number } | null {
  const r = json<{ kind: ReactionKind; at: number }>(snap.raw[F.react(pid)]);
  return r && now - r.at <= REACTION_SHOW_MS ? r : null;
}

/** Jokers d'une manche vus par tous, avec les points volés (jamais plus que la manche de la cible). */
function publicPlays(plays: JokerPlay[], i: number, entries: Record<string, DuelEntry>): PublicPlay[] {
  // Un Bouclier n'est public que s'il a arrêté une attaque (sinon, personne ne doit savoir qu'il a été joué).
  const shieldUsed = (p: JokerPlay) => plays.some((a) => a.round === i && a.target === p.pid && a.blocked);
  return plays
    .filter((p) => p.round === i && (p.id !== 'bouclier' || shieldUsed(p)))
    .map((p) => ({
      pid: p.pid,
      id: p.id,
      target: p.target,
      blocked: !!p.blocked,
      ...(p.id === 'pickpocket' && !p.blocked && p.target ? { points: stolenPoints(entries[p.target]?.score ?? 0) } : {}),
    }));
}

function buildNewsView(snap: Snapshot, pid: string, n: NewsTiming): NewsView {
  const plan = newsPlan(snap)!;
  const mine = newsAnswerOf(snap, pid);
  return {
    phase: n.phase,
    startAt: n.start,
    listenAt: n.listenAt,
    deadline: n.deadline,
    nextAt: n.nextAt,
    trackId: plan.trackId,
    you: { answered: mine != null, ready: snap.raw[F.newsReady(pid)] === '1', entry: mine },
    answered: Object.fromEntries(snap.players.map((p) => [p.id, newsAnswerOf(snap, p.id) != null])),
    // Les réponses des autres restent secrètes jusqu'à la révélation.
    reveal: n.phase === 'reveal' ? { answer: newsInfo(snap), entries: newsEntries(snap) } : null,
  };
}
