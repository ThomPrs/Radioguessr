// Breaking News : flash spécial façon téléscripteur, extrait musical, recherche de la réponse,
// révélation. Le même composant sert au solo et au multijoueur.

import { useEffect, useRef, useState } from 'preact/hooks';
import type { NewsAnswer, NewsVerdict, TrackInfo } from '../../shared/blindtest';
import { NEWS_LISTEN_MS } from '../../shared/blindtest';
import { clickSound, newsJingle, stampSound } from '../audio/sfx';
import { formatInt } from '../format';
import { t } from '../i18n/fr';
import { getNewsAudio, musicApi } from '../music/client';
import { Typewriter } from './Typewriter';

export interface NewsRow {
  id: string;
  name: string;
  color?: string;
  entry: NewsAnswer | null;
  isYou: boolean;
}

interface Props {
  phase: 'intro' | 'listen' | 'reveal';
  /** Horloge (ms) alignée sur celle du serveur en multijoueur. */
  clock: () => number;
  listenAt: number;
  deadline: number;
  nextAt?: number | null;
  trackId: number;
  /** Ma réponse (verrouillée). */
  myEntry: NewsAnswer | null;
  /** Libellé de ma réponse envoyée, avant la révélation. */
  pendingLabel?: string | null;
  /** Multijoueur : qui a déjà répondu, pendant l'écoute. */
  othersAnswered?: { name: string; answered: boolean }[];
  reveal: { answer: TrackInfo | null; rows: NewsRow[] } | null;
  onAnswer: (track: TrackInfo) => void;
  onContinue: () => void;
  continueDisabled?: boolean;
  continueLabel?: string;
}

const VERDICT_CLASS: Record<NewsVerdict, string> = { song: 'is-song', artist: 'is-artist', none: 'is-none' };

export function BreakingNews(p: Props) {
  const [, tick] = useState(0);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TrackInfo[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const started = useRef(false);

  // Horloge locale : rafraîchit le minuteur.
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);

  // Jingle au flash, extrait préchargé tout de suite (le lien expire vite : on le demande maintenant).
  useEffect(() => {
    newsJingle();
    let cancelled = false;
    void musicApi
      .preview(p.trackId)
      .then((url) => !cancelled && getNewsAudio().load(url))
      .catch(() => undefined);
    return () => {
      cancelled = true;
      getNewsAudio().stop();
    };
  }, [p.trackId]);

  // L'extrait démarre à la fin du jingle.
  useEffect(() => {
    if (p.phase === 'intro' || started.current) return;
    started.current = true;
    void getNewsAudio()
      .play()
      .then((ok) => setBlocked(!ok));
  }, [p.phase]);

  // Tampon à la révélation.
  useEffect(() => {
    if (p.phase === 'reveal') setTimeout(stampSound, 300);
  }, [p.phase]);

  // Recherche avec un délai de 300 ms après la dernière frappe.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      void musicApi
        .search(q)
        .then((r) => setResults(r))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const now = p.clock();
  const left = Math.max(0, p.deadline - now);
  const locked = p.myEntry != null || chosen != null || p.pendingLabel != null;
  const lockedLabel = p.myEntry?.guessLabel ?? p.pendingLabel ?? chosen;

  return (
    <section class={`news phase-${p.phase}`} aria-live="polite">
      <div class="news-banner" aria-hidden="true">
        <span class="news-onair">{t.news.onAir}</span>
        <div class="news-ticker">
          <span>
            {t.news.banner} {t.news.banner} {t.news.banner}
          </span>
        </div>
      </div>

      <div class="news-sheet">
        {p.phase === 'intro' && <Typewriter class="news-telex" text={t.news.intro} speed={38} />}

        {p.phase === 'listen' && (
          <>
            <p class="news-telex">{t.news.listen}</p>
            <div class="duel-timer news-timer" role="timer" aria-label={t.news.timeLeft(Math.ceil(left / 1000))}>
              <div class="duel-timer-bar" style={{ transform: `scaleX(${Math.min(1, left / NEWS_LISTEN_MS)})` }} />
              <span>{t.news.timeLeft(Math.ceil(left / 1000))}</span>
            </div>
            {blocked && (
              <button
                class="stamp-button"
                onClick={() => {
                  void getNewsAudio()
                    .play()
                    .then((ok) => setBlocked(!ok));
                }}
              >
                {t.news.blocked}
              </button>
            )}

            {locked ? (
              <p class="news-locked">{t.news.locked(lockedLabel ?? '')}</p>
            ) : (
              <div class="news-search">
                <input
                  type="search"
                  value={query}
                  placeholder={t.news.placeholder}
                  aria-label={t.news.placeholder}
                  autoComplete="off"
                  autoFocus
                  onInput={(e) => setQuery(e.currentTarget.value)}
                />
                <ul class="news-results">
                  {searching && results == null && <li class="news-hint">{t.news.searching}</li>}
                  {results?.length === 0 && <li class="news-hint">{t.news.noResult}</li>}
                  {results?.map((r) => (
                    <li key={r.id}>
                      <button
                        class="news-result"
                        onClick={() => {
                          clickSound();
                          setChosen(`${r.title} — ${r.artist}`);
                          p.onAnswer(r);
                        }}
                      >
                        {r.cover ? <img src={r.cover} alt="" width={40} height={40} loading="lazy" /> : <span class="news-nocover" />}
                        <span class="news-result-text">
                          <strong>{r.title}</strong>
                          <small>{r.artist}</small>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {p.othersAnswered && p.othersAnswered.length > 0 && (
              <p class="news-others">
                {p.othersAnswered.map((o) => (
                  <span key={o.name} class={o.answered ? 'is-done' : ''}>
                    {o.answered ? '✓' : '…'} {o.name}
                  </span>
                ))}
              </p>
            )}
            {locked && p.othersAnswered && p.othersAnswered.some((o) => !o.answered) && <p class="news-hint">{t.news.waitingOthers}</p>}
          </>
        )}

        {p.phase === 'reveal' && p.reveal && (
          <div class="news-reveal">
            <p class="news-itwas">{t.news.itWas}</p>
            <div class="news-answer">
              {p.reveal.answer?.cover && <img src={p.reveal.answer.cover} alt="" width={120} height={120} />}
              <div>
                <p class="news-answer-title">{p.reveal.answer?.title ?? '?'}</p>
                <p class="news-answer-artist">{p.reveal.answer?.artist ?? ''}</p>
              </div>
            </div>
            <table class="news-table">
              <tbody>
                {p.reveal.rows.map((r) => {
                  const v = r.entry?.verdict ?? 'none';
                  return (
                    <tr key={r.id} class={r.isYou ? 'is-mine' : ''}>
                      <th scope="row">
                        {r.color && <span class="pin-dot" style={{ background: r.color }} aria-hidden="true" />} {r.name}
                      </th>
                      <td class="news-guess">{r.entry?.guessLabel || t.news.noAnswer}</td>
                      <td>
                        <span class={`news-verdict ${VERDICT_CLASS[v]}`}>{t.news.verdict[v]}</span>
                      </td>
                      <td class="news-pts">{t.news.points(formatInt(r.entry?.score ?? 0))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button class="primary-action" onClick={p.onContinue} disabled={p.continueDisabled}>
              {p.continueLabel ?? t.news.continue}
            </button>
            {p.nextAt != null && <p class="news-hint">{t.news.nextIn(Math.max(0, Math.ceil((p.nextAt - now) / 1000)))}</p>}
          </div>
        )}

        <p class="news-credit">{t.news.credit}</p>
      </div>
    </section>
  );
}
