// Salon multijoueur : attente (joueurs + chat), compte à rebours, manches synchronisées, résultats.

import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { countryNameFr } from '../../shared/countries';
import {
  DUEL_ROUNDS,
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  PLAYER_COLORS,
  ROUND_TIME_MS,
  rankPlayers,
  type DuelEntry,
  type PlayerView,
  type RoomView,
} from '../../shared/duel';
import { shortStationName } from '../../shared/qsl';
import { HINT_COST, hintsCost } from '../../shared/scoring';
import type { HintKind } from '../../shared/types';
import { clickSound, pinSound, stampSound } from '../audio/sfx';
import { goHome, openDuelLobby } from '../app';
import { ChatPanel } from '../components/ChatPanel';
import { KraftEnvelope } from '../components/KraftEnvelope';
import { PinBadge } from '../pins/PinBadge';
import { AvatarView } from '../profile/Avatar';
import { EnvelopeReveal } from '../components/EnvelopeReveal';
import { MapView } from '../components/MapView';
import { PlayerList } from '../components/PlayerList';
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

const nameOf = (view: RoomView, pid: string) => view.players.find((p) => p.id === pid)?.name ?? '?';

// ── Attente ────────────────────────────────────────────────────────────────

function Waiting({ session, view }: { session: DuelSession; view: RoomView }) {
  const [copied, setCopied] = useState(false);
  const link = `${location.origin}/?duel=${view.code}`;
  const isHost = view.hostId === view.youId;
  const present = view.players.filter((p) => !p.gone).length;
  const canStart = present >= MIN_PLAYERS_TO_START;

  return (
    <main class="desk sheet-page">
      <div class="waiting-layout">
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

          <h2 class="waiting-subtitle">{t.duel.players(view.players.length, MAX_PLAYERS)}</h2>
          <PlayerList players={view.players} youId={view.youId} phase="waiting" />

          {isHost ? (
            <>
              <button
                class="stamp-button"
                disabled={!canStart || session.busy.value}
                onClick={() => {
                  clickSound();
                  void session.startGame();
                }}
              >
                {t.duel.launch}
              </button>
              {!canStart && <p class="duel-waiting-note">{t.duel.needTwo}</p>}
            </>
          ) : (
            <p class="duel-waiting-note">
              <span class="dot-pulse" aria-hidden="true" /> {t.duel.waitingHost(nameOf(view, view.hostId))}
            </p>
          )}
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
        <ChatPanel session={session} />
      </div>
    </main>
  );
}

// ── Compte à rebours ───────────────────────────────────────────────────────

