// Moteur d'une partie « Monde entier » : 5 manches, indices, score.

import { computed, signal } from '@preact/signals';
import { computeHints, type StationHints, type ZoneRow } from '../../shared/hints';
import { haversineKm, ROUNDS_PER_GAME, roundScore, type LatLon } from '../../shared/scoring';
import type { Game, HintKind, Round, Station } from '../../shared/types';
import { RadioPlayer } from '../audio/radio';
import { createQslCard } from '../../shared/qsl';
import { collectCard, recordGame } from '../state/save';
import { nearestCity, preloadPlaces } from './places';
import { StationPool } from './station-pool';

export type SoloPhase = 'tuning' | 'listening' | 'revealed' | 'finished' | 'error';

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

  /** Station en cours d'écoute : connue du moteur, jamais affichée avant la révélation. */
  private station: Station | null = null;
  private readonly pool = new StationPool();
  private readonly player = getPlayer();
  private disposed = false;

  readonly roundIndex = computed(() => this.game.value.current);
  readonly totalScore = computed(() => this.game.value.rounds.reduce((s, r) => s + r.score, 0));
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
    try {
      const [station, zones] = await Promise.all([this.pool.tuneNext(this.player), loadZones()]);
      if (this.disposed) return;
      this.station = station;
      // Tests automatisés uniquement : absent du build de production (import.meta.env.DEV = false).
      if (import.meta.env.DEV) Object.assign(window, { __rgDebugStation: station, __rgGame: this });
      this.hints.value = computeHints(station, zones);
      this.phase.value = 'listening';
      this.game.value = { ...this.game.value, phase: 'listening' };
    } catch (err) {
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
    if (this.isLastRound) {
      this.player.stop();
      recordGame(this.game.value.rounds);
      this.game.value = { ...this.game.value, phase: 'finished' };
      this.phase.value = 'finished';
      return;
    }
    this.game.value = { ...this.game.value, current: this.game.value.current + 1, phase: 'loading' };
    await this.tuneRound();
  }

  dispose(): void {
    this.disposed = true;
    this.player.stop();
  }
}
