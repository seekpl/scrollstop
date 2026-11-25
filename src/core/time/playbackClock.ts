import type { VideoState } from '../contracts/types';

/**
 * Zegar odtwarzania: odpowiada na pytanie „którą chwilę materiału widz widział
 * w momencie T (ms, performance.now())?”.
 */
export interface PlaybackClock {
  mediaTimeAt(perfMs: number): number | null;
  state(): VideoState;
  segment(): number;
  duration(): number;
  dispose(): void;
}

export interface FramePair {
  /** Kiedy klatka pojawiła się na ekranie (ms, performance.now()). */
  display: number;
  /** Znacznik czasu klatki w filmie (s, PTS). */
  media: number;
}

/**
 * Interpolacja czasu filmu dla danej chwili: bierzemy ostatnią wyświetloną klatkę
 * przed T i dodajemy upływ czasu × prędkość odtwarzania.
 */
export function interpolateMediaTime(
  pairs: readonly FramePair[],
  t: number,
  rate: number,
  playing: boolean,
  fallback: number | null,
): number | null {
  if (!pairs.length) return fallback;
  let best = pairs[0];
  for (let i = pairs.length - 1; i >= 0; i--) {
    if (pairs[i].display <= t) {
      best = pairs[i];
      break;
    }
  }
  if (!playing) return best.media;
  return Math.max(0, best.media + ((t - best.display) / 1000) * rate);
}

/** Zegar oparty na <video> i requestVideoFrameCallback (mediaTime = PTS faktycznie wyświetlonej klatki). */
export class VideoElementClock implements PlaybackClock {
  private pairs: FramePair[] = [];
  private st: VideoState = 'paused';
  private seg = 0;
  private handle = 0;
  private disposed = false;
  private readonly off: Array<() => void> = [];

  constructor(private readonly video: HTMLVideoElement) {
    const on = (ev: string, fn: () => void) => {
      video.addEventListener(ev, fn);
      this.off.push(() => video.removeEventListener(ev, fn));
    };
    on('playing', () => {
      if (this.st !== 'playing') {
        this.st = 'playing';
        this.seg++;
      }
    });
    on('pause', () => {
      if (this.st !== 'ended') this.st = 'paused';
    });
    on('waiting', () => {
      if (this.st === 'playing') this.st = 'paused';
    });
    on('seeking', () => {
      this.st = 'seeking';
      this.pairs = [];
    });
    on('seeked', () => {
      this.st = video.paused ? 'paused' : 'playing';
      this.seg++;
    });
    on('ended', () => {
      this.st = 'ended';
    });
    if (typeof video.requestVideoFrameCallback === 'function') {
      const step: VideoFrameRequestCallback = (_now, meta) => {
        if (this.disposed) return;
        this.pairs.push({ display: meta.expectedDisplayTime, media: meta.mediaTime });
        if (this.pairs.length > 90) this.pairs.shift();
        this.handle = video.requestVideoFrameCallback(step);
      };
      this.handle = video.requestVideoFrameCallback(step);
    }
  }

  mediaTimeAt(perfMs: number): number | null {
    const ct = this.video.currentTime;
    return interpolateMediaTime(
      this.pairs,
      perfMs,
      this.video.playbackRate || 1,
      this.st === 'playing',
      Number.isFinite(ct) ? ct : null,
    );
  }

  state(): VideoState {
    return this.st;
  }

  segment(): number {
    return this.seg;
  }

  duration(): number {
    return Number.isFinite(this.video.duration) ? this.video.duration : 0;
  }

  dispose(): void {
    this.disposed = true;
    if (typeof this.video.cancelVideoFrameCallback === 'function') this.video.cancelVideoFrameCallback(this.handle);
    this.off.forEach((f) => f());
  }
}

/** Zegar sterowany ręcznie (klipy demo, symulacja, testy, pozycje feedu). */
export class ManualClock implements PlaybackClock {
  private startPerf = 0;
  private offset = 0;
  private st: VideoState = 'paused';
  private seg = 0;

  constructor(private readonly dur: number) {}

  play(now = performance.now()): void {
    if (this.st === 'playing') return;
    if (this.st === 'ended') this.offset = 0;
    this.startPerf = now;
    this.st = 'playing';
    this.seg++;
  }

  pause(now = performance.now()): void {
    if (this.st !== 'playing') return;
    this.offset = this.timeAt(now);
    this.st = 'paused';
  }

  seek(t: number, now = performance.now()): void {
    this.offset = Math.min(this.dur, Math.max(0, t));
    this.startPerf = now;
    this.seg++;
  }

  end(): void {
    this.offset = this.dur;
    this.st = 'ended';
  }

  private timeAt(perf: number): number {
    return this.st === 'playing' ? Math.min(this.dur, this.offset + (perf - this.startPerf) / 1000) : this.offset;
  }

  mediaTimeAt(perfMs: number): number {
    return this.timeAt(perfMs);
  }

  state(): VideoState {
    return this.st;
  }

  segment(): number {
    return this.seg;
  }

  duration(): number {
    return this.dur;
  }

  dispose(): void {}
}
