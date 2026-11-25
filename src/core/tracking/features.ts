import type { HeadPose } from '../contracts/types';
import { MEASUREMENT } from '../config';
import { clamp } from '../math/util';

/**
 * Ekstrakcja cech z 478 landmarków MediaPipe Face Landmarker.
 *
 * Kluczowa zasada: NIE przyjmujemy „pozycja irysa = punkt na ekranie”.
 * Pozycję irysa wyrażamy w układzie twarzy (względem kącików oka, po kompensacji
 * obrotu głowy w płaszczyźnie obrazu), a pozę głowy, skalę i położenie twarzy
 * podajemy jako osobne cechy. Mapowanie na ekran robi indywidualna kalibracja.
 */
export interface Pt {
  x: number;
  y: number;
}

export interface BlendshapeCategory {
  categoryName: string;
  score: number;
}

export const LANDMARKS = {
  // „Prawe/lewe” z perspektywy widza (MediaPipe).
  rightEye: { outer: 33, inner: 133, upper: 159, lower: 145, ear: [33, 160, 158, 133, 153, 144] },
  leftEye: { outer: 263, inner: 362, upper: 386, lower: 374, ear: [362, 385, 387, 263, 373, 380] },
  rightIris: [468, 469, 470, 471, 472],
  leftIris: [473, 474, 475, 476, 477],
  noseTip: 1,
} as const;

export const FEATURE_NAMES = ['uR', 'vR', 'uL', 'vL', 'yaw', 'pitch', 'roll', 'scale', 'cx', 'cy', 'open'] as const;

export const BLINK_THRESHOLD = 0.55;
export const EAR_MIN = 0.12;

export interface FaceObservation {
  features: number[];
  pose: HeadPose;
  /** Odległość między środkami irysów / szerokość obrazu (proxy odległości od kamery). */
  scale: number;
  /** Środek oczu w kadrze kamery (0..1). */
  center: Pt;
  ear: number;
  /** 0..1 — prawdopodobieństwo mrugnięcia. */
  blink: number;
  eyesOpen: boolean;
  /** Punkty do podglądu (piksele obrazu kamery) — nigdy nie są zapisywane. */
  debug: { irisL: Pt; irisR: Pt; eyePoints: Pt[] };
}

const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const dot = (a: Pt, b: Pt): number => a.x * b.x + a.y * b.y;
const len = (a: Pt): number => Math.hypot(a.x, a.y);
const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const centroid = (pts: Pt[]): Pt => ({
  x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
  y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
});
const DEG = 180 / Math.PI;

export function eyeAspectRatio(P: Pt[], idx: readonly number[]): number {
  const [p1, p2, p3, p4, p5, p6] = idx.map((i) => P[i]);
  const h = len(sub(p1, p4));
  if (h < 1e-6) return 0;
  return (len(sub(p2, p6)) + len(sub(p3, p5))) / (2 * h);
}

/** Kąty Eulera (ZYX) z macierzy 4×4 MediaPipe zapisanej kolumnami. */
export function poseFromMatrix(m: ArrayLike<number>): HeadPose {
  const r00 = m[0];
  const r10 = m[1];
  const r20 = m[2];
  const r21 = m[6];
  const r22 = m[10];
  return {
    yaw: Math.asin(clamp(-r20, -1, 1)) * DEG,
    pitch: Math.atan2(r21, r22) * DEG,
    roll: Math.atan2(r10, r00) * DEG,
  };
}

/** Przybliżona poza z geometrii landmarków (gdy brak macierzy transformacji). */
export function poseFromLandmarks(P: Pt[]): HeadPose {
  const r = P[LANDMARKS.rightEye.outer];
  const l = P[LANDMARKS.leftEye.outer];
  const nose = P[LANDMARKS.noseTip];
  const axis = sub(l, r);
  const io = len(axis) || 1;
  const ux = { x: axis.x / io, y: axis.y / io };
  const uy = { x: -ux.y, y: ux.x };
  const d = sub(nose, mid(r, l));
  return {
    yaw: Math.asin(clamp(dot(d, ux) / (0.9 * io), -1, 1)) * DEG,
    pitch: (dot(d, uy) / io - 0.6) * 90,
    roll: Math.atan2(axis.y, axis.x) * DEG,
  };
}

