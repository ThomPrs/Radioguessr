// Bandeau « Nouveaux tampons ! » en fin de partie : les tampons s'abattent l'un après l'autre.

import { useEffect } from 'preact/hooks';
import { stampSound } from '../audio/sfx';
import { t } from '../i18n/fr';
import { reducedMotion } from '../state/prefs';
import { AchievementStamp } from './AchievementStamp';
import type { AchievementDef } from './catalog';

const STEP_MS = 450;

interface Props {
  stamps: AchievementDef[];
  /** Attendre (par exemple la fermeture de l'enveloppe) avant de tamponner. */
  paused?: boolean;
}

export function StampStrip({ stamps, paused = false }: Props) {
  useEffect(() => {
    if (paused || stamps.length === 0) return;
    const timers = stamps.map((_, i) => setTimeout(stampSound, 300 + i * STEP_MS));
    return () => timers.forEach(clearTimeout);
  }, [paused, stamps]);

  if (stamps.length === 0) return null;
  return (
    <section class={`stamp-strip${paused ? ' is-paused' : ''}`} aria-label={t.stamps.newOnes}>
      <h2 class="recap-subtitle">{t.stamps.newOnes}</h2>
      <ul>
        {stamps.map((s, i) => {
          const [name, goal] = t.stamps.list[s.id] ?? [s.id, ''];
          return (
            <li key={s.id} style={{ animationDelay: reducedMotion.value ? '0s' : `${0.3 + (i * STEP_MS) / 1000}s` }} title={goal}>
              <AchievementStamp def={s} earned size={84} />
              <span class="stamp-strip-name">{name}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
