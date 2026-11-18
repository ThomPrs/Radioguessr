// Écran provisoire du jalon 2 : une manche complète (écoute → punaise → rapport → révélation).

import { useRef, useState } from 'preact/hooks';
import { haversineKm, roundScore, type LatLon } from '../../shared/scoring';
import type { Station } from '../../shared/types';
import { RadioPlayer } from '../audio/radio';
import { MapView } from '../components/MapView';
import { formatInt, formatKm } from '../format';
import { StationPool } from '../game/station-pool';
import { t } from '../i18n/fr';
import type { InkMap } from '../map/ink-map';

type Phase = 'off' | 'searching' | 'listening' | 'revealed' | 'error';

interface Result {
  distanceKm: number;
  score: number;
}

export function RoundTest() {
  const player = useRef<RadioPlayer | null>(null);
  const pool = useRef<StationPool | null>(null);
  const map = useRef<InkMap | null>(null);
  const [phase, setPhase] = useState<Phase>('off');
  const [station, setStation] = useState<Station | null>(null);
  const [guess, setGuess] = useState<LatLon | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');

  async function tune() {
    player.current ??= new RadioPlayer();
    pool.current ??= new StationPool();
    map.current?.reset();
    map.current?.setPinnable(true);
    setPhase('searching');
    setStation(null);
    setGuess(null);
    setResult(null);
    try {
      const s = await pool.current.tuneNext(player.current);
      setStation(s);
      setPhase('listening');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setPhase('error');
      setError(err instanceof Error && err.message === 'no-station' ? t.radio.noStation : t.radio.unreachable);
    }
  }

  function submit() {
    if (!station || !guess) return;
    const distanceKm = haversineKm(guess, station);
    setResult({ distanceKm, score: roundScore(distanceKm, []).score });
    map.current?.reveal(station, guess);
    setPhase('revealed');
  }

  return (
    <main class="round-layout">
      <section class="round-panel">
        <h1>{t.debug.title}</h1>

        <div class="bench-row">
          {(phase === 'off' || phase === 'error') && <button onClick={tune}>{t.radio.powerOn}</button>}
          {phase === 'revealed' && <button onClick={tune}>{t.round.next}</button>}
          {phase === 'listening' && (
            <button onClick={submit} disabled={!guess}>
              {t.round.submit}
            </button>
          )}
        </div>

        <p class="bench-status">
          {phase === 'searching' && t.radio.searching}
          {phase === 'listening' && (guess ? t.map.movePin : t.map.placePin)}
          {phase === 'error' && error}
        </p>

        {phase === 'revealed' && station && result && (
          <dl class="round-result">
            <dt>{t.round.stationWas}</dt>
            <dd>
              {station.name} — {station.state ? `${station.state}, ` : ''}
              {station.country}
            </dd>
            <dt>{t.round.distance}</dt>
            <dd>{formatKm(result.distanceKm)}</dd>
            <dt>{t.round.points}</dt>
            <dd class="round-points">{formatInt(result.score)}</dd>
          </dl>
        )}
      </section>

      <section class="round-map">
        <MapView
          onReady={(m) => {
            map.current = m;
            m.setPinnable(false);
          }}
          onPin={(p) => {
            if (phase === 'listening' || phase === 'searching') setGuess(p);
          }}
        />
      </section>
    </main>
  );
}
