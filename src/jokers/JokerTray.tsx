// Bons Joker posés sur le bureau pendant la partie : un clic, une confirmation, et le bon est joué
// (talon arraché, tampon « UTILISÉ »). Sert au solo comme au multijoueur.

import { useState } from 'preact/hooks';
import type { JokerDef, JokerId, PlayRefusal } from '../../shared/jokers';
import { clickSound, stampSound, tearSound } from '../audio/sfx';
import { t } from '../i18n/fr';
import { JokerVoucher } from './JokerVoucher';

interface Props {
  jokers: readonly JokerDef[];
  used: readonly string[];
  check: (id: JokerId) => { ok: true } | { ok: false; reason: PlayRefusal };
  onPlay: (id: JokerId) => void;
  /** Message de confirmation propre (ex. choix de la cible en multijoueur). */
  confirmText?: (j: JokerDef) => string;
}

export function JokerTray({ jokers, used, check, onPlay, confirmText }: Props) {
  const [armed, setArmed] = useState<JokerId | null>(null);
  if (jokers.length === 0) return null;
  const armedDef = jokers.find((j) => j.id === armed);

  return (
    <div class="joker-tray" role="group" aria-label={t.jokers.tray}>
      <div class="joker-tray-cards">
        {jokers.map((j) => {
          const isUsed = used.includes(j.id);
          const verdict = check(j.id);
          const reason = !verdict.ok && !isUsed ? t.jokers.refusal[verdict.reason] : undefined;
          return (
            <button
              key={j.id}
              class={`joker-play${armed === j.id ? ' is-armed' : ''}`}
              disabled={isUsed || (!verdict.ok && verdict.reason !== 'target')}
              title={reason ?? t.jokers.effect[j.id]}
              onClick={() => {
                clickSound();
                setArmed(armed === j.id ? null : j.id);
              }}
            >
              <JokerVoucher joker={j} compact state={isUsed ? 'used' : 'owned'} disabledNote={!isUsed && reason && verdict.ok === false && verdict.reason !== 'target' ? reason : undefined} />
            </button>
          );
        })}
      </div>
      {armedDef && !used.includes(armedDef.id) && (
        <div class="joker-confirm" role="alertdialog" aria-label={t.jokers.confirm(armedDef.name)}>
          <p>{confirmText ? confirmText(armedDef) : t.jokers.confirm(armedDef.name)}</p>
          <button
            class="stamp-button"
            disabled={!check(armedDef.id).ok}
            onClick={() => {
              tearSound();
              setTimeout(stampSound, 250);
              onPlay(armedDef.id);
              setArmed(null);
            }}
          >
            {t.jokers.yes}
          </button>
          <button class="link-button" onClick={() => setArmed(null)}>
            {t.jokers.no}
          </button>
        </div>
      )}
    </div>
  );
}
