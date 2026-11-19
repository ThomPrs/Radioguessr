// Profil · « Aperçu des jokers » : la main en miniature ; un clic ouvre la fenêtre de choix des bons.

import { useEffect, useState } from 'preact/hooks';
import { HAND_SIZE, jokerById } from '../../shared/jokers';
import { clickSound } from '../audio/sfx';
import { t } from '../i18n/fr';
import { save } from '../state/save';
import { JokerDeck } from './JokerDeck';
import { JokerVoucher } from './JokerVoucher';

export function JokersPreview() {
  const [open, setOpen] = useState(false);
  const hand = save.value.hand.map(jokerById);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

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
        class="link-button jokers-preview-link"
        onClick={() => {
          clickSound();
          setOpen(true);
        }}
      >
        {t.profile.chooseJokers} →
      </button>

      {open && (
        <div class="modal" role="dialog" aria-modal="true" aria-label={t.jokers.title} onClick={() => setOpen(false)}>
          <div class="sheet jokers-modal" onClick={(e) => e.stopPropagation()}>
            <JokerDeck />
            <div class="jokers-modal-actions">
              <button class="primary-action" onClick={() => setOpen(false)}>
                {t.jokers.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
