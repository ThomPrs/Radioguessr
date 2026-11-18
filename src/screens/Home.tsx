// Accueil : le bureau du DXeur.

import { openDuelLobby, showAlbum, showSettings, startWorldGame } from '../app';
import { clickSound, unlockAudio } from '../audio/sfx';
import { t } from '../i18n/fr';
import { save } from '../state/save';

export function Home() {
  const { stats, album } = save.value;
  const cards = Object.keys(album).length;

  return (
    <main class="desk home">
      <header class="home-header">
        <h1 class="home-title">
          <span class="home-title-stamp">{t.app.name}</span>
        </h1>
        <p class="home-tagline">{t.app.tagline}</p>
      </header>

      <nav class="home-menu">
        <button
          class="home-card home-main"
          onClick={() => {
            unlockAudio();
            clickSound();
            startWorldGame();
          }}
        >
          <span class="home-card-title">{t.home.world}</span>
          <span class="home-card-desc">{t.home.worldDesc}</span>
          <span class="home-airmail" aria-hidden="true" />
        </button>
        <button
          class="home-card"
          onClick={() => {
            unlockAudio();
            clickSound();
            openDuelLobby();
          }}
        >
          <span class="home-card-title">{t.home.duel}</span>
          <span class="home-card-desc">{t.home.duelDesc}</span>
        </button>
        <button
          class="home-card"
          onClick={() => {
            unlockAudio();
            clickSound();
            showAlbum();
          }}
        >
          <span class="home-card-title">{t.home.album}</span>
          <span class="home-card-desc">{t.home.albumDesc(cards)}</span>
        </button>
        <button
          class="home-card"
          onClick={() => {
            unlockAudio();
            clickSound();
            showSettings();
          }}
        >
          <span class="home-card-title">{t.home.settings}</span>
          <span class="home-card-desc">{t.home.stats(stats.gamesPlayed, cards)}</span>
        </button>
      </nav>
    </main>
  );
}
