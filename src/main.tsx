import { render } from 'preact';
import { RoundTest } from './screens/RoundTest';
import { t } from './i18n/fr';
import './styles/tokens.css';
import './styles/base.css';

document.title = t.app.tabTitle;
render(<RoundTest />, document.getElementById('app')!);
