// Fiche « Options de la partie » avant une partie solo : Breaking News activée ou non.

import { useEffect } from 'preact/hooks';
import { clickSound } from '../audio/sfx';
import { t } from '../i18n/fr';
import { save, updatePrefs } from '../state/save';

interface Props {
  onStart: () => void;
  onCancel: () => void;
}

export function SoloSetup({ onStart, onCancel }: Props) {
  const on = save.value.prefs.breakingNews;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div class="modal" role="dialog" aria-modal="true" aria-label={t.news.setupTitle} onClick={onCancel}>
      <div class="sheet solo-setup" onClick={(e) => e.stopPropagation()}>
        <h2>{t.news.setupTitle}</h2>
        <label class="news-option">
          <input
            type="checkbox"
            role="switch"
            checked={on}
            onChange={(e) => {
              clickSound();
              updatePrefs({ breakingNews: e.currentTarget.checked });
            }}
          />
          <span class="news-option-text">
            <strong class="news-option-title">{t.news.option}</strong>
            <small>{t.news.optionDesc}</small>
          </span>
        </label>
        <div class="solo-setup-actions">
          <button class="link-button" onClick={onCancel}>
            {t.news.cancel}
          </button>
          <button class="primary-action" onClick={onStart} autoFocus>
            {t.news.start}
          </button>
        </div>
      </div>
    </div>
  );
}
