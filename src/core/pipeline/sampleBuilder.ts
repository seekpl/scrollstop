import type { GazeSample, SmoothingLevel, TrackingQuality, VideoState } from '../contracts/types';
import { GazeSmoother } from '../filters/oneEuro';
import { toVideoCoords, type Rect } from '../geometry/coords';
import { round } from '../math/util';
import { RollingQuality } from '../quality/quality';
import type { PlaybackClock } from '../time/playbackClock';
import type { DisplayGaze, RawGaze } from './types';

export interface BuildResult {
  sample: GazeSample;
  display: DisplayGaze | null;
  quality: TrackingQuality;
}

const r4 = (v: number | null) => (v === null ? null : round(v, 4));

/**
 * Wspólny etap dla każdego źródła wzroku:
 * synchronizacja z materiałem → współrzędne obrazu materiału → wygładzanie do prezentacji → jakość.
 */
export class SampleBuilder {
  private readonly smoother: GazeSmoother;
  private readonly rolling = new RollingQuality();

  constructor(
    level: SmoothingLevel,
    private readonly clock: PlaybackClock | null,
    private readonly videoRect: () => Rect,
  ) {
    this.smoother = new GazeSmoother(level);
  }

  build(raw: RawGaze): BuildResult {
    const videoTime = this.clock ? this.clock.mediaTimeAt(raw.tCapture) : null;
    const videoState: VideoState = this.clock ? this.clock.state() : 'paused';
    const segment = this.clock?.segment() ?? 0;
    const flags = [...raw.flags];
    if (videoState === 'paused') flags.push('paused');
    else if (videoState === 'seeking') flags.push('seeking');

    const hasPoint = raw.x !== null && raw.y !== null;
    const usable = hasPoint && !flags.includes('low_conf');

    let fx: number | null = null;
    let fy: number | null = null;
    if (hasPoint) {
      const f = this.smoother.push(raw.x as number, raw.y as number, raw.tCapture);
      fx = f.x;
      fy = f.y;
    }
    this.rolling.push(raw.tCapture, usable, raw.confidence);
    const quality = this.rolling.current();

    let vx: number | null = null;
    let vy: number | null = null;
    if (usable) {
      const v = toVideoCoords(raw.x as number, raw.y as number, this.videoRect());
      if (v.inside) {
        vx = v.vx;
        vy = v.vy;
      } else flags.push('outside_video');
    }

    const sample: GazeSample = {
      tCapture: round(raw.tCapture, 2),
      videoTime: videoTime === null ? null : round(videoTime, 4),
      segment,
      videoState,
      x: usable ? r4(raw.x) : null,
      y: usable ? r4(raw.y) : null,
      vx: r4(vx),
      vy: r4(vy),
      fx: usable ? r4(fx) : null,
      fy: usable ? r4(fy) : null,
      confidence: round(raw.confidence, 3),
      uncertainty: raw.uncertainty === null ? null : round(raw.uncertainty, 4),
      faceDetected: raw.faceDetected,
      eyesOpen: raw.eyesOpen,
      quality,
      flags,
    };
    const display: DisplayGaze | null =
      hasPoint && fx !== null && fy !== null
        ? {
            x: fx,
            y: fy,
            confidence: raw.confidence,
            uncertainty: raw.uncertainty ?? 0.05,
            quality,
            dashed: quality === 'POOR' || raw.confidence < 0.4,
          }
        : null;
    return { sample, display, quality };
  }
}
