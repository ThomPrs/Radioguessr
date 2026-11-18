// Accueil : le bureau du DXeur.

import { openDuelLobby, showAlbum, showProfile, showSettings, startWorldGame } from '../app';
import { PinMarker } from '../pins/PinMarker';
import { AvatarView } from '../profile/Avatar';
import { clickSound, unlockAudio } from '../audio/sfx';
import { t } from '../i18n/fr';
import { useState } from 'preact/hooks';
import { SoloSetup } from '../components/SoloSetup';
import { save } from '../state/save';

export function Home() {
  const { stats, album, profile } = save.value;
  const cards = Object.keys(album).length;
  const [setup, setSetup] = useState(false);

  return (
    <main class="desk home">
      <header class="home-header">
        <h1 class="home-title">
          <span class="home-title-stamp">{t.app.name}</span>
        </h1>
        <p class="home-tagline">{t.app.tagline}</p>
      </header>

      <button
        class="home-profile"
        onClick={() => {
          unlockAudio();
          clickSound();
          showProfile();
        }}
      >
        <AvatarView avatar={profile.avatar} size={56} />
        <span class="home-profile-text">
          <span class="home-card-title">{t.home.profile}</span>
          <span class="home-card-desc">{t.profile.homeDesc(profile.name)}</span>
        </span>
        <span class="home-profile-pin">
          <PinMarker pinId={profile.pin} />
        </span>
      </button>

      <nav class="home-menu">
        <button
          class="home-card home-main"
          onClick={() => {
            unlockAudio();
            clickSound();
            setSetup(true);
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
      {setup && (
        <SoloSetup
          onCancel={() => setSetup(false)}
          onStart={() => {
            unlockAudio(); // geste de l'utilisateur : la radio pourra démarrer
            startWorldGame();
          }}
        />
      )}
    </main>
  );
}
