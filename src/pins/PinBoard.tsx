// Tableau de liège des épingles, rangé par rareté, et fiche de l'épingle plantée sur la carte.
// Un clic sur une épingle possédée la choisit.

import { PINS, RARITY_ORDER, RARITY_WEIGHTS, pinById } from '../../shared/pins';
import { hashString } from '../../shared/rng';
import { pinSound } from '../audio/sfx';
import { t } from '../i18n/fr';
import { save, updateProfile } from '../state/save';
import { PinArt } from './PinArt';

export function PinBoard() {
  const { profile, pins } = save.value;
  const owned = PINS.filter((p) => pins[p.id]).length;
  // Une rangée par niveau de rareté, de la plus courante à la plus rare.
  const weightSum = RARITY_ORDER.reduce((sum, r) => sum + RARITY_WEIGHTS[r], 0);
  const rows = RARITY_ORDER.map((rarity) => ({ rarity, pins: PINS.filter((p) => p.rarity === rarity) }));
  const current = pinById(profile.pin);

  return (
    <section class="pin-board">
      <h2>
        {t.profile.board} <small class="board-count">{t.pins.count(owned, PINS.length)}</small>
      </h2>
      <p class="board-help">
        <strong>{t.profile.pin}.</strong> {t.profile.pinHelp} {owned <= 1 && t.pins.how}
      </p>

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
    </section>
  );
}
