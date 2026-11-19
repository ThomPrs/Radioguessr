// Entrée du Multijoueur : créer un salon ou en rejoindre un avec son code.
// Le pseudo, l'avatar et l'épingle viennent du profil (plus de saisie ici).

import { useEffect, useState } from 'preact/hooks';
import { ROOM_CODE_LENGTH, isValidCode, normalizeCode } from '../../shared/duel';
import { goHome, openDuelRoom, showProfile } from '../app';
import { clickSound, unlockAudio } from '../audio/sfx';
import { ApiError, api, lastIdentity, loadIdentity, saveIdentity } from '../duel/client';
import { save, updateProfile } from '../state/save';
import { t } from '../i18n/fr';
import { PinArt } from '../pins/PinArt';
import { AvatarView } from '../profile/Avatar';

export function DuelLobby({ initialCode = '' }: { initialCode?: string }) {
  const profile = save.value.profile;
  // Nouveau joueur sans pseudo : on lui en choisit un, enregistré dans son profil.
  const [autoName, setAutoName] = useState(false);
  useEffect(() => {
    if (!save.peek().profile.name) {
      updateProfile({ name: `DX-${1000 + Math.floor(Math.random() * 9000)}` });
      setAutoName(true);
    }
  }, []);
  const [code, setCode] = useState(normalizeCode(initialCode));
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState('');
  const resumable = lastIdentity();

  // Apparence et main de jokers du profil, envoyées en créant ou en rejoignant le salon.
  const look = () => ({ avatar: save.value.profile.avatar, pin: save.value.profile.pin, hand: save.value.hand });

  const fail = (err: unknown) => {
    const c = err instanceof ApiError ? err.code : 'network';
    const detail = err instanceof ApiError && err.detail && !['not-found', 'full', 'started'].includes(c) ? ` (${err.detail})` : '';
    setError((t.duel.errors[c] ?? t.duel.errors.server!) + detail);
    setBusy(null);
  };

  async function create() {
    unlockAudio();
    clickSound();
    setBusy('create');
    setError('');
    try {
      const r = await api.create(save.value.profile.name, look());
      openDuelRoom(saveIdentity(r));
    } catch (err) {
      fail(err);
    }
  }

  async function join(e?: Event) {
    e?.preventDefault();
    if (!isValidCode(code)) return;
    unlockAudio();
    clickSound();
    setBusy('join');
    setError('');
    try {
      const r = await api.join(code, save.value.profile.name, loadIdentity(code), look());
      openDuelRoom(saveIdentity(r));
    } catch (err) {
      fail(err);
    }
  }

  return (
    <main class="desk sheet-page">
      <div class="sheet duel-lobby">
        <header class="sheet-header">
          <button class="link-button" onClick={goHome}>
            ← {t.duel.back}
          </button>
          <h1>{t.duel.title}</h1>
          <p>{t.duel.intro}</p>
        </header>

        {resumable && (
          <button class="resume-button" onClick={() => openDuelRoom(resumable)}>
            {t.duel.resume(resumable.code)}
          </button>
        )}

        <section class="lobby-me">
          <AvatarView avatar={profile.avatar} size={56} />
          <div class="lobby-me-text">
            <span class="lobby-me-label">{t.duel.playingAs}</span>
            <strong class="lobby-me-name">{profile.name}</strong>
            {autoName && <small>{t.duel.autoName}</small>}
          </div>
          <PinArt id={profile.pin} height={48} />
          <button class="link-button" onClick={showProfile}>
            {t.duel.editProfile}
          </button>
        </section>

        <div class="duel-choices">
          <section class="duel-choice">
            <button class="primary-action" onClick={() => void create()} disabled={busy != null}>
              {busy === 'create' ? t.duel.creating : t.duel.create}
            </button>
          </section>

          <span class="duel-or">{t.duel.or}</span>

          <form class="duel-choice" onSubmit={(e) => void join(e)}>
            <label class="field">
              <span>{t.duel.code}</span>
              <input
                class="code-input"
                type="text"
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                spellcheck={false}
                maxLength={ROOM_CODE_LENGTH + 2}
                value={code}
                placeholder="ABC23"
                onInput={(e) => setCode(normalizeCode(e.currentTarget.value))}
              />
            </label>
            <button type="submit" disabled={busy != null || !isValidCode(code)}>
              {busy === 'join' ? t.duel.joining : t.duel.join}
            </button>
          </form>
        </div>

        {error && (
          <p class="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
