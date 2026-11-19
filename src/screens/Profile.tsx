// Profil : carte de membre du radio-club (pseudo, portrait, fond) et tableau de liège des épingles.

import { useEffect, useState } from 'preact/hooks';
import { ACHIEVEMENTS, FAMILY_ORDER } from '../achievements/catalog';
import { AchievementStamp, FAMILY_INK } from '../achievements/AchievementStamp';
import { AVATAR_BGS, AVATAR_FACES } from '../../shared/avatars';
import { MAX_NAME_LENGTH } from '../../shared/duel';
import { PINS, RARITY_ORDER, RARITY_WEIGHTS, pinById } from '../../shared/pins';
import { goHome } from '../app';
import { clickSound, pinSound } from '../audio/sfx';
import { t } from '../i18n/fr';
import { PinArt } from '../pins/PinArt';
import { hashString } from '../../shared/rng';
import { PinMarker } from '../pins/PinMarker';
import { AvatarView } from '../profile/Avatar';
import { markAchievementsSeen, save, updateProfile } from '../state/save';

export function Profile() {
  const { profile, pins, album, stats } = save.value;
  const [name, setName] = useState(profile.name);
  const owned = PINS.filter((p) => pins[p.id]).length;
  // Tableau rangé par rareté : une rangée par niveau, de la plus courante à la plus rare.
  const weightSum = RARITY_ORDER.reduce((sum, r) => sum + RARITY_WEIGHTS[r], 0);
  const rows = RARITY_ORDER.map((rarity) => ({ rarity, pins: PINS.filter((p) => p.rarity === rarity) }));
  const current = pinById(profile.pin);
  const { achievements, achievementsSeenAt } = save.value;
  // Les tampons obtenus depuis la dernière visite restent marqués « nouveau » jusqu'à la sortie de l'écran.
  const [seenAt] = useState(achievementsSeenAt);
  useEffect(() => () => markAchievementsSeen(), []);
  const stampCount = ACHIEVEMENTS.filter((a) => achievements[a.id]).length;

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
              <p class="member-stats-label">{t.profile.preview}</p>
              <div class="map-preview" aria-label={t.profile.preview}>
                <PinMarker pinId={profile.pin} label={profile.name || undefined} />
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
              class={`avatar-choice${profile.avatar.face === face ? ' is-selected' : ''}`}
              role="radio"
              aria-checked={profile.avatar.face === face}
              onClick={() => {
                clickSound();
                updateProfile({ avatar: { ...profile.avatar, face } });
              }}
            >
              <AvatarView avatar={{ face, bg: profile.avatar.bg }} size={64} />
            </button>
          ))}
        </div>

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

        <h2>
          {t.profile.board} <small class="board-count">{t.pins.count(owned, PINS.length)}</small>
        </h2>
        <p class="board-help">
          <strong>{t.profile.pin}.</strong> {t.profile.pinHelp} {owned <= 1 && t.pins.how}
        </p>
        <div class="cork-board">
          {rows.map(({ rarity, pins: list }) => (
            <section key={rarity} class={`cork-row rarity-${rarity}`} aria-label={t.pins.rarity[rarity]}>
              <p class="cork-label">
                <span class={`rarity-tag rarity-${rarity}`}>{t.pins.rarity[rarity]}</span>
                <span class="cork-label-chance">{t.pins.chance(Math.round((RARITY_WEIGHTS[rarity] / weightSum) * 100))}</span>
                <span class="cork-label-owned">{t.pins.ownedIn(list.filter((p) => pins[p.id]).length, list.length)}</span>
              </p>
              <div class="cork-grid">
                {list.map((p) => {
                  const n = pins[p.id] ?? 0;
                  return (
                    <button
                      key={p.id}
                      class={`cork-slot rarity-${p.rarity}${n ? '' : ' is-locked'}${profile.pin === p.id ? ' is-selected' : ''}`}
                      disabled={!n}
                      title={n ? `${p.name} · ${t.pins.rarity[p.rarity]}` : `${p.name} · ${t.pins.locked}`}
                      onClick={() => {
                        pinSound();
                        updateProfile({ pin: p.id });
                      }}
                    >
                      <span class="cork-pin" style={{ transform: `rotate(${(hashString(p.id) % 25) - 12}deg)` }}>
                        <PinArt id={p.id} height={70} owned={n > 0} />
                      </span>
                      {n > 1 && <span class="cork-count">×{n}</span>}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {current && (
          <div class={`pin-sheet rarity-${current.rarity}`}>
            <PinArt id={current.id} height={64} />
            <div class="pin-sheet-text">
              <small>{t.profile.pin}</small>
              <strong>{current.name}</strong>
              <span class="pin-sheet-tags">
                <span class={`rarity-tag rarity-${current.rarity}`}>{t.pins.rarity[current.rarity]}</span>
                <span>{t.pins.copies(pins[current.id] ?? 1)}</span>
              </span>
            </div>
          </div>
        )}

        <h2>
          {t.stamps.board} <small class="board-count">{t.stamps.count(stampCount, ACHIEVEMENTS.length)}</small>
        </h2>
        <p class="board-help">{t.stamps.help}</p>
        <div class="stamp-book">
          {FAMILY_ORDER.map((family) => (
            <section key={family} class="stamp-page" style={{ '--ink-family': FAMILY_INK[family] }}>
              <h3 class="stamp-family">{t.stamps.family[family]}</h3>
              <ul class="stamp-grid">
                {ACHIEVEMENTS.filter((a) => a.family === family).map((a) => {
                  const at = achievements[a.id];
                  const [name, goal] = t.stamps.list[a.id] ?? [a.id, ''];
                  const isNew = at != null && (seenAt == null || at > seenAt);
                  return (
                    <li key={a.id} class={`stamp-cell${at ? '' : ' is-locked'}`}>
                      {isNew && <span class="stamp-new">{t.stamps.isNew}</span>}
                      <AchievementStamp def={a} earned={at != null} />
                      <strong>{name}</strong>
                      <small>{goal}</small>
                      <small class="stamp-date">
                        {at ? t.stamps.on(new Date(at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })) : t.stamps.locked}
                      </small>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
