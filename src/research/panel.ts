/**
 * Integracja z dostawcą panelu (§16.5): widz z panelu otwiera link z identyfikatorem uczestnika
 * (`?pid=…`), a po badaniu wraca do dostawcy na adres `complete`, `screenout` albo `quality_fail`.
 * Identyfikator nie trafia do bazy — serwer zapisuje tylko skrót SHA-256 z solą (`PANEL_SALT`).
 * Adresy ustawia operator (administrator), nie twórca: to przekierowanie widza poza serwis.
 */
export interface PanelConfig {
  /** Nazwa dostawcy (do rozliczeń), np. `cint`. */
  provider: string;
  /** Adresy powrotu; `{PID}` zastępujemy identyfikatorem uczestnika. */
  completeUrl: string;
  screenoutUrl: string;
  qualityFailUrl: string;
}

export type PanelOutcome = 'complete' | 'screenout' | 'quality_fail';

export const PID_PLACEHOLDER = '{PID}';
const PROVIDER_RE = /^[a-z0-9][a-z0-9 ._-]{0,39}$/i;
/** Identyfikatory dostawców: litery, cyfry i kilka separatorów, do 128 znaków. */
export const PID_RE = /^[A-Za-z0-9._~:@-]{1,128}$/;

function cleanUrl(x: unknown): string | null {
  if (typeof x !== 'string') return null;
  const s = x.trim();
  if (s.length > 600 || !/^https:\/\//i.test(s)) return null;
  try {
    // Placeholder w nawiasach klamrowych nie jest poprawnym znakiem URL — sprawdzamy adres bez niego.
    const u = new URL(s.replaceAll(PID_PLACEHOLDER, 'PID'));
    return u.protocol === 'https:' && u.hostname ? s : null;
  } catch {
    return null;
  }
}

/** Konfiguracja panelu z niezaufanych danych; `null`, gdy czegoś brakuje albo adres nie jest HTTPS. */
export function cleanPanelConfig(raw: unknown): PanelConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const provider = typeof o.provider === 'string' ? o.provider.trim() : '';
  const completeUrl = cleanUrl(o.completeUrl);
  const screenoutUrl = cleanUrl(o.screenoutUrl);
  const qualityFailUrl = cleanUrl(o.qualityFailUrl);
  if (!PROVIDER_RE.test(provider) || !completeUrl || !screenoutUrl || !qualityFailUrl) return null;
  return { provider, completeUrl, screenoutUrl, qualityFailUrl };
}

/** Identyfikator uczestnika z linku; `null`, gdy brak albo ma niedozwolone znaki. */
export function cleanPid(x: unknown): string | null {
  return typeof x === 'string' && PID_RE.test(x) ? x : null;
}

/** Adres powrotu do dostawcy dla wyniku badania (z podstawionym identyfikatorem). */
export function panelReturnUrl(panel: PanelConfig, outcome: PanelOutcome, pid: string): string {
  const template = outcome === 'complete' ? panel.completeUrl : outcome === 'screenout' ? panel.screenoutUrl : panel.qualityFailUrl;
  return template.replaceAll(PID_PLACEHOLDER, encodeURIComponent(pid));
}
