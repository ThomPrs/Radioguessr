// Réactions rapides : six petits tampons à envoyer en un clic, vus par tout le salon pendant 4 s.

import { useState } from 'preact/hooks';
import { REACTIONS, REACTION_MIN_INTERVAL_MS, type ReactionKind } from '../../shared/duel';
import type { DuelSession } from '../duel/session';
import { t } from '../i18n/fr';

export function ReactionBar({ session }: { session: DuelSession }) {
  const [cooling, setCooling] = useState(false);
  return (
    <div class="reaction-bar" role="group" aria-label={t.reactions.title}>
      {REACTIONS.map((kind: ReactionKind) => (
        <button
          key={kind}
          class={`reaction-btn reaction-${kind}`}
          disabled={cooling}
          title={t.reactions.send(t.reactions.label[kind] ?? kind)}
          onClick={() => {
            setCooling(true);
            setTimeout(() => setCooling(false), REACTION_MIN_INTERVAL_MS);
            void session.react(kind);
          }}
        >
          {t.reactions.label[kind]}
        </button>
      ))}
    </div>
  );
}
