import { defineConfig, devices } from '@playwright/test';

/**
 * Testy E2E (§22.2): aplikacja zbudowana produkcyjnie.
 * - :4173 — tryb lokalny (GitHub Pages, IndexedDB),
 * - :4174 — tryb serwerowy (aplikacja + API + SQLite w jednym procesie). `E2E_SERVER=0` pomija go.
 * Kamera: sztuczne urządzenie Chromium; pełne badania przechodzą też w trybie symulacji wzroku.
 * W kontenerze z inną wersją Chromium niż przypięty Playwright: PW_CHROMIUM_PATH=/opt/pw-browsers/chromium.
 */
const chromiumPath = process.env.PW_CHROMIUM_PATH || undefined;
const launchOptions = {
  executablePath: chromiumPath,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
};
const withServer = process.env.E2E_SERVER !== '0';

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    serviceWorkers: 'block',
    locale: 'pl-PL',
    launchOptions,
  },
  projects: [
    { name: 'desktop', testIgnore: /mobile\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 860 }, launchOptions } },
    { name: 'mobile', testMatch: /(site|mobile|layout)\.spec\.ts/, use: { ...devices['iPhone 13'], browserName: 'chromium', launchOptions } },
  ],
  webServer: [
    {
      command: 'npx vite build --outDir dist-e2e/local --emptyOutDir && npx vite preview --outDir dist-e2e/local --port 4173 --strictPort --host 127.0.0.1',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    ...(withServer
      ? [
          {
            command: 'node e2e/start-server.mjs',
            url: 'http://127.0.0.1:4174/api/health',
            reuseExistingServer: !process.env.CI,
            timeout: 180_000,
          },
        ]
      : []),
  ],
});
