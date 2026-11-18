// Écran de partie : écoute, fiches d'indices, punaise, rapport, révélation.

import { useEffect, useRef } from 'preact/hooks';
import { countryNameFr } from '../../shared/countries';
import { localTimeLabel, utcOffsetLabel } from '../../shared/hints';
import { HINT_COST, ROUNDS_PER_GAME, hintsCost } from '../../shared/scoring';
import type { HintKind } from '../../shared/types';
import { goHome, showRecap } from '../app';
import { MapView } from '../components/MapView';
import { formatInt, formatKm } from '../format';
import type { SoloGame } from '../game/solo';
import { t } from '../i18n/fr';
import type { InkMap } from '../map/ink-map';

const HINT_ORDER: HintKind[] = ['language', 'continent', 'timezone'];

export function GameScreen({ game }: { game: SoloGame }) {
  const map = useRef<InkMap | null>(null);
  const phase = game.phase.value;
  const guess = game.guess.value;
  const hints = game.hints.value;
  const used = game.usedHints.value;
  const round = game.lastRound.value;
  const index = game.roundIndex.value;

  // Synchronise la carte avec la phase de jeu.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (phase === 'tuning') m.reset();
    m.setPinnable(phase === 'listening');
  }, [phase]);

  useEffect(() => () => game.dispose(), [game]);

  function submit() {
    const r = game.submit();
    if (r?.guess) map.current?.reveal(r.station, r.guess);
  }

  function next() {
    if (game.isLastRound) {
      void game.next();
      showRecap(game);
    } else {
      void game.next();
    }
  }

  function quit() {
    if (phase === 'revealed' || window.confirm(t.round.quitConfirm)) goHome();
  }

  function hintValue(kind: HintKind): string {
    if (!hints) return '';
    if (kind === 'language') return hints.language ?? t.hints.unknown;
    if (kind === 'continent') return hints.continent;
    if (!hints.timezone) return t.hints.unknown;
    return `${utcOffsetLabel(hints.timezone)} — ${t.hints.localTime(localTimeLabel(hints.timezone))}`;
  }

  const revealed = phase === 'revealed' && round;

  return (
    <main class="game-layout">
      <section class="game-panel">
        <header class="game-header">
          <span class="game-round">{t.round.label(index + 1, ROUNDS_PER_GAME)}</span>
          <span class="game-total">
            {t.round.total} : <strong>{formatInt(game.totalScore.value)}</strong>
          </span>
          <button class="link-button" onClick={quit}>
            {t.round.quit}
          </button>
        </header>

        <div class={`radio-box radio-${phase}`} aria-live="polite">
          {phase === 'tuning' && t.radio.searching}
          {phase === 'listening' && (guess ? t.map.movePin : t.map.placePin)}
          {phase === 'revealed' && t.radio.captured}
          {phase === 'error' && (
            <>
              {game.error.value === 'no-station' ? t.radio.noStation : t.radio.unreachable}{' '}
              <button onClick={() => void game.retry()}>{t.radio.retry}</button>
            </>
          )}
        </div>

        {(phase === 'listening' || phase === 'revealed') && (
          <div class="hint-cards">
            <h2 class="hint-title">{t.hints.title}</h2>
            {HINT_ORDER.map((kind) => {
              const isUsed = used.includes(kind);
              const unavailable =
                (kind === 'language' && !hints?.language) || (kind === 'timezone' && !hints?.timezone);
              return (
                <button
                  key={kind}
                  class={`hint-card${isUsed ? ' is-used' : ''}`}
                  disabled={phase !== 'listening' || isUsed || unavailable}
                  onClick={() => game.useHint(kind)}
                >
                  <span class="hint-label">{t.hints[kind]}</span>
                  <span class="hint-value">
                    {isUsed ? hintValue(kind) : unavailable ? t.hints.unknown : t.hints.cost(HINT_COST[kind])}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {phase === 'listening' && (
          <button class="primary-action" onClick={submit} disabled={!guess}>
            {t.round.submit}
          </button>
        )}

        {revealed && (
          <div class="round-result">
            <dl>
              <dt>{t.round.stationWas}</dt>
              <dd class="round-station">{round.station.name}</dd>
              <dd>
                {round.station.state ? `${round.station.state}, ` : ''}
                {countryNameFr(round.station.countryCode)}
              </dd>
              <dt>{t.round.distance}</dt>
              <dd>{round.distanceKm != null ? formatKm(round.distanceKm) : '—'}</dd>
              {round.hints.length > 0 && (
                <>
                  <dt>{t.round.hintsPenalty}</dt>
                  <dd>−{formatInt(hintsCost(round.hints))}</dd>
                </>
              )}
              <dt>{t.round.points}</dt>
              <dd class="round-points">{formatInt(round.score)}</dd>
            </dl>
            <button class="primary-action" onClick={next}>
              {game.isLastRound ? t.round.finish : t.round.next}
            </button>
          </div>
        )}
      </section>

      <section class="game-map">
        <MapView
          onReady={(m) => {
            map.current = m;
            m.setPinnable(game.phase.peek() === 'listening');
          }}
          onPin={(p) => game.setGuess(p)}
        />
      </section>
    </main>
  );
}
