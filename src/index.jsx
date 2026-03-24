import { render } from 'solid-js/web';
import { Router, Route } from '@solidjs/router';
import './index.css';
import App from './App';
import SearchView from './components/SearchView';
import TuneView from './components/TuneView';
import AdminView from './components/AdminView';

render(() => (
  <Router root={App}>
    <Route path="/" component={SearchView} />
    <Route path="/tune/:tuneId" component={TuneView} />
    <Route path="/admin" component={AdminView} />
  </Router>
), document.getElementById('root'));
