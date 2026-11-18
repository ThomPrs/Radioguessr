import { startWorldGame } from '../app';
import { t } from '../i18n/fr';

export function Home() {
  return (
    <main class="home">
      <header class="home-header">
        <h1 class="home-title">{t.app.name}</h1>
        <p class="home-tagline">{t.app.tagline}</p>
      </header>

      <nav class="home-menu">
        <button class="home-main" onClick={startWorldGame}>
          <span class="home-main-label">{t.home.world}</span>
          <span class="home-main-desc">{t.home.worldDesc}</span>
        </button>
        <button disabled>
          {t.home.duel} <small>({t.home.soon})</small>
        </button>
        <button disabled>
          {t.home.album} <small>({t.home.soon})</small>
        </button>
        <button disabled>
          {t.home.settings} <small>({t.home.soon})</small>
        </button>
      </nav>
    </main>
  );
}
