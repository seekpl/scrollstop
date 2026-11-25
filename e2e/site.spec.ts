import { expect, test } from '@playwright/test';
import { expectNoHorizontalScroll } from './helpers';

test.describe('strona publiczna', () => {
  test('strona główna (w budowie) po polsku', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/^ScrollStop/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('W której sekundzie widzowie przestają patrzeć na Twoją rolkę?');
    await expect(page.getByText('W budowie')).toBeVisible();
    await expect(page.getByRole('link', { name: /^Kontakt: / })).toHaveAttribute('href', /^mailto:/);
    await expect(page.getByText(/Serwis prowadzi Sebastian Biel, .*NIP 8681879901\./)).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('strona po angielsku z ?lang=en', async ({ page }) => {
    await page.goto('/?lang=en');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('At which second do viewers stop watching your reel?');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByText('Under construction')).toBeVisible();
  });

  test('404 dla nieznanego adresu', async ({ page }) => {
    await page.goto('/#/nie-ma-takiej');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nie ma takiej strony');
  });
});
