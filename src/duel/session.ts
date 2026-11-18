// Session de duel côté navigateur : polling ~1 s, radio synchronisée sur le flux du salon,
// signalement des flux muets, cartes QSL et statistiques en fin de partie.

import { computed, signal } from '@preact/signals';
import { POLL_INTERVAL_MS, type HistoryItem, type RoomView } from '../../shared/duel';
import { createQslCard, type CollectOutcome, type QslCard } from '../../shared/qsl';
import type { HintKind } from '../../shared/types';
import { startStatic, stopStatic } from '../audio/sfx';
import { nearestCity, preloadPlaces } from '../game/places';
import { getPlayer } from '../game/solo';
import { collectCard, recordDuel } from '../state/save';
import { ApiError, api, forgetIdentity, type Identity } from './client';

export type ConnectionState = 'ok' | 'retrying' | 'expired' | 'forbidden';

export interface RoundCard {
  card: QslCard;
  outcome: CollectOutcome;
}

export class DuelSession {
  readonly view = signal<RoomView | null>(null);
  readonly connection = signal<ConnectionState>('ok');
  /** Radio : en recherche / en écoute / muette (tous les secours ont échoué). */
  readonly radio = signal<'idle' | 'tuning' | 'on' | 'dead' | 'blocked'>('idle');
  /** Cartes gagnées, par manche. */
  readonly cards = signal<Record<number, RoundCard>>({});
  /** Punaise locale (avant envoi). */
  readonly pending = signal<{ lat: number; lon: number } | null>(null);
  readonly busy = signal(false);

  /** Décalage horloge serveur − horloge locale (ms). */
  private offset = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private tunedKey: string | null = null;
  private recorded = false;

  readonly now = signal(Date.now());
  private ticker: ReturnType<typeof setInterval> | null = null;

  readonly serverNow = computed(() => this.now.value + this.offset);

  constructor(readonly id: Identity) {}

  start(): void {
    void preloadPlaces();
    this.ticker = setInterval(() => (this.now.value = Date.now()), 250);
    void this.poll();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.ticker) clearInterval(this.ticker);
    stopStatic();
    getPlayer().stop();
  }

  private async poll(): Promise<void> {
    if (this.stopped) return;
    const t0 = Date.now();
    try {
      const v = await api.get(this.id);
      this.offset = v.serverNow - (t0 + Date.now()) / 2;
      this.connection.value = 'ok';
      this.apply(v);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'not-found') {
        this.connection.value = 'expired';
        forgetIdentity(this.id.code);
        this.stop();
        return;
      }
      if (err instanceof ApiError && err.code === 'forbidden') {
        this.connection.value = 'forbidden';
        this.stop();
        return;
      }
      this.connection.value = 'retrying'; // réseau coupé : on réessaie, la session reprendra
    }
    if (!this.stopped) this.timer = setTimeout(() => void this.poll(), POLL_INTERVAL_MS);
  }

  private apply(v: RoomView): void {
    const prev = this.view.value;
    this.view.value = v;
    if (prev?.round?.index !== v.round?.index) this.pending.value = null;

    // Radio : on (re)syntonise quand la manche ou le flux de secours change.
    const r = v.round;
    if (v.status === 'playing' && r) {
      const key = `${r.index}:${r.candidate}`;
      if (key !== this.tunedKey) {
        this.tunedKey = key;
        void this.tune(r.index, r.candidate, r.streamUrl);
      }
    } else if (v.status === 'finished' || v.status === 'waiting') {
      if (this.tunedKey) getPlayer().stop();
      this.tunedKey = null;
      this.radio.value = 'idle';
    }

    for (const h of v.history) this.collect(h);

    if (v.status === 'finished' && !this.recorded) {
      this.recorded = true;
      const { you, opponent } = v.totals;
      recordDuel(you > opponent ? 'won' : you < opponent ? 'lost' : 'draw');
    }
  }

  private async tune(round: number, candidate: number, url: string): Promise<void> {
    this.radio.value = 'tuning';
    startStatic();
    const result = await getPlayer().tune(url);
    if (this.tunedKey !== `${round}:${candidate}`) return; // dépassé par un autre flux
    stopStatic();
    if (result === 'playing') {
      this.radio.value = 'on';
      return;
    }
    if (result === 'blocked') {
      this.radio.value = 'blocked'; // le joueur doit cliquer pour rallumer le poste
      return;
    }
    if (result === 'failed') {
      // Flux muet : on demande au serveur de passer au secours suivant (pour les deux joueurs).
      try {
        const res = await api.act(this.id, { action: 'skip', round, from: candidate });
        this.apply(res.view);
        if (res.view.round?.candidate === candidate) this.radio.value = 'dead'; // plus de secours
      } catch {
        this.radio.value = 'dead';
      }
    }
  }

  /** Rallume le poste après un blocage d'autoplay (appelé depuis un clic). */
  retune(): void {
    const r = this.view.value?.round;
    if (!r) return;
    this.tunedKey = `${r.index}:${r.candidate}`;
    void this.tune(r.index, r.candidate, r.streamUrl);
  }

  /** Carte QSL de la manche, une seule fois. */
  private collect(h: HistoryItem): void {
    if (this.cards.value[h.index] || h.you?.distanceKm == null) return;
    const card = createQslCard({ station: h.station, distanceKm: h.you.distanceKm, city: nearestCity(h.station), source: 'duel' });
    if (!card) return;
    this.cards.value = { ...this.cards.value, [h.index]: { card, outcome: collectCard(card) } };
  }

  /** Temps restant avant une échéance serveur, en ms. */
  remaining(at: number | null | undefined): number {
    return at == null ? 0 : Math.max(0, at - this.serverNow.value);
  }

  private async send(action: Parameters<typeof api.act>[1]): Promise<string | undefined> {
    this.busy.value = true;
    try {
      const res = await api.act(this.id, action);
      this.apply(res.view);
      return res.hint;
    } catch (err) {
      if (err instanceof ApiError && err.code === 'not-found') this.connection.value = 'expired';
      return undefined;
    } finally {
      this.busy.value = false;
    }
  }

  setPin(lat: number, lon: number): void {
    const r = this.view.value?.round;
    if (r?.phase === 'listening' && !r.you.guessed) this.pending.value = { lat, lon };
  }

  async submit(): Promise<void> {
    const r = this.view.value?.round;
    const p = this.pending.value;
    if (!r || !p || r.you.guessed) return;
    await this.send({ action: 'guess', round: r.index, lat: p.lat, lon: p.lon });
  }

  async hint(kind: HintKind): Promise<void> {
    const r = this.view.value?.round;
    if (r) await this.send({ action: 'hint', round: r.index, kind });
  }

  async ready(): Promise<void> {
    const r = this.view.value?.round;
    if (r) await this.send({ action: 'ready', round: r.index });
  }

  async leave(): Promise<void> {
    await this.send({ action: 'leave' });
    forgetIdentity(this.id.code);
    this.stop();
  }
}
