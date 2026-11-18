import { render } from 'preact';
import { App } from './app';
import { t } from './i18n/fr';
import './styles/tokens.css';
import './styles/base.css';

document.title = t.app.tabTitle;
render(<App />, document.getElementById('app')!);
