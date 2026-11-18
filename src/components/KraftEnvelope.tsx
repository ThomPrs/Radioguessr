// « Pack opening » : une enveloppe en papier kraft arrive, tremble, on déchire la bande,
// l'épingle jaillit dans un éclat à la couleur de sa rareté, puis se plante.

import { useEffect, useState } from 'preact/hooks';
import type { PinDef } from '../../shared/pins';
import { pinSound, stampSound, swooshSound, tearSound } from '../audio/sfx';
import { t } from '../i18n/fr';
import { PinBadge } from '../pins/PinBadge';
import { reducedMotion } from '../state/prefs';
import { save, updateProfile } from '../state/save';

type Step = 'arrive' | 'shake' | 'tear' | 'reveal' | 'pinned';

interface Props {
  pin: PinDef;
  /** Nombre d'exemplaires possédés après ce gain (1 = nouvelle). */
  count: number;
  onClose: () => void;
}

export function KraftEnvelope({ pin, count, onClose }: Props) {
  const instant = reducedMotion.value;
  const [step, setStep] = useState<Step>(instant ? 'pinned' : 'arrive');
  const [opened, setOpened] = useState(instant);

  // Arrivée puis tremblement (en attendant le clic du joueur, ou ouverture automatique).
  useEffect(() => {
    if (instant) {
      stampSound();
      return;
    }
    swooshSound();
    const t1 = setTimeout(() => setStep((s) => (s === 'arrive' ? 'shake' : s)), 900);
    const t2 = setTimeout(() => setOpened(true), 2600); // ouverture d'office si le joueur ne clique pas
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [instant]);

  // Ouverture : déchirure, apparition, épingle plantée.
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

  return (
    <div class="modal kraft-modal" role="dialog" aria-modal="true" aria-label={t.pins.prizeTitle}>
      <p class="kraft-title">{t.pins.prizeTitle}</p>

      <div class={`kraft-stage step-${step} rarity-${pin.rarity}`}>
        <div class="kraft-burst" aria-hidden="true" />
        <div class="kraft-pin">
          <PinBadge id={pin.id} size={150} />
        </div>
        <button class="kraft-envelope" onClick={() => setOpened(true)} disabled={opened} aria-label={t.pins.open}>
          <span class="kraft-strip" aria-hidden="true" />
          <span class="kraft-string" aria-hidden="true" />
          <span class="kraft-seal" aria-hidden="true">
            73
          </span>
          <span class="kraft-label">{t.pins.envelopeLabel}</span>
          {!opened && <span class="kraft-hint">{t.pins.open}</span>}
        </button>
      </div>

      <div class={`kraft-caption${step === 'pinned' ? ' is-visible' : ''}`}>
        <p class="kraft-name">{pin.name}</p>
        <p class="kraft-tags">
          <span class={`rarity-tag rarity-${pin.rarity}`}>{t.pins.rarity[pin.rarity]}</span>
          <span class={`kraft-dup${count === 1 ? ' is-new' : ''}`}>{count === 1 ? t.pins.newOne : t.pins.duplicate(count)}</span>
        </p>
        {save.value.profile.pin === pin.id ? (
          <p class="kraft-inuse">{t.pins.inUse}</p>
        ) : (
          <button class="stamp-button" onClick={() => updateProfile({ pin: pin.id })} disabled={step !== 'pinned'}>
            {t.pins.useIt}
          </button>
        )}
        <button class="primary-action" onClick={onClose} disabled={step !== 'pinned'}>
          {t.pins.pinIt}
        </button>
      </div>
    </div>
  );
}
