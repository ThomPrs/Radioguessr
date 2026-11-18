// Écran de partie : bureau vu de dessus, poste radio, fiches d'indices, carte, rapport d'écoute.

import { useEffect, useRef, useState } from 'preact/hooks';
import { countryNameFr } from '../../shared/countries';
import { localTimeLabel, utcOffsetLabel } from '../../shared/hints';
import { shortStationName } from '../../shared/qsl';
import { HINT_COST, ROUNDS_PER_GAME, hintsCost } from '../../shared/scoring';
import type { HintKind, Round } from '../../shared/types';
import { clickSound, pinSound, typeBell } from '../audio/sfx';
import { goHome, showRecap } from '../app';
import { AudioToggle } from '../components/AudioToggle';
import { EnvelopeReveal } from '../components/EnvelopeReveal';
import { MapView } from '../components/MapView';
import { RadioSet } from '../components/RadioSet';
import { Typewriter } from '../components/Typewriter';
import { formatInt, formatKm } from '../format';
import type { SoloGame } from '../game/solo';
import { t } from '../i18n/fr';
import type { InkMap } from '../map/ink-map';
import { QslCardView } from '../qsl/QslCardView';
import { motionDelay } from '../state/prefs';

const HINT_ORDER: HintKind[] = ['language', 'continent', 'timezone'];

