// Salon de duel : attente, compte à rebours, manches synchronisées, résultats.

import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { countryNameFr } from '../../shared/countries';
import { DUEL_ROUNDS, ROUND_TIME_MS, type DuelEntry, type RoomView } from '../../shared/duel';
import { shortStationName } from '../../shared/qsl';
import { HINT_COST, hintsCost } from '../../shared/scoring';
import type { HintKind } from '../../shared/types';
import { clickSound, pinSound, stampSound } from '../audio/sfx';
import { goHome, openDuelLobby } from '../app';
import { EnvelopeReveal } from '../components/EnvelopeReveal';
import { MapView } from '../components/MapView';
import { RadioControls } from '../components/RadioControls';
import { RadioSet } from '../components/RadioSet';
import { forgetIdentity } from '../duel/client';
import type { DuelSession, RoundCard } from '../duel/session';
import { formatInt, formatKm } from '../format';
import { t } from '../i18n/fr';
import type { InkMap } from '../map/ink-map';
import { QslCardView } from '../qsl/QslCardView';

const HINT_ORDER: HintKind[] = ['language', 'continent', 'timezone'];

export function DuelRoom({ session }: { session: DuelSession }) {
  useEffect(() => {
    session.start();
    return () => session.stop();
  }, [session]);

  const v = session.view.value;
  const conn = session.connection.value;

  if (conn === 'expired' || conn === 'forbidden') {
    return (
      <main class="desk sheet-page">
        <div class="sheet">
          <h1>{t.duel.title}</h1>
          <p>{conn === 'expired' ? t.duel.expired : t.duel.errors.forbidden}</p>
          <button onClick={openDuelLobby}>{t.duel.rematch}</button> <button onClick={goHome}>{t.duel.back}</button>
        </div>
      </main>
    );
  }
  if (!v) {
    return (
      <main class="desk sheet-page">
        <p class="desk-note">{conn === 'retrying' ? t.duel.retrying : t.duel.joining}</p>
      </main>
    );
  }
  if (v.status === 'waiting') return <Waiting session={session} view={v} />;
  if (v.status === 'countdown') return <Countdown session={session} view={v} />;
  if (v.status === 'finished') return <Results session={session} view={v} />;
  return <Playing session={session} view={v} />;
}

// ── Attente ────────────────────────────────────────────────────────────────

function Waiting({ session, view }: { session: DuelSession; view: RoomView }) {
  const [copied, setCopied] = useState(false);
  const link = `${location.origin}/?duel=${view.code}`;
  return (
    <main class="desk sheet-page">
      <div class="sheet duel-waiting">
        <h1>{t.duel.waitingTitle}</h1>
        <p>{t.duel.shareCode}</p>
        <p class="room-code" aria-label={view.code.split('').join(' ')}>
          {view.code}
        </p>
        <button
          onClick={() => {
            void navigator.clipboard?.writeText(link).then(() => setCopied(true));
          }}
        >
          {copied ? t.duel.copied : t.duel.copyLink}
        </button>
        <p class="duel-waiting-note">
          <span class="dot-pulse" aria-hidden="true" /> {t.duel.waitingFor}
        </p>
        {session.connection.value === 'retrying' && <p class="form-error">{t.duel.retrying}</p>}
        <button
          class="link-button"
          onClick={() => {
            void session.leave();
            goHome();
          }}
        >
          {t.duel.cancel}
        </button>
      </div>
    </main>
  );
}

// ── Compte à rebours ───────────────────────────────────────────────────────

function Countdown({ session, view }: { session: DuelSession; view: RoomView }) {
  const left = Math.ceil(session.remaining(view.startAt) / 1000);
  return (
    <main class="desk sheet-page">
      <div class="sheet duel-countdown">
        <h1>{t.duel.vs(view.me.name, view.opponent?.name ?? '?')}</h1>
        <p class="countdown-number" key={left}>
          {Math.max(left, 1)}
        </p>
        <p>{t.duel.startsIn(Math.max(left, 1))}</p>
      </div>
    </main>
  );
}

