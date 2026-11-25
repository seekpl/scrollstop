import { defineConfig } from 'vite';

// Serwer API jako jeden plik ESM (zależności wbudowane), uruchamiany przez `node dist-server/main.js`.
export default defineConfig({
  publicDir: false,
  build: {
    ssr: 'server/main.ts',
    outDir: 'dist-server',
    target: 'node22',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: { output: { entryFileNames: 'main.js' } },
  },
  ssr: { noExternal: true, target: 'node' },
});
