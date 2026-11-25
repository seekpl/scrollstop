import { createRoot } from 'react-dom/client';
import { createApi } from './api';
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
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {
      /* bez service workera aplikacja działa normalnie, tylko online */
    });
  });
}
