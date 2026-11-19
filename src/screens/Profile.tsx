// Profil : carte de membre du radio-club (pseudo, portrait, fond) ; l'épingle et les jokers se choisissent
// depuis leurs aperçus, qui ouvrent une fenêtre de choix.

import { useState } from 'preact/hooks';
import { ACHIEVEMENTS } from '../achievements/catalog';
import { AVATAR_BGS, AVATAR_FACES } from '../../shared/avatars';
import { MAX_NAME_LENGTH } from '../../shared/duel';
import { PINS } from '../../shared/pins';
import { goHome, showAlbum } from '../app';
import { clickSound } from '../audio/sfx';
import { t } from '../i18n/fr';
import { PinPreview } from '../pins/PinPreview';
import { PhotoPicker } from '../profile/PhotoPicker';
import { JokersPreview } from '../jokers/JokersPreview';
import { AvatarView } from '../profile/Avatar';
import { save, updateProfile } from '../state/save';

export function Profile() {
  const { profile, pins, album, stats } = save.value;
  const [name, setName] = useState(profile.name);
  const owned = PINS.filter((p) => pins[p.id]).length;
  const stampCount = ACHIEVEMENTS.filter((a) => save.value.achievements[a.id]).length;

  const saveName = () => updateProfile({ name });

  return (
    <main class="desk sheet-page">
      <div class="sheet profile">
        <header class="sheet-header">
          <button
            class="link-button"
            onClick={() => {
              saveName();
              goHome();
            }}
          >
            ← {t.profile.back}
          </button>
          <h1>{t.profile.title}</h1>
        </header>

        {/* Carte de membre */}
        <section class="member-card">
          <p class="member-card-title">{t.profile.card}</p>
          <div class="member-card-body">
            <div class="member-portrait">
              <AvatarView avatar={profile.avatar} size={112} />
            </div>
            <div class="member-fields">
              <label class="field">
                <span>{t.profile.name}</span>
                <input
                  type="text"
                  value={name}
                  maxLength={MAX_NAME_LENGTH}
                  placeholder={t.profile.noName}
                  autoComplete="nickname"
                  onInput={(e) => setName(e.currentTarget.value)}
                  onBlur={saveName}
                  onKeyDown={(e) => e.key === 'Enter' && saveName()}
                />
              </label>
              <div class="member-previews">
                <PinPreview />
                <JokersPreview />
              </div>
              <p class="member-stats">
                {Object.keys(album).length} QSL · {t.pins.count(owned, PINS.length)} · {stats.duels.won} victoire{stats.duels.won > 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </section>

        <h2>{t.profile.avatar}</h2>
        <div class="avatar-grid" role="radiogroup" aria-label={t.profile.avatar}>
          {AVATAR_FACES.map((face) => (
            <button
              key={face}
              class={`avatar-choice${profile.avatar.face === face && !profile.avatar.usePhoto ? ' is-selected' : ''}`}
              role="radio"
              aria-checked={profile.avatar.face === face && !profile.avatar.usePhoto}
              onClick={() => {
                clickSound();
                // Choisir un portrait dessiné : la photo reste gardée, mais n'est plus affichée.
                updateProfile({ avatar: { ...profile.avatar, face, usePhoto: false } });
              }}
            >
              <AvatarView avatar={{ face, bg: profile.avatar.bg }} size={64} />
            </button>
          ))}
        </div>

        <h2>{t.photo.title}</h2>
        <PhotoPicker />

        <h2>{t.profile.background}</h2>
        <div class="bg-swatches" role="radiogroup" aria-label={t.profile.background}>
          {AVATAR_BGS.map((color, i) => (
            <button
              key={color}
              class={`bg-swatch${profile.avatar.bg === i ? ' is-selected' : ''}`}
              style={{ background: color }}
              role="radio"
              aria-checked={profile.avatar.bg === i}
              aria-label={`${t.profile.background} ${i + 1}`}
              onClick={() => {
                clickSound();
                updateProfile({ avatar: { ...profile.avatar, bg: i } });
              }}
            />
          ))}
        </div>

        <p class="profile-stamps-link">
          <button class="link-button" onClick={() => showAlbum('stamps')}>
            {t.profile.seeStamps(stampCount)} →
          </button>
        </p>
      </div>
    </main>
  );
}
