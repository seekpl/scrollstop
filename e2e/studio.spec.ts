import { expect, test, type Page } from '@playwright/test';
import { DEMO_SPECS } from '../src/demo/demoScene';
import { encodePackage } from '../src/research/compact';
import { PROFILES, simulateSessions } from '../src/research/panelSim';
import { expectNoHorizontalScroll, PHONE_WIDTHS } from './helpers';

/** Pliki sesji „od widzów” (jak z linku bez serwera): rolka demo B, kamera, zgoda 18+. */
function sessionFiles(n: number, seed: number) {
  return simulateSessions({ projectId: 'prj_z_linku', variantId: 'A', spec: DEMO_SPECS.reel_b, profile: PROFILES.reelStrongHook, valid: n, phoneShare: 1, seed, audio: 'off' }).map((s, i) => ({
    name: `sesja-${seed}-${i}.json`,
    mimeType: 'application/json',
    buffer: Buffer.from(encodePackage({ ...s, source: 'webcam' })),
  }));
}

/** Pobiera plik PNG po kliknięciu i zwraca jego wymiary z nagłówka IHDR. */
async function pngSize(page: Page, click: () => Promise<void>, name: string): Promise<{ w: number; h: number }> {
  const download = page.waitForEvent('download');
  await click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(name);
  const bytes = Buffer.concat((await (await file.createReadStream())!.toArray()) as Buffer[]);
  expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { w: bytes.readUInt32BE(16), h: bytes.readUInt32BE(20) };
}

