import { expect, test } from '@playwright/test';
import { DEMO_SPECS, FILLER_IDS, SLIDE_IDS, THUMB_IDS, type DemoId } from '../src/demo/demoScene';
import { acceptConsent, downloadSession, expectNoHorizontalScroll, reelStudyLink } from './helpers';

const filler = (id: DemoId) => ({ id, media: { kind: 'demo' as const, demo: id }, duration: DEMO_SPECS[id].duration, width: DEMO_SPECS[id].w, height: DEMO_SPECS[id].h });

test.describe('feed, miniatura i karuzela (M6)', () => {
  test('feed: przewijanie klawiaturą, każda pozycja zapisana, próbki z indeksem pozycji', async ({ page }) => {
    await page.goto(`${reelStudyLink({ kind: 'feed', context: 'feed', platformUi: 'generic', targetDevice: 'any', fillers: FILLER_IDS.map(filler), feed: { items: 6, stopSeconds: 2, capSeconds: 120 }, questions: ['finish'] })}?sim=1`);
    await acceptConsent(page);
    await expect(page.getByRole('heading', { name: 'Za chwilę zobaczysz kilka krótkich klipów' })).toBeVisible();
    await expect(page.getByText('Przewijaj kółkiem myszy albo strzałkami ↑ ↓. Spacja zatrzymuje klip.')).toBeVisible();
    await page.getByRole('button', { name: 'Zaczynam' }).click();
    await expect(page.getByLabel('Klip 1 z 6')).toBeVisible();
    // Neutralna nakładka: konto i ikony, bez marek platform.
    await expect(page.getByRole('img', { name: 'Polub' })).toBeVisible();
    for (let i = 1; i <= 6; i++) {
      await page.waitForTimeout(900);
      if (i === 3) {
        await page.keyboard.press(' ');
        await expect(page.getByText('Zatrzymane')).toBeVisible();
        await page.keyboard.press(' ');
      }
      await page.keyboard.press('ArrowDown');
      if (i < 6) await expect(page.getByLabel(`Klip ${i + 1} z 6`)).toBeVisible();
    }
    // Feed jest badaniem ślepym: bez pytań po obejrzeniu.
    await expect(page.getByRole('heading', { name: 'Dziękujemy!' })).toBeVisible();
    const pkg = await downloadSession(page);
    const items = pkg.session.items!;
    expect(items).toHaveLength(6);
    const tested = items.find((x) => x.role === 'tested')!;
    expect(tested.index as number).toBeGreaterThanOrEqual(1);
    expect(tested.index as number).toBeLessThanOrEqual(4);
    expect(items.slice(0, 5).every((x) => x.exitType === 'swipe_next')).toBe(true);
    expect(items[5].exitType).toBe('swipe_next');
    expect(items.some((x) => (x.events as Array<{ type: string }>).some((e) => e.type === 'pause'))).toBe(true);
    const its = new Set(pkg.session.data.it);
    for (let k = 0; k < 6; k++) expect(its.has(k)).toBe(true);
    expect(pkg.session.answers).toEqual({});
  });

  test('miniatura: ekspozycja siatki, pytanie o wybór, komórki z położeniem', async ({ page }) => {
    await page.goto(
      `${reelStudyLink({ kind: 'thumbnail', context: 'grid', targetDevice: 'any', variant: { id: 'A', media: { kind: 'demo', demo: 'thumb_1' }, mediaName: 'Okładka A', duration: 0, width: 1280, height: 720, title: 'Trzy rzeczy, które sprawdzam' }, fillers: THUMB_IDS.slice(1).map(filler), grid: { layout: 'yt_home', exposureSeconds: 3, askChoice: true }, questions: [] })}?sim=1`,
    );
    await acceptConsent(page);
    await page.getByRole('button', { name: 'Pokaż' }).click();
    await expect(page.getByRole('group', { name: 'Strona z filmami' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Który film chcesz obejrzeć?' })).toBeVisible({ timeout: 8000 });
    await expectNoHorizontalScroll(page);
    await page.getByRole('button', { name: 'Trzy rzeczy, które sprawdzam' }).click();
    await expect(page.getByRole('heading', { name: 'Dziękujemy!' })).toBeVisible();
    const pkg = await downloadSession(page);
    expect(pkg.session.choice).toEqual({ itemId: 'tested' });
    const items = pkg.session.items!;
    expect(items).toHaveLength(6);
    expect(items.filter((x) => x.role === 'tested')).toHaveLength(1);
    for (const it of items) expect(it.rect).toMatchObject({ x: expect.any(Number), y: expect.any(Number), w: expect.any(Number), h: expect.any(Number) });
    expect(pkg.session.data.tc.length).toBeGreaterThan(60);
  });

  test('karuzela: slajdy strzałkami, „Przewiń dalej” kończy, wizyty slajdów', async ({ page }) => {
    await page.goto(
      `${reelStudyLink({ kind: 'carousel', context: 'carousel', targetDevice: 'any', variant: { id: 'A', media: { kind: 'demo', demo: 'slide_1' }, slides: SLIDE_IDS.map((demo) => ({ kind: 'demo' as const, demo })), mediaName: 'Karuzela', duration: 0, width: 1080, height: 1350 }, slides: { mode: 'self', secondsPerSlide: 4 }, questions: [] })}?sim=1`,
    );
    await acceptConsent(page);
    await page.getByRole('button', { name: 'Zaczynam' }).click();
    await expect(page.getByLabel('Zdjęcie 1 z 5')).toBeVisible();
    for (let k = 2; k <= 4; k++) {
      await page.waitForTimeout(600);
      await page.keyboard.press('ArrowRight');
      await expect(page.getByLabel(`Zdjęcie ${k} z 5`)).toBeVisible();
    }
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: 'Przewiń dalej' }).click();
    await expect(page.getByRole('heading', { name: 'Dziękujemy!' })).toBeVisible();
    const pkg = await downloadSession(page);
    const items = pkg.session.items!;
    expect(items.map((x) => x.index)).toEqual([0, 1, 2, 3]);
    expect(items.map((x) => x.exitType)).toEqual(['swipe_next', 'swipe_next', 'swipe_next', 'finish']);
  });
});
