/**
 * Link samowystarczalny (§12.4), kod usunięcia sesji (§12.5) i pomocnicze identyfikatory (Załącznik B).
 */
import type { CalibrationSummary } from '../core/contracts/types';
import { CodedError } from '../core/errors';
import { isLocale } from '../i18n/locales';
import { CONSENT_VERSION, LIMITS, RETENTION_OPTIONS, type CalibrationInfo, type DeviceInfo, type DeviceType, type StudyConfig } from './model';
import { cleanText, isId, isNum, isObj, pickAgeBands, pickAudio, pickContext, pickEnum, pickKind, pickPlatform, pickQuestions, sanitizeFillers, sanitizeMedia, InvalidInput } from './sanitize';

const b64url = (bytes: Uint8Array): string => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromB64url = (s: string): Uint8Array => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

/** Losowy identyfikator base64url z `bytes` bajtów (crypto). */
export function randomId(bytes = 16): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return b64url(a);
}

/**
 * Konfiguracja badania z zewnątrz (serwer albo link): budowana od zera z dozwolonych pól.
 * Kody: `link_incomplete`, `local_media`.
 */
export function sanitizeStudyConfig(raw: unknown, transport: StudyConfig['transport']): StudyConfig {
  if (!isObj(raw) || !isId(raw.projectId) || !isObj(raw.variant)) throw new CodedError('link_incomplete');
  const v = raw.variant;
  let media: StudyConfig['variant']['media'];
  try {
    media = v.media === null || v.media === undefined ? null : sanitizeMedia(v.media, false);
  } catch (e) {
    throw new CodedError(e instanceof InvalidInput && e.code === 'local_media' ? 'local_media' : 'link_incomplete');
  }
  const slides = Array.isArray(v.slides) ? v.slides.slice(0, LIMITS.maxSlides).map((s) => sanitizeMedia(s, false)) : undefined;
  if (!media && !slides?.length) throw new CodedError('link_incomplete');
  const feed = isObj(raw.feed) ? { items: isNum(raw.feed.items, 2, 20) ? Math.round(raw.feed.items) : 6, stopSeconds: isNum(raw.feed.stopSeconds, 1, 3) ? raw.feed.stopSeconds : 2, capSeconds: isNum(raw.feed.capSeconds, 30, 900) ? raw.feed.capSeconds : 180 } : undefined;
  const grid = isObj(raw.grid)
    ? { layout: pickEnum(raw.grid.layout, ['yt_home', 'yt_search_mobile', 'profile_grid'] as const, 'yt_home'), exposureSeconds: isNum(raw.grid.exposureSeconds, 3, 10) ? raw.grid.exposureSeconds : 6, askChoice: raw.grid.askChoice !== false }
    : undefined;
  const slidesCfg = isObj(raw.slides) ? { mode: raw.slides.mode === 'self' ? ('self' as const) : ('auto' as const), secondsPerSlide: isNum(raw.slides.secondsPerSlide, 1, 60) ? raw.slides.secondsPerSlide : 5 } : undefined;
  const panel =
    isObj(raw.panel) && typeof raw.panel.completeUrl === 'string'
      ? { provider: cleanText(raw.panel.provider, 40), completeUrl: cleanText(raw.panel.completeUrl, 2000), screenoutUrl: cleanText(raw.panel.screenoutUrl, 2000), qualityFailUrl: cleanText(raw.panel.qualityFailUrl, 2000) }
      : undefined;
  return {
    projectId: raw.projectId,
    projectName: cleanText(raw.projectName, 120),
    creatorName: cleanText(raw.creatorName, 120),
    kind: pickKind(raw.kind),
    platform: pickPlatform(raw.platform),
    audio: pickAudio(raw.audio),
    context: pickContext(raw.context),
    platformUi: raw.platformUi === 'generic' ? 'generic' : 'none',
    ...(typeof raw.caption === 'string' ? { caption: cleanText(raw.caption, 300) } : {}),
    targetDevice: pickEnum(raw.targetDevice, ['mobile', 'desktop', 'any'] as const, 'any'),
    variant: {
      id: pickEnum(v.id, ['A', 'B', 'C', 'D'] as const, 'A'),
      media,
      ...(slides ? { slides } : {}),
      mediaName: cleanText(v.mediaName, LIMITS.fileName),
      duration: isNum(v.duration, 0, LIMITS.maxMediaSeconds) ? v.duration : 0,
      width: isNum(v.width, 1, 10000) ? Math.round(v.width) : 1080,
      height: isNum(v.height, 1, 10000) ? Math.round(v.height) : 1920,
      ...(typeof v.title === 'string' ? { title: cleanText(v.title, 120) } : {}),
    },
    fillers: sanitizeFillers(raw.fillers, false),
    ...(feed ? { feed } : {}),
    ...(grid ? { grid } : {}),
    ...(slidesCfg ? { slides: slidesCfg } : {}),
    questions: pickQuestions(raw.questions),
    ageBands: pickAgeBands(raw.ageBands),
    screenPlatforms: raw.screenPlatforms === true,
    consentVersion: typeof raw.consentVersion === 'string' && raw.consentVersion.length <= 32 ? raw.consentVersion : CONSENT_VERSION,
    transport,
    linkToken: isId(raw.linkToken) ? raw.linkToken : 'package',
    retentionDays: (RETENTION_OPTIONS as readonly number[]).includes(raw.retentionDays as number) ? (raw.retentionDays as number) : 90,
    locale: isLocale(raw.locale) ? raw.locale : 'pl',
    ...(panel ? { panel } : {}),
  };
}

