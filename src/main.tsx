import { render } from 'preact';
import { App } from './app';
import { t } from './i18n/fr';
import { installPrefs } from './state/prefs';
import { unlockAchievements } from './state/save';
import './styles/tokens.css';
import './styles/base.css';
import './styles/qsl.css';
import './styles/duel.css';
import './styles/pins.css';
import './styles/news.css';
import './styles/achievements.css';

document.title = t.app.tabTitle;

// Filtre SVG global « encre baveuse » utilisé par les tampons.
document.body.insertAdjacentHTML(
  'afterbegin',
  `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="ink-bleed">
    <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="2.5"/>
  </filter></svg>`,
);
installPrefs();
// Succès déjà mérités d'après la sauvegarde (album, épingles, statistiques) : attribués sans animation.
unlockAchievements();
render(<App />, document.getElementById('app')!);
