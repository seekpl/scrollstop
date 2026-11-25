import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { DEMO_SPECS } from '../src/demo/demoScene';
import { encodePackage } from '../src/research/compact';
import { PROFILES, simulateSessions } from '../src/research/panelSim';
import { reelStudyLink } from './helpers';

/**
 * Przegląd dostępności (§19.6, M9): automatyczny audyt WCAG 2.2 AA (axe-core) kluczowych ekranów —
 * strona publiczna, studio, raport z oknami, badanie widza. Każde naruszenie zatrzymuje test
 * z listą elementów do poprawy.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function audit(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const report = r.violations.map((v) => `${v.impact} ${v.id}: ${v.help}\n${v.nodes.map((n) => `  - ${n.target.join(' ')} ${n.failureSummary?.split('\n')[1] ?? ''}`).join('\n')}`).join('\n');
  expect.soft(r.violations, `${label}\n${report}`).toEqual([]);
}

test.describe('dostępność (WCAG 2.2 AA)', () => {
  test('strona publiczna: główna, cennik z formularzem panelu, prywatność, przykładowe raporty, 404', async ({ page }) => {
    test.setTimeout(120_000);
    for (const [path, label] of [
      ['/', 'strona główna'],
      ['/#/pricing', 'cennik'],
      ['/#/privacy', 'prywatność'],
      ['/#/terms', 'regulamin'],
      ['/#/sample/reel', 'przykładowy raport A/B'],
      ['/#/sample/video', 'przykładowy raport filmu'],
      ['/#/nie-ma', '404'],
      ['/?lang=en#/pricing', 'cennik po angielsku'],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await audit(page, label);
    }
    // `?lang=en` zapisał wybór języka — wracamy do polskiego.
    await page.goto('/?lang=pl#/pricing');
    await page.getByRole('button', { name: 'Zamów badanie z panelem' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Przygotuj e-mail z zamówieniem' }).click();
    await audit(page, 'formularz zamówienia panelu z błędami');
  });

  test('studio: projekty, kreator, kroki projektu, raport z grafiką, konto, laboratorium', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/#/app');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await audit(page, 'lista projektów (pusta)');
    await page.goto('/#/app/new');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await audit(page, 'kreator');
    await page.getByRole('tab', { name: 'Klip demo' }).click();
    await page.getByRole('button', { name: 'Użyj: Rolka demo B (15 s, 9:16)' }).click();
    await page.getByLabel('Nazwa projektu').fill('Rolka dostępna');
    await page.getByLabel('Nazwa twórcy').fill('Studio');
    await page.getByRole('button', { name: 'Utwórz projekt' }).click();
    await page.waitForURL(/prepare$/);
    const hash = new URL(page.url()).hash;
    await audit(page, 'przygotuj test');
    await page.goto(`/${hash.replace(/prepare$/, 'collect')}`);
    await expect(page.getByLabel('Dodaj pliki sesji (.json)')).toBeAttached();
    await audit(page, 'zbierz widzów');
    const files = simulateSessions({ projectId: 'x', variantId: 'A', spec: DEMO_SPECS.reel_b, profile: PROFILES.reelStrongHook, valid: 5, phoneShare: 1, seed: 3, audio: 'off' }).map((s, i) => ({ name: `s${i}.json`, mimeType: 'application/json', buffer: Buffer.from(encodePackage({ ...s, source: 'webcam' })) }));
    await page.getByLabel('Dodaj pliki sesji (.json)').setInputFiles(files);
    await expect(page.getByText(/^Dodano 5/)).toBeVisible();
    await page.goto(`/${hash.replace(/prepare$/, 'report')}`);
    await expect(page.getByRole('heading', { name: 'Hook', exact: true })).toBeVisible();
    await audit(page, 'raport');
    await page.getByRole('button', { name: 'Grafika do udostępnienia' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await audit(page, 'okno grafiki');
    await page.keyboard.press('Escape');
    await page.goto(`/${hash.replace(/prepare$/, 'technical')}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await audit(page, 'analiza techniczna');
    await page.goto('/#/app/account');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await audit(page, 'konto');
    await page.goto('/#/lab');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await audit(page, 'laboratorium');
  });

  test('badanie widza: zgoda, przygotowanie, usuwanie danych', async ({ page }) => {
    await page.goto(reelStudyLink({ targetDevice: 'any' }));
    await expect(page.getByRole('heading', { name: 'Zaproszenie do krótkiego badania materiału wideo' })).toBeVisible();
    await audit(page, 'zgoda widza');
    await page.getByLabel('Twój wiek').selectOption('25-34');
    await page.getByLabel('Mam ukończone 18 lat.').check();
    await page.getByLabel(/Zgadzam się na zapisanie/).check();
    await page.getByRole('button', { name: 'Zgadzam się i przechodzę dalej' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await audit(page, 'przygotowanie widza');
    await page.goto('/#/delete');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await audit(page, 'usuwanie danych');
  });
});