export function buildObservation(
  landmarks: ReadonlyArray<{ x: number; y: number }>,
  imgW: number,
  imgH: number,
  blendshapes?: readonly BlendshapeCategory[],
  matrix?: ArrayLike<number>,
): FaceObservation | null {
  if (!landmarks || landmarks.length < 478 || imgW <= 0 || imgH <= 0) return null;
  const P: Pt[] = landmarks.map((p) => ({ x: p.x * imgW, y: p.y * imgH }));
  const R = LANDMARKS.rightEye;
  const L = LANDMARKS.leftEye;
  const irisR = centroid(LANDMARKS.rightIris.map((i) => P[i]));
  const irisL = centroid(LANDMARKS.leftIris.map((i) => P[i]));

  // Wspólna oś pozioma twarzy (kącik zewn. prawego → kącik zewn. lewego oka) kompensuje „roll”.
  const axis = sub(P[L.outer], P[R.outer]);
  const faceW = len(axis);
  if (faceW < 1) return null;
  const ux = { x: axis.x / faceW, y: axis.y / faceW };
  const uy = { x: -ux.y, y: ux.x };

  const eye = (e: { inner: number; outer: number; upper: number; lower: number }, iris: Pt) => {
    const a = P[e.inner];
    const b = P[e.outer];
    const w = len(sub(b, a)) || 1;
    const d = sub(iris, mid(a, b));
    return { u: dot(d, ux) / w, v: dot(d, uy) / w, open: len(sub(P[e.upper], P[e.lower])) / w };
  };
  const er = eye(R, irisR);
  const el = eye(L, irisL);

  const pose = matrix && matrix.length >= 16 ? poseFromMatrix(matrix) : poseFromLandmarks(P);
  const scale = len(sub(irisL, irisR)) / imgW;
  const center = { x: (irisL.x + irisR.x) / 2 / imgW, y: (irisL.y + irisR.y) / 2 / imgH };
  const ear = (eyeAspectRatio(P, R.ear) + eyeAspectRatio(P, L.ear)) / 2;

  let blink: number;
  if (blendshapes && blendshapes.length) {
    const get = (n: string) => blendshapes.find((b) => b.categoryName === n)?.score ?? 0;
    blink = Math.max(get('eyeBlinkLeft'), get('eyeBlinkRight'));
  } else {
    blink = clamp((0.24 - ear) / 0.1, 0, 1);
  }
  const eyesOpen = blink < BLINK_THRESHOLD && ear > EAR_MIN;
  const open = (er.open + el.open) / 2;

  return {
    features: [er.u, er.v, el.u, el.v, pose.yaw, pose.pitch, pose.roll, scale, center.x, center.y, open],
    pose,
    scale,
    center,
    ear,
    blink,
    eyesOpen,
    debug: {
      irisL,
      irisR,
      eyePoints: [R.outer, R.inner, R.upper, R.lower, L.outer, L.inner, L.upper, L.lower].map((i) => P[i]),
    },
  };
}

/**
 * Przybliżona odległość twarzy od kamery (cm): `E / (scale · 2 · tan(HFOV/2))`, gdzie E to średni
 * rozstaw źrenic dorosłego (6,3 cm), a HFOV ≈ 65° (§5.3). Tylko do wskazówki „bliżej / dalej”.
 */
export function estimateDistanceCm(scale: number): number {
  if (scale <= 0) return NaN;
  return MEASUREMENT.interPupillaryCm / (scale * 2 * Math.tan(((MEASUREMENT.cameraHfovDeg / 2) * Math.PI) / 180));
}
