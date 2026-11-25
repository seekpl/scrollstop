import { expect, test } from '@playwright/test';
import { LOCALES } from '../src/i18n/locales';
import { expectNoHorizontalScroll, PHONE_WIDTHS } from './helpers';

test.describe('języki', () => {
  test('przełącznik języka zapamiętuje wybór', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Język strony').selectOption('en');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('At which second do viewers stop watching your reel?');
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('At which second do viewers stop watching your reel?');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  for (const locale of LOCALES) {
    test(`${locale}: brak poziomego przewijania przy 320–390 px`, async ({ page }) => {
      test.setTimeout(180_000);
      for (const width of PHONE_WIDTHS) {
        await page.setViewportSize({ width, height: 800 });
        for (const path of ['/', '/#/pricing', '/#/privacy', '/#/sample/reel', '/#/sample/video', '/#/app', '/#/app/new', '/#/app/account', '/#/nie-ma']) {
          await page.goto(`${path}?lang=${locale}`);
          await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
          await expectNoHorizontalScroll(page);
        }
      }
    });
  }
});
