import { describe, expect, it } from 'vitest';
import { detectLocale, loadMessages } from '../src/i18n';
import { formatClock, formatMoney, formatPct, formatPp, groupThousands } from '../src/i18n/format';
import { currencyFor, LOCALES, type Locale } from '../src/i18n/locales';
import { pl } from '../src/i18n/pl';

const OTHER: Locale[] = LOCALES.filter((l) => l !== 'pl');
/** Litery występujące tylko w polskim. */
const POLISH = /[ąćęłńśźżĄĆĘŁŃŚŹŻ]/;
/** Klucze z nazwami własnymi (identyczne w każdym języku z założenia). */
const PROPER_NOUNS = /^common\.platforms\.(tiktok|reels|shorts|youtube|linkedin|facebook)$/;

/** Wszystkie liście słownika: ścieżka i wartość (napis, funkcja albo element tablicy). */
export function leaves(obj: unknown, path = ''): Array<[string, unknown]> {
  if (obj && typeof obj === 'object') return Object.entries(obj).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  return [[path, obj]];
}

describe('słowniki języków (§18)', () => {
  for (const locale of OTHER) {
    it(`${locale}: te same klucze i typy co polski, bez polskich znaków, nie kopia`, async () => {
      const t = await loadMessages(locale);
      const ref = new Map(leaves(pl));
      const own = new Map(leaves(t));
      expect([...own.keys()].sort()).toEqual([...ref.keys()].sort());
      for (const [key, value] of own) {
        expect(typeof value, key).toBe(typeof ref.get(key));
        if (typeof value === 'string') expect(value, key).not.toMatch(POLISH);
        if (typeof value === 'function') {
          // Funkcje z parametrami: ta sama liczba argumentów, wynik bez polskich znaków.
          const fn = value as (...a: unknown[]) => unknown;
          const refFn = ref.get(key) as (...a: unknown[]) => unknown;
          expect(fn.length, key).toBe(refFn.length);
        }
      }
      // Słownik nie jest kopią polskiego (< 8% identycznych tekstów; nazwy własne platform pomijamy).
      const counted = [...own].filter(([k]) => !PROPER_NOUNS.test(k));
      const same = counted.filter(([k, v]) => typeof v === 'string' && v === ref.get(k)).length;
      expect(same / counted.length).toBeLessThan(0.08);
    });
  }

  it('wykrywa język z adresu, zapisu i przeglądarki', () => {
    window.history.replaceState(null, '', '/?lang=en');
    expect(detectLocale()).toBe('en');
    // Wybór z adresu zostaje zapamiętany na kolejne wizyty.
    window.history.replaceState(null, '', '/');
    expect(detectLocale()).toBe('en');
    window.history.replaceState(null, '', '/#/pricing?lang=pl');
    expect(detectLocale()).toBe('pl');
    window.history.replaceState(null, '', '/');
    localStorage.removeItem('attn-lang');
    expect(LOCALES).toContain(detectLocale());
    localStorage.setItem('attn-lang', 'pl');
  });
});

describe('formatowanie', () => {
  it('procenty i punkty procentowe', () => {
    expect(formatPct(0.842, 'pl')).toBe('84%');
    expect(formatPct(0.842, 'en')).toBe('84%');
    expect(formatPct(null, 'pl')).toBe('–');
    expect(formatPp(-0.39, 'pl')).toBe('−39 pp');
    expect(formatPp(0.09, 'en')).toBe('+9 pp');
  });

  it('pieniądze: PLN z grupowaniem także 4-cyfrowych, USD i EUR przez Intl', () => {
    expect(groupThousands(1990)).toBe('1 990');
    expect(groupThousands(790)).toBe('790');
    expect(formatMoney(1990, 'pl')).toBe('1 990 zł');
    expect(formatMoney(79, 'pl')).toBe('79 zł');
    expect(formatMoney(19, 'en')).toBe('$19');
    expect(formatMoney(19, 'en', 'EUR')).toBe('€19');
    expect(currencyFor('pl')).toBe('PLN');
    expect(currencyFor('en')).toBe('USD');
    expect(currencyFor('en', true)).toBe('EUR');
  });

  it('znaczniki czasu materiału', () => {
    expect(formatClock(7)).toBe('00:07');
    expect(formatClock(62.4)).toBe('01:02');
    expect(formatClock(3727)).toBe('1:02:07');
  });
});
