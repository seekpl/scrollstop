/** Identyfikator filmu YouTube: 11 znaków [A-Za-z0-9_-]. */
const ID_RE = /^[A-Za-z0-9_-]{11}$/;

const HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

/**
 * Wyciąga identyfikator filmu z linku YouTube (watch, youtu.be, embed, shorts, live)
 * albo z samego identyfikatora. Zwraca `null`, gdy tekst nie wskazuje filmu.
 */
export function parseYouTubeId(input: string): string | null {
  const text = input.trim();
  if (ID_RE.test(text)) return text;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split('/').filter(Boolean);
  let id: string | null = null;
  if (host === 'youtu.be' || host === 'www.youtu.be') id = parts[0] ?? null;
  else if (HOSTS.has(host)) {
    if (parts[0] === 'watch') id = url.searchParams.get('v');
    else if (['embed', 'shorts', 'live', 'v', 'e'].includes(parts[0] ?? '')) id = parts[1] ?? null;
  }
  return id && ID_RE.test(id) ? id : null;
}

export const youtubeWatchUrl = (id: string): string => `https://www.youtube.com/watch?v=${id}`;

/** Odtwarzacz w trybie rozszerzonej prywatności (bez ciasteczek do czasu odtworzenia). */
export const YOUTUBE_EMBED_HOST = 'https://www.youtube-nocookie.com';

export const youtubeEmbedUrl = (id: string): string => `${YOUTUBE_EMBED_HOST}/embed/${id}?rel=0&iv_load_policy=3`;

/** Miniatury od największej; `maxresdefault` istnieje tylko dla filmów HD. */
export const youtubeThumbnailUrls = (id: string): string[] => [
  `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
  `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
];

/** Klucz w bibliotece plików: lokalna kopia filmu z YouTube (opcjonalna, daje prawdziwe klatki). */
export const youtubeLibraryName = (id: string): string => `youtube:${id}`;

/** Kod błędu aplikacji dla kodu IFrame Player API (tekst w słowniku `errors`). */
export function youtubeErrorCode(code: number): 'youtube_bad_id' | 'youtube_html5' | 'youtube_unavailable' | 'youtube_unembeddable' | 'youtube_error' {
  switch (code) {
    case 2:
      return 'youtube_bad_id';
    case 5:
      return 'youtube_html5';
    case 100:
      return 'youtube_unavailable';
    case 101:
    case 150:
      return 'youtube_unembeddable';
    default:
      return 'youtube_error';
  }
}
