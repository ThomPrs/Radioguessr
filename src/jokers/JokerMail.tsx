// Courrier : une petite enveloppe « par avion » arrive, on l'ouvre, un bon Joker en sort.
// Même déroulé que l'enveloppe kraft des épingles (styles kraft-* réutilisés).

import { useEffect, useState } from 'preact/hooks';
import type { JokerDef } from '../../shared/jokers';
import { pinSound, stampSound, swooshSound, tearSound } from '../audio/sfx';
import { t } from '../i18n/fr';
import { reducedMotion } from '../state/prefs';
import { putInHand, save } from '../state/save';
import { JokerVoucher } from './JokerVoucher';

type Step = 'arrive' | 'shake' | 'tear' | 'reveal' | 'pinned';

export function JokerMail({ joker, onClose }: { joker: JokerDef; onClose: () => void }) {
  const instant = reducedMotion.value;
  const [step, setStep] = useState<Step>(instant ? 'pinned' : 'arrive');
  const [opened, setOpened] = useState(instant);

  useEffect(() => {
    if (instant) return;
    swooshSound();
    const t1 = setTimeout(() => setStep((s) => (s === 'arrive' ? 'shake' : s)), 900);
    const t2 = setTimeout(() => setOpened(true), 2600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [instant]);

  useEffect(() => {
    if (!opened || instant) return;
    setStep('tear');
    tearSound();
    const t1 = setTimeout(() => {
      setStep('reveal');
      swooshSound();
    }, 550);
    const t2 = setTimeout(() => {
      setStep('pinned');
      pinSound();
      setTimeout(stampSound, 250);
    }, 1500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [opened, instant]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && step === 'pinned') onClose();
      if ((e.key === 'Enter' || e.key === ' ') && !opened) setOpened(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, opened, onClose]);

  const inHand = save.value.hand.includes(joker.id);

  return (
    <div class="modal kraft-modal" role="dialog" aria-modal="true" aria-label={t.jokers.mailTitle}>
      <p class="kraft-title">{t.jokers.mailTitle}</p>

      <div class={`kraft-stage mail-stage step-${step} rarity-${joker.rarity === 'epic' ? 'epic' : joker.rarity === 'rare' ? 'rare' : 'common'}`}>
        <div class="kraft-burst" aria-hidden="true" />
        <div class="kraft-pin">
          <JokerVoucher joker={joker} />
        </div>
        <button class="kraft-envelope" onClick={() => setOpened(true)} disabled={opened} aria-label={t.jokers.mailOpen}>
          <span class="kraft-strip" aria-hidden="true" />
          <span class="kraft-label">{t.jokers.mailLabel}</span>
          {!opened && <span class="kraft-hint">{t.jokers.mailOpen}</span>}
        </button>
      </div>

      <div class={`kraft-caption${step === 'pinned' ? ' is-visible' : ''}`}>
        <p class="kraft-tags">
          <span class="kraft-dup is-new">{t.jokers.mailNew}</span>
          <span class={`rarity-tag rarity-${joker.rarity === 'epic' ? 'epic' : joker.rarity === 'rare' ? 'rare' : 'common'}`}>
            {t.jokers.rarity[joker.rarity]}
          </span>
        </p>
        {inHand ? (
          <p class="kraft-inuse">{t.jokers.mailAdded}</p>
        ) : (
          <button class="stamp-button" onClick={() => putInHand(joker.id)} disabled={step !== 'pinned'}>
            {t.jokers.mailKeep}
          </button>
        )}
        <button class="primary-action" onClick={onClose} disabled={step !== 'pinned'}>
          {t.jokers.mailClose}
        </button>
      </div>
    </div>
  );
}
