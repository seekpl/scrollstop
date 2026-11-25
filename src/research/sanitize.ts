/**
 * Walidacja danych z zewnątrz (serwer, import plików, link samowystarczalny, §15). Wynik buduje się
 * od zera z dozwolonych pól — wszystko inne jest odrzucane, więc do bazy nie trafią imiona,
 * e-maile ani obraz. Błędy jako kody (`InvalidInput.code`).
 */
import { PLATFORMS } from '../config/platforms';
import { CodedError } from '../core/errors';
import { isDemoId } from '../demo/demoScene';
import { isLocale } from '../i18n/locales';
import { SCREENER_FREQUENCIES, SCREENER_PLATFORMS } from './audience';
import { validateCompact } from './compact';
import {
  AGE_BANDS,
  AOI_TYPES,
  AUDIO_MODES,
  LIMITS,
  QUESTION_IDS,
  STUDY_KINDS,
  VARIANT_IDS,
  VIEW_CONTEXTS,
  type AgeBand,
  type Aoi,
  type CalibrationInfo,
  type CompactSamples,
  type DeviceInfo,
  type FillerItem,
  type ItemLog,
  type MediaSource,
  type Scene,
  type Variant,
  type VariantId,
  type ViewerSession,
} from './model';

type Obj = Record<string, unknown>;
export const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
export const isNum = (x: unknown, min = -Infinity, max = Infinity): x is number => typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;
export const isId = (x: unknown, max = 64): x is string => typeof x === 'string' && x.length > 0 && x.length <= max && /^[A-Za-z0-9_-]+$/.test(x);
export const isIso = (x: unknown): x is string => typeof x === 'string' && x.length <= 40 && Number.isFinite(Date.parse(x));
/** Teksty czyszczone ze znaków kontrolnych i przycinane. */
export const cleanText = (x: unknown, max: number): string => (typeof x === 'string' ? x.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');
const HTTP_URL = /^https?:\/\/[^\s]{3,2000}$/i;

export class InvalidInput extends CodedError {
  constructor(code: string) {
    super(code);
    this.name = 'InvalidInput';
  }
}

function fail(code: string): never {
  throw new InvalidInput(code);
}

function device(x: unknown): DeviceInfo {
  if (!isObj(x)) fail('bad_device');
  const type = x.type === 'desktop' || x.type === 'tablet' || x.type === 'mobile' ? x.type : fail('bad_device');
  const orientation = x.orientation === 'portrait' || x.orientation === 'landscape' ? x.orientation : fail('bad_device');
  const dim = (v: unknown) => (isNum(v, 0, 20000) ? Math.round(v) : 0);
  return { type, orientation, screenW: dim(x.screenW), screenH: dim(x.screenH), dpr: isNum(x.dpr, 0.5, 8) ? Math.round(x.dpr * 100) / 100 : 1, touch: x.touch === true };
}

function calibration(x: unknown): CalibrationInfo | null {
  if (x === null || x === undefined) return null;
  if (!isObj(x)) fail('bad_calibration');
  const quality = x.quality === 'GOOD' || x.quality === 'FAIR' || x.quality === 'POOR' ? x.quality : fail('bad_calibration');
  const pct = (v: unknown) => (isNum(v, 0, 1000) ? Math.round(v * 10) / 10 : null);
  return { quality, xPct: pct(x.xPct), yPct: pct(x.yPct), points: isNum(x.points, 0, 100) ? Math.round(x.points) : 0 };
}

function samples(x: unknown): CompactSamples {
  const errs = validateCompact(x);
  if (errs.length) fail(errs[0]);
  const c = x as CompactSamples;
  return { tc: c.tc, vt: c.vt, seg: c.seg, it: c.it, vx: c.vx, vy: c.vy, cf: c.cf, un: c.un, st: c.st };
}

/** Słownik odpowiedzi: tylko klucze-identyfikatory i krótkie wartości-identyfikatory (opcje z list). */
function choiceMap(x: unknown, maxKeys = 10): Record<string, string> {
  if (!isObj(x)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(x).slice(0, maxKeys)) if (isId(k, 32) && isId(v, 64)) out[k] = v;
  return out;
}

/** Pytania przesiewowe: tylko klucze `platform_<platforma>` i częstotliwości z listy (§10.3). */
function screenerMap(x: unknown): Record<string, string> {
  if (!isObj(x)) return {};
  const out: Record<string, string> = {};
  for (const p of SCREENER_PLATFORMS) {
    const v = x[`platform_${p}`];
    if (typeof v === 'string' && (SCREENER_FREQUENCIES as readonly string[]).includes(v)) out[`platform_${p}`] = v;
  }
  return out;
}

function items(x: unknown): ItemLog[] | undefined {
  if (!Array.isArray(x)) return undefined;
  return x.slice(0, LIMITS.maxItems).flatMap((it, i): ItemLog[] => {
    if (!isObj(it) || !isId(it.itemId) || !isNum(it.enterMs, 0, LIMITS.maxTcMs)) return [];
    const exits = ['swipe_next', 'swipe_prev', 'end_cap', 'finish'] as const;
    const events = Array.isArray(it.events)
      ? it.events.slice(0, LIMITS.maxItemEvents).flatMap((e) => (isObj(e) && isNum(e.t, 0, LIMITS.maxTcMs) && ['pause', 'resume', 'loop', 'mute', 'unmute'].includes(e.type as string) ? [{ t: Math.round(e.t), type: e.type as ItemLog['events'][number]['type'] }] : []))
      : [];
    return [
      {
        index: isNum(it.index, 0, LIMITS.maxItems) ? Math.round(it.index) : i,
        itemId: it.itemId,
        role: it.role === 'tested' ? 'tested' : 'filler',
        ...(VARIANT_IDS.includes(it.variantId as VariantId) ? { variantId: it.variantId as VariantId } : {}),
        enterMs: Math.round(it.enterMs),
        exitMs: isNum(it.exitMs, 0, LIMITS.maxTcMs) ? Math.round(it.exitMs) : null,
        exitType: exits.includes(it.exitType as never) ? (it.exitType as ItemLog['exitType']) : null,
        loops: isNum(it.loops, 0, 1000) ? Math.round(it.loops) : 0,
        events,
      },
    ];
  });
}

/**
 * Sesja widza z zewnątrz (§15). Zgoda musi mieć wszystkie potwierdzenia, w tym pełnoletność —
 * bez nich sesja nie jest przyjmowana. `createdAt` z zewnątrz tylko przy imporcie plików.
 */
export function sanitizeSession(raw: unknown, opts: { now?: number; trustCreatedAt?: boolean; retentionDays?: number } = {}): ViewerSession {
  if (!isObj(raw)) fail('bad_request');
  const now = opts.now ?? Date.now();
  const c = raw.consent;
  if (!isObj(c) || c.processing !== true || c.localOnly !== true || typeof c.version !== 'string' || !c.version || c.version.length > 32 || !isIso(c.acceptedAt)) fail('consent_required');
  if (c.adult !== true) fail('adult_required');
  if (!isId(raw.id) || !isId(raw.participantId)) fail('bad_request');
  const variantId = VARIANT_IDS.includes(raw.variantId as VariantId) ? (raw.variantId as VariantId) : 'A';
  const ageBand = AGE_BANDS.includes(raw.ageBand as AgeBand) ? (raw.ageBand as AgeBand) : fail('adult_required');
  const source = raw.source === 'webcam' || raw.source === 'simulated' ? raw.source : fail('bad_request');
  const created = opts.trustCreatedAt && isIso(raw.createdAt) && Date.parse(raw.createdAt) <= now + 60_000 ? new Date(Date.parse(raw.createdAt)).toISOString() : new Date(now).toISOString();
  const retention = opts.retentionDays ?? 90;
  const audio = isObj(raw.audio) ? { mode: raw.audio.mode === 'on' ? ('on' as const) : ('off' as const), confirmed: raw.audio.confirmed === true } : { mode: 'off' as const, confirmed: false };
  const it = items(raw.items);
  return {
    schemaVersion: '1.0',
    id: raw.id,
    projectId: isId(raw.projectId) ? raw.projectId : '',
    variantId,
    participantId: raw.participantId,
    ageBand,
    country: typeof raw.country === 'string' && /^[A-Z]{2}$/.test(raw.country) ? raw.country : null,
    screener: screenerMap(raw.screener),
    device: device(raw.device),
    consent: {
      version: c.version as string,
      acceptedAt: new Date(Date.parse(c.acceptedAt as string)).toISOString(),
      adult: true,
      processing: true,
      localOnly: true,
      ...(isLocale(c.lang) ? { lang: c.lang } : {}),
    },
    source,
    calibration: calibration(raw.calibration),
    audio,
    watchedSeconds: isNum(raw.watchedSeconds, 0, LIMITS.maxMediaSeconds) ? raw.watchedSeconds : 0,
    mediaDuration: isNum(raw.mediaDuration, 0, LIMITS.maxMediaSeconds) ? raw.mediaDuration : 0,
    completed: raw.completed === true,
    ...(it ? { items: it } : {}),
    ...(isObj(raw.choice) ? { choice: { itemId: isId(raw.choice.itemId) ? raw.choice.itemId : null } } : {}),
    answers: choiceMap(raw.answers),
    createdAt: created,
    expiresAt: new Date(Date.parse(created) + retention * 86_400_000).toISOString(),
    status: 'valid',
    rejectCode: null,
    manual: false,
    data: samples(raw.data),
  };
}

function scenes(x: unknown): Scene[] {
  if (!Array.isArray(x)) return [];
  return x.slice(0, LIMITS.maxScenes).flatMap((s) => {
    if (!isObj(s) || !isNum(s.start, 0, LIMITS.maxMediaSeconds) || !isNum(s.end, 0, LIMITS.maxMediaSeconds) || s.end <= s.start) return [];
    return [{ id: isId(s.id) ? s.id : `s${Math.round(s.start * 10)}`, start: s.start, end: s.end, source: s.source === 'manual' ? 'manual' : 'auto' } as Scene];
  });
}

export function sanitizeAois(x: unknown): Aoi[] {
  if (!Array.isArray(x)) return [];
  const unit = (v: unknown) => isNum(v, 0, 1);
  return x.slice(0, LIMITS.maxAois).flatMap((a) => {
    if (!isObj(a) || !unit(a.x) || !unit(a.y) || !unit(a.w) || !unit(a.h) || !isNum(a.t0, 0) || !isNum(a.t1, 0) || a.t1 <= a.t0) return [];
    if (!AOI_TYPES.includes(a.type as never)) return [];
    return [
      {
        id: isId(a.id) ? a.id : `aoi_${Math.round(a.x * 1e4)}_${Math.round(a.y * 1e4)}`,
        name: cleanText(a.name, LIMITS.aoiName),
        type: a.type as Aoi['type'],
        x: a.x,
        y: a.y,
        w: Math.min(a.w, 1 - a.x),
        h: Math.min(a.h, 1 - a.y),
        t0: a.t0,
        t1: a.t1,
        ...(isNum(a.slide, 0, LIMITS.maxSlides) ? { slide: Math.round(a.slide) } : {}),
        ...(isNum(a.words, 1, 200) ? { words: Math.round(a.words) } : {}),
      },
    ];
  });
}

/** Źródło materiału. `local` (plik w przeglądarce twórcy) tylko w trybie lokalnym. */
export function sanitizeMedia(x: unknown, allowLocal: boolean): MediaSource {
  if (!isObj(x)) fail('bad_media');
  switch (x.kind) {
    case 'youtube':
      if (typeof x.youtubeId === 'string' && /^[A-Za-z0-9_-]{11}$/.test(x.youtubeId)) return { kind: 'youtube', youtubeId: x.youtubeId };
      break;
    case 'url':
      if (typeof x.url === 'string' && HTTP_URL.test(x.url)) return { kind: 'url', url: x.url };
      break;
    case 'hosted':
      if (isId(x.mediaId) && typeof x.url === 'string' && (HTTP_URL.test(x.url) || /^\/api\/media\/[A-Za-z0-9_-]+$/.test(x.url)) && typeof x.mime === 'string' && /^(video|image)\/[a-z0-9.+-]{2,40}$/.test(x.mime))
        return { kind: 'hosted', mediaId: x.mediaId, url: x.url, mime: x.mime };
      break;
    case 'demo':
      if (isDemoId(x.demo)) return { kind: 'demo', demo: x.demo };
      break;
    case 'local':
      if (!allowLocal) fail('local_media');
      if (typeof x.fileName === 'string' && isNum(x.fileSize, 0)) return { kind: 'local', fileName: cleanText(x.fileName, LIMITS.fileName), fileSize: x.fileSize };
      break;
  }
  return fail('bad_media');
}

/** Wersja materiału z zapisu twórcy (sceny, strefy, metadane). */
export function sanitizeVariant(x: unknown, allowLocal: boolean, index = 0): Variant {
  if (!isObj(x)) fail('bad_variant');
  const id = VARIANT_IDS.includes(x.id as VariantId) ? (x.id as VariantId) : VARIANT_IDS[Math.min(index, 3)];
  const slides = Array.isArray(x.slides) ? x.slides.slice(0, LIMITS.maxSlides).map((s) => sanitizeMedia(s, allowLocal)) : undefined;
  return {
    id,
    label: cleanText(x.label, LIMITS.variantLabel) || `Wersja ${id}`,
    media: x.media === null || x.media === undefined ? null : sanitizeMedia(x.media, allowLocal),
    ...(slides ? { slides } : {}),
    mediaName: cleanText(x.mediaName, LIMITS.fileName),
    duration: isNum(x.duration, 0, LIMITS.maxMediaSeconds) ? x.duration : 0,
    width: isNum(x.width, 1, 10000) ? Math.round(x.width) : 1080,
    height: isNum(x.height, 1, 10000) ? Math.round(x.height) : 1920,
    scenes: scenes(x.scenes),
    aois: sanitizeAois(x.aois),
    ...(isNum(x.sharedFrom, 0, 600) ? { sharedFrom: x.sharedFrom } : {}),
    ...(typeof x.title === 'string' ? { title: cleanText(x.title, 120) } : {}),
  };
}

export function sanitizeFillers(x: unknown, allowLocal: boolean): FillerItem[] {
  if (!Array.isArray(x)) return [];
  return x.slice(0, LIMITS.maxFillers).flatMap((f, i): FillerItem[] => {
    if (!isObj(f)) return [];
    try {
      return [
        {
          id: isId(f.id) ? f.id : `fil_${i}`,
          media: sanitizeMedia(f.media, allowLocal),
          ...(typeof f.title === 'string' ? { title: cleanText(f.title, 120) } : {}),
          duration: isNum(f.duration, 0, LIMITS.maxMediaSeconds) ? f.duration : 0,
          width: isNum(f.width, 1, 10000) ? Math.round(f.width) : 1080,
          height: isNum(f.height, 1, 10000) ? Math.round(f.height) : 1920,
        },
      ];
    } catch {
      return [];
    }
  });
}

export const pickEnum = <T extends string>(x: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(x as T) ? (x as T) : fallback);
export const pickPlatform = (x: unknown) => pickEnum(x, PLATFORMS, 'other');
export const pickKind = (x: unknown) => pickEnum(x, STUDY_KINDS, 'video');
export const pickAudio = (x: unknown) => pickEnum(x, AUDIO_MODES, 'viewer');
export const pickContext = (x: unknown) => pickEnum(x, VIEW_CONTEXTS, 'fullscreen');
export const pickQuestions = (x: unknown) => (Array.isArray(x) ? [...new Set(x.filter((q) => QUESTION_IDS.includes(q as never)))].slice(0, 3) : []) as Array<(typeof QUESTION_IDS)[number]>;
export const pickAgeBands = (x: unknown): AgeBand[] => (Array.isArray(x) ? [...new Set(x.filter((a) => AGE_BANDS.includes(a as AgeBand)))] : AGE_BANDS.slice()) as AgeBand[];