// ── Manche ─────────────────────────────────────────────────────────────────

function Playing({ session, view }: { session: DuelSession; view: RoomView }) {
  const map = useRef<InkMap | null>(null);
  const revealedRound = useRef<number | null>(null);
  const shownEnvelope = useRef(new Set<number>());
  const [envelope, setEnvelope] = useState<{ index: number; rc: RoundCard } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const r = view.round!;
  const opp = view.opponent;
  const oppName = opp?.name ?? '?';
  const radio = session.radio.value;
  const pending = session.pending.value;
  const listening = r.phase === 'listening';
  const canPin = listening && !r.you.guessed;

  // Synchronisation de la carte avec la manche (immédiate : pas d'attente d'une image à l'écran).
  useLayoutEffect(() => {
    const m = map.current;
    if (!m) return;
    if (listening) {
      if (revealedRound.current !== null && revealedRound.current !== r.index) m.reset();
      revealedRound.current = null;
      m.setPinnable(canPin);
      if (r.you.entry?.lat != null) m.setPin({ lat: r.you.entry.lat, lon: r.you.entry.lon! });
    } else if (r.station && revealedRound.current !== r.index) {
      revealedRound.current = r.index;
      const mine = r.you.entry?.lat != null ? { lat: r.you.entry.lat, lon: r.you.entry.lon! } : null;
      const theirs = r.opponent.entry?.lat != null ? { lat: r.opponent.entry.lat, lon: r.opponent.entry.lon! } : null;
      m.revealDuel(r.station, mine, theirs);
      stampSound();
    }
  }, [r.index, r.phase, canPin, r.candidate, mapReady]);

  // Enveloppe quand une nouvelle carte arrive.
  const rc = session.cards.value[r.index];
  useEffect(() => {
    if (!listening && rc && (rc.outcome === 'new' || rc.outcome === 'upgraded') && !shownEnvelope.current.has(r.index)) {
      shownEnvelope.current.add(r.index);
      const timer = setTimeout(() => setEnvelope({ index: r.index, rc }), 1400);
      return () => clearTimeout(timer);
    }
  }, [rc, listening, r.index]);

  const secondsLeft = Math.ceil(session.remaining(r.deadline) / 1000);
  const progress = Math.min(1, session.remaining(r.deadline) / ROUND_TIME_MS);
  const nextIn = Math.ceil(session.remaining(r.nextAt) / 1000);

  const radioLabel = radio === 'tuning' ? t.radio.searching : r.station ? shortStationName(r.station.name, 22) : t.radio.unknownStation;

  function quit() {
    if (window.confirm(t.duel.quitConfirm)) {
      void session.leave();
      goHome();
    }
  }

  return (
    <main class="desk game-layout duel-layout">
      <section class="game-panel">
        <header class="game-header">
          <span class="game-round tag">{t.round.label(r.index + 1, DUEL_ROUNDS)}</span>
          <span class="duel-score">
            <strong>{formatInt(view.totals.you)}</strong> · {formatInt(view.totals.opponent)}
          </span>
          <button class="link-button on-desk" onClick={quit}>
            {t.duel.quit}
          </button>
        </header>

        <RadioSet state={radio === 'tuning' ? 'tuning' : radio === 'on' ? 'on' : 'off'} dial={radio === 'on' ? ((r.index * 37 + r.candidate * 13) % 90) / 100 + 0.05 : null} label={radioLabel} />
        <RadioControls canPause={radio === 'on'} />

        {radio === 'blocked' && (
          <button class="stamp-button" onClick={() => session.retune()}>
            {t.duel.tapToListen}
          </button>
        )}
        {radio === 'dead' && listening && <p class="desk-note">{t.duel.deadRadio}</p>}
        {session.connection.value === 'retrying' && <p class="form-error on-desk">{t.duel.retrying}</p>}

        {listening && (
          <div class="duel-timer" role="timer" aria-label={t.duel.timeLeft(secondsLeft)}>
            <div class="duel-timer-bar" style={{ transform: `scaleX(${progress})` }} />
            <span>{t.duel.timeLeft(secondsLeft)}</span>
          </div>
        )}

        {opp && (
          <p class={`opponent-chip${opp.gone ? ' is-gone' : !opp.connected ? ' is-offline' : r.opponent.guessed ? ' is-done' : ''}`}>
            {opp.gone
              ? t.duel.opponentGone(oppName)
              : !opp.connected
                ? t.duel.opponentOffline(oppName)
                : r.opponent.guessed && listening
                  ? t.duel.opponentDone(oppName)
                  : listening
                    ? t.duel.opponentThinking(oppName)
                    : r.opponent.ready
                      ? `${oppName} ✓`
                      : oppName}
          </p>
        )}

        {listening && (
          <div class="hint-cards" role="group" aria-label={t.hints.title}>
            {HINT_ORDER.map((kind, i) => {
              const value = r.you.hintValues[kind];
              return (
                <button
                  key={kind}
                  class={`hint-card${value ? ' is-used' : ''}`}
                  style={{ '--tilt': `${(i - 1) * 1.2}deg` } as Record<string, string>}
                  disabled={!canPin || !!value || session.busy.value}
                  onClick={() => {
                    clickSound();
                    void session.hint(kind);
                  }}
                >
                  <span class="hint-label">{t.hints[kind]}</span>
                  {value ? (
                    <span class="hint-used">
                      <span class="hint-value">{value}</span>
                      <span class="hint-paid">{t.hints.paid(formatInt(HINT_COST[kind]))}</span>
                    </span>
                  ) : (
                    <span class="hint-cost">{t.hints.cost(HINT_COST[kind])}</span>
                  )}
                </button>
              );
            })}
            {r.you.hints.length > 0 && <p class="hint-total">{t.hints.totalCost(formatInt(hintsCost(r.you.hints)))}</p>}
          </div>
        )}

        {listening && !r.you.guessed && (
          <button class="stamp-button" disabled={!pending || session.busy.value} onClick={() => void session.submit()}>
            {t.round.submit}
          </button>
        )}
        {listening && r.you.guessed && <p class="desk-note">{t.duel.sent}</p>}

        {!listening && r.station && (
          <article class="report-slip duel-slip">
            <h2 class="report-title">{t.round.report}</h2>
            <p class="duel-slip-station">
              <strong>{shortStationName(r.station.name, 40)}</strong>
              <br />
              {[r.station.state, countryNameFr(r.station.countryCode)].filter(Boolean).join(', ')}
            </p>
            <table class="duel-compare">
              <tbody>
                <EntryRow who={t.duel.you} entry={r.you.entry} mine />
                <EntryRow who={oppName} entry={r.opponent.entry} />
              </tbody>
            </table>
            {rc ? (
              <div class="report-card">
                <p class={`report-qsl is-${rc.outcome}`}>{t.qsl.received[rc.outcome]}</p>
                <QslCardView card={rc.card} />
              </div>
            ) : (
              <p class="report-qsl-none">{t.qsl.none}</p>
            )}
          </article>
        )}

        {!listening && (
          <>
            <button
              class="primary-action"
              disabled={r.you.ready || session.busy.value}
              onClick={() => {
                clickSound();
                void session.ready();
              }}
            >
              {r.you.ready ? t.duel.waitingReady(oppName) : t.duel.ready}
            </button>
            <p class="desk-note">{t.duel.nextIn(nextIn)}</p>
          </>
        )}
      </section>

      <section class="game-map map-sheet">
        <MapView
          onReady={(m) => {
            map.current = m;
            setMapReady(true);
          }}
          onPin={(p) => {
            const cur = session.view.peek()?.round;
            if (cur?.phase !== 'listening' || cur.you.guessed) return;
            pinSound();
            session.setPin(p.lat, p.lon);
          }}
        />
      </section>

      {envelope && (envelope.rc.outcome === 'new' || envelope.rc.outcome === 'upgraded') && (
        <EnvelopeReveal card={envelope.rc.card} outcome={envelope.rc.outcome} onClose={() => setEnvelope(null)} />
      )}
    </main>
  );
}

