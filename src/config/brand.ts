/**
 * Marka produktu — jedyne miejsce z nazwą, domeną i kolorami marki (§0, lekcja §24.1).
 *
 * `code` to kod wewnętrzny: prefiks kluczy w przeglądarce, baz IndexedDB, plików i formatów.
 * NIE zmienia się przy zmianie nazwy marki, dzięki czemu dane użytkowników przetrwają rebranding.
 */
export const BRAND = {
  /** Nazwa robocza (do zmiany, §26.1). */
  name: 'ScrollStop',
  /** Kod wewnętrzny — nie zmieniać. */
  code: 'attn',
  /** Domena produkcyjna: adresy kanoniczne, sitemap.xml, robots.txt, stopka grafiki do udostępnienia. */
  domain: 'scroll-stop.com' as string | null,
  /** Kolor motywu przeglądarki i manifestu PWA. */
  themeColor: '#1f2a44',
  /** Akcent marki (przyciski główne, wersja A na wykresach). Zmiana = ponowne sprawdzenie kontrastu (`npm run check:colors`). */
  accent: '#2747d6',
} as const;

/** Klucze w przeglądarce i nazwy baz (Załącznik B). */
export const STORAGE = {
  lang: `${BRAND.code}-lang`,
  token: `${BRAND.code}-token`,
  researchDb: `${BRAND.code}-research`,
  outboxDb: `${BRAND.code}-outbox`,
  labDb: `${BRAND.code}-lab`,
} as const;

/** Nazwa pliku z marką, np. „scrollstop-session-ses_x.json” (małe litery, bez spacji). */
export const brandSlug = (): string => BRAND.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
