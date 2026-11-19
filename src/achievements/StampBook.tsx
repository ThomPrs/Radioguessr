// Carnet de tampons : une page par famille, tampons obtenus (avec leur date) et à obtenir.
// Les tampons obtenus depuis la dernière visite restent marqués « nouveau » jusqu'à la fermeture du carnet.

import { useEffect, useState } from 'preact/hooks';
import { t } from '../i18n/fr';
import { markAchievementsSeen, save } from '../state/save';
import { AchievementStamp, FAMILY_INK } from './AchievementStamp';
import { ACHIEVEMENTS, FAMILY_ORDER } from './catalog';

/** Vrai si un tampon a été obtenu depuis la dernière visite du carnet. */
export function hasNewStamps(): boolean {
  const { achievements, achievementsSeenAt } = save.value;
  return Object.values(achievements).some((at) => achievementsSeenAt == null || at > achievementsSeenAt);
}

export function StampBook() {
  const { achievements, achievementsSeenAt } = save.value;
  const [seenAt] = useState(achievementsSeenAt);
  useEffect(() => () => markAchievementsSeen(), []);

  return (
    <div class="stamp-book-wrap">
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
  );
}
