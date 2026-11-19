// Bon Joker façon coupon imprimé : talon détachable (icône, numéro de série), corps « BON POUR … »,
// cadre guilloché de la couleur de sa rareté, étiquette PERSO / MULTI.

import type { JokerDef } from '../../shared/jokers';
import { hashString } from '../../shared/rng';
import { t } from '../i18n/fr';
import { JokerIcon } from './JokerIcon';

interface Props {
  joker: JokerDef;
  state?: 'owned' | 'locked' | 'used';
  /** Grisé avec une mention (ex. joker multi en solo). */
  disabledNote?: string;
  compact?: boolean;
  /** Miniature (aperçu du profil) : talon, icône et nom seulement. */
  mini?: boolean;
  /** Bon qu'on vient de jouer : talon arraché et coup de tampon animés (sinon, état final direct). */
  animate?: boolean;
}

export function JokerVoucher({ joker, state = 'owned', disabledNote, compact = false, animate = false, mini = false }: Props) {
  const serial = String(hashString(joker.id) % 10000).padStart(4, '0');
  const locked = state === 'locked';
  return (
    <div
      class={`voucher rarity-${joker.rarity} kind-${joker.kind}${locked ? ' is-locked' : ''}${state === 'used' ? ' is-used' : ''}${state === 'used' && animate ? ' is-animated' : ''}${disabledNote ? ' is-disabled' : ''}${compact ? ' is-compact' : ''}${mini ? ' is-mini' : ''}`}
    >
      <div class="voucher-stub">
        {locked ? <span class="voucher-blank-icon">?</span> : <JokerIcon id={joker.id} size={mini ? 18 : compact ? 30 : 38} />}
        {!mini && <span class="voucher-serial">{t.jokers.serial(serial)}</span>}
      </div>
      <div class="voucher-body">
        <span class="voucher-kind">{t.jokers.kind[joker.kind]}</span>
        {!mini && <small class="voucher-for">{t.jokers.voucherFor}</small>}
        <strong class="voucher-name">{locked ? '· · · · · ·' : joker.name}</strong>
        {!mini && <p class="voucher-effect">{locked ? t.jokers.lockedHelp : t.jokers.effect[joker.id]}</p>}
        {!mini && <small class="voucher-valid">{disabledNote ?? t.jokers.valid}</small>}
      </div>
      {state === 'used' && <span class="voucher-used">{t.jokers.used}</span>}
    </div>
  );
}
