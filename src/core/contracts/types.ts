/**
 * Kontrakty danych pomiaru (wersjonowane — zmiana struktury = nowa SCHEMA_VERSION).
 *
 * Konwencje:
 *  - współrzędne są znormalizowane 0..1 (x od lewej, y od góry),
 *  - `x/y` — względem okna (ekranu) w trakcie sesji,
 *  - `vx/vy` — względem prostokąta, w którym faktycznie wyświetla się obraz materiału,
 *  - czasy wideo w sekundach, czasy przechwycenia klatki kamery w ms (domena performance.now()).
 */
export const SCHEMA_VERSION = '1.1';

export type TrackingQuality = 'GOOD' | 'FAIR' | 'POOR';
export type SmoothingLevel = 0 | 1 | 2 | 3;
export type VideoState = 'playing' | 'paused' | 'seeking' | 'ended';
export type SessionMode = 'measurement' | 'demo_overlay';
export type GazeSourceKind = 'webcam' | 'simulated' | 'mouse';
export type ClockSource = 'captureTime' | 'presentationTime' | 'performanceNow';

export type SampleFlag =
  | 'no_face'
  | 'blink'
  | 'head_pose'
  | 'distance'
  | 'off_screen'
  | 'outside_video'
  | 'low_conf'
  | 'paused'
  | 'seeking';

export interface HeadPose {
  yaw: number;
  pitch: number;
  roll: number;
}

export interface GazeSample {
  /** Czas przechwycenia klatki kamery (ms, performance.now()). */
  tCapture: number;
  /** Czas materiału (s), który widz widział w chwili przechwycenia klatki. */
  videoTime: number | null;
  /** Numer ciągłego odcinka odtwarzania (zmienia się po pauzie / przewinięciu). */
  segment: number;
  videoState: VideoState;
  /** Surowa (niewygładzona) estymacja — `null`, gdy pomiar jest niewiarygodny. */
  x: number | null;
  y: number | null;
  vx: number | null;
  vy: number | null;
  /** Wartości wygładzone — wyłącznie do prezentacji. */
  fx: number | null;
  fy: number | null;
  confidence: number;
  /** Niepewność (σ) w jednostkach znormalizowanych. */
  uncertainty: number | null;
  faceDetected: boolean;
  eyesOpen: boolean;
  quality: TrackingQuality;
  flags: SampleFlag[];
}

export interface ReferenceState {
  pose: HeadPose;
  scale: number;
  viewport: { width: number; height: number };
}

export interface CalibrationSummary {
  model: string;
  params: Record<string, number>;
  points: number;
  samples: number;
  /** Błąd walidacji krzyżowej (leave-one-point-out), euklidesowy, jednostki znormalizowane. */
  cvError: number;
  testError: { xPct: number; yPct: number; euclid: number } | null;
  quality: TrackingQuality;
  /** Bazowa niepewność σ wynikająca z kalibracji. */
  baseSigma: number;
  reference: ReferenceState;
  createdAt: string;
}

export interface VideoInfo {
  kind: 'file' | 'demo' | 'youtube';
  name: string;
  size?: number;
  /** Identyfikator filmu, gdy materiał był odtwarzany z YouTube. */
  youtubeId?: string;
  duration: number;
  width: number;
  height: number;
}

export interface Scene {
  id: string;
  start: number;
  end: number;
  source: 'auto' | 'manual';
}

export interface SessionMeta {
  schemaVersion: string;
  id: string;
  createdAt: string;
  endedAt?: string;
  mode: SessionMode;
  source: GazeSourceKind;
  /** Etykieta uczestnika w laboratorium (np. „Widz 1”) — nie dane osobowe. */
  participant: string;
  video: VideoInfo;
  screen: { width: number; height: number; dpr: number; fullscreen: boolean };
  camera?: { label: string; width: number; height: number };
  engine: { name: string; smoothingLevel: SmoothingLevel };
  calibration?: CalibrationSummary;
  scenes?: Scene[];
  sampleCount: number;
  disclaimerShown: boolean;
}

export interface Session {
  meta: SessionMeta;
  samples: GazeSample[];
}

export interface Fixation {
  id: number;
  start: number;
  end: number;
  x: number;
  y: number;
  duration: number;
  dispersion: number;
  nSamples: number;
  meanConfidence: number;
}

/** Próbki o niższej pewności nie są traktowane jako prawidłowy pomiar. */
export const MIN_VALID_CONFIDENCE = 0.2;

/** Czy próbka może trafić do analiz (heat mapa, fixacje, statystyki). */
export function isValidSample(s: GazeSample): boolean {
  return (
    s.x !== null &&
    s.y !== null &&
    s.videoTime !== null &&
    s.videoState === 'playing' &&
    s.confidence >= MIN_VALID_CONFIDENCE
  );
}

