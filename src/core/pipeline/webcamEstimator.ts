import { MIN_VALID_CONFIDENCE, type CalibrationSummary, type SampleFlag } from '../contracts/types';
import type { GazePredictor } from '../estimation/gazeModel';
import { clamp01 } from '../math/util';
import { computeConfidence, computeUncertainty, DEFAULT_QUALITY, gateObservation, type QualityConfig } from '../quality/quality';
import type { TrackerFrame } from '../tracking/faceTracker';
import type { RawGaze } from './types';

export const OFF_SCREEN_MARGIN = 0.1;
const JITTER_WINDOW_MS = 300;

/**
 * Klatka z kamery → surowa estymacja punktu na ekranie + pewność i niepewność.
 * Pomiary niewiarygodne (brak twarzy, mrugnięcie, odwrócona głowa) zwracają x/y = null.
 */
export class WebcamGazeEstimator {
  private recent: Array<{ t: number; x: number; y: number }> = [];

  constructor(
    private readonly model: GazePredictor,
    private readonly cal: Pick<CalibrationSummary, 'baseSigma' | 'reference'>,
    private readonly cfg: QualityConfig = DEFAULT_QUALITY,
  ) {}

  estimate(frame: TrackerFrame): RawGaze {
    const t = frame.captureTime;
    const face = frame.face;
    const gate = gateObservation(face, this.cal.reference, this.cfg);
    const empty = (flags: SampleFlag[]): RawGaze => ({
      tCapture: t,
      faceDetected: !!face,
      eyesOpen: face?.eyesOpen ?? false,
      x: null,
      y: null,
      confidence: 0,
      uncertainty: null,
      flags,
    });
    if (!face || !gate.valid) return empty(gate.flags);

    const p = this.model.predict(face.features);
    const m = OFF_SCREEN_MARGIN;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < -m || p.x > 1 + m || p.y < -m || p.y > 1 + m) {
      return empty(['off_screen']);
    }
    const x = clamp01(p.x);
    const y = clamp01(p.y);

    this.recent.push({ t, x, y });
    while (this.recent.length && this.recent[0].t < t - JITTER_WINDOW_MS) this.recent.shift();
    const jitter = this.jitter();

    const sigma = computeUncertainty({
      baseSigma: this.cal.baseSigma,
      novelty: p.novelty,
      poseDelta: gate.poseDelta,
      scaleDelta: gate.scaleDelta / this.cfg.maxScaleDelta,
      jitter,
    });
    const confidence = computeConfidence({ openness: 1 - face.blink, sigma });
    const flags: SampleFlag[] = confidence < MIN_VALID_CONFIDENCE ? ['low_conf'] : [];
    return { tCapture: t, faceDetected: true, eyesOpen: true, x, y, confidence, uncertainty: sigma, flags };
  }

  private jitter(): number {
    const n = this.recent.length;
    if (n < 3) return 0;
    let mx = 0;
    let my = 0;
    for (const r of this.recent) {
      mx += r.x / n;
      my += r.y / n;
    }
    let v = 0;
    for (const r of this.recent) v += ((r.x - mx) ** 2 + (r.y - my) ** 2) / (2 * n);
    return Math.sqrt(v);
  }
}