/** Kreator: projekt z klipem demo B; zwraca adres kroku Przygotuj test. */
async function createProject(page: Page, name = 'Rolka E2E'): Promise<string> {
  await page.goto('/#/app/new');
  await page.getByRole('tab', { name: 'Klip demo' }).click();
  await page.getByRole('button', { name: 'Użyj: Rolka demo B (15 s, 9:16)' }).click();
  await page.getByLabel('Nazwa projektu').fill(name);
  await page.getByLabel('Nazwa twórcy').fill('Studio E2E');
  await page.getByRole('button', { name: 'Utwórz projekt' }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  return new URL(page.url()).hash;
}

test.describe('studio twórcy (tryb lokalny)', () => {
  test('projekt, link, próba bez kamery, import plików, paywall, raport, laboratorium', async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto('/#/app');
    await expect(page.getByText('Pierwszy projekt zajmuje 2 minuty')).toBeVisible();
    await page.getByRole('link', { name: 'Utwórz projekt' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Nowy projekt' })).toBeVisible();
    const prepare = await createProject(page);
    expect(prepare).toMatch(/^#\/app\/p\/prj_[^/]+\/prepare$/);

    // Przygotuj test: link bez serwera z konfiguracją w adresie i gotowe wiadomości.
    await expect(page.getByLabel('Link bez serwera', { exact: true })).toHaveValue(/#\/p\/.+/);
    await expect(page.getByRole('textbox', { name: 'Relacja' })).toHaveValue(/Link: http.+#\/p\//);
    await expect(page.getByRole('img', { name: 'Kod QR z linkiem do badania' })).toBeVisible();

    // Próba bez kamery (?sim=1) na tym urządzeniu: sesja trafia od razu do projektu jako symulacja.
    await page.getByRole('link', { name: 'Przejdź badanie bez kamery' }).click();
    await expect(page.getByText('Tryb testowy: bez kamery, wzrok symulowany')).toBeVisible();
    // W trybie testowym (bez kamery) nie ma prośby o telefon — od razu zgoda.
    await page.getByLabel('Twój wiek').selectOption('25-34');
    await page.getByLabel('Mam ukończone 18 lat.').check();
    await page.getByLabel(/Zgadzam się na zapisanie/).check();
    await page.getByRole('button', { name: 'Zgadzam się i przechodzę dalej' }).click();
    await expect(page.getByLabel('Materiał', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Jeszcze jedno pytanie' })).toBeVisible({ timeout: 40_000 });
    await page.getByLabel('Tak', { exact: true }).check();
    await page.getByRole('button', { name: 'Zakończ' }).click();
    await expect(page.getByRole('heading', { name: 'Dziękujemy!' })).toBeVisible();

    // Zbierz widzów: symulacja widoczna w tabeli, ale nie liczy się do celu.
    await page.goto(`/${prepare.replace(/prepare$/, 'collect')}`);
    await expect(page.getByText('0 z 30 widzów', { exact: true })).toBeVisible();
    await expect(page.getByRole('table').getByText('Symulacja')).toBeVisible();

    // Import plików: 5 sesji przechodzi kontrolę jakości, uszkodzony plik pominięty.
    const input = page.getByLabel('Dodaj pliki sesji (.json)');
    await input.setInputFiles([...sessionFiles(5, 11), { name: 'zly.json', mimeType: 'application/json', buffer: Buffer.from('{nie json') }]);
    await expect(page.getByText('Dodano 5 sesji, pominięto 1 (duplikaty, limit planu albo uszkodzone dane).')).toBeVisible();
    await expect(page.getByText('5 z 30 widzów', { exact: true })).toBeVisible();

    // Plan Free: 5 widzów w projekcie — link wstrzymany, paywall z planem i panelem.
    await expect(page.getByText('Masz już pierwszą krzywą uwagi.')).toBeVisible();
    await page.getByRole('button', { name: 'Zobacz możliwości' }).click();
    const dialog = page.getByRole('dialog', { name: 'Limit planu' });
    await expect(dialog.getByRole('link', { name: /^Plan Creator za 79/ })).toHaveAttribute('href', '#/pricing?plan=creator');
    // Panel z okna limitu: formularz z nazwą projektu (bez serwera — e-mail z podsumowaniem).
    await dialog.getByRole('button', { name: /Zamów badanie z panelem/ }).click();
    const order = page.getByRole('dialog', { name: 'Zamów badanie z panelem' });
    await expect(order.getByText(/^Projekt: /)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(order).toBeHidden();
    await input.setInputFiles(sessionFiles(1, 12));
    await expect(page.getByText('Dodano 0 sesji, pominięto 1 (duplikaty, limit planu albo uszkodzone dane).')).toBeVisible();

    // Raport z 5 widzów: mała próba, krzywa i hook.
    await page.goto(`/${prepare.replace(/prepare$/, 'report')}`);
    await expect(page.getByText('Mała próba', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Hook' })).toBeVisible();
    await expect(page.getByText('ScrollStop Free').first()).toBeAttached();

    // Grafika do udostępnienia (§7.1): dwa formaty PNG, w Free ze znakiem wodnym.
    await page.getByRole('button', { name: 'Grafika do udostępnienia' }).click();
    const share = page.getByRole('dialog', { name: 'Grafika do udostępnienia' });
    await expect(share.getByText('W planie Free grafika ma znak wodny.', { exact: false })).toBeVisible();
    await expect(share.getByRole('img', { name: 'Podgląd grafiki: Post 4:5' })).toBeVisible();
    expect(await pngSize(page, () => share.getByRole('button', { name: 'Pobierz PNG' }).click(), 'scrollstop-grafika-4x5.png')).toEqual({ w: 1080, h: 1350 });
    await share.getByRole('radio', { name: 'Relacja 9:16' }).click();
    await share.getByLabel('Największy spadek').check();
    expect(await pngSize(page, () => share.getByRole('button', { name: 'Pobierz PNG' }).click(), 'scrollstop-grafika-9x16.png')).toEqual({ w: 1080, h: 1920 });
    await page.keyboard.press('Escape');

    // PDF przez druk (§7.2): nagłówek z marką i datą, bez przycisków i powłoki studia, znak wodny Free.
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByText(/^Raport z badania uwagi · /)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pobierz PDF' })).toBeHidden();
    await expect(page.getByRole('navigation', { name: 'Ścieżka' })).toBeHidden();
    await expect(page.getByText('ScrollStop Free').first()).toBeVisible();
    const pdf = await page.pdf({ format: 'A4' });
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBeGreaterThan(1);
    await page.emulateMedia({ media: 'screen' });

    // Analiza techniczna → laboratorium.
    await page.goto(`/${prepare.replace(/prepare$/, 'technical')}`);
    await expect(page.getByText('Eksport surowych danych (JSON, CSV) jest dostępny od planu Agency.')).toBeVisible();
    await page.getByRole('button', { name: 'Otwórz w laboratorium' }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'Sesje laboratorium' })).toBeVisible();
  });

  test('kroki projektu bez poziomego przewijania na telefonie (pl i en)', async ({ page }) => {
    test.setTimeout(150_000);
    const prepare = await createProject(page, 'Projekt na wąskim ekranie z długą nazwą');
    await page.goto(`/${prepare.replace(/prepare$/, 'collect')}`);
    await page.getByLabel('Dodaj pliki sesji (.json)').setInputFiles(sessionFiles(3, 21));
    await expect(page.getByText(/^Dodano 3 sesje/)).toBeVisible();
    for (const lang of ['pl', 'en']) {
      for (const width of PHONE_WIDTHS) {
        await page.setViewportSize({ width, height: 800 });
        for (const step of ['prepare', 'collect', 'report', 'technical']) {
          await page.goto(`/${prepare.replace(/prepare$/, step)}?lang=${lang}`);
          await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
          await page.waitForTimeout(150);
          await expectNoHorizontalScroll(page);
        }
      }
    }
  });
});