function Countdown({ session, view }: { session: DuelSession; view: RoomView }) {
  const left = Math.max(1, Math.ceil(session.remaining(view.startAt) / 1000));
  return (
    <main class="desk sheet-page">
      <div class="sheet duel-countdown">
        <h1>{view.players.filter((p) => !p.gone).map((p) => p.name).join(' · ')}</h1>
        <p class="countdown-number" key={left}>
          {left}
        </p>
        <p>{t.duel.startsIn(left)}</p>
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
  const me = view.players.find((p) => p.id === view.youId);
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
    } else if (r.station && r.entries && revealedRound.current !== r.index) {
      revealedRound.current = r.index;
      m.revealMulti(
        r.station,
        view.players.map((p) => {
          const e = r.entries![p.id];
          return { pos: e?.lat != null ? { lat: e.lat, lon: e.lon! } : null, color: PLAYER_COLORS[p.color]!, label: p.name };
        }),
      );
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
            {t.round.total} <strong>{formatInt(me?.total ?? 0)}</strong>
          </span>
          <button class="link-button on-desk" onClick={quit}>
            {t.duel.quit}
          </button>
        </header>

        <RadioSet
          state={radio === 'tuning' ? 'tuning' : radio === 'on' ? 'on' : 'off'}
          dial={radio === 'on' ? ((r.index * 37 + r.candidate * 13) % 90) / 100 + 0.05 : null}
          label={radioLabel}
        />
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

        <div class="paper players-sheet">
          <PlayerList players={view.players} youId={view.youId} phase={listening ? 'listening' : 'revealed'} />
        </div>

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

        {!listening && r.station && r.entries && (
          <article class="report-slip duel-slip">
            <h2 class="report-title">{t.round.report}</h2>
            <p class="duel-slip-station">
              <strong>{shortStationName(r.station.name, 40)}</strong>
              <br />
              {[r.station.state, countryNameFr(r.station.countryCode)].filter(Boolean).join(', ')}
            </p>
            <RoundTable players={view.players} entries={r.entries} youId={view.youId} />
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
              {r.you.ready ? t.duel.waitingReady : t.duel.ready}
            </button>
            <p class="desk-note">{t.duel.nextIn(nextIn)}</p>
          </>
        )}

        <ChatPanel session={session} />
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

/** Rapports de la manche, du meilleur au moins bon. */
function RoundTable({ players, entries, youId }: { players: PlayerView[]; entries: Record<string, DuelEntry | null>; youId: string }) {
  const rows = players
    .map((p) => ({ p, e: entries[p.id] ?? null }))
    .sort((a, b) => (b.e?.score ?? 0) - (a.e?.score ?? 0));
  return (
    <table class="duel-compare">
      <tbody>
        {rows.map(({ p, e }) => (
          <tr key={p.id} class={p.id === youId ? 'is-mine' : ''}>
            <th scope="row">
              <span class="pin-dot" style={{ background: PLAYER_COLORS[p.color] }} aria-hidden="true" /> {p.id === youId ? t.duel.you : p.name}
            </th>
            <td>{e?.distanceKm != null ? formatKm(e.distanceKm) : t.duel.noAnswer}</td>
            <td class="duel-pts" style={{ color: PLAYER_COLORS[p.color] }}>
              {formatInt(e?.score ?? 0)}
              {e && e.hints.length > 0 && <small class="duel-hint-cost">{t.round.hintsShort(formatInt(hintsCost(e.hints)))}</small>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Résultats ──────────────────────────────────────────────────────────────

function Results({ session, view }: { session: DuelSession; view: RoomView }) {
  const ranking = rankPlayers(view.players);
  const myRank = ranking.find((r) => r.player.id === view.youId)?.rank ?? 0;
  const firsts = ranking.filter((r) => r.rank === 1).length;
  const verdict = myRank !== 1 ? t.duel.lost : firsts > 1 ? t.duel.draw : t.duel.won;
  const cards = Object.values(session.cards.value).filter((c) => c.outcome !== 'kept');
  const prize = session.prize.value;
  const [prizeOpen, setPrizeOpen] = useState(true);

  const leave = (then: () => void) => () => {
    forgetIdentity(view.code);
    then();
  };

  return (
    <main class="desk game-layout duel-layout">
      <section class="game-panel">
        <div class="paper recap-sheet">
          <h1 class="recap-title">{t.duel.resultsTitle}</h1>
          <p class={`duel-verdict ${myRank === 1 ? 'is-won' : 'is-lost'}`}>{verdict}</p>

          <ol class="ranking">
            {ranking.map(({ player, rank }) => (
              <li key={player.id} class={`ranking-row rank-${Math.min(rank, 4)}${player.id === view.youId ? ' is-mine' : ''}`}>
                <span class="ranking-rank">{t.duel.rank(rank)}</span>
                <span class="player-avatar" style={{ borderColor: PLAYER_COLORS[player.color] }}>
                  <AvatarView avatar={player.avatar} size={34} title={player.name} />
                </span>
                <span class="ranking-name">
                  {player.name}
                  {player.id === view.youId && <em class="player-tag"> ({t.duel.youTag})</em>}
                </span>
                {player.pin && <PinBadge id={player.pin} size={26} />}
                <span class="ranking-total">{formatInt(player.total)}</span>
              </li>
            ))}
          </ol>

          <table class="duel-results">
            <thead>
              <tr>
                <th />
                <th>{t.duel.you}</th>
                <th>{t.duel.roundBest}</th>
              </tr>
            </thead>
            <tbody>
              {view.history.map((h) => {
                const mine = h.entries[view.youId]?.score ?? 0;
                const best = Object.entries(h.entries).reduce<[string, number]>(
                  (acc, [pid, e]) => ((e?.score ?? 0) > acc[1] ? [pid, e?.score ?? 0] : acc),
                  ['', -1],
                );
                return (
                  <tr key={h.index}>
                    <th scope="row">
                      {t.duel.round(h.index + 1)}
                      <small>{countryNameFr(h.station.countryCode)}</small>
                    </th>
                    <td class={mine >= best[1] ? 'is-best' : ''}>
                      {formatInt(mine)}
                      <small>{h.entries[view.youId]?.distanceKm != null ? formatKm(h.entries[view.youId]!.distanceKm!) : '—'}</small>
                    </td>
                    <td>
                      {formatInt(Math.max(best[1], 0))}
                      <small>{best[0] ? nameOf(view, best[0]) : '—'}</small>
                    </td>
                  </tr>
                );
              })}
            </tbody>
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
            <button class="primary-action" onClick={leave(openDuelLobby)}>
              {t.duel.rematch}
            </button>
            <button onClick={leave(goHome)}>{t.recap.home}</button>
          </div>
        </div>
        <ChatPanel session={session} />
      </section>
      {prize && prizeOpen && <KraftEnvelope pin={prize.pin} count={prize.count} onClose={() => setPrizeOpen(false)} />}
      <section class="game-map map-sheet">
        <MapView
          onReady={(m) =>
            m.showSummary(
              view.history.map((h) => {
                const e = h.entries[view.youId];
                return { station: h.station, guess: e?.lat != null ? { lat: e.lat, lon: e.lon! } : null };
              }),
            )
          }
        />
      </section>
    </main>
  );
}
