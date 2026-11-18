// Moteur d'une partie « Monde entier » : 5 manches, indices, score, Breaking News éventuelle.

import { computed, signal } from '@preact/signals';
import { computeHints, type StationHints, type ZoneRow } from '../../shared/hints';
import { haversineKm, ROUNDS_PER_GAME, roundScore, type LatLon } from '../../shared/scoring';
import type { Game, HintKind, Round, Station } from '../../shared/types';
import { RadioPlayer } from '../audio/radio';
import { startStatic, stopStatic } from '../audio/sfx';
import { hashString } from '../../shared/rng';
import { createQslCard } from '../../shared/qsl';
import { NEWS_INTRO_MS, NEWS_LISTEN_MS, pickNewsSlot, type NewsAnswer, type TrackInfo } from '../../shared/blindtest';
import { musicApi } from '../music/client';
import { collectCard, recordGame } from '../state/save';
import { nearestCity, preloadPlaces } from './places';
import { StationPool } from './station-pool';

export type SoloPhase = 'tuning' | 'listening' | 'revealed' | 'news' | 'finished' | 'error';

/** Breaking News en cours (solo). */
export interface SoloNews {
  phase: 'intro' | 'listen' | 'reveal';
  trackId: number;
  listenAt: number;
  deadline: number;
  /** Réponse choisie, en attente de vérification. */
  pendingLabel: string | null;
  entry: NewsAnswer | null;
  answer: TrackInfo | null;
}

export interface SoloOptions {
  breakingNews: boolean;
}

let zonesPromise: Promise<ZoneRow[]> | null = null;
function loadZones(): Promise<ZoneRow[]> {
  zonesPromise ??= fetch('/data/timezones.json')
    .then((r) => (r.ok ? (r.json() as Promise<ZoneRow[]>) : []))
    .catch(() => []);
  return zonesPromise;
}

/** Lecteur partagé par toutes les parties (un seul flux à la fois). */
let sharedPlayer: RadioPlayer | null = null;
export function getPlayer(): RadioPlayer {
  sharedPlayer ??= new RadioPlayer();
  return sharedPlayer;
}

export class SoloGame {
  readonly game = signal<Game>({
    id: crypto.randomUUID(),
    mode: 'world',
    startedAt: Date.now(),
    rounds: [],
    current: 0,
    phase: 'loading',
  });
  readonly phase = signal<SoloPhase>('tuning');
  readonly guess = signal<LatLon | null>(null);
  readonly hints = signal<StationHints | null>(null);
  readonly usedHints = signal<HintKind[]>([]);
  readonly error = signal<'unreachable' | 'no-station' | null>(null);
  /** Position de l'aiguille sur le cadran (0..1), propre à chaque station, null pendant la recherche. */
  readonly dial = signal<number | null>(null);
  readonly news = signal<SoloNews | null>(null);
  /** Résultat de la Breaking News une fois passée (récapitulatif). */
  readonly newsResult = signal<{ entry: NewsAnswer | null; answer: TrackInfo | null } | null>(null);
  /** Manche (0..3) après laquelle tombe la Breaking News ; -1 si désactivée. */
  private readonly newsAfter: number;
  private newsTimers: ReturnType<typeof setTimeout>[] = [];

  /** Station en cours d'écoute : connue du moteur, jamais affichée avant la révélation. */
  private station: Station | null = null;
  private readonly pool = new StationPool();
  private readonly player = getPlayer();
  private disposed = false;

  readonly roundIndex = computed(() => this.game.value.current);
  readonly totalScore = computed(
    () => this.game.value.rounds.reduce((s, r) => s + r.score, 0) + (this.newsResult.value?.entry?.score ?? 0),
  );

  constructor(options: SoloOptions = { breakingNews: false }) {
    this.newsAfter = options.breakingNews ? pickNewsSlot() : -1;
  }
  readonly lastRound = computed<Round | null>(() => this.game.value.rounds.at(-1) ?? null);

  /** À appeler depuis un geste utilisateur (politique d'autoplay des navigateurs). */
  async start(): Promise<void> {
    void preloadPlaces();
    await this.tuneRound();
  }

  private async tuneRound(): Promise<void> {
    this.phase.value = 'tuning';
    this.error.value = null;
    this.guess.value = null;
    this.hints.value = null;
    this.usedHints.value = [];
    this.station = null;
    this.dial.value = null;
    startStatic();
    try {
      const [station, zones] = await Promise.all([this.pool.tuneNext(this.player), loadZones()]);
      stopStatic();
      if (this.disposed) return;
      this.station = station;
      this.dial.value = 0.06 + ((hashString(station.id) % 1000) / 1000) * 0.88;
      // Tests automatisés uniquement : absent du build de production (import.meta.env.DEV = false).
      if (import.meta.env.DEV) Object.assign(window, { __rgDebugStation: station, __rgGame: this });
      this.hints.value = computeHints(station, zones);
      this.phase.value = 'listening';
      this.game.value = { ...this.game.value, phase: 'listening' };
    } catch (err) {
      stopStatic();
      if (this.disposed || (err instanceof DOMException && err.name === 'AbortError')) return;
      this.error.value = err instanceof Error && err.message === 'no-station' ? 'no-station' : 'unreachable';
      this.phase.value = 'error';
    }
  }

