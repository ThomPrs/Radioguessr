// Bons Joker rangés en bas à droite de la carte : ils dépassent à peine et sortent au survol
// (ou d'un appui sur l'étiquette, sur écran tactile). Un clic, une confirmation (et une cible pour
// les jokers multi), et le bon est joué (talon arraché, tampon « UTILISÉ »). Solo et multijoueur.

import { useState } from 'preact/hooks';
import type { JokerDef, JokerId, PlayRefusal } from '../../shared/jokers';
import { clickSound, stampSound, tearSound } from '../audio/sfx';
import { t } from '../i18n/fr';
import { JokerVoucher } from './JokerVoucher';

export interface JokerTarget {
  id: string;
  name: string;
  color: string;
}

interface Props {
  jokers: readonly JokerDef[];
  used: readonly string[];
  check: (id: JokerId, target: string | null) => { ok: true } | { ok: false; reason: PlayRefusal };
  onPlay: (id: JokerId, target: string | null) => void;
  /** Adversaires qu'un joker multi peut viser. */
  targets?: readonly JokerTarget[];
  busy?: boolean;
  error?: string | null;
}

export function JokerTray({ jokers, used, check, onPlay, targets = [], busy = false, error }: Props) {
  const [armed, setArmed] = useState<JokerId | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  if (jokers.length === 0) return null;
  const armedDef = jokers.find((j) => j.id === armed && !used.includes(j.id));
  const needsTarget = armedDef?.target === 'opponent';

  const left = jokers.filter((j) => !used.includes(j.id)).length;
  const confirm = armedDef && (
    <div class="joker-confirm" role="alertdialog" aria-label={t.jokers.confirm(armedDef.name)}>
      <p>{needsTarget ? t.jokers.pickTarget(armedDef.name) : t.jokers.confirm(armedDef.name)}</p>
      {needsTarget && (
        <div class="joker-targets">
          {targets.map((p) => (
            <button
              key={p.id}
              class={`joker-target${target === p.id ? ' is-picked' : ''}`}
              style={{ '--player': p.color } as Record<string, string>}
              onClick={() => {
                clickSound();
                setTarget(p.id);
              }}
            >
              <span class="pin-dot" style={{ background: p.color }} aria-hidden="true" /> {p.name}
            </button>
          ))}
        </div>
      )}
      <button
        class="stamp-button"
        disabled={busy || (needsTarget && !target) || !check(armedDef.id, needsTarget ? target : null).ok}
        onClick={() => {
          tearSound();
          setTimeout(stampSound, 250);
          onPlay(armedDef.id, needsTarget ? target : null);
          setArmed(null);
          setTarget(null);
        }}
      >
        {t.jokers.yes}
      </button>
      <button class="link-button" onClick={() => setArmed(null)}>
        {t.jokers.no}
      </button>
    </div>
  );

  return (
    // Ouvert : survol, focus clavier, appui sur l'étiquette, ou confirmation en cours.
    <div class={`joker-dock${open || armedDef ? ' is-open' : ''}`} role="group" aria-label={t.jokers.tray}>
      {open && (
        <button class="joker-dock-close" onClick={() => setOpen(false)}>
          {t.jokers.dockClose}
        </button>
      )}
      {error && <p class="form-error joker-dock-error">{error}</p>}
      {confirm}
      <div class="joker-dock-hand">
        <button class="joker-dock-tab" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {t.jokers.dockTab(left)}
        </button>
        {jokers.map((j, i) => {
          const isUsed = used.includes(j.id);
          const verdict = check(j.id, j.target === 'opponent' ? (targets[0]?.id ?? null) : null);
          const reason = !verdict.ok && !isUsed ? t.jokers.refusal[verdict.reason] : undefined;
          return (
            <button
              key={j.id}
              class={`joker-play${armed === j.id ? ' is-armed' : ''}`}
              style={{ '--fan': `${(i - (jokers.length - 1) / 2) * 5}deg` } as Record<string, string>}
              disabled={isUsed || !verdict.ok || busy}
              title={reason ?? t.jokers.effect[j.id]}
              onClick={() => {
                clickSound();
                setTarget(null);
                setArmed(armed === j.id ? null : j.id);
              }}
            >
              <JokerVoucher joker={j} compact state={isUsed ? 'used' : 'owned'} disabledNote={reason} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
