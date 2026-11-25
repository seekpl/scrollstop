import { expect, test } from '@playwright/test';
import { DEMO_SPECS } from '../src/demo/demoScene';
import { PROFILES, simulateSessions } from '../src/research/panelSim';
import { createDemoProject, registerUi, SERVER, setPlan, uniqueEmail } from './serverHelpers';

/**
 * Rekomendacje AI (§8.4) w trybie serwerowym: serwer woła Messages API prawdziwym SDK (atrapa API
 * z `e2e/fake-anthropic.mjs`), waliduje odpowiedź i pokazuje wnioski z nazwą modelu.
 */
test.use({ baseURL: SERVER });
test.skip(process.env.E2E_SERVER === '0', 'serwer E2E wyłączony (E2E_SERVER=0)');

test('Pro: „Opisz rekomendacje językiem montażu (AI)” — tekst modelu tylko z liczbami z metryk', async ({ page, request }) => {
  test.setTimeout(120_000);
  const email = uniqueEmail('ai');
  await registerUi(page, email);
  await setPlan(request, email, 'pro');
  await page.reload();
  await expect(page.getByRole('link', { name: 'Plan Pro' })).toBeVisible();
  const prepare = await createDemoProject(page, 'Rolka z rekomendacjami');
  const link = await page.getByLabel('Link dla widzów', { exact: true }).inputValue();
  const token = link.split('/s/')[1];

  // 12 sesji „z kamery” (jak od prawdziwych widzów) — raport liczy tylko takie.
  const sessions = simulateSessions({ projectId: 'x', variantId: 'A', spec: DEMO_SPECS.reel_b, profile: PROFILES.reelStrongHook, valid: 12, phoneShare: 1, seed: 31, audio: 'off' });
  for (const s of sessions) {
    const r = await request.post(`/api/study/${token}/sessions`, { data: { ...s, source: 'webcam', calibration: { quality: 'GOOD', xPct: 5, yPct: 6, points: 9 } } });
    expect(r.status()).toBe(201);
  }

  await page.goto(`/${prepare.replace(/prepare$/, 'report')}`);
  await page.getByRole('button', { name: 'Opisz rekomendacje językiem montażu (AI)' }).click();
  await expect(page.getByText(/^Tekst: claude-opus-5-5\. AI dostaje tylko policzone metryki/)).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Spadek o \d+ pp \(00:\d\d–00:\d\d\)$/ })).toBeVisible();
  await expect(page.getByText('Otwórz ujęcie mocniej: zbliżenie, ruch albo krótki napis na start.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Napisz ponownie' })).toBeVisible();
});
