import { isValidSample, type GazeSample, type TrackingQuality } from '../contracts/types';
import { clamp, mean, std } from '../math/util';

export type Region = 'left' | 'center' | 'right';


export interface SessionStats {
  watchedSeconds: number;
  trackedSeconds: number;
  validRatio: number;
  nSamples: number;
  nValid: number;
  avgConfidence: number;
  avgUncertainty: number;
  regionShares: Record<Region, number>;
  dominantRegion: Region | null;
  longestStreakSeconds: number;
  qualityShares: Record<TrackingQuality, number>;
}

const MAX_DT = 0.1;
const STREAK_GAP_MS = 300;

export function regionOf(x: number): Region {
  return x < 1 / 3 ? 'left' : x < 2 / 3 ? 'center' : 'right';
}

export function computeStats(samples: readonly GazeSample[]): SessionStats {
  const sorted = [...samples].sort((a, b) => a.tCapture - b.tCapture);
  let watched = 0;
  let tracked = 0;
  const regionTime: Record<Region, number> = { left: 0, center: 0, right: 0 };
  const qualityTime: Record<TrackingQuality, number> = { GOOD: 0, FAIR: 0, POOR: 0 };
  const confs: number[] = [];
  const uncs: number[] = [];
  let longest = 0;
  let streakStart: number | null = null;
  let lastValidT: number | null = null;
  let nValid = 0;

  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    const next = sorted[i + 1];
    const dt = next ? clamp((next.tCapture - s.tCapture) / 1000, 0, MAX_DT) : 1 / 30;
    if (s.videoState === 'playing') {
      watched += dt;
      qualityTime[s.quality] += dt;
    }
    if (isValidSample(s)) {
      nValid++;
      tracked += dt;
      regionTime[regionOf(s.x as number)] += dt;
      confs.push(s.confidence);
      if (s.uncertainty !== null) uncs.push(s.uncertainty);
      if (lastValidT === null || s.tCapture - lastValidT > STREAK_GAP_MS || streakStart === null) streakStart = s.tCapture;
      lastValidT = s.tCapture;
      longest = Math.max(longest, (s.tCapture - streakStart) / 1000 + dt);
    }
  }
  const regionTotal = regionTime.left + regionTime.center + regionTime.right;
  const regionShares: Record<Region, number> = {
    left: regionTotal ? regionTime.left / regionTotal : 0,
    center: regionTotal ? regionTime.center / regionTotal : 0,
    right: regionTotal ? regionTime.right / regionTotal : 0,
  };
  const dominantRegion = regionTotal
    ? (Object.entries(regionShares).sort((a, b) => b[1] - a[1])[0][0] as Region)
    : null;
  const qTotal = qualityTime.GOOD + qualityTime.FAIR + qualityTime.POOR;
  return {
    watchedSeconds: watched,
    trackedSeconds: tracked,
    validRatio: watched > 0 ? Math.min(1, tracked / watched) : 0,
    nSamples: sorted.length,
    nValid,
    avgConfidence: confs.length ? mean(confs) : 0,
    avgUncertainty: uncs.length ? mean(uncs) : 0,
    regionShares,
    dominantRegion,
    longestStreakSeconds: longest,
    qualityShares: {
      GOOD: qTotal ? qualityTime.GOOD / qTotal : 0,
      FAIR: qTotal ? qualityTime.FAIR / qTotal : 0,
      POOR: qTotal ? qualityTime.POOR / qTotal : 0,
    },
  };
}

export interface AttentionBin {
  t0: number;
  t1: number;
  /** Udział ważnych próbek „na ekranie” w przedziale. */
  onScreen: number;
  /** 1 = wzrok stabilny, 0 = bardzo rozproszony. */
  stability: number;
  /** Średnia pewność pomiaru. */
  quality: number;
  /** Eksperymentalna miara „szacowanego patrzenia na ekran” — null, gdy danych jest za mało. */
  estimated: number | null;
}

/** Eksperymentalna oś czasu — nie jest pomiarem uwagi w sensie psychologicznym. */
export function attentionTimeline(samples: readonly GazeSample[], duration: number, binSeconds = 1): AttentionBin[] {
  const nBins = Math.max(1, Math.ceil(duration / binSeconds));
  const bins: GazeSample[][] = Array.from({ length: nBins }, () => []);
  for (const s of samples) {
    if (s.videoTime === null || s.videoState !== 'playing') continue;
    const k = Math.min(nBins - 1, Math.floor(s.videoTime / binSeconds));
    if (k >= 0) bins[k].push(s);
  }
  return bins.map((b, k) => {
    const valid = b.filter(isValidSample);
    const onScreen = b.length ? valid.length / b.length : 0;
    const spread = valid.length >= 3 ? Math.hypot(std(valid.map((s) => s.x as number)), std(valid.map((s) => s.y as number))) : 0.25;
    const stability = 1 - Math.min(1, spread / 0.25);
    const quality = b.length ? mean(b.map((s) => s.confidence)) : 0;
    const estimated = b.length >= 3 && quality >= 0.25 ? onScreen * (0.5 + 0.5 * stability) : null;
    return { t0: k * binSeconds, t1: (k + 1) * binSeconds, onScreen, stability, quality, estimated };
  });
}

export function sessionDuration(samples: readonly GazeSample[], declared: number): number {
  if (declared > 0) return declared;
  let max = 0;
  for (const s of samples) if (s.videoTime !== null && s.videoTime > max) max = s.videoTime;
  return max;
}