function EntryRow({ who, entry, mine = false }: { who: string; entry: DuelEntry | null; mine?: boolean }) {
  return (
    <tr class={mine ? 'is-mine' : 'is-theirs'}>
      <th scope="row">
        <span class={`pin-dot ${mine ? 'red' : 'blue'}`} aria-hidden="true" /> {who}
      </th>
      <td>{entry?.distanceKm != null ? formatKm(entry.distanceKm) : t.duel.noAnswer}</td>
      <td class="duel-pts">
        {formatInt(entry?.score ?? 0)}
        {entry && entry.hints.length > 0 && <small class="duel-hint-cost">{t.round.hintsShort(formatInt(hintsCost(entry.hints)))}</small>}
      </td>
    </tr>
  );
}

// ── Résultats ──────────────────────────────────────────────────────────────

function Results({ session, view }: { session: DuelSession; view: RoomView }) {
  const { you, opponent } = view.totals;
  const verdict = you > opponent ? t.duel.won : you < opponent ? t.duel.lost : t.duel.draw;
  const oppName = view.opponent?.name ?? '?';
  const cards = Object.values(session.cards.value).filter((c) => c.outcome !== 'kept');

  return (
    <main class="desk game-layout">
      <section class="game-panel paper recap-sheet">
        <h1 class="recap-title">{t.duel.resultsTitle}</h1>
        <p class={`duel-verdict ${you > opponent ? 'is-won' : you < opponent ? 'is-lost' : ''}`}>{verdict}</p>
        <table class="duel-results">
          <thead>
            <tr>
              <th />
              <th>{t.duel.you}</th>
              <th>{oppName}</th>
            </tr>
          </thead>
          <tbody>
            {view.history.map((h) => {
              const a = h.you?.score ?? 0;
              const b = h.opponent?.score ?? 0;
              return (
                <tr key={h.index}>
                  <th scope="row">
                    {t.duel.round(h.index + 1)}
                    <small>{countryNameFr(h.station.countryCode)}</small>
                  </th>
                  <td class={a > b ? 'is-best' : ''}>
                    {formatInt(a)}
                    <small>{h.you?.distanceKm != null ? formatKm(h.you.distanceKm) : '—'}</small>
                  </td>
                  <td class={b > a ? 'is-best' : ''}>
                    {formatInt(b)}
                    <small>{h.opponent?.distanceKm != null ? formatKm(h.opponent.distanceKm) : '—'}</small>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th>{t.round.total}</th>
              <td>{formatInt(you)}</td>
              <td>{formatInt(opponent)}</td>
            </tr>
          </tfoot>
        </table>

        <h2 class="recap-subtitle">{t.recap.cards}</h2>
        {cards.length ? (
          <div class="recap-cards">
            {cards.map((c) => (
              <QslCardView key={c.card.countryCode} card={c.card} />
            ))}
          </div>
        ) : (
          <p>{t.recap.noCards}</p>
        )}

        <div class="recap-actions">
          <button
            class="primary-action"
            onClick={() => {
              forgetIdentity(view.code);
              openDuelLobby();
            }}
          >
            {t.duel.rematch}
          </button>
          <button
            onClick={() => {
              forgetIdentity(view.code);
              goHome();
            }}
          >
            {t.recap.home}
          </button>
        </div>
      </section>
      <section class="game-map map-sheet">
        <MapView
          onReady={(m) =>
            m.showSummary(view.history.map((h) => ({ station: h.station, guess: h.you?.lat != null ? { lat: h.you.lat, lon: h.you.lon! } : null })))
          }
        />
      </section>
    </main>
  );
}
