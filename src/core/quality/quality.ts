import type { HeadPose, SampleFlag, TrackingQuality } from '../contracts/types';
import type { FaceObservation } from '../tracking/features';
import { MEASUREMENT } from '../config';
import { clamp } from '../math/util';

/**
 * Progi jakości to heurystyczne punkty startowe (do strojenia na nagraniach testowych),
 * a nie wartości z literatury.
 */
export interface QualityConfig {
  maxYawDelta: number;
  maxPitchDelta: number;
  maxScaleDelta: number;
}

export const DEFAULT_QUALITY: QualityConfig = { ...MEASUREMENT.quality };

export interface GateResult {
  valid: boolean;
  flags: SampleFlag[];
  /** 0..1+ — odchylenie pozy od kalibracji względem dopuszczalnego zakresu. */
  poseDelta: number;
  /** |skala / skala_kalibracji − 1|. */
  scaleDelta: number;
}

export function gateObservation(
  obs: FaceObservation | null,
  ref: { pose: HeadPose; scale: number } | null,
  cfg: QualityConfig = DEFAULT_QUALITY,
): GateResult {
  if (!obs) return { valid: false, flags: ['no_face'], poseDelta: 0, scaleDelta: 0 };
  const flags: SampleFlag[] = [];
  if (!obs.eyesOpen) flags.push('blink');
  let poseDelta = 0;
  let scaleDelta = 0;
  if (ref) {
    const dy = Math.abs(obs.pose.yaw - ref.pose.yaw);
    const dp = Math.abs(obs.pose.pitch - ref.pose.pitch);
    poseDelta = Math.max(dy / cfg.maxYawDelta, dp / cfg.maxPitchDelta);
    if (poseDelta > 1) flags.push('head_pose');
    scaleDelta = ref.scale > 0 ? Math.abs(obs.scale / ref.scale - 1) : 0;
    if (scaleDelta > cfg.maxScaleDelta) flags.push('distance');
  }
  return { valid: flags.length === 0, flags, poseDelta, scaleDelta };
}

export interface UncertaintyInput {
  baseSigma: number;
  novelty: number;
  poseDelta: number;
  /** Znormalizowane do zakresu dopuszczalnego (0..1). */
  scaleDelta: number;
  jitter: number;
}

/** σ rośnie z: błędem kalibracji, ekstrapolacją modelu, odchyleniem pozy/odległości i drganiami. */
export function computeUncertainty(i: UncertaintyInput): number {
  const s =
    i.baseSigma *
      (1 + 1.5 * clamp(i.novelty, 0, 1)) *
      (1 + 0.5 * clamp(i.poseDelta, 0, 2)) *
      (1 + 0.5 * clamp(i.scaleDelta, 0, 2)) +
    i.jitter;
  return clamp(s, 0.01, 0.5);
}

export const SIGMA_REF = 0.25;

export function computeConfidence(i: { openness: number; sigma: number; faceScore?: number }): number {
  return clamp((i.faceScore ?? 1) * clamp(i.openness, 0, 1) * Math.exp(-i.sigma / SIGMA_REF), 0, 1);
}

/** Wskaźnik GOOD / FAIR / POOR z ostatnich ~2 s. */
export class RollingQuality {
  private buf: Array<{ t: number; valid: boolean; conf: number }> = [];

  constructor(private readonly windowMs = 2000) {}

  push(t: number, valid: boolean, conf: number): void {
    this.buf.push({ t, valid, conf });
    while (this.buf.length && this.buf[0].t < t - this.windowMs) this.buf.shift();
  }

  current(): TrackingQuality {
    if (!this.buf.length) return 'POOR';
    const valid = this.buf.filter((b) => b.valid);
    const ratio = valid.length / this.buf.length;
    const meanConf = valid.length ? valid.reduce((s, b) => s + b.conf, 0) / valid.length : 0;
    if (ratio >= 0.8 && meanConf >= 0.6) return 'GOOD';
    if (ratio >= 0.5 && meanConf >= 0.35) return 'FAIR';
    return 'POOR';
  }
}
