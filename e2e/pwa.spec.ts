import { expect, test } from '@playwright/test';

test.describe('PWA (§20)', () => {
  test.use({ serviceWorkers: 'allow' });

  test('manifest z marki i service worker bez cache danych', async ({ page }) => {
    await page.goto('/');
    const manifest = await page.evaluate(async () => {
      const href = document.querySelector('link[rel="manifest"]')?.getAttribute('href');
      return href ? (await fetch(href)).json() : null;
    });
    expect(manifest).toMatchObject({ short_name: 'ScrollStop', display: 'standalone', start_url: './', scope: './' });
    expect(manifest.icons).toHaveLength(3);
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
    expect(scope).toMatch(/\/$/);
    const sw = await (await page.request.get('/sw.js')).text();
    expect(sw).toContain('api/');
    expect(sw).toContain("headers.has('range')");
    expect(sw).not.toContain('__PRECACHE__');
    expect(sw).not.toContain('__VERSION__');
  });
});
