// Fenêtre de choix (épingle, jokers…) ouverte depuis le profil : fermeture par le bouton, Échap ou un clic à côté.

import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { t } from '../i18n/fr';

interface Props {
  label: string;
  onClose: () => void;
  children: ComponentChildren;
}

export function PickerModal({ label, onClose, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div class="modal" role="dialog" aria-modal="true" aria-label={label} onClick={onClose}>
      <div class="sheet picker-modal" onClick={(e) => e.stopPropagation()}>
        {children}
        <div class="picker-modal-actions">
          <button class="primary-action" onClick={onClose}>
            {t.jokers.close}
          </button>
        </div>
      </div>
    </div>
  );
}
