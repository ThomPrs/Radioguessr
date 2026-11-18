// Commandes du poste en cours de partie : pause / lecture, volume radio, volume effets, muet.

import { radioPaused } from '../audio/radio';
import { clickSound } from '../audio/sfx';
import { getPlayer } from '../game/solo';
import { t } from '../i18n/fr';
import { save, updatePrefs } from '../state/save';
import { AudioToggle } from './AudioToggle';

interface Props {
  /** Pause possible seulement quand une station joue. */
  canPause: boolean;
}

export function RadioControls({ canPause }: Props) {
  const { radioVolume, sfxVolume } = save.value.prefs;
  const paused = radioPaused.value;

  return (
    <div class="radio-controls" role="group" aria-label={t.audio.controls}>
      <button
        class="rc-play"
        disabled={!canPause}
        aria-label={paused ? t.audio.play : t.audio.pause}
        title={paused ? t.audio.play : t.audio.pause}
        onClick={() => {
          clickSound();
          getPlayer().togglePause();
        }}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          {paused || !canPause ? (
            <path d="M7 4l13 8-13 8z" fill="currentColor" />
          ) : (
            <path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor" />
          )}
        </svg>
      </button>

      <label class="rc-slider" title={t.audio.radioVolume}>
        <span class="rc-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <rect x="3" y="8" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2" />
            <circle cx="9" cy="14" r="2.5" fill="currentColor" />
            <path d="M14 12h4M14 16h4M7 8l9-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </span>
        <span class="sr-only">{t.audio.radioVolume}</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={radioVolume}
          onInput={(e) => updatePrefs({ radioVolume: Number(e.currentTarget.value), muted: false })}
        />
      </label>

      <label class="rc-slider rc-slider-small" title={t.audio.sfxVolume}>
        <span class="rc-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path d="M12 2l2.5 6.5L21 9l-5 4.5 1.5 7L12 17l-5.5 3.5 1.5-7L3 9l6.5-.5z" fill="currentColor" />
          </svg>
        </span>
        <span class="sr-only">{t.audio.sfxVolume}</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={sfxVolume}
          onInput={(e) => updatePrefs({ sfxVolume: Number(e.currentTarget.value), muted: false })}
          onChange={clickSound}
        />
      </label>

      <AudioToggle />
    </div>
  );
}
