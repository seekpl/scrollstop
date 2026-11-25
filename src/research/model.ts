/**
 * Model danych badań (§11). Dane zapisują kody (powody odrzucenia, błędy), nigdy teksty w języku UI.
 * Zmiana struktury sesji = nowa `schemaVersion`; zmiana treści zgody = nowa `CONSENT_VERSION`.
 */
import type { Platform } from '../config/platforms';
import type { TrackingQuality } from '../core/contracts/types';
import type { DemoId } from '../demo/demoScene';
import type { Locale } from '../i18n/locales';

export type { Platform } from '../config/platforms';
export type { TrackingQuality } from '../core/contracts/types';
export type { DemoId } from '../demo/demoScene';
export type { Locale } from '../i18n/locales';

export type StudyKind = 'video' | 'hook' | 'abn' | 'feed' | 'thumbnail' | 'carousel' | 'slides';
export type AudioMode = 'on' | 'off' | 'viewer';
export type ViewContext = 'fullscreen' | 'feed' | 'grid' | 'carousel';
export type AgeBand = '18-24' | '25-34' | '35-44' | '45-54' | '55+';
export type VariantId = 'A' | 'B' | 'C' | 'D';
export type AoiType = 'face' | 'text' | 'subtitle' | 'product' | 'logo' | 'cta' | 'object' | 'center';
export type DeviceType = 'desktop' | 'tablet' | 'mobile';
export type TargetDevice = 'mobile' | 'desktop' | 'any';
export type RejectCode = 'no_calibration' | 'poor_calibration' | 'too_short' | 'low_data' | 'over_limit' | 'manual';
export type QuestionId = 'finish' | 'brand_recall' | 'thumb_choice';

export const STUDY_KINDS: StudyKind[] = ['video', 'hook', 'abn', 'feed', 'thumbnail', 'carousel', 'slides'];
export const AUDIO_MODES: AudioMode[] = ['on', 'off', 'viewer'];
export const VIEW_CONTEXTS: ViewContext[] = ['fullscreen', 'feed', 'grid', 'carousel'];
export const AGE_BANDS: AgeBand[] = ['18-24', '25-34', '35-44', '45-54', '55+'];
export const VARIANT_IDS: VariantId[] = ['A', 'B', 'C', 'D'];
export const AOI_TYPES: AoiType[] = ['face', 'text', 'subtitle', 'product', 'logo', 'cta', 'object', 'center'];
export const REJECT_CODES: RejectCode[] = ['no_calibration', 'poor_calibration', 'too_short', 'low_data', 'over_limit', 'manual'];
export const QUESTION_IDS: QuestionId[] = ['finish', 'brand_recall', 'thumb_choice'];
export const RETENTION_OPTIONS = [30, 90, 180, 365] as const;

/** Wersja treści zgody (RRRR-MM-vN). Zmiana tekstu zgody w słownikach = nowa wersja. */
export const CONSENT_VERSION = '2026-11-v1';

export type MediaSource =
  | { kind: 'hosted'; mediaId: string; url: string; mime: string } // plik na serwerze
  | { kind: 'youtube'; youtubeId: string } // 11 znaków [A-Za-z0-9_-]
  | { kind: 'url'; url: string } // HTTPS, bezpośrednio do pliku
  | { kind: 'local'; fileName: string; fileSize: number } // tylko tryb lokalny, ta przeglądarka
  | { kind: 'demo'; demo: DemoId };

export interface Scene {
  id: string;
  start: number;
  end: number;
  source: 'auto' | 'manual';
}

export interface Aoi {
  id: string;
  name: string;
  type: AoiType;
  /** Prostokąt 0..1 na obrazie materiału. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Sekundy materiału. */
  t0: number;
  t1: number;
  /** Karuzela, slajdy: numer slajdu (0..). */
  slide?: number;
  /** Tekst, napisy: liczba słów (czytelność, §6.13). */
  words?: number;
}

