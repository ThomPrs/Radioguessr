// Effets sonores synthétisés avec la Web Audio API (aucun fichier audio).
// Le contexte audio est créé au premier geste de l'utilisateur (politique d'autoplay).

import { effect } from '@preact/signals';
import { save } from '../state/save';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

function audio(): { ctx: AudioContext; out: GainNode } | null {
  if (typeof AudioContext === 'undefined') return null;
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.connect(ctx.destination);
    applyVolume();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return { ctx, out: master! };
}

function applyVolume(): void {
  if (!master || !ctx) return;
  const { sfxVolume, muted } = save.value.prefs;
  master.gain.setTargetAtTime(muted ? 0 : sfxVolume, ctx.currentTime, 0.02);
}
effect(() => {
  void save.value.prefs; // dépendance
  applyVolume();
});

/** Bruit blanc de 2 s, réutilisé par tous les effets. */
function noise(c: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    noiseBuffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

function noiseSource(c: AudioContext, loop = false): AudioBufferSourceNode {
  const src = c.createBufferSource();
  src.buffer = noise(c);
  src.loop = loop;
  if (!loop) src.loopStart = 0;
  return src;
}

/** Enveloppe de gain attaque/décroissance. */
function envGain(c: AudioContext, peak: number, attack: number, decay: number, at = c.currentTime): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  return g;
}

// ── Grésillement de syntonisation ─────────────────────────────────────────

let staticNodes: { src: AudioBufferSourceNode; gain: GainNode; lfo: OscillatorNode } | null = null;

/** Grésillement continu (bruit filtré qui « balaie » comme un cadran qu'on tourne). */
export function startStatic(): void {
  const a = audio();
  if (!a || staticNodes) return;
  const { ctx: c, out } = a;
  const src = noiseSource(c, true);
  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 1800;
  band.Q.value = 0.8;
  // Balayage lent de la fréquence centrale.
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.35;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 1200;
  lfo.connect(lfoGain).connect(band.frequency);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.18, c.currentTime + 0.25);
  src.connect(band).connect(gain).connect(out);
  src.start();
  lfo.start();
  staticNodes = { src, gain, lfo };
}

export function stopStatic(): void {
  if (!staticNodes || !ctx) return;
  const { src, gain, lfo } = staticNodes;
  staticNodes = null;
  const t = ctx.currentTime;
  gain.gain.cancelScheduledValues(t);
  gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  src.stop(t + 0.35);
  lfo.stop(t + 0.35);
}

/** Courte rafale de grésillement (changement de station, coupure de la Breaking News). */
export function staticBurst(duration = 0.4, volume = 0.15): void {
  const a = audio();
  if (!a) return;
  const { ctx: c, out } = a;
  const src = noiseSource(c);
  const hp = c.createBiquadFilter();
  hp.type = 'bandpass';
  hp.frequency.value = 2500;
  const g = envGain(c, volume, 0.02, duration);
  src.connect(hp).connect(g).connect(out);
  src.start();
  src.stop(c.currentTime + duration + 0.1);
}

/** Sirène d'alerte (≈ 1 s) : deux tons qui montent et descendent. */
export function siren(duration = 1): void {
  const a = audio();
  if (!a) return;
  const { ctx: c, out } = a;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = 'sawtooth';
  const lfo = c.createOscillator();
  lfo.frequency.value = 3; // va-et-vient du hululement
  const depth = c.createGain();
  depth.gain.value = 220;
  o.frequency.value = 760;
  lfo.connect(depth).connect(o.frequency);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2200;
  o.connect(lp).connect(envGain(c, 0.16, 0.05, duration, t)).connect(out);
  o.start(t);
  lfo.start(t);
  o.stop(t + duration + 0.1);
  lfo.stop(t + duration + 0.1);
}

/** « Boum » de rotative : le journal qui s'écrase sur l'écran. */
export function pressThump(): void {
  const a = audio();
  if (!a) return;
  const { ctx: c, out } = a;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(110, t);
  o.frequency.exponentialRampToValueAtTime(32, t + 0.35);
  o.connect(envGain(c, 1, 0.005, 0.45, t)).connect(out);
  o.start(t);
  o.stop(t + 0.5);
  const n = noiseSource(c);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 600;
  n.connect(lp).connect(envGain(c, 0.6, 0.003, 0.25, t)).connect(out);
  n.start(t);
  n.stop(t + 0.3);
}

// ── Bruitages ponctuels ───────────────────────────────────────────────────

/** « Chtonk » du tampon : coup sourd grave + claquement. */
export function stampSound(): void {
  const a = audio();
  if (!a) return;
  const { ctx: c, out } = a;
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(140, t);
  osc.frequency.exponentialRampToValueAtTime(45, t + 0.15);
  osc.connect(envGain(c, 0.9, 0.005, 0.22, t)).connect(out);
  osc.start(t);
  osc.stop(t + 0.3);

  const n = noiseSource(c);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  n.connect(lp).connect(envGain(c, 0.5, 0.002, 0.08, t)).connect(out);
  n.start(t);
  n.stop(t + 0.15);
}