  retry(): Promise<void> {
    return this.tuneRound();
  }

  setGuess(pos: LatLon): void {
    if (this.phase.value === 'listening') this.guess.value = pos;
  }

  useHint(kind: HintKind): void {
    if (this.phase.value !== 'listening' || this.usedHints.value.includes(kind)) return;
    const h = this.hints.value;
    if (kind === 'language' && !h?.language) return;
    if (kind === 'timezone' && !h?.timezone) return;
    this.usedHints.value = [...this.usedHints.value, kind];
  }

  /** Envoie le rapport d'écoute et révèle la station. Renvoie la manche jouée. */
  submit(): Round | null {
    const station = this.station;
    const guess = this.guess.value;
    if (this.phase.value !== 'listening' || !station || !guess) return null;
    const distanceKm = haversineKm(guess, station);
    const { raw, score } = roundScore(distanceKm, this.usedHints.value);
    const card = createQslCard({ station, distanceKm, city: nearestCity(station) });
    const round: Round = {
      index: this.game.value.current,
      station,
      hints: this.usedHints.value,
      guess: { ...guess, at: Date.now() },
      distanceKm,
      rawScore: raw,
      score,
      card,
      qsl: card ? collectCard(card) : null,
    };
    this.game.value = { ...this.game.value, rounds: [...this.game.value.rounds, round], phase: 'revealed' };
    this.phase.value = 'revealed';
    return round;
  }

  get isLastRound(): boolean {
    return this.game.value.current >= ROUNDS_PER_GAME - 1;
  }

  async next(): Promise<void> {
    if (this.phase.value !== 'revealed') return;
    // Breaking News : entre la manche « newsAfter » et la suivante.
    if (this.game.value.current === this.newsAfter && !this.newsResult.value && !this.isLastRound) {
      await this.startNews();
      return;
    }
    if (this.isLastRound) {
      this.player.stop();
      recordGame(this.game.value.rounds, this.newsResult.value?.entry?.score ?? 0);
      this.game.value = { ...this.game.value, phase: 'finished' };
      this.phase.value = 'finished';
      return;
    }
    this.game.value = { ...this.game.value, current: this.game.value.current + 1, phase: 'loading' };
    await this.tuneRound();
  }

  // ── Breaking News ────────────────────────────────────────────────────────

  private async startNews(): Promise<void> {
    this.player.stop(); // la station se tait pendant le flash
    let trackId: number;
    try {
      trackId = await musicApi.pick();
    } catch {
      // Musique indisponible : on passe directement à la manche suivante.
      this.newsResult.value = { entry: null, answer: null };
      return this.next();
    }
    if (this.disposed) return;
    const now = Date.now();
    const listenAt = now + NEWS_INTRO_MS;
    const deadline = listenAt + NEWS_LISTEN_MS;
    this.news.value = { phase: 'intro', trackId, listenAt, deadline, pendingLabel: null, entry: null, answer: null };
    this.phase.value = 'news';
    this.newsTimers.push(
      setTimeout(() => this.patchNews({ phase: 'listen' }), NEWS_INTRO_MS),
      setTimeout(() => void this.resolveNews(null, ''), NEWS_INTRO_MS + NEWS_LISTEN_MS),
    );
  }

  private patchNews(patch: Partial<SoloNews>): void {
    if (this.news.value) this.news.value = { ...this.news.value, ...patch };
  }

  /** Réponse du joueur (une seule) : vérifiée par le serveur. */
  answerNews(track: TrackInfo): void {
    const n = this.news.value;
    if (!n || n.phase !== 'listen' || n.pendingLabel) return;
    const label = `${track.title} — ${track.artist}`;
    this.patchNews({ pendingLabel: label });
    void this.resolveNews(track.id, label);
  }

  private async resolveNews(guessId: number | null, label: string): Promise<void> {
    const n = this.news.value;
    if (!n || n.phase === 'reveal') return;
    if (guessId == null && n.pendingLabel) return; // une réponse est déjà en cours de vérification
    this.newsTimers.forEach(clearTimeout);
    this.newsTimers = [];
    const at = Math.min(Date.now(), n.deadline);
    try {
      const res = await musicApi.check(n.trackId, guessId, Math.max(0, at - n.listenAt));
      const entry: NewsAnswer = { guessId, guessLabel: label, at, verdict: res.verdict, score: res.score };
      this.patchNews({ phase: 'reveal', entry, answer: res.answer });
    } catch {
      this.patchNews({ phase: 'reveal', entry: { guessId, guessLabel: label, at, verdict: 'none', score: 0 }, answer: null });
    }
  }

  /** Fin de la Breaking News : retour aux stations. */
  async continueAfterNews(): Promise<void> {
    const n = this.news.value;
    if (!n || n.phase !== 'reveal') return;
    this.newsResult.value = { entry: n.entry, answer: n.answer };
    this.news.value = null;
    this.phase.value = 'revealed';
    await this.next();
  }

  dispose(): void {
    this.disposed = true;
    this.newsTimers.forEach(clearTimeout);
    stopStatic();
    this.player.stop();
  }
}
