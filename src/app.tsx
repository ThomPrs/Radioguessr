// Racine de l'application : navigation entre écrans.

import { signal } from '@preact/signals';
import { SoloGame } from './game/solo';
import { t } from './i18n/fr';
import { Album } from './screens/Album';
import { GameScreen } from './screens/GameScreen';
import { Home } from './screens/Home';
import { Recap } from './screens/Recap';
import { Settings } from './screens/Settings';

type Screen = { name: 'home' } | { name: 'album' } | { name: 'settings' } | { name: 'game'; game: SoloGame } | { name: 'recap'; game: SoloGame };

const screen = signal<Screen>({ name: 'home' });

export function startWorldGame(): void {
  const current = screen.value;
  if (current.name === 'game') current.game.dispose();
  const game = new SoloGame();
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

export function showSettings(): void {
  goHome();
  screen.value = { name: 'settings' };
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
  }
}
