// Profil · « Aperçu sur la carte » : l'épingle plantée ; un clic ouvre le tableau de liège pour en choisir une autre.

import { useState } from 'preact/hooks';
import { clickSound } from '../audio/sfx';
import { PickerModal } from '../components/PickerModal';
import { t } from '../i18n/fr';
import { save } from '../state/save';
import { PinBoard } from './PinBoard';
import { PinMarker } from './PinMarker';

export function PinPreview() {
  const [open, setOpen] = useState(false);
  const { profile } = save.value;
  const show = () => {
    clickSound();
    setOpen(true);
  };

  return (
    <div class="member-preview">
      <p class="member-stats-label">{t.profile.preview}</p>
      <button class="map-preview map-preview-button" aria-label={t.profile.choosePin} onClick={show}>
        <PinMarker pinId={profile.pin} label={profile.name || undefined} />
      </button>
      <button class="link-button preview-link" onClick={show}>
        {t.profile.choosePin} →
      </button>
      {open && (
        <PickerModal label={t.profile.board} onClose={() => setOpen(false)}>
          <PinBoard />
        </PickerModal>
      )}
    </div>
  );
}
