// Moteur d'une partie « Monde entier » : 5 manches, indices, score, Breaking News éventuelle.

import { computed, signal } from '@preact/signals';
import { computeHints, type StationHints, type ZoneRow } from '../../shared/hints';
import { haversineKm, ROUNDS_PER_GAME, type LatLon } from '../../shared/scoring';
import type { Game, HintKind, Round, Station } from '../../shared/types';
import { RadioPlayer } from '../audio/radio';
import { startStatic, stopStatic } from '../audio/sfx';
import { hashString } from '../../shared/rng';
import { createQslCard } from '../../shared/qsl';
import { NEWS_INTRO_MS, NEWS_LISTEN_MS, pickNewsSlot, type NewsAnswer, type TrackInfo } from '../../shared/blindtest';
import { musicApi } from '../music/client';
import { drawPin, SOLO_PRIZE_SCORE, type PinDef } from '../../shared/pins';
import type { AchievementDef } from '../achievements/catalog';
import {
  ANTENNA_BONUS_MS,
  canPlay,
  playableIn,
  radarCenter,
  scoreWithJokers,
  type JokerDef,
  type JokerId,
  type PlayRefusal,
} from '../../shared/jokers';
import { ROUND_TIME_MS } from '../../shared/duel';
import { awardPin, collectCard, countJokerPlayed, recordGame, save, tickMail, unlockAchievements } from '../state/save';
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
  /** Cartes Joker activées (la main vient du profil). */
  jokers?: boolean;
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
  /** Enveloppe kraft gagnée par une très bonne partie. */
  readonly prize = signal<{ pin: PinDef; count: number } | null>(null);
  /** Succès obtenus pendant cette partie. */
  readonly newStamps = signal<AchievementDef[]>([]);
  /** Courrier : bon Joker reçu à la fin de cette partie. */
  readonly mail = signal<JokerDef | null>(null);
  /** Fin du chrono de la manche en cours (ms), null hors écoute. */
  readonly deadline = signal<number | null>(null);
  /** Manche validée d'office à la fin du chrono (l'écran joue alors la révélation). */
  readonly autoRound = signal<Round | null>(null);
  /** Jokers : main jouable en solo, jokers déjà joués, jokers actifs sur la manche en cours. */
  readonly hand: JokerDef[];
  readonly jokersEnabled: boolean;
  readonly jokersUsed = signal<JokerId[]>([]);
  readonly roundJokers = signal<JokerId[]>([]);
  /** Radar : centre du cercle ; Seconde écoute : distance de l'épingle à la station. */
  readonly radar = signal<LatLon | null>(null);
  readonly probe = signal<number | null>(null);
  private roundTimer: ReturnType<typeof setTimeout> | null = null;
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
    this.jokersEnabled = options.jokers ?? false;
    this.hand = this.jokersEnabled ? playableIn('solo', save.peek().hand) : [];
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
    this.roundJokers.value = [];
    this.radar.value = null;
    this.probe.value = null;
    this.clearTimer();
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
      this.startTimer(ROUND_TIME_MS);
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

  // ── Chrono ───────────────────────────────────────────────────────────────

  private startTimer(ms: number): void {
    this.clearTimer();
    const end = Date.now() + ms;
    this.deadline.value = end;
    this.roundTimer = setTimeout(() => this.timeUp(), ms);
  }

  private clearTimer(): void {
    if (this.roundTimer) clearTimeout(this.roundTimer);
    this.roundTimer = null;
    this.deadline.value = null;
  }

  /** Fin du chrono : l'épingle posée est validée d'office ; sans épingle, la manche vaut 0. */
  private timeUp(): void {
    if (this.disposed || this.phase.value !== 'listening') return;
    this.autoRound.value = this.submit(true);
  }

  // ── Jokers ───────────────────────────────────────────────────────────────

  /** Peut-on jouer ce joker maintenant ? (règles partagées avec le serveur) */
  jokerCheck(id: JokerId): { ok: true } | { ok: false; reason: PlayRefusal } {
    return canPlay(id, {
      mode: 'solo',
      enabled: this.jokersEnabled,
      hand: this.hand.map((j) => j.id),
      used: this.jokersUsed.value,
      listening: this.phase.value === 'listening' && this.station != null,
      guessed: false,
      pinPlaced: this.guess.value != null,
    });
  }

  playJoker(id: JokerId): boolean {
    if (!this.jokerCheck(id).ok) return false;
    const station = this.station!;
    this.jokersUsed.value = [...this.jokersUsed.value, id];
    this.roundJokers.value = [...this.roundJokers.value, id];
    countJokerPlayed();
    if (id === 'radar') this.radar.value = radarCenter(station);
    if (id === 'seconde' && this.guess.value) this.probe.value = haversineKm(this.guess.value, station);
    if (id === 'antenne' && this.deadline.value != null) this.startTimer(this.deadline.value - Date.now() + ANTENNA_BONUS_MS);
    return true;
  }

  /** Envoie le rapport d'écoute et révèle la station. Renvoie la manche jouée. */
  submit(timedOut = false): Round | null {
    const station = this.station;
    const guess = this.guess.value;
    if (this.phase.value !== 'listening' || !station || (!guess && !timedOut)) return null;
    this.clearTimer();
    const distanceKm = guess ? haversineKm(guess, station) : null;
    const active = this.roundJokers.value;
    const { raw, score } = scoreWithJokers(distanceKm, this.usedHints.value, {
      double: active.includes('double'),
      floor: active.includes('filet'),
      freeHints: active.includes('indices'),
    });
    const card = distanceKm != null ? createQslCard({ station, distanceKm, city: nearestCity(station) }) : null;
    const round: Round = {
      index: this.game.value.current,
      station,
      hints: this.usedHints.value,
      guess: guess ? { ...guess, at: Date.now() } : null,
      distanceKm,
      rawScore: raw,
      score,
      card,
      qsl: card ? collectCard(card) : null,
      jokers: active.length ? active : undefined,
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
      const rounds = this.game.value.rounds;
      const news = this.newsResult.value?.entry ?? null;
      recordGame(rounds, news?.score ?? 0);
      const total = this.totalScore.value;
      if (total >= SOLO_PRIZE_SCORE) {
        const pin = drawPin();
        this.prize.value = { pin, count: awardPin(pin.id) };
      }
      this.mail.value = tickMail();
      this.newStamps.value = unlockAchievements({
        mode: 'world',
        distances: rounds.map((r) => r.distanceKm),
        hintsUsed: rounds.reduce((n, r) => n + r.hints.length, 0),
        total,
        news,
      });
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
    this.clearTimer();
    this.newsTimers.forEach(clearTimeout);
    stopStatic();
    this.player.stop();
  }
}
