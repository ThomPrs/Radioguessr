// Profil · « Aperçu des jokers » : la main en miniature ; un clic ouvre la fenêtre de choix des bons.

import { useState } from 'preact/hooks';
import { HAND_SIZE, jokerById } from '../../shared/jokers';
import { clickSound } from '../audio/sfx';
import { PickerModal } from '../components/PickerModal';
import { t } from '../i18n/fr';
import { save } from '../state/save';
import { JokerDeck } from './JokerDeck';
import { JokerVoucher } from './JokerVoucher';

export function JokersPreview() {
  const [open, setOpen] = useState(false);
  const hand = save.value.hand.map(jokerById);

  return (
    <div class="member-preview">
      <p class="member-stats-label">{t.profile.jokersPreview}</p>
      <button
        class="jokers-preview"
        aria-label={t.profile.chooseJokers}
        onClick={() => {
          clickSound();
          setOpen(true);
        }}
      >
        {Array.from({ length: HAND_SIZE }, (_, i) => {
          const j = hand[i];
          return (
            <span key={i} class="jokers-preview-slot" style={{ '--fan': `${(i - 0.5) * 8}deg` } as Record<string, string>}>
              {j ? <JokerVoucher joker={j} mini /> : <span class="jokers-preview-empty">+</span>}
            </span>
          );
        })}
      </button>
      <button
        class="link-button preview-link"
        onClick={() => {
          clickSound();
          setOpen(true);
        }}
      >
        {t.profile.chooseJokers} →
      </button>

      {open && (
        <PickerModal label={t.jokers.title} onClose={() => setOpen(false)}>
          <JokerDeck />
        </PickerModal>
      )}
    </div>
  );
}
