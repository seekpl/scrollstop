import { expect, test } from '@playwright/test';

test.describe('laboratorium', () => {
  test('sesja demo: wyniki, heat mapa, ścieżka, statystyki, eksport', async ({ page }) => {
    await page.goto('/#/lab');
    await expect(page.getByRole('heading', { level: 1, name: 'Nowa sesja' })).toBeVisible();
    await page.getByRole('button', { name: 'Wygeneruj sesję: Film demo (60 s, 16:9)' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Sesje laboratorium' })).toBeVisible();
    await expect(page.getByText('Wiarygodny pomiar')).toBeVisible();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Pobierz CSV' }).click();
    expect((await download).suggestedFilename()).toMatch(/^scrollstop_lab_.*\.csv$/);

    await page.getByRole('navigation', { name: 'Widoki laboratorium' }).getByRole('button', { name: 'Heat mapa' }).click();
    await page.getByRole('button', { name: 'Wykryj sceny automatycznie' }).click();
    // Klip demo ma 5 scen (cięcia co 12 s) — wykrywanie z histogramów klatek.
    await expect(page.getByRole('button', { name: /^Scena 5/ })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Generuj heat mapę' }).click();
    await expect(page.getByText(/ważnych próbek, .* s danych/).first()).toBeVisible();
    await page.getByRole('navigation', { name: 'Widoki laboratorium' }).getByRole('button', { name: 'Statystyki' }).click();
    await expect(page.getByRole('img', { name: 'Oś czasu szacowanego patrzenia na ekran' })).toBeVisible();
  });

  test('kamera: MediaPipe startuje na fałszywej kamerze, diagnostyka na żywo', async ({ page }) => {
    await page.goto('/#/lab');
    await page.getByRole('navigation', { name: 'Widoki laboratorium' }).getByRole('button', { name: 'Na żywo' }).click();
    await page.getByRole('button', { name: 'Włącz kamerę' }).click();
    await expect(page.getByText(/\d+×\d+, \d+ kl\/s, (GPU|CPU)/)).toBeVisible({ timeout: 60_000 });
    // Model hostowany razem z aplikacją (bez serwera Google), jeśli pobrany przez `npm run fetch-model`.
    await expect(page.getByRole('button', { name: 'Wyłącz kamerę' })).toBeVisible();
    // Sztuczna kamera nie pokazuje twarzy.
    await expect(page.getByText('brak', { exact: true })).toBeVisible();
  });

  test('oglądanie z symulowanym wzrokiem zapisuje sesję', async ({ page }) => {
    await page.goto('/#/lab');
    await page.getByRole('button', { name: 'Rolka demo B (15 s, 9:16)', exact: true }).click();
    await page.getByRole('radio', { name: 'Symulacja' }).click();
    await page.getByRole('button', { name: 'Rozpocznij oglądanie' }).click();
    await expect(page.locator('canvas[aria-label="Rolka demo B (15 s, 9:16)"]')).toBeVisible();
    await page.waitForTimeout(2500);
    await page.mouse.move(300, 300);
    await page.getByRole('button', { name: 'Zakończ i zapisz' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Sesje laboratorium' })).toBeVisible();
    await expect(page.getByRole('definition').filter({ hasText: 'Rolka demo B (15 s, 9:16)' })).toBeVisible();
  });
});
