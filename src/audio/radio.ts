// Lecteur radio : <audio> natif, délai de démarrage, et aucune fuite d'identité de la station.
//
// Le flux n'est PAS routé dans Web Audio : sans en-têtes CORS (cas fréquent),
// createMediaElementSource rendrait le son muet. Le volume passe par audio.volume.

import { t } from '../i18n/fr';

export const TUNE_TIMEOUT_MS = 8000;

export type TuneResult = 'playing' | 'failed' | 'cancelled';

export class RadioPlayer {
  private readonly audio: HTMLAudioElement;
  private attempt = 0;

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'none';
    // Pas de crossOrigin : on ne lit jamais les échantillons, et ça évite les refus CORS.
    this.audio.setAttribute('aria-hidden', 'true');
  }

  get volume(): number {
    return this.audio.volume;
  }

  set volume(v: number) {
    this.audio.volume = Math.min(1, Math.max(0, v));
  }

  set muted(m: boolean) {
    this.audio.muted = m;
  }

  /**
   * Tente de lire un flux. Résout 'playing' dès que le son démarre,
   * 'failed' en cas d'erreur ou si rien ne démarre avant le délai,
   * 'cancelled' si un autre tune()/stop() est appelé entre-temps.
   */
  tune(streamUrl: string, timeoutMs = TUNE_TIMEOUT_MS): Promise<TuneResult> {
    const id = ++this.attempt;
    const audio = this.audio;
    this.hideIdentity();

    return new Promise<TuneResult>((resolve) => {
      let settled = false;
      const finish = (result: TuneResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        clearInterval(watchdog);
        audio.removeEventListener('playing', onPlaying);
        audio.removeEventListener('error', onError);
        if (result === 'failed' && this.attempt === id) this.reset();
        resolve(result);
      };
      const onPlaying = () => finish(this.attempt === id ? 'playing' : 'cancelled');
      const onError = () => finish(this.attempt === id ? 'failed' : 'cancelled');
      const timer = setTimeout(() => finish('failed'), timeoutMs);
      const watchdog = setInterval(() => {
        if (this.attempt !== id) finish('cancelled');
      }, 200);

      audio.addEventListener('playing', onPlaying);
      audio.addEventListener('error', onError);
      audio.src = streamUrl;
      audio.load();
      audio.play().catch((err: unknown) => {
        // NotAllowedError = autoplay bloqué (pas de geste utilisateur) : ce n'est pas la faute du flux.
        if (err instanceof DOMException && err.name === 'NotAllowedError') finish('failed');
        // AbortError = interrompu par un nouveau src : géré par le watchdog.
      });
    });
  }

  stop(): void {
    this.attempt++;
    this.reset();
  }

  private reset(): void {
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load(); // coupe réellement la connexion réseau
  }

  /** Neutralise tout ce que le navigateur ou l'OS pourrait afficher (notification média, onglet). */
  private hideIdentity(): void {
    document.title = t.app.tabTitleListening;
    if ('mediaSession' in navigator && typeof MediaMetadata !== 'undefined') {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: t.app.mediaTitle,
        artist: t.app.name,
        album: '',
        artwork: [],
      });
    }
  }
}
