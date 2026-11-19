// Session multijoueur côté navigateur : polling ~1 s, radio synchronisée sur le flux du salon,
// signalement des flux muets, chat, cartes QSL et statistiques en fin de partie.

import { computed, signal } from '@preact/signals';
import { CHAT_KEEP, POLL_INTERVAL_MS, rankPlayers, type ChatMessage, type HistoryItem, type RoomView } from '../../shared/duel';
import { createQslCard, type CollectOutcome, type QslCard } from '../../shared/qsl';
import type { HintKind } from '../../shared/types';
import { startStatic, stopStatic, typeClick } from '../audio/sfx';
import { nearestCity, preloadPlaces } from '../game/places';
import { getPlayer } from '../game/solo';
import { drawPin, type PinDef } from '../../shared/pins';
import type { AchievementDef } from '../achievements/catalog';
import type { JokerDef } from '../../shared/jokers';
import { awardPin, collectCard, countJokerPlayed, recordDuel, tickMail, unlockAchievements } from '../state/save';
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
  /** Messages du salon (les plus anciens d'abord), fusionnés par identifiant. */
  readonly chat = signal<ChatMessage[]>([]);
  /** Épingle gagnée en fin de partie (vainqueur, ex æquo compris), à ouvrir dans l'enveloppe kraft. */
  readonly prize = signal<{ pin: PinDef; count: number } | null>(null);
  /** Succès obtenus pendant cette partie. */
  readonly newStamps = signal<AchievementDef[]>([]);
  /** Courrier : bon Joker reçu à la fin de cette partie. */
  readonly mail = signal<JokerDef | null>(null);
  /** Erreur du dernier envoi de message (trop rapide…). */
  readonly chatError = signal<string | null>(null);

  /** Décalage horloge serveur − horloge locale (ms). */
  private offset = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private tunedKey: string | null = null;
  private recorded = false;
  private lastChatId = 0;

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
      const v = await api.get(this.id, this.lastChatId);
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

  private mergeChat(incoming: ChatMessage[]): void {
    const fresh = incoming.filter((m) => m.id > this.lastChatId);
    if (fresh.length === 0) return;
    this.lastChatId = fresh[fresh.length - 1]!.id;
    this.chat.value = [...this.chat.value, ...fresh].slice(-CHAT_KEEP);
    // Petit cliquetis de télégraphe quand quelqu'un d'autre écrit.
    if (fresh.some((m) => m.kind === 'msg' && m.pid !== this.id.playerId)) typeClick();
  }

  private apply(v: RoomView): void {
    const prev = this.view.value;
    this.view.value = v;
    this.mergeChat(v.chat);
    if (v.status !== 'news') this.newsPending.value = null;
    if (prev?.round?.index !== v.round?.index) this.pending.value = null;

    // Radio : on (re)syntonise quand la manche ou le flux de secours change.
    const r = v.round;
    if (v.status === 'playing' && r) {
      const key = `${r.index}:${r.candidate}`;
      if (key !== this.tunedKey) {
        this.tunedKey = key;
        void this.tune(r.index, r.candidate, r.streamUrl);
      }
    } else if (v.status === 'finished' || v.status === 'waiting' || v.status === 'news') {
      // Breaking News : la station se tait ; la manche suivante resyntonisera.
      if (this.tunedKey) getPlayer().stop();
      stopStatic();
      this.tunedKey = null;
      this.radio.value = 'idle';
    }

    for (const h of v.history) this.collect(h);

    if (v.status === 'finished' && !this.recorded) {
      this.recorded = true;
      // Victoire : seul en tête ; égalité : premier ex æquo ; sinon défaite.
      const ranking = rankPlayers(v.players);
      const firsts = ranking.filter((r) => r.rank === 1).map((r) => r.player.id);
      const result = !firsts.includes(v.youId) ? 'lost' : firsts.length === 1 ? 'won' : 'draw';
      // Partie déjà comptée avant un rechargement de la page : ni statistique ni épingle en double.
      if (this.markOnce('done')) {
        recordDuel(result);
        if (result !== 'lost' && v.players.filter((p) => !p.gone).length >= 2) {
          const pin = drawPin();
          this.prize.value = { pin, count: awardPin(pin.id) };
        }
        this.mail.value = tickMail();
        const mine = v.history.map((h) => h.entries[v.youId] ?? null);
        this.newStamps.value = unlockAchievements({
          mode: 'duel',
          distances: mine.map((e) => e?.distanceKm ?? null),
          hintsUsed: mine.reduce((n, e) => n + (e?.hints.length ?? 0), 0),
          total: v.players.find((p) => p.id === v.youId)?.total ?? 0,
          news: v.newsResult?.entries[v.youId] ?? null,
          players: v.players.length,
          result,
        });
      }
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

  /** Vrai la première fois seulement, pour ce salon et ce joueur (mémorisé dans le navigateur). */
  private markOnce(what: string): boolean {
    const key = `radioguessr:room-${what}:${this.id.code}:${this.id.playerId}`;
    try {
      if (localStorage.getItem(key)) return false;
      localStorage.setItem(key, '1');
    } catch {
      // stockage indisponible : on accepte (au pire une épingle en double)
    }
    return true;
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
    const mine = h.entries[this.id.playerId];
    if (this.cards.value[h.index] || mine?.distanceKm == null) return;
    const card = createQslCard({ station: h.station, distanceKm: mine.distanceKm, city: nearestCity(h.station), source: 'duel' });
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
      const res = await api.act(this.id, action, this.lastChatId);
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

  /** Option Jokers (hôte, avant le lancement). */
  async setJokers(on: boolean): Promise<void> {
    await this.send({ action: 'options', jokers: on });
  }

  /** Joue un joker (cible pour les jokers multi ; épingle posée pour Seconde écoute). */
  async playJoker(id: string, target: string | null = null): Promise<boolean> {
    const r = this.view.value?.round;
    if (!r) return false;
    const p = this.pending.value;
    this.jokerError.value = null;
    this.busy.value = true;
    try {
      const res = await api.act(this.id, { action: 'joker', round: r.index, id, target, ...(p ? { lat: p.lat, lon: p.lon } : {}) }, this.lastChatId);
      this.apply(res.view);
      countJokerPlayed();
      return true;
    } catch (err) {
      this.jokerError.value = err instanceof ApiError ? err.detail || err.code : 'network';
      return false;
    } finally {
      this.busy.value = false;
    }
  }

  /** Refus du serveur pour le dernier joker. */
  readonly jokerError = signal<string | null>(null);

  /** Option Breaking News (hôte, avant le lancement). */
  async setBreakingNews(on: boolean): Promise<void> {
    await this.send({ action: 'options', breakingNews: on });
  }

  /** Réponse à la Breaking News : libellé affiché en attendant la vérification par le serveur. */
  readonly newsPending = signal<string | null>(null);

  async newsAnswer(trackId: number, label: string): Promise<void> {
    this.newsPending.value = label;
    await this.send({ action: 'news-answer', guessId: trackId });
  }

  async newsReady(): Promise<void> {
    await this.send({ action: 'news-ready' });
  }

  /** Lancement de la partie (hôte uniquement). */
  async startGame(): Promise<void> {
    await this.send({ action: 'start' });
  }

  /** Envoie un message ; renvoie true si le serveur l'a accepté. */
  async sendChat(text: string): Promise<boolean> {
    this.chatError.value = null;
    try {
      const res = await api.act(this.id, { action: 'chat', text }, this.lastChatId);
      this.apply(res.view);
      return true;
    } catch (err) {
      this.chatError.value = err instanceof ApiError ? err.code : 'network';
      return false;
    }
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
