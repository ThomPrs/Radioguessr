// Fiche « Options de la partie » avant une partie solo : Breaking News activée ou non.

import { useEffect } from 'preact/hooks';
import { clickSound } from '../audio/sfx';
import { t } from '../i18n/fr';
import { jokerById } from '../../shared/jokers';
import { showProfile } from '../app';
import { JokerVoucher } from '../jokers/JokerVoucher';
import { save, updatePrefs } from '../state/save';

interface Props {
  onStart: () => void;
  onCancel: () => void;
}

export function SoloSetup({ onStart, onCancel }: Props) {
  const on = save.value.prefs.breakingNews;
  const jokersOn = save.value.prefs.jokers;
  const hand = save.value.hand.map(jokerById).filter((j) => j != null);
  const playable = hand.filter((j) => j.kind === 'perso');
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
        <label class="news-option joker-option">
          <input
            type="checkbox"
            role="switch"
            checked={jokersOn}
            onChange={(e) => {
              clickSound();
              updatePrefs({ jokers: e.currentTarget.checked });
            }}
          />
          <span class="news-option-text">
            <strong class="news-option-title">{t.jokers.option}</strong>
            <small>{t.jokers.optionDesc}</small>
          </span>
        </label>
        {jokersOn && (
          <div class="setup-hand">
            {hand.length === 0 && <p class="joker-warning">{t.jokers.noHand}</p>}
            {hand.map((j) => (
              <JokerVoucher key={j.id} joker={j} compact disabledNote={j.kind === 'multi' ? t.jokers.soloForbidden : undefined} />
            ))}
            {playable.length < hand.length && <p class="joker-warning">{t.jokers.someForbidden}</p>}
            <button class="link-button" onClick={showProfile}>
              {t.jokers.changeHand}
            </button>
          </div>
        )}
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
