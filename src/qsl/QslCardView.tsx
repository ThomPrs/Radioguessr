// Carte QSL : recto (indicatif + vignette) et verso (message, timbre, tampon SINPO). Retournable.

import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import type { QslCard } from '../../shared/qsl';
import type { Continent } from '../../shared/types';
import { formatKm } from '../format';
import { t } from '../i18n/fr';
import { Vignette } from './vignette';

export const CONTINENT_ACCENT: Record<Continent, string> = {
  AF: '#c9822b',
  AS: '#b5473a',
  EU: '#2f5d8c',
  NA: '#4f7a4a',
  SA: '#8a5a9e',
  OC: '#2b8a8a',
  AN: '#7d8a99',
};

const RTL = new Set(['ar', 'he', 'fa', 'ur']);

function formatCoord(v: number, pos: string, neg: string): string {
  return `${Math.abs(v).toFixed(2).replace('.', ',')}° ${v >= 0 ? pos : neg}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface Props {
  card: QslCard;
  /** Retournement au clic (album, détail). */
  flippable?: boolean;
  /** Démarrer côté verso. */
  initialSide?: 'front' | 'back';
  /** Élément posé sur le recto (tampon de réception) : il pivote avec la carte. */
  frontOverlay?: ComponentChildren;
}

export function QslCardView({ card, flippable = true, initialSide = 'front', frontOverlay }: Props) {
  const [flipped, setFlipped] = useState(initialSide === 'back');
  const accent = CONTINENT_ACCENT[card.continent];
  const style = { '--accent': accent } as Record<string, string>;
  const rot = ((card.artSeed % 7) - 3) * 1.5; // tampon un peu de travers, propre à chaque carte

  const toggle = () => flippable && setFlipped((f) => !f);

  return (
    <div
      class={`qsl qsl-${card.rarity}${flipped ? ' is-flipped' : ''}${flippable ? ' is-flippable' : ''}`}
      style={style}
      role={flippable ? 'button' : undefined}
      tabIndex={flippable ? 0 : undefined}
      aria-label={flippable ? t.qsl.flip : undefined}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      }}
    >
      <div class="qsl-inner">
        {/* ── Recto ── */}
        <div class="qsl-face qsl-front">
          <div class="qsl-front-top">
            <span class="qsl-callsign">{card.callsign}</span>
            <span class="qsl-badge">{t.qsl.rarity[card.rarity]}</span>
          </div>
          <div class="qsl-art">
            <Vignette seed={card.artSeed} accent={accent} rarity={card.rarity} lat={card.lat} />
          </div>
          <div class="qsl-front-bottom">
            <span class="qsl-station-name">{card.stationName}</span>
            {card.frequency && <span class="qsl-freq">{card.frequency}</span>}
            <span class="qsl-place">
              {card.city}
              {card.city !== card.country && <> — {card.country}</>}
            </span>
          </div>
          {frontOverlay}
        </div>

        {/* ── Verso ── */}
        <div class="qsl-face qsl-back">
          <div class="qsl-back-left">
            <p class="qsl-message" lang={card.message.lang} dir={RTL.has(card.message.lang) ? 'rtl' : 'auto'}>
              « {card.message.text} »
            </p>
            <p class="qsl-73">73 !</p>
            <dl class="qsl-data">
              <dt>{t.qsl.station}</dt>
              <dd>{card.stationName}</dd>
              <dt>{t.qsl.location}</dt>
              <dd>
                {card.city}, {card.country}
              </dd>
              <dt>{t.qsl.coords}</dt>
              <dd>
                {formatCoord(card.lat, 'N', 'S')} · {formatCoord(card.lon, 'E', 'O')}
              </dd>
              {card.frequency && (
                <>
                  <dt>{t.qsl.frequency}</dt>
                  <dd>{card.frequency}</dd>
                </>
              )}
              <dt>{t.qsl.report}</dt>
              <dd>{formatKm(card.distanceKm)}</dd>
              <dt>{t.qsl.date}</dt>
              <dd>{formatDate(card.capturedAt)}</dd>
            </dl>
          </div>
          <div class="qsl-back-right">
            <div class="qsl-stamp" aria-hidden="true">
              <span class="qsl-stamp-cc">{card.countryCode}</span>
              <span class="qsl-stamp-call">{card.callsign.split(' ')[0]}</span>
            </div>
            <div class="qsl-sinpo" style={{ transform: `rotate(${rot - 8}deg)` }}>
              <span class="qsl-sinpo-label">SINPO</span>
              <span class="qsl-sinpo-code">{card.sinpo}</span>
              <span class="qsl-sinpo-label">QSL</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
