// Album des cartes QSL : une case par pays, filtres par continent, vue détaillée recto/verso.

import { useEffect, useMemo, useState } from 'preact/hooks';
import albumCountries from '../../shared/album-countries.json';
import { continentOf, countryNameFr } from '../../shared/countries';
import { CONTINENT_FR } from '../../shared/hints';
import type { QslCard } from '../../shared/qsl';
import type { Continent } from '../../shared/types';
import { goHome, type AlbumTab } from '../app';
import { ACHIEVEMENTS } from '../achievements/catalog';
import { StampBook, hasNewStamps } from '../achievements/StampBook';
import { t } from '../i18n/fr';
import { QslCardView } from '../qsl/QslCardView';
import { save, updatePrefs } from '../state/save';

const FILTERS: Continent[] = ['AF', 'NA', 'SA', 'AS', 'EU', 'OC'];

interface Slot {
  code: string;
  name: string;
  continent: Continent;
}

const collator = new Intl.Collator('fr');

function buildSlots(album: Record<string, QslCard>): Slot[] {
  const codes = new Set<string>([...(albumCountries as string[]), ...Object.keys(album)]);
  const slots: Slot[] = [];
  for (const code of codes) {
    const continent = continentOf(code);
    if (!continent || continent === 'AN') continue;
    slots.push({ code, name: countryNameFr(code), continent });
  }
  return slots.sort((a, b) => collator.compare(a.name, b.name));
}

export function Album({ initialTab = 'cards' }: { initialTab?: AlbumTab }) {
  const [tab, setTab] = useState<AlbumTab>(initialTab);
  const stampCount = ACHIEVEMENTS.filter((a) => save.value.achievements[a.id]).length;
  // Pastille « nouveaux tampons » : elle s'éteint dès qu'on a ouvert le carnet.
  const [freshStamps] = useState(hasNewStamps);
  const [bookSeen, setBookSeen] = useState(initialTab === 'stamps');
  useEffect(() => {
    if (tab === 'stamps') setBookSeen(true);
  }, [tab]);
  const album = save.value.album;
  const [filter, setFilter] = useState<Continent | 'all'>('all');
  const [open, setOpen] = useState<QslCard | null>(null);
  const slots = useMemo(() => buildSlots(album), [album]);
  const showMissing = save.value.prefs.albumShowMissing;
  const visible = slots.filter((s) => (filter === 'all' || s.continent === filter) && (showMissing || album[s.code]));
  const owned = slots.filter((s) => album[s.code]).length;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <main class="desk sheet-page">
      <div class="sheet album">
      <header class="album-header">
        <button class="link-button" onClick={goHome}>
          ← {t.album.back}
        </button>
        <h1>{t.album.title}</h1>
      </header>

      <div class="album-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'cards'} class={tab === 'cards' ? 'is-active' : ''} onClick={() => setTab('cards')}>
          {t.album.tabCards} <small>{t.album.count(owned, slots.length)}</small>
        </button>
        <button role="tab" aria-selected={tab === 'stamps'} class={tab === 'stamps' ? 'is-active' : ''} onClick={() => setTab('stamps')}>
          {t.album.tabStamps} <small>{t.stamps.count(stampCount, ACHIEVEMENTS.length)}</small>
          {freshStamps && !bookSeen && <span class="album-tab-dot" aria-label={t.stamps.isNew} />}
        </button>
      </div>

      {tab === 'stamps' ? (
        <StampBook />
      ) : (
      <>
      <header class="album-header album-subheader">
        <label class="album-toggle">
          <input
            type="checkbox"
            role="switch"
            checked={showMissing}
            onChange={(e) => updatePrefs({ albumShowMissing: e.currentTarget.checked })}
          />
          <span>{t.album.showMissing}</span>
        </label>
      </header>

      <nav class="album-filters" aria-label="Continents">
        <button class={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>
          {t.album.all}
        </button>
        {FILTERS.map((c) => {
          const n = slots.filter((s) => s.continent === c && album[s.code]).length;
          return (
            <button key={c} class={filter === c ? 'is-active' : ''} onClick={() => setFilter(c)}>
              {CONTINENT_FR[c]} <small>({n})</small>
            </button>
          );
        })}
      </nav>

      {owned === 0 && <p class="album-empty">{t.album.empty}</p>}

      <ul class="album-grid">
        {visible.map((slot) => {
          const card = album[slot.code];
          return (
            <li key={slot.code} class={card ? 'album-slot is-filled' : 'album-slot'}>
              {card ? (
                <button class="album-card-button" onClick={() => setOpen(card)} aria-label={slot.name}>
                  <QslCardView card={card} flippable={false} />
                </button>
              ) : (
                <div class="album-placeholder">
                  <span class="album-placeholder-cc">{slot.code}</span>
                  <span>{slot.name}</span>
                </div>
              )}
              <span class="album-slot-name">{slot.name}</span>
            </li>
          );
        })}
      </ul>
      </>
      )}

      {open && (
        <div class="modal" role="dialog" aria-modal="true" aria-label={open.country} onClick={() => setOpen(null)}>
          <div class="modal-body" onClick={(e) => e.stopPropagation()}>
            <QslCardView card={open} />
            <p class="modal-hint">{t.album.flipHint}</p>
            <button onClick={() => setOpen(null)}>{t.album.close}</button>
          </div>
        </div>
      )}
      </div>
    </main>
  );
}
