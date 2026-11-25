import type { GazeSourceKind } from '../core/contracts/types';
import type { WebcamGazeEstimator } from '../core/pipeline/webcamEstimator';
import type { RawGaze } from '../core/pipeline/types';
import type { PlaybackClock } from '../core/time/playbackClock';
import type { TrackerFrame } from '../core/tracking/faceTracker';
import type { DemoSpec } from '../demo/demoScene';
import { GazeSimulator } from '../demo/simulator';

/** Wspólny interfejs źródeł wzroku: kamera, symulacja (demo) i mysz (testy UI). */
export interface GazeSource {
  readonly kind: GazeSourceKind;
  start(cb: (g: RawGaze) => void): void;
  stop(): void;
}

interface FrameHub {
  subscribe(l: (f: TrackerFrame) => void): () => void;
}

export class WebcamGazeSource implements GazeSource {
  readonly kind = 'webcam' as const;
  private unsub: (() => void) | null = null;

  constructor(
    private readonly hub: FrameHub,
    private readonly estimator: WebcamGazeEstimator,
  ) {}

  start(cb: (g: RawGaze) => void): void {
    this.unsub = this.hub.subscribe((f) => cb(this.estimator.estimate(f)));
  }

  stop(): void {
    this.unsub?.();
    this.unsub = null;
  }
}

export class SimulatedGazeSource implements GazeSource {
  readonly kind = 'simulated' as const;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly sim: GazeSimulator;

  constructor(
    private readonly clock: PlaybackClock,
    spec: DemoSpec,
  ) {
    this.sim = new GazeSimulator(spec);
  }

  start(cb: (g: RawGaze) => void): void {
    this.timer = setInterval(() => {
      const now = performance.now();
      cb(this.sim.sample(this.clock.mediaTimeAt(now) ?? 0, now));
    }, 1000 / 30);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

/** Kursor myszy jako „wzrok” — pozwala sprawdzić overlay i analizy bez kamery. */
export class MouseGazeSource implements GazeSource {
  readonly kind = 'mouse' as const;
  private timer: ReturnType<typeof setInterval> | null = null;
  private pos: { x: number; y: number } | null = null;
  private readonly onMove = (e: PointerEvent) => {
    this.pos = { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight };
  };

  start(cb: (g: RawGaze) => void): void {
    window.addEventListener('pointermove', this.onMove);
    this.timer = setInterval(() => {
      const now = performance.now();
      if (!this.pos) {
        cb({ tCapture: now, faceDetected: false, eyesOpen: false, x: null, y: null, confidence: 0, uncertainty: null, flags: ['no_face'] });
        return;
      }
      cb({ tCapture: now, faceDetected: true, eyesOpen: true, x: this.pos.x, y: this.pos.y, confidence: 0.9, uncertainty: 0.02, flags: [] });
    }, 1000 / 30);
  }

  stop(): void {
    window.removeEventListener('pointermove', this.onMove);
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
