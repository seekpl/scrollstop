import { currencyFor, LOCALE_TAGS, PP_LABEL, type Currency, type Locale } from './locales';

const NBSP = ' ';

/** Grupowanie tysięcy spacją nierozdzielającą — zawsze, także dla liczb 4-cyfrowych („1 990”). */
export function groupThousands(n: number): string {
  const s = String(Math.round(Math.abs(n)));
  const grouped = s.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return n < 0 ? `−${grouped}` : grouped;
}

/** Kwota: PLN własnym formatem („1 990 zł”), EUR i USD przez Intl („€49”, „$49”). */
export function formatMoney(amount: number, locale: Locale, currency: Currency = currencyFor(locale)): string {
  if (currency === 'PLN') return `${groupThousands(amount)}${NBSP}zł`;
  return new Intl.NumberFormat(LOCALE_TAGS[locale], { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

/** Procent w zapisie języka: „84%”; null → „–”. */
export function formatPct(v: number | null, locale: Locale, digits = 0): string {
  if (v === null || !Number.isFinite(v)) return '–';
  return new Intl.NumberFormat(LOCALE_TAGS[locale], { style: 'percent', maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v);
}

/** Punkty procentowe ze znakiem: „+9 pp”, „−39 pp” (różnica ułamków 0..1). */
export function formatPp(diff: number, locale: Locale, signed = true): string {
  const v = Math.round(diff * 100);
  const sign = signed ? (v > 0 ? '+' : v < 0 ? '−' : '') : v < 0 ? '−' : '';
  return `${sign}${Math.abs(v)}${NBSP}${PP_LABEL[locale]}`;
}

/** Liczba w zapisie języka (separator dziesiętny). */
export function formatNumber(v: number, locale: Locale, digits = 0): string {
  return new Intl.NumberFormat(LOCALE_TAGS[locale], { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v);
}

export function formatDate(iso: string, locale: Locale, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  return new Date(iso).toLocaleString(LOCALE_TAGS[locale], opts);
}

/** Znacznik czasu materiału „00:07” (albo „1:02:07” powyżej godziny). */
export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds)) return '--:--';
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
