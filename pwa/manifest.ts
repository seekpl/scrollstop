import { BRAND } from '../src/config/brand.ts';

/** Manifest PWA generowany z `brand.ts` (nazwa marki w jednym miejscu, lekcja §24.1). */
export function manifestJson(): string {
  return JSON.stringify(
    {
      name: `${BRAND.name} — badania uwagi widzów`,
      short_name: BRAND.name,
      description: 'W której sekundzie widzowie przestają patrzeć na Twoją rolkę? Krzywa uwagi, hook i mapy spojrzeń przed publikacją. Obraz z kamery nie opuszcza urządzenia widza.',
      lang: 'pl',
      start_url: './',
      scope: './',
      display: 'standalone',
      orientation: 'any',
      background_color: '#f4f6f9',
      theme_color: BRAND.themeColor,
      categories: ['business', 'productivity'],
      icons: [
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    null,
    2,
  );
}
