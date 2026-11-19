// Profil · « Mon jeu de jokers » : la main (2 bons emportés en partie) et la collection, rangée par type.

import { JOKERS, MAIL_EVERY, jokerById, type JokerKind } from '../../shared/jokers';
import { clickSound } from '../audio/sfx';
import { t } from '../i18n/fr';
import { putInHand, removeFromHand, save } from '../state/save';
import { JokerVoucher } from './JokerVoucher';

const KINDS: JokerKind[] = ['perso', 'multi'];

export function JokerDeck() {
  const { jokers, hand, mail } = save.value;
  const owned = JOKERS.filter((j) => jokers[j.id]).length;
  const handDefs = hand.map(jokerById);
  const complete = owned === JOKERS.length;

  return (
    <section class="joker-deck">
      <h2>
        {t.jokers.title} <small class="board-count">{t.jokers.count(owned, JOKERS.length)}</small>
      </h2>
      <p class="board-help">{t.jokers.help}</p>

      <div class="joker-hand" aria-label={t.jokers.hand}>
        {[0, 1].map((i) => {
          const j = handDefs[i];
          return (
            <div key={i} class="joker-hand-slot">
              {j ? (
                <>
                  <JokerVoucher joker={j} />
                  <button
                    class="link-button"
                    onClick={() => {
                      clickSound();
                      removeFromHand(j.id);
                    }}
                  >
                    {t.jokers.removeFromHand}
                  </button>
                </>
              ) : (
                <div class="joker-hand-empty">{t.jokers.emptySlot}</div>
              )}
            </div>
          );
        })}
      </div>
      {handDefs.some((j) => j?.kind === 'multi') && <p class="joker-warning">{t.jokers.multiWarning}</p>}
      <p class="joker-mail-status">{complete ? t.jokers.mailDone : t.jokers.mailIn(MAIL_EVERY - mail)}</p>

      {KINDS.map((kind) => (
        <div key={kind}>
          <h3 class="joker-kind-title">{t.jokers.kindTitle[kind]}</h3>
          <div class="joker-grid">
            {JOKERS.filter((j) => j.kind === kind).map((j) => {
              const has = !!jokers[j.id];
              const inHand = hand.includes(j.id);
              return (
                <button
                  key={j.id}
                  class={`joker-choice${inHand ? ' is-in-hand' : ''}`}
                  disabled={!has || inHand}
                  title={has ? (inHand ? t.jokers.inHand : t.jokers.putInHand) : t.jokers.locked}
                  onClick={() => {
                    clickSound();
                    putInHand(j.id);
                  }}
                >
                  <JokerVoucher joker={j} state={has ? 'owned' : 'locked'} compact />
                  <span class="joker-choice-tag">{inHand ? t.jokers.inHand : ''}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
