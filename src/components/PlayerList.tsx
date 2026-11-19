// Liste des opérateurs du salon : pastille de couleur, hôte, « vous », état et total.

import { PLAYER_COLORS, type PlayerView } from '../../shared/duel';
import { formatInt } from '../format';
import { PinArt } from '../pins/PinArt';
import { AvatarView } from '../profile/Avatar';
import { t } from '../i18n/fr';

interface Props {
  players: PlayerView[];
  youId: string;
  /** Contexte : en attente (pas de score), écoute ou révélation. */
  phase: 'waiting' | 'listening' | 'revealed';
}

function statusOf(p: PlayerView, phase: Props['phase']): { label: string; cls: string } | null {
  if (p.gone) return { label: t.duel.status.gone, cls: 'is-gone' };
  if (!p.connected) return { label: t.duel.status.offline, cls: 'is-offline' };
  if (phase === 'listening') return p.guessed ? { label: t.duel.status.sent, cls: 'is-done' } : { label: t.duel.status.listening, cls: '' };
  if (phase === 'revealed' && p.ready) return { label: t.duel.status.ready, cls: 'is-done' };
  return null;
}

export function PlayerList({ players, youId, phase }: Props) {
  return (
    <ul class="player-list">
      {players.map((p) => {
        const status = statusOf(p, phase);
        return (
          <li key={p.id} class={`player-row${p.gone ? ' is-gone' : ''}`}>
            <span class="player-avatar" style={{ borderColor: PLAYER_COLORS[p.color] }}>
              <AvatarView avatar={p.avatar} size={30} title={p.name} />
            </span>
            <span class="player-name">
              {p.name}
              {p.id === youId && <em class="player-tag"> ({t.duel.youTag})</em>}
              {p.isHost && <span class="player-host">{t.duel.host}</span>}
            </span>
            {p.reaction && (
              // La clé change à chaque réaction : le tampon s'abat de nouveau.
              <span key={p.reaction.at} class="player-reaction" style={{ '--player': PLAYER_COLORS[p.color] } as Record<string, string>}>
                {t.reactions.label[p.reaction.kind]}
              </span>
            )}
            {p.pin && <PinArt id={p.pin} height={30} />}
            {status && <span class={`player-status ${status.cls}`}>{status.label}</span>}
            {phase !== 'waiting' && <span class="player-total">{formatInt(p.total)}</span>}
          </li>
        );
      })}
    </ul>
  );
}
