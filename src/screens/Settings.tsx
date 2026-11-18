// Réglages : volumes séparés radio / effets, muet, animations, statistiques.

import { pinSound, stampSound } from '../audio/sfx';
import { goHome } from '../app';
import { formatInt, formatKm } from '../format';
import { t } from '../i18n/fr';
import { defaultSave, save, updatePrefs, type Prefs } from '../state/save';

const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

export function Settings() {
  const { prefs, stats, album } = save.value;

  const slider = (key: 'radioVolume' | 'sfxVolume', label: string, onTest?: () => void) => (
    <label class="settings-row">
      <span>{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={prefs[key]}
        onInput={(e) => updatePrefs({ [key]: Number(e.currentTarget.value) })}
        onChange={onTest}
      />
      <output>{Math.round(prefs[key] * 100)} %</output>
    </label>
  );

  return (
    <main class="desk sheet-page">
      <div class="sheet">
        <header class="sheet-header">
          <button class="link-button" onClick={goHome}>
            ← {t.settings.back}
          </button>
          <h1>{t.settings.title}</h1>
        </header>

        <section>
          <h2>{t.settings.sound}</h2>
          {slider('radioVolume', t.audio.radioVolume)}
          {isIOS && <p class="settings-note">{t.settings.iosNote}</p>}
          {slider('sfxVolume', t.audio.sfxVolume, stampSound)}
          <label class="settings-row">
            <span>{t.settings.mute}</span>
            <input type="checkbox" checked={prefs.muted} onChange={(e) => updatePrefs({ muted: e.currentTarget.checked })} />
            <button class="small-button" onClick={pinSound}>
              {t.settings.test}
            </button>
          </label>
        </section>

        <section>
          <h2>{t.settings.motion}</h2>
          <div class="settings-choices" role="radiogroup" aria-label={t.settings.motion}>
            {(
              [
                ['system', t.settings.motionSystem],
                ['reduced', t.settings.motionReduced],
                ['full', t.settings.motionFull],
              ] as [Prefs['motion'], string][]
            ).map(([value, label]) => (
              <label key={value}>
                <input type="radio" name="motion" checked={prefs.motion === value} onChange={() => updatePrefs({ motion: value })} />
                {label}
              </label>
            ))}
          </div>
        </section>

        <section>
          <h2>{t.settings.stats}</h2>
          <dl class="settings-stats">
            <dt>{t.settings.gamesPlayed}</dt>
            <dd>{formatInt(stats.gamesPlayed)}</dd>
            <dt>{t.settings.bestScore}</dt>
            <dd>{formatInt(stats.bestScore)}</dd>
            <dt>{t.settings.roundsPlayed}</dt>
            <dd>{formatInt(stats.roundsPlayed)}</dd>
            <dt>{t.settings.bestDistance}</dt>
            <dd>{stats.bestDistanceKm != null ? formatKm(stats.bestDistanceKm) : '—'}</dd>
            <dt>{t.settings.cards}</dt>
            <dd>{Object.keys(album).length}</dd>
          </dl>
          <button
            class="danger-button"
            onClick={() => {
              if (window.confirm(t.settings.resetConfirm)) save.value = { ...defaultSave(), prefs };
            }}
          >
            {t.settings.reset}
          </button>
        </section>
      </div>
    </main>
  );
}
