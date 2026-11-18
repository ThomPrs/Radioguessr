// Bouton muet rapide (en-tête de partie).

import { clickSound } from '../audio/sfx';
import { t } from '../i18n/fr';
import { save, updatePrefs } from '../state/save';

export function AudioToggle() {
  const muted = save.value.prefs.muted;
  return (
    <button
      class="icon-button"
      aria-pressed={muted}
      aria-label={muted ? t.audio.unmute : t.audio.mute}
      title={muted ? t.audio.unmute : t.audio.mute}
      onClick={() => {
        updatePrefs({ muted: !muted });
        if (muted) clickSound();
      }}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
        {muted ? (
          <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        ) : (
          <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" />
        )}
      </svg>
    </button>
  );
}