/** Link samowystarczalny: konfiguracja zakodowana we fragmencie adresu (nie trafia do serwera). */
export function encodeStudyConfig(config: StudyConfig): string {
  return b64url(new TextEncoder().encode(JSON.stringify({ ...config, transport: 'package' })));
}

/** Kody błędów: `link_broken` (uszkodzony), `link_incomplete` (niepełny), `local_media` (plik twórcy). */
export function decodeStudyConfig(payload: string): StudyConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
  } catch {
    throw new CodedError('link_broken');
  }
  return sanitizeStudyConfig(parsed, 'package');
}

/** Kod usunięcia sesji: 8 znaków bez mylących (0/O, 1/I/L), format XXXX-XXXX. */
export function newDeletionCode(): string {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  const s = Array.from(a, (b) => abc[b % abc.length]).join('');
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

export async function sha256Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Normalizacja kodu: wielkie litery, tylko A–Z i 0–9. */
export const normalizeCode = (code: string): string => code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Typ urządzenia widza z rozmiaru ekranu i dotyku. */
export function detectDevice(win: Pick<Window, 'innerWidth' | 'innerHeight' | 'devicePixelRatio' | 'matchMedia'> = window): DeviceInfo {
  const w = win.innerWidth;
  const h = win.innerHeight;
  const coarse = typeof win.matchMedia === 'function' ? win.matchMedia('(pointer: coarse)').matches : false;
  const touch = coarse || (typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 0 && Math.min(w, h) < 1100);
  const short = Math.min(w, h);
  const type: DeviceType = touch ? (short < 600 ? 'mobile' : 'tablet') : 'desktop';
  return { type, orientation: h > w ? 'portrait' : 'landscape', screenW: w, screenH: h, dpr: win.devicePixelRatio || 1, touch };
}

/** Podsumowanie kalibracji zapisywane z sesją (bez modelu i punktów twarzy). */
export function calibrationInfo(c: CalibrationSummary | null | undefined): CalibrationInfo | null {
  if (!c) return null;
  return {
    quality: c.quality,
    xPct: c.testError ? Math.round(c.testError.xPct * 10) / 10 : null,
    yPct: c.testError ? Math.round(c.testError.yPct * 10) / 10 : null,
    points: c.points,
  };
}
