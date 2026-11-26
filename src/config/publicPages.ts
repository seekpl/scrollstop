import { isFormatId, type FormatId } from './formats';

/**
 * Strony publiczne z własnym adresem (indeksowane): jedno źródło dla routera, plików HTML
 * generowanych przy budowaniu (tytuł, opis, adres kanoniczny) oraz sitemap.xml.
 * Kolejność: od najdłuższej ścieżki; pusta ścieżka to strona główna.
 */
export const PUBLIC_PAGES = [
  { path: 'formats/reel/', key: 'format-reel' },
  { path: 'formats/video/', key: 'format-video' },
  { path: 'formats/feed/', key: 'format-feed' },
  { path: 'formats/thumbnail/', key: 'format-thumbnail' },
  { path: 'formats/carousel/', key: 'format-carousel' },
  { path: 'formats/versions/', key: 'format-versions' },
  { path: 'sample/reel/', key: 'sample-reel' },
  { path: 'sample/video/', key: 'sample-video' },
  { path: 'sample/feed/', key: 'sample-feed' },
  { path: 'pricing/', key: 'pricing' },
  { path: 'privacy/', key: 'privacy' },
  { path: 'terms/', key: 'terms' },
  { path: '', key: 'landing' },
] as const;

export type PublicPageKey = (typeof PUBLIC_PAGES)[number]['key'];

interface SeoText {
  title: string;
  description: string;
}

/** Podstrona formatu badania z klucza strony (`format-reel` → `reel`). */
export function formatOfPage(key: PublicPageKey): FormatId | null {
  const id = key.startsWith('format-') ? key.slice('format-'.length) : null;
  return isFormatId(id) ? id : null;
}

/** Tytuł i opis strony ze słownika (`site.seo`). */
export function seoText(seo: { landing: SeoText; pricing: SeoText; privacy: SeoText; terms: SeoText; sample: { reel: SeoText; video: SeoText; feed: SeoText }; formats: Record<FormatId, SeoText> }, key: PublicPageKey): SeoText {
  const format = formatOfPage(key);
  if (format) return seo.formats[format];
  switch (key) {
    case 'sample-reel':
      return seo.sample.reel;
    case 'sample-video':
      return seo.sample.video;
    case 'sample-feed':
      return seo.sample.feed;
    case 'landing':
    case 'pricing':
    case 'privacy':
    case 'terms':
      return seo[key];
    default:
      return seo.landing;
  }
}

/** Adres serwisu w internecie: `SITE_URL` przy budowaniu albo domena z `brand.ts` (zawsze z „/” na końcu). */
export function siteUrl(domain: string | null, override?: string): string | null {
  const raw = override || (domain ? `https://${domain}/` : '');
  if (!raw) return null;
  return raw.endsWith('/') ? raw : `${raw}/`;
}