export interface Variant {
  id: VariantId;
  /** Domyślnie „Wersja A” (tłumaczona przy wyświetlaniu, §18). */
  label: string;
  /** Wideo albo miniatura. */
  media: MediaSource | null;
  /** Karuzela, slajdy. */
  slides?: MediaSource[];
  mediaName: string;
  /** 0 = nieznana do pierwszej sesji. */
  duration: number;
  /** Nominalnie; liczą się proporcje. */
  width: number;
  height: number;
  scenes: Scene[];
  aois: Aoi[];
  /** Hook: od tej sekundy wersje są identyczne. */
  sharedFrom?: number;
  /** Miniatura: tytuł pod okładką. */
  title?: string;
}

export interface FillerItem {
  id: string;
  media: MediaSource;
  title?: string;
  duration: number;
  width: number;
  height: number;
}

export interface DeviceInfo {
  type: DeviceType;
  orientation: 'landscape' | 'portrait';
  screenW: number;
  screenH: number;
  dpr: number;
  touch: boolean;
}

export interface FeedSettings {
  items: number;
  stopSeconds: number;
  capSeconds: number;
}

export interface GridSettings {
  layout: 'yt_home' | 'yt_search_mobile' | 'profile_grid';
  exposureSeconds: number;
  askChoice: boolean;
}

export interface SlidesSettings {
  mode: 'auto' | 'self';
  secondsPerSlide: number;
}

export interface Audience {
  source: 'community' | 'panel' | 'mixed';
  ageBands: AgeBand[];
  countries: string[];
  /** Pytanie przesiewowe o korzystanie z platform. */
  screenPlatforms: boolean;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  /** Widoczny na ekranie zgody. */
  creatorName: string;
  kind: StudyKind;
  platform: Platform;
  audio: AudioMode;
  context: ViewContext;
  platformUi: 'none' | 'generic';
  caption?: string;
  targetDevice: TargetDevice;
  /** 1–4. */
  variants: Variant[];
  /** Feed, siatka. */
  fillers: FillerItem[];
  feed?: FeedSettings;
  grid?: GridSettings;
  slides?: SlidesSettings;
  /** 0–3 z gotowej listy. */
  questions: QuestionId[];
  audience: Audience;
  /** Domyślnie 30 (A/B: 50 na wersję). */
  targetSessions: number;
  status: 'collecting' | 'paused' | 'closed';
  /** Losowy, 16 bajtów base64url. */
  linkToken: string;
  /** Domyślnie 90. */
  retentionDays: number;
  /** Język badania. */
  locale: Locale;
  createdAt: string;
  updatedAt: string;
  /** Dołączane przez API przy liście. */
  counts?: { total: number; valid: number };
}

/** Format kolumnowy próbek (mały, łatwy do walidacji, §11.3). */
export interface CompactSamples {
  /** ms od początku sesji. */
  tc: number[];
  /** Czas materiału (s, 3 miejsca) albo -1. */
  vt: number[];
  /** Numer ciągłego odcinka odtwarzania. */
  seg: number[];
  /** Indeks pozycji feedu, siatki, slajdu (-1 = brak; pełny ekran: 0). */
  it: number[];
  /** ×1000 (0..1000) albo -1. */
  vx: number[];
  vy: number[];
  /** Pewność ×100. */
  cf: number[];
  /** Niepewność σ ×1000 albo -1. */
  un: number[];
  /** GazeCode 0..4. */
  st: number[];
}

export type ItemExit = 'swipe_next' | 'swipe_prev' | 'end_cap' | 'finish';
export type ItemEventType = 'pause' | 'resume' | 'loop' | 'mute' | 'unmute';

export interface ItemLog {
  index: number;
  itemId: string;
  role: 'tested' | 'filler';
  variantId?: VariantId;
  enterMs: number;
  exitMs: number | null;
  exitType: ItemExit | null;
  loops: number;
  events: Array<{ t: number; type: ItemEventType }>;
}

export interface ConsentRecord {
  version: string;
  acceptedAt: string;
  adult: true;
  processing: true;
  localOnly: true;
  lang?: Locale;
}

