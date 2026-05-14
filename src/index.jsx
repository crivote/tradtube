import { render } from 'solid-js/web';
import { Router, Route } from '@solidjs/router';
import './index.css';
import App from './App';
import SearchView from './components/SearchView';
import TuneView from './components/TuneView';
import AdminView from './components/AdminView';
import { I18nProvider } from './i18n';

render(() => (
  <I18nProvider>
    <Router root={App}>
      <Route path="/" component={SearchView} />
      <Route path="/tune/:tuneId" component={TuneView} />
      <Route path="/admin" component={AdminView} />
    </Router>
  </I18nProvider>
), document.getElementById('root'));