export function GameScreen({ game }: { game: SoloGame }) {
  const map = useRef<InkMap | null>(null);
  const [envelopeFor, setEnvelopeFor] = useState<Round | null>(null);
  const phase = game.phase.value;
  const guess = game.guess.value;
  const hints = game.hints.value;
  const used = game.usedHints.value;
  const round = game.lastRound.value;
  const index = game.roundIndex.value;

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (phase === 'tuning') m.reset();
    m.setPinnable(phase === 'listening');
  }, [phase]);

  useEffect(() => () => game.dispose(), [game]);

  async function submit() {
    const r = game.submit();
    if (!r?.guess) return;
    map.current?.reveal(r.station, r.guess);
    if (r.card && (r.qsl === 'new' || r.qsl === 'upgraded')) {
      await motionDelay(1400); // laisse le temps de voir l'arc sur la carte
      setEnvelopeFor(r);
    }
  }

  function next() {
    clickSound();
    const last = game.isLastRound;
    void game.next();
    if (last) showRecap(game);
  }

  function quit() {
    if (phase === 'revealed' || window.confirm(t.round.quitConfirm)) goHome();
  }

  function hintValue(kind: HintKind): string {
    if (!hints) return '';
    if (kind === 'language') return hints.language ?? t.hints.unknown;
    if (kind === 'continent') return hints.continent;
    if (!hints.timezone) return t.hints.unknown;
    return `${utcOffsetLabel(hints.timezone)} · ${t.hints.localTime(localTimeLabel(hints.timezone))}`;
  }

  const radioState = phase === 'tuning' ? 'tuning' : phase === 'error' ? 'off' : 'on';
  const radioLabel =
    phase === 'tuning'
      ? t.radio.searching
      : phase === 'revealed' && round
        ? shortStationName(round.station.name, 22)
        : phase === 'error'
          ? '—'
          : t.radio.unknownStation;

  return (
    <main class="desk game-layout">
      <section class="game-panel">
        <header class="game-header">
          <span class="game-round tag">{t.round.label(index + 1, ROUNDS_PER_GAME)}</span>
          <span class="game-total">
            {t.round.total} <strong>{formatInt(game.totalScore.value)}</strong>
          </span>
          <AudioToggle />
          <button class="link-button on-desk" onClick={quit}>
            {t.round.quit}
          </button>
        </header>

        <RadioSet state={radioState} dial={game.dial.value} label={radioLabel} />

        <p class="desk-note" aria-live="polite">
          {phase === 'tuning' && t.radio.searchingLong}
          {phase === 'listening' && (guess ? t.map.movePin : t.map.placePin)}
          {phase === 'error' && (
            <>
              {game.error.value === 'no-station' ? t.radio.noStation : t.radio.unreachable}{' '}
              <button class="small-button" onClick={() => void game.retry()}>
                {t.radio.retry}
              </button>
            </>
          )}
        </p>

        {(phase === 'listening' || phase === 'revealed') && (
          <div class="hint-cards" role="group" aria-label={t.hints.title}>
            {HINT_ORDER.map((kind, i) => {
              const isUsed = used.includes(kind);
              const unavailable = (kind === 'language' && !hints?.language) || (kind === 'timezone' && !hints?.timezone);
              return (
                <button
                  key={kind}
                  class={`hint-card${isUsed ? ' is-used' : ''}`}
                  style={{ '--tilt': `${(i - 1) * 1.2}deg` } as Record<string, string>}
                  disabled={phase !== 'listening' || isUsed || unavailable}
                  onClick={() => {
                    clickSound();
                    game.useHint(kind);
                  }}
                >
                  <span class="hint-label">{t.hints[kind]}</span>
                  {isUsed ? (
                    <Typewriter class="hint-value" text={hintValue(kind)} speed={28} />
                  ) : (
                    <span class="hint-cost">{unavailable ? t.hints.unknown : t.hints.cost(HINT_COST[kind])}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {phase === 'listening' && (
          <button class="stamp-button" onClick={() => void submit()} disabled={!guess}>
            {t.round.submit}
          </button>
        )}

        {phase === 'revealed' && round && <ReportSlip round={round} />}

        {phase === 'revealed' && round && (
          <button class="primary-action" onClick={next}>
            {game.isLastRound ? t.round.finish : t.round.next}
          </button>
        )}
      </section>

      <section class="game-map map-sheet">
        <MapView
          onReady={(m) => {
            map.current = m;
            m.setPinnable(game.phase.peek() === 'listening');
          }}
          onPin={(p) => {
            if (game.phase.peek() !== 'listening') return;
            pinSound();
            game.setGuess(p);
          }}
        />
      </section>

      {envelopeFor?.card && (envelopeFor.qsl === 'new' || envelopeFor.qsl === 'upgraded') && (
        <EnvelopeReveal card={envelopeFor.card} outcome={envelopeFor.qsl} onClose={() => setEnvelopeFor(null)} />
      )}
    </main>
  );
}

/** Fiche « rapport d'écoute » tapée à la machine après la révélation. */
function ReportSlip({ round }: { round: Round }) {
  const lines: [string, string][] = [
    [t.round.stationWas, shortStationName(round.station.name, 40)],
    [t.qsl.location, [round.station.state, countryNameFr(round.station.countryCode)].filter(Boolean).join(', ')],
    [t.round.distance, round.distanceKm != null ? formatKm(round.distanceKm) : '—'],
  ];
  if (round.hints.length > 0) lines.push([t.round.hintsPenalty, `−${formatInt(hintsCost(round.hints))}`]);

  // Chaque ligne commence quand la précédente est finie (≈ 30 ms par caractère).
  let delay = 200;
  const delays = lines.map(([, v]) => {
    const d = delay;
    delay += v.length * 30 + 150;
    return d;
  });

  return (
    <article class="report-slip" key={round.index}>
      <h2 class="report-title">{t.round.report}</h2>
      <dl>
        {lines.map(([label, value], i) => (
          <div key={label} class="report-line">
            <dt>{label}</dt>
            <dd>
              <Typewriter text={value} delay={delays[i]} speed={30} />
            </dd>
          </div>
        ))}
      </dl>
      <p class="report-points">
        <Typewriter text={`${formatInt(round.score)} pts`} delay={delay} speed={60} onDone={typeBell} />
      </p>
      {round.card && round.qsl ? (
        <div class="report-card">
          <p class={`report-qsl is-${round.qsl}`}>{t.qsl.received[round.qsl]}</p>
          <QslCardView card={round.card} />
        </div>
      ) : (
        <p class="report-qsl-none">{t.qsl.none}</p>
      )}
    </article>
  );
}
