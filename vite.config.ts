import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { manifestJson } from './pwa/manifest.ts';
import { BRAND } from './src/config/brand.ts';

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

// BASE_PATH ustawiany w CI dla GitHub Pages (np. "/scrollstop/").
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss(), brand(), serviceWorker()],
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
});
