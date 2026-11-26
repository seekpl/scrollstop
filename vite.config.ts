import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { manifestJson } from './pwa/manifest.ts';
import { BRAND } from './src/config/brand.ts';
import { COMPANY } from './src/config/company.ts';
import { PUBLIC_PAGES, seoText, siteUrl } from './src/config/publicPages.ts';
import { site as plSite } from './src/i18n/pl/site.ts';

/**
 * PWA: generuje `sw.js` z listą plików powłoki aplikacji (JS, CSS, czcionki) i wersją
 * wyliczoną z nazw plików (pierwsze 12 znaków SHA-256). Szablon i zasady prywatności: pwa/sw.js.
 */
function serviceWorker(): Plugin {
  return {
    name: 'attn-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle)
        .filter((f) => /\.(js|css|woff2)$/.test(f))
        .sort();
      const precache = [...files, 'manifest.webmanifest', 'favicon.svg', 'icons/icon-192.png'];
      const version = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 12);
      const source = readFileSync('pwa/sw.js', 'utf8').replace('= __VERSION__;', `= ${JSON.stringify(version)};`).replace('= __PRECACHE__;', `= ${JSON.stringify(precache)};`);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

/** Nazwa marki i kolor motywu w index.html oraz manifest PWA — z `src/config/brand.ts`. */
function brand(): Plugin {
  return {
    name: 'attn-brand',
    transformIndexHtml: (html) => html.replaceAll('%BRAND_NAME%', BRAND.name).replaceAll('%BRAND_CODE%', BRAND.code).replaceAll('%THEME_COLOR%', BRAND.themeColor),
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.endsWith('/manifest.webmanifest')) return next();
        res.setHeader('Content-Type', 'application/manifest+json');
        res.end(manifestJson());
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: manifestJson() });
    },
  };
}

const esc = (x: string) => x.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Właściciel serwisu jako dane strukturalne (schema.org) — z `src/config/company.ts`. */
function organizationJsonLd(url: string): string {
  const [street, cityLine] = (COMPANY.address ?? '').split(/,\s*/);
  const m = /^(\d{2}-\d{3})\s+(.+)$/.exec(cityLine ?? '');
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BRAND.name,
    url,
    logo: `${url}icons/icon-512.png`,
    email: COMPANY.email,
    ...(COMPANY.name ? { legalName: COMPANY.name } : {}),
    ...(COMPANY.nip ? { taxID: COMPANY.nip, vatID: `PL${COMPANY.nip}` } : {}),
    ...(street && m ? { address: { '@type': 'PostalAddress', streetAddress: street, postalCode: m[1], addressLocality: m[2], addressCountry: 'PL' } } : {}),
  };
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

/**
 * Strony publiczne dla wyszukiwarek (§20, M9+): każda strona z `PUBLIC_PAGES` dostaje własny plik
 * `<ścieżka>/index.html` z tytułem, opisem, adresem kanonicznym i Open Graph (teksty ze słownika pl).
 * Do tego sitemap.xml i robots.txt z adresem serwisu (`SITE_URL` albo domena z brand.ts).
 * Przy względnej bazie (`--base ./`, hosting FTP) ścieżki plików w podstronach dostają `../`.
 */
function seoPages(): Plugin {
  let outDir = 'dist';
  let base = '/';
  return {
    name: 'attn-seo-pages',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
      base = config.base;
    },
    closeBundle() {
      const template = readFileSync(join(outDir, 'index.html'), 'utf8');
      const site = siteUrl(BRAND.domain, process.env.SITE_URL);
      const relative = base.startsWith('.');
      for (const page of PUBLIC_PAGES) {
        const seo = seoText(plSite.seo, page.key);
        const depth = page.path.split('/').filter(Boolean).length;
        let html = relative && depth ? template.replace(/(src|href)="\.\//g, `$1="${'../'.repeat(depth)}`) : template;
        html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(seo.title)}</title>`).replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(seo.description)}" />`);
        const url = site ? site + page.path : null;
        const head = [
          url ? `<link rel="canonical" href="${url}" />` : '',
          `<meta property="og:type" content="website" />`,
          `<meta property="og:site_name" content="${esc(BRAND.name)}" />`,
          `<meta property="og:locale" content="pl_PL" />`,
          `<meta property="og:title" content="${esc(seo.title)}" />`,
          `<meta property="og:description" content="${esc(seo.description)}" />`,
          url ? `<meta property="og:url" content="${url}" />` : '',
          site ? `<meta property="og:image" content="${site}icons/icon-512.png" />` : '',
          `<meta name="twitter:card" content="summary" />`,
          page.key === 'landing' && site ? organizationJsonLd(site) : '',
        ]
          .filter(Boolean)
          .join('\n    ');
        html = html.replace('</head>', `    ${head}\n  </head>`);
        const file = join(outDir, page.path, 'index.html');
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, html);
      }
      const today = new Date().toISOString().slice(0, 10);
      if (site) {
        const urls = PUBLIC_PAGES.slice()
          .sort((a, b) => a.path.length - b.path.length)
          .map((p) => `  <url>\n    <loc>${site}${p.path}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${p.path ? (p.path.startsWith('sample/') ? '0.6' : '0.8') : '1.0'}</priority>\n  </url>`)
          .join('\n');
        writeFileSync(join(outDir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
      }
      // Studio, badanie widza i raporty z linków działają pod „#/…” (wyszukiwarki ich nie indeksują);
      // API i pliki mediów wyłączamy z indeksowania.
      const robots = ['User-agent: *', 'Allow: /', 'Disallow: /api/', ...(site ? ['', `Sitemap: ${site}sitemap.xml`] : [])].join('\n');
      writeFileSync(join(outDir, 'robots.txt'), `${robots}\n`);
    },
  };
}

// BASE_PATH ustawiany w CI dla GitHub Pages (np. "/scrollstop/").
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss(), brand(), serviceWorker(), seoPages()],
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
});
