import { describe, expect, it } from 'vitest';
import { FORMAT_IDS } from '../src/config/formats';
import { PUBLIC_PAGES, seoText } from '../src/config/publicPages';
import { loadMessages } from '../src/i18n';
import { LOCALES } from '../src/i18n/locales';
import { formatFacts } from '../src/research/formatFacts';
import { MAX_VARIANTS, PLANS } from '../src/research/plans';
import { RELIABLE_SAMPLE } from '../src/research/sessions';

/** Podstrony formatów (`/formats/<id>/`): treść pod wyszukiwarki w każdym języku. */
describe('podstrony formatów badań', () => {
  it('każdy format ma własny adres w sitemap i komplet treści w każdym języku', async () => {
    for (const f of FORMAT_IDS) expect(PUBLIC_PAGES.some((p) => p.path === `formats/${f}/`)).toBe(true);
    for (const locale of LOCALES) {
      const t = await loadMessages(locale);
      const facts = formatFacts((id) => t.billing.planNames[id]);
      for (const f of FORMAT_IDS) {
        const c = t.formats.pages[f](facts);
        expect(c.title.length, `${locale}/${f}: H1`).toBeGreaterThan(10);
        expect(c.lead.length, `${locale}/${f}: lead`).toBeGreaterThan(80);
        expect(c.questions.length).toBeGreaterThanOrEqual(3);
        expect(c.steps.length).toBeGreaterThanOrEqual(3);
        expect(c.report.length).toBeGreaterThanOrEqual(3);
        expect(c.when.length).toBeGreaterThanOrEqual(2);
        expect(c.faq.length, `${locale}/${f}: FAQ`).toBeGreaterThanOrEqual(3);
        // Opis w wynikach wyszukiwania: do 160 znaków; tytuł z nazwą marki.
        const seo = seoText(t.site.seo, `format-${f}`);
        expect(seo.description.length, `${locale}/${f}: opis`).toBeLessThanOrEqual(160);
        expect(seo.description.length).toBeGreaterThan(90);
        expect(seo.title).toContain('ScrollStop');
      }
    }
  });

  it('liczby i plany w treści pochodzą z kodu badań, nie z tekstu', async () => {
    const t = await loadMessages('pl');
    const facts = formatFacts((id) => t.billing.planNames[id]);
    expect(facts.maxVariants).toBe(MAX_VARIANTS);
    expect(facts.reliable).toBe(RELIABLE_SAMPLE);
    expect(t.formats.pages.reel(facts).faq.some(([, a]) => a.includes(`${RELIABLE_SAMPLE} widzów`))).toBe(true);
    expect(t.formats.pages.versions(facts).title).toContain(`${MAX_VARIANTS} wersji`);
    // Zmiana progu w danych zmienia treść.
    const other = { ...facts, reliable: 99, plan: { ...facts.plan, feed: 'X' } };
    expect(t.formats.pages.reel(other).steps.at(-1)?.[1]).toContain('99 widzów');
    expect(t.formats.pages.feed(other).planNote).toBe('Od planu X.');
    // Plan funkcji feedu to rzeczywiście najtańszy plan z tą funkcją.
    expect(facts.plan.feed).toBe(t.billing.planNames[Object.values(PLANS).find((p) => p.features.feed)!.id]);
  });
});
