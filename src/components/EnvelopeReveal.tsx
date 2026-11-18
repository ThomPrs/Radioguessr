// Révélation de la carte QSL : une enveloppe « par avion » arrive, s'ouvre, la carte glisse dehors,
// puis le tampon s'applique.

import { useEffect, useState } from 'preact/hooks';
import type { QslCard } from '../../shared/qsl';
import { stampSound, swooshSound, tearSound } from '../audio/sfx';
import { t } from '../i18n/fr';
import { QslCardView } from '../qsl/QslCardView';
import { ReceptionStamp } from './ReceptionStamp';
import { reducedMotion } from '../state/prefs';

type Step = 'arrive' | 'open' | 'out' | 'present' | 'stamped';

const SEQUENCE: [Step, number, (() => void)?][] = [
  ['arrive', 0, swooshSound],
  ['open', 900, tearSound],
  ['out', 650],
  ['present', 750],
  ['stamped', 650, stampSound],
];

interface Props {
  card: QslCard;
  outcome: 'new' | 'upgraded';
  onClose: () => void;
}

export function EnvelopeReveal({ card, outcome, onClose }: Props) {
  const instant = reducedMotion.value;
  const [step, setStep] = useState<Step>(instant ? 'stamped' : 'arrive');

  useEffect(() => {
    if (instant) {
      stampSound();
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    let at = 0;
    for (const [s, delay, sound] of SEQUENCE) {
      at += delay;
      timers.push(
        setTimeout(() => {
          setStep(s);
          sound?.();
        }, at),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [instant]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || (e.key === 'Enter' && step === 'stamped')) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, onClose]);

  const rot = ((card.artSeed % 9) - 4) * 1.6 - 10;

  return (
    <div class="modal envelope-modal" role="dialog" aria-modal="true" aria-label={t.qsl.received[outcome]}>
      <div class={`env-stage step-${step}`}>
        <div class="env-back" />
        <div class="env-card">
          <QslCardView
            card={card}
            flippable={step === 'stamped'}
            frontOverlay={<ReceptionStamp sinpo={card.sinpo} gold={card.rarity === 'gold'} rotation={rot} label={t.envelope.confirmed} seed={card.artSeed} />}
          />
        </div>
        <div class="env-front">
          <span class="env-airmail">{t.envelope.airmail}</span>
          <div class="env-address">
            <span>{t.envelope.to}</span>
            <span>{t.envelope.addressee}</span>
            <span>{t.envelope.from(card.country)}</span>
          </div>
          <span class="env-postage">{card.countryCode}</span>
          <span class="env-postmark" />
        </div>
        <div class="env-flap" />
      </div>

      <div class={`env-caption${step === 'stamped' ? ' is-visible' : ''}`}>
        <p class="env-title">{t.qsl.received[outcome]}</p>
        <button class="primary-action" onClick={onClose} autoFocus={step === 'stamped'}>
          {t.envelope.file}
        </button>
      </div>
    </div>
  );
}
