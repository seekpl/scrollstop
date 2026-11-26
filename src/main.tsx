import { createRoot } from 'react-dom/client';
import { createApi } from './api';
import { rootPrefix } from './app/router';
import { Root } from './app/Root';
import { I18nProvider } from './i18n';
import './index.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <I18nProvider>
    <Root api={createApi()} />
  </I18nProvider>,
);

// PWA: powłoka aplikacji działa bez internetu (dane sesji i API nigdy nie trafiają do cache, §20).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Podstrony publiczne (np. /pricing/) rejestrują ten sam service worker z katalogu głównego.
    const base = import.meta.env.BASE_URL.startsWith('/') ? import.meta.env.BASE_URL : `${rootPrefix()}${import.meta.env.BASE_URL}`;
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {
      /* bez service workera aplikacja działa normalnie, tylko online */
    });
  });
}