/** Frappe de machine à écrire. */
export function typeClick(): void {
  const a = audio();
  if (!a) return;
  const { ctx: c, out } = a;
  const t = c.currentTime;
  const n = noiseSource(c);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2500 + Math.random() * 1500;
  bp.Q.value = 2;
  n.connect(bp).connect(envGain(c, 0.35, 0.001, 0.035, t)).connect(out);
  n.start(t, Math.random());
  n.stop(t + 0.06);
  const thud = c.createOscillator();
  thud.frequency.value = 180 + Math.random() * 40;
  thud.connect(envGain(c, 0.12, 0.001, 0.04, t)).connect(out);
  thud.start(t);
  thud.stop(t + 0.06);
}

/** Sonnette de retour chariot (fin de saisie). */
export function typeBell(): void {
  const a = audio();
  if (!a) return;
  const { ctx: c, out } = a;
  const t = c.currentTime;
  for (const [f, v] of [[2093, 0.12], [3140, 0.05]] as const) {
    const o = c.createOscillator();
    o.frequency.value = f;
    o.connect(envGain(c, v, 0.002, 0.6, t)).connect(out);
    o.start(t);
    o.stop(t + 0.7);
  }
}

/** Punaise qui se plante dans le liège. */
export function pinSound(): void {
  const a = audio();
  if (!a) return;
  const { ctx: c, out } = a;
  const t = c.currentTime;
  const n = noiseSource(c);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1200;
  bp.Q.value = 3;
  n.connect(bp).connect(envGain(c, 0.5, 0.001, 0.05, t)).connect(out);
  n.start(t);
  n.stop(t + 0.08);
  const o = c.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(900, t);
  o.frequency.exponentialRampToValueAtTime(300, t + 0.06);
  o.connect(envGain(c, 0.2, 0.001, 0.07, t)).connect(out);
  o.start(t);
  o.stop(t + 0.1);
}

/** Enveloppe qu'on déchire : bruit crépitant qui balaie vers l'aigu. */
export function tearSound(): void {
  const a = audio();
  if (!a) return;
  const { ctx: c, out } = a;
  const t = c.currentTime;
  const dur = 0.45;
  const n = noiseSource(c);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.5;
  bp.frequency.setValueAtTime(600, t);
  bp.frequency.exponentialRampToValueAtTime(4000, t + dur);
  const g = c.createGain();
  // Crépitement : petites variations aléatoires du gain.
  g.gain.setValueAtTime(0.0001, t);
  for (let k = 0; k < 18; k++) g.gain.setValueAtTime(0.1 + Math.random() * 0.35, t + (k / 18) * dur);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
  n.connect(bp).connect(g).connect(out);
  n.start(t);
  n.stop(t + dur + 0.1);
}

/** Froissement de papier (arrivée de l'enveloppe). */
export function swooshSound(): void {
  const a = audio();
  if (!a) return;
  const { ctx: c, out } = a;
  const t = c.currentTime;
  const n = noiseSource(c);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(400, t);
  lp.frequency.exponentialRampToValueAtTime(2500, t + 0.25);
  n.connect(lp).connect(envGain(c, 0.25, 0.12, 0.25, t)).connect(out);
  n.start(t);
  n.stop(t + 0.45);
}

/** Déclic d'un bouton (fiches d'indices, interrupteur). */
export function clickSound(): void {
  const a = audio();
  if (!a) return;
  const { ctx: c, out } = a;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = 'square';
  o.frequency.value = 1400;
  o.connect(envGain(c, 0.08, 0.001, 0.02, t)).connect(out);
  o.start(t);
  o.stop(t + 0.04);
}

/**
 * Jingle de flash spécial (≈ 3 s) : roulement de caisse claire puis fanfare de cuivres
 * (dents de scie filtrées), façon « Breaking News » de radio.
 */
export function newsJingle(): void {
  const a = audio();
  if (!a) return;
  const { ctx: c, out } = a;
  const t0 = c.currentTime + 0.05;
  // Roulement : rafales de bruit rapprochées et crescendo
  for (let k = 0; k < 14; k++) {
    const at = t0 + k * 0.045;
    const n = noiseSource(c);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    n.connect(bp).connect(envGain(c, 0.08 + k * 0.015, 0.002, 0.04, at)).connect(out);
    n.start(at, Math.random());
    n.stop(at + 0.06);
  }
  // Fanfare : sol – do – mi – sol (tenu), deux voix
  const notes: [number, number, number][] = [
    [392, 0.7, 0.16],
    [523.25, 0.88, 0.16],
    [659.25, 1.06, 0.16],
    [783.99, 1.24, 1.3],
  ];
  for (const [f, start, dur] of notes) {
    for (const [mult, type, vol] of [
      [1, 'sawtooth', 0.12],
      [1.5, 'triangle', 0.06],
    ] as const) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = f * mult;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(900, t0 + start);
      lp.frequency.linearRampToValueAtTime(2600, t0 + start + 0.08);
      const g = envGain(c, vol, 0.02, dur, t0 + start);
      o.connect(lp).connect(g).connect(out);
      o.start(t0 + start);
      o.stop(t0 + start + dur + 0.1);
    }
  }
  // Coup de cymbale final
  const cym = noiseSource(c);
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 6000;
  cym.connect(hp).connect(envGain(c, 0.18, 0.005, 1.4, t0 + 1.24)).connect(out);
  cym.start(t0 + 1.24);
  cym.stop(t0 + 2.8);
}

/** À appeler sur un premier geste pour déverrouiller l'audio. */
export function unlockAudio(): void {
  audio();
}
