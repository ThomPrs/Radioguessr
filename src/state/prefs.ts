// Préférences dérivées : mouvement réduit (préférence du jeu + réglage du système), volume de la radio.

import { computed, effect, signal } from '@preact/signals';
import { getPlayer } from '../game/solo';
import { save } from './save';

const systemReduced = signal(false);
if (typeof window !== 'undefined' && window.matchMedia) {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  systemReduced.value = mq.matches;
  mq.addEventListener('change', (e) => (systemReduced.value = e.matches));
}

/** Vrai si les animations doivent être réduites. */
export const reducedMotion = computed(() => {
  const m = save.value.prefs.motion;
  return m === 'reduced' || (m === 'system' && systemReduced.value);
});

/** Applique les préférences au document et au lecteur radio. */
export function installPrefs(): void {
  effect(() => {
    document.documentElement.classList.toggle('reduce-motion', reducedMotion.value);
  });
  effect(() => {
    const { radioVolume, muted } = save.value.prefs;
    const player = getPlayer();
    player.volume = radioVolume;
    player.muted = muted;
  });
}

/** Attend `ms`, ou rien si les animations sont réduites. */
export function motionDelay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, reducedMotion.value ? 0 : ms));
}
