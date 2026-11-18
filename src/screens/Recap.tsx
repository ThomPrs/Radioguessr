// Récapitulatif de fin de partie : les 5 manches sur une carte, score total.

import { countryNameFr } from '../../shared/countries';
import { MAX_ROUND_SCORE, ROUNDS_PER_GAME } from '../../shared/scoring';
import { goHome, startWorldGame } from '../app';
import { MapView } from '../components/MapView';
import { formatInt, formatKm } from '../format';
import type { SoloGame } from '../game/solo';
import { t } from '../i18n/fr';

export function Recap({ game }: { game: SoloGame }) {
  const rounds = game.game.value.rounds;
  const total = game.totalScore.value;
  const max = MAX_ROUND_SCORE * ROUNDS_PER_GAME;
  const verdict = t.recap.verdicts.find(([min]) => total >= min)?.[1] ?? '';

  return (
    <main class="game-layout">
      <section class="game-panel">
        <h1 class="recap-title">{t.recap.title}</h1>
        <p class="recap-total">
          <span class="recap-total-value">{formatInt(total)}</span>{' '}
          <span class="recap-total-max">{t.recap.outOf(formatInt(max))}</span>
        </p>
        <p class="recap-verdict">{verdict}</p>

        <ol class="recap-list">
          {rounds.map((r) => (
            <li key={r.index}>
              <span class="recap-num">{r.index + 1}</span>
              <span class="recap-place">
                <strong>{countryNameFr(r.station.countryCode)}</strong>
                <small>{r.station.name}</small>
              </span>
              <span class="recap-dist">{r.distanceKm != null ? formatKm(r.distanceKm) : '—'}</span>
              <span class="recap-score">{formatInt(r.score)}</span>
            </li>
          ))}
        </ol>

        <div class="recap-actions">
          <button class="primary-action" onClick={startWorldGame}>
            {t.recap.playAgain}
          </button>
          <button onClick={goHome}>{t.recap.home}</button>
        </div>
      </section>

      <section class="game-map">
        <MapView
          onReady={(m) => m.showSummary(rounds.map((r) => ({ station: r.station, guess: r.guess })))}
        />
      </section>
    </main>
  );
}
