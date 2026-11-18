// Entrée du Duel : choisir son pseudo, créer un salon ou en rejoindre un avec son code.

import { useMemo, useState } from 'preact/hooks';
import { MAX_NAME_LENGTH, ROOM_CODE_LENGTH, cleanName, isValidCode, normalizeCode } from '../../shared/duel';
import { goHome, openDuelRoom } from '../app';
import { clickSound, unlockAudio } from '../audio/sfx';
import { ApiError, api, lastIdentity, loadIdentity, rememberName, saveIdentity, savedName } from '../duel/client';
import { t } from '../i18n/fr';

export function DuelLobby({ initialCode = '' }: { initialCode?: string }) {
  const fallbackName = useMemo(() => `DX-${1000 + Math.floor(Math.random() * 9000)}`, []);
  const [name, setName] = useState(savedName());
  const [code, setCode] = useState(normalizeCode(initialCode));
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState('');
  const resumable = lastIdentity();

  const finalName = () => {
    const n = cleanName(name) || fallbackName;
    rememberName(n);
    return n;
  };

  const fail = (err: unknown) => {
    const c = err instanceof ApiError ? err.code : 'network';
    const detail = err instanceof ApiError && err.detail && c !== 'not-found' && c !== 'full' ? ` (${err.detail})` : '';
    setError((t.duel.errors[c] ?? t.duel.errors.server!) + detail);
    setBusy(null);
  };

  async function create() {
    unlockAudio();
    clickSound();
    setBusy('create');
    setError('');
    try {
      const r = await api.create(finalName());
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
      const r = await api.join(code, finalName(), loadIdentity(code));
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

        <label class="field">
          <span>{t.duel.name}</span>
          <input
            type="text"
            maxLength={MAX_NAME_LENGTH}
            value={name}
            placeholder={t.duel.namePlaceholder(fallbackName)}
            onInput={(e) => setName(e.currentTarget.value)}
            autoComplete="nickname"
          />
        </label>

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
