/* Service worker ScrollStop (PWA).
 *
 * Zasady prywatności: w pamięci podręcznej trzymamy wyłącznie powłokę aplikacji (HTML, JS, CSS,
 * czcionki, ikony, model i WASM do śledzenia twarzy). Nigdy nie zapisujemy odpowiedzi API, sesji,
 * filmów, obrazu z kamery ani żądań z nagłówkiem Authorization. Sesje czekające na wysłanie
 * są w IndexedDB aplikacji, nie tutaj.
 *
 * Wersję i listę plików powłoki wstawia wtyczka Vite przy budowaniu (vite.config.ts).
 */
const VERSION = __VERSION__;
const PRECACHE = __PRECACHE__;
const SHELL = `attn-shell-${VERSION}`;
const RUNTIME = 'attn-runtime-v1';
const BASE = new URL('./', self.location).pathname;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(['./', ...PRECACHE]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('attn-shell-') && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Pliki statyczne, które wolno trzymać w pamięci podręcznej (bez danych użytkowników). */
function isStaticAsset(url) {
  const p = url.pathname.slice(BASE.length - 1);
  return /^\/(assets|icons|mediapipe|models)\//.test(p) || /^\/(favicon\.svg|manifest\.webmanifest)$/.test(p);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Tylko ten sam adres; YouTube, filmy z innych serwerów i API pomijamy w całości.
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  if (url.pathname.startsWith(`${BASE}api/`) || req.headers.has('authorization') || req.headers.has('range')) return;

  if (req.mode === 'navigate') {
    // Podstrony publiczne (/pricing/ itd.) mają własne pliki HTML — tylko z sieci.
    if (url.pathname !== BASE && url.pathname !== `${BASE}index.html`) return;
    // Sieć najpierw (świeża wersja), bez sieci — zapisana powłoka aplikacji.
    event.respondWith(
      fetch(req).catch(() => caches.open(SHELL).then((c) => c.match('./').then((r) => r || Response.error()))),
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok && res.type === 'basic') {
              const copy = res.clone();
              caches.open(url.pathname.includes('/assets/') ? SHELL : RUNTIME).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
