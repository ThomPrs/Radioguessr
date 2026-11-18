// Breaking News en plein écran : coupure des programmes (grésillement, image qui saute), puis
// journal « ÉDITION SPÉCIALE » qui arrive en tournoyant, compte à rebours 3-2-1, puis l'extrait. Le journal reste à l'écran et porte l'interface (recherche, révélation).
// Le même composant sert au solo et au multijoueur.

import { useEffect, useRef, useState } from 'preact/hooks';
import type { NewsAnswer, NewsVerdict, TrackInfo } from '../../shared/blindtest';
import { NEWS_INTRO_MS, NEWS_LISTEN_MS } from '../../shared/blindtest';
import { clickSound, newsJingle, pressThump, stampSound, staticBurst } from '../audio/sfx';
import { formatInt } from '../format';
import { t } from '../i18n/fr';
import { getNewsAudio, musicApi } from '../music/client';

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

/** Étapes du flash, en ms depuis son début. */
type Step = 'cut' | 'paper' | 'count3' | 'count2' | 'count1' | 'go';
const TIMELINE: [Step, number][] = [
  ['cut', 0],
  ['paper', 1200],
  ['count3', 3000],
  ['count2', 4000],
  ['count1', 5000],
  ['go', 6000],
];

function stepAt(elapsed: number): Step {
  let s: Step = 'cut';
  for (const [name, at] of TIMELINE) if (elapsed >= at) s = name;
  return s;
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
  const lastStep = useRef<Step | null>(null);

  const now = p.clock();
  const startAt = p.listenAt - NEWS_INTRO_MS;
  const step: Step = p.phase === 'intro' ? stepAt(now - startAt) : 'go';

  // Horloge : rafraîchit le déroulé et le minuteur.
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 100);
    return () => clearInterval(id);
  }, []);

  // Extrait préchargé dès le début (le lien expire vite : on le demande maintenant).
  useEffect(() => {
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

  // Sons du flash, à chaque changement d'étape (pas de rattrapage si l'on arrive en cours de route).
  useEffect(() => {
    if (lastStep.current === step) return;
    const first = lastStep.current === null;
    lastStep.current = step;
    if (first && step !== 'cut') return;
    if (step === 'cut') staticBurst(1.2, 0.5);
    else if (step === 'paper') {
      newsJingle();
      setTimeout(pressThump, 1500);
    } else if (step.startsWith('count')) stampSound();
  }, [step]);

  // L'extrait démarre à la fin du flash.
  useEffect(() => {
    if (p.phase === 'intro' || started.current) return;
    started.current = true;
    void getNewsAudio()
      .play()
      .then((ok) => setBlocked(!ok));
  }, [p.phase]);

  useEffect(() => {
    if (p.phase === 'reveal') setTimeout(stampSound, 400);
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

  const left = Math.max(0, p.deadline - now);
  const locked = p.myEntry != null || chosen != null || p.pendingLabel != null;
  const lockedLabel = p.myEntry?.guessLabel ?? p.pendingLabel ?? chosen;
  const paperIn = step !== 'cut';
  const today = new Date(now).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div class={`news-takeover step-${step} phase-${p.phase}`} role="dialog" aria-modal="true" aria-label={t.news.option}>
      {/* Coupure : neige télé, bandes, décalage de couleurs */}
      <div class="news-static" aria-hidden="true" />
      {/* Bandeau qui défile en continu */}
      <div class="news-banner" aria-hidden="true">
        <span class="news-onair">{t.news.onAir}</span>
        <div class="news-ticker">
          <span>
            {t.news.banner} {t.news.banner} {t.news.banner}
          </span>
        </div>
      </div>

      {paperIn && (
        <article class="newspaper" aria-live="polite">
          <header class="np-masthead">
            <span class="np-date">{today}</span>
            <h1 class="np-title">{t.news.masthead}</h1>
            <span class="np-special">{t.news.special}</span>
            <span class="np-price">{t.news.price}</span>
          </header>

          {p.phase !== 'reveal' && <h2 class="np-headline">{t.news.headline}</h2>}

          {p.phase === 'intro' && (
            <div class="np-body">
              <p class="np-lead">{t.news.intro}</p>
            </div>
          )}

          {p.phase === 'listen' && (
            <div class="np-columns">
              <section class="np-wanted">
                <p class="np-wanted-title">{t.news.wanted}</p>
                <p class="np-wanted-q">{t.news.wantedQ}</p>
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
              </section>
              {p.othersAnswered && p.othersAnswered.length > 0 && (
                <aside class="np-side">
                  <p class="np-side-title">{t.news.answeredCol}</p>
                  <ul>
                    {p.othersAnswered.map((o) => (
                      <li key={o.name} class={o.answered ? 'is-done' : ''}>
                        {o.answered ? '✓' : '…'} {o.name}
                      </li>
                    ))}
                  </ul>
                  {locked && p.othersAnswered.some((o) => !o.answered) && <p class="news-hint">{t.news.waitingOthers}</p>}
                </aside>
              )}
            </div>
          )}

          {p.phase === 'reveal' && p.reveal && (
            <div class="np-reveal">
              <h2 class="np-headline">
                {p.reveal.answer ? t.news.revealHeadline(p.reveal.answer.title, p.reveal.answer.artist) : t.news.itWas}
              </h2>
              <div class="np-columns">
                {p.reveal.answer?.cover && (
                  <figure class="np-photo">
                    <img src={p.reveal.answer.cover} alt="" width={180} height={180} />
                  </figure>
                )}
                <section class="np-results">
                  <p class="np-side-title">{t.news.results}</p>
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
                </section>
              </div>
            </div>
          )}

          <p class="news-credit">{t.news.credit}</p>
        </article>
      )}

      {/* Compte à rebours tamponné par-dessus le journal */}
      {step.startsWith('count') && (
        <div class="news-count" key={step} aria-hidden="true">
          {step.slice(-1)}
        </div>
      )}
    </div>
  );
}