export interface CalibrationInfo {
  quality: TrackingQuality;
  xPct: number | null;
  yPct: number | null;
  points: number;
}

export interface ViewerSession {
  schemaVersion: '1.0';
  /** ses_ + 12 bajtów. */
  id: string;
  projectId: string;
  variantId: VariantId;
  /** p_ + 9 bajtów, losowy, niełączony z osobą. */
  participantId: string;
  ageBand: AgeBand;
  country: string | null;
  /** Tylko wartości z list. */
  screener: Record<string, string>;
  device: DeviceInfo;
  consent: ConsentRecord;
  source: 'webcam' | 'simulated';
  calibration: CalibrationInfo | null;
  audio: { mode: 'on' | 'off'; confirmed: boolean };
  watchedSeconds: number;
  mediaDuration: number;
  completed: boolean;
  /** Feed, siatka, karuzela. */
  items?: ItemLog[];
  /** Wybór w teście miniatury. */
  choice?: { itemId: string | null };
  /** Pytania po obejrzeniu, tylko opcje z listy. */
  answers: Record<string, string>;
  createdAt: string;
  /** createdAt + retentionDays. */
  expiresAt: string;
  status: 'valid' | 'rejected';
  rejectCode: RejectCode | null;
  manual: boolean;
  /** Skrót identyfikatora z panelu, do rozliczeń. */
  panel?: { provider: string; refHash: string };
  data: CompactSamples;
}

/** Konfiguracja dla widza (z serwera albo zakodowana w linku, §11.4). */
export interface StudyConfig {
  projectId: string;
  projectName: string;
  creatorName: string;
  kind: StudyKind;
  platform: Platform;
  audio: AudioMode;
  context: ViewContext;
  platformUi: 'none' | 'generic';
  caption?: string;
  targetDevice: TargetDevice;
  variant: Pick<Variant, 'id' | 'media' | 'slides' | 'mediaName' | 'duration' | 'width' | 'height' | 'title'>;
  fillers: FillerItem[];
  feed?: FeedSettings;
  grid?: GridSettings;
  slides?: SlidesSettings;
  questions: QuestionId[];
  ageBands: AgeBand[];
  screenPlatforms: boolean;
  consentVersion: string;
  /** serwer / ta przeglądarka / plik do odesłania. */
  transport: 'server' | 'local' | 'package';
  linkToken: string;
  retentionDays: number;
  locale: Locale;
  panel?: { provider: string; completeUrl: string; screenoutUrl: string; qualityFailUrl: string };
}

/** Plik sesji do odesłania twórcy (badanie bez serwera). */
export interface SessionPackage {
  kind: 'attn-session';
  version: 1;
  session: ViewerSession;
}

/** Kody stanu próbki (§5.10). Najbardziej odporny sygnał to „patrzy / nie patrzy”. */
export const GazeCode = {
  /** Wzrok na obrazie materiału (są vx, vy). */
  LOOK: 0,
  /** Na ekranie, poza obrazem (pasy, nakładka feedu). */
  LOOK_OFF_MEDIA: 1,
  /** Brak twarzy, odwrócona głowa, wzrok poza ekranem. */
  AWAY: 2,
  /** Mrugnięcie, niska pewność, zmiana odległości. */
  UNKNOWN: 3,
  /** Pauza, przewijanie, koniec, przejście między pozycjami feedu. */
  NOT_PLAYING: 4,
} as const;
export type GazeCodeValue = (typeof GazeCode)[keyof typeof GazeCode];

/** Limity danych (§11.4). */
export const LIMITS = {
  maxSamples: 252_000,
  maxMediaSeconds: 4 * 3600,
  maxTcMs: 3 * 4 * 3600 * 1000,
  maxSeg: 100_000,
  maxScenes: 400,
  maxAois: 50,
  aoiName: 80,
  variantLabel: 60,
  fileName: 200,
  maxVariants: 4,
  maxFillers: 20,
  maxSlides: 20,
  maxItems: 40,
  maxItemEvents: 400,
} as const;
