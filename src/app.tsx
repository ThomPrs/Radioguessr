// Racine de l'application : navigation entre écrans.

import { signal } from '@preact/signals';
import { DuelSession } from './duel/session';
import { tabIdentity, type Identity } from './duel/client';
import { SoloGame } from './game/solo';
import { save } from './state/save';
import { t } from './i18n/fr';
import { Album } from './screens/Album';
import { DuelLobby } from './screens/DuelLobby';
import { DuelRoom } from './screens/DuelRoom';
import { GameScreen } from './screens/GameScreen';
import { Home } from './screens/Home';
import { Profile } from './screens/Profile';
import { Recap } from './screens/Recap';
import { Settings } from './screens/Settings';

type Screen =
  | { name: 'home' }
  | { name: 'album' }
  | { name: 'settings' }
  | { name: 'profile' }
  | { name: 'duel-lobby'; code: string }
  | { name: 'duel-room'; session: DuelSession } | { name: 'game'; game: SoloGame } | { name: 'recap'; game: SoloGame };

/** Lien d'invitation « ?duel=CODE » : on ouvre directement l'entrée du duel avec le code. */
function initialScreen(): Screen {
  const code = new URLSearchParams(location.search).get('duel');
  if (code) {
    history.replaceState(null, '', location.pathname);
    return { name: 'duel-lobby', code };
  }
  // Page rechargée en plein duel : on retourne directement dans le salon.
  const id = tabIdentity();
  if (id) return { name: 'duel-room', session: new DuelSession(id) };
  return { name: 'home' };
}

const screen = signal<Screen>(initialScreen());

export function startWorldGame(): void {
  const current = screen.value;
  if (current.name === 'game') current.game.dispose();
  // Options de la partie : mémorisées dans les préférences (fiche « Options de la partie »).
  const game = new SoloGame({ breakingNews: save.peek().prefs.breakingNews });
  screen.value = { name: 'game', game };
  void game.start(); // appelé depuis le clic : l'autoplay est autorisé
}

export function goHome(): void {
  const current = screen.value;
  if (current.name === 'game') current.game.dispose();
  document.title = t.app.tabTitle;
  screen.value = { name: 'home' };
}

export function showAlbum(): void {
  goHome();
  screen.value = { name: 'album' };
}

export function showProfile(): void {
  goHome();
  screen.value = { name: 'profile' };
}

export function showSettings(): void {
  goHome();
  screen.value = { name: 'settings' };
}

export function openDuelLobby(): void {
  goHome();
  screen.value = { name: 'duel-lobby', code: '' };
}

export function openDuelRoom(id: Identity): void {
  goHome();
  screen.value = { name: 'duel-room', session: new DuelSession(id) };
}

export function showRecap(game: SoloGame): void {
  document.title = t.app.tabTitle;
  screen.value = { name: 'recap', game };
}

export function App() {
  const s = screen.value;
  switch (s.name) {
    case 'home':
      return <Home />;
    case 'game':
      return <GameScreen key={s.game.game.value.id} game={s.game} />;
    case 'recap':
      return <Recap game={s.game} />;
    case 'album':
      return <Album />;
    case 'settings':
      return <Settings />;
    case 'profile':
      return <Profile />;
    case 'duel-lobby':
      return <DuelLobby initialCode={s.code} />;
    case 'duel-room':
      return <DuelRoom key={s.session.id.code} session={s.session} />;
  }
}
