import type { VideoState } from '../core/contracts/types';
import type { PlaybackClock } from '../core/time/playbackClock';
import { YT_STATE } from './api';

/** Część odtwarzacza YouTube potrzebna zegarowi (w testach — atrapa). */
export interface YouTubeClockPlayer {
  getCurrentTime(): number;
  getPlayerState(): number;
  getPlaybackRate(): number;
  getDuration(): number;
}

/** Okno obserwacji, z którego liczymy przesunięcie zegara filmu względem performance.now(). */
const WINDOW_MS = 3000;
/** Rozbieżność z prognozą, powyżej której uznajemy, że film przeskoczył (przewinięcie). */
const JUMP_S = 1;
/** Czas bez postępu filmu w stanie PLAYING, po którym traktujemy go jak pauzę (zacięcie, reklama). */
const STALL_MS = 1000;

export function ytVideoState(state: number): VideoState {
  if (state === YT_STATE.PLAYING) return 'playing';
  if (state === YT_STATE.ENDED) return 'ended';
  // PAUSED, BUFFERING (jak 'waiting' w <video>), CUED, UNSTARTED
  return 'paused';
}

/**
 * Zegar odtwarzacza YouTube (iframe). IFrame API nie ma odpowiednika
 * requestVideoFrameCallback — `getCurrentTime()` przychodzi przez postMessage
 * z opóźnieniem i aktualizuje się skokowo. Każda obserwacja jest więc dolnym
 * ograniczeniem prawdziwego czasu filmu: przesunięcie zegara to górna obwiednia
 * (maksimum) obserwacji z ostatnich 3 s. Okno jest czyszczone po zmianie stanu,
 * prędkości lub przeskoku czasu.
 *
 * `observe()` trzeba wywoływać cyklicznie (~20 Hz) i przy każdej zmianie stanu odtwarzacza.
 */
export class YouTubeClock implements PlaybackClock {
  private obs: Array<{ perf: number; media: number }> = [];
  private st: VideoState = 'paused';
  private seg = 0;
  private rate = 1;
  private last: number | null = null;
  private advancedAt = -Infinity;

  constructor(private readonly player: YouTubeClockPlayer) {}

  observe(perf = performance.now()): void {
    const media = this.player.getCurrentTime();
    const rate = this.player.getPlaybackRate() || 1;
    const known = Number.isFinite(media);
    if (known && (this.last === null || Math.abs(media - this.last) > 1e-3)) this.advancedAt = perf;
    let next = ytVideoState(this.player.getPlayerState());
    if (next === 'playing' && perf - this.advancedAt > STALL_MS) next = 'paused';

    if (next !== 'playing' || rate !== this.rate) this.obs = [];
    if (next === 'playing' && this.st !== 'playing') this.seg++;
    this.st = next;
    this.rate = rate;
    if (!known) return;
    this.last = media;
    if (next !== 'playing') return;

    const predicted = this.estimate(perf);
    if (predicted !== null && Math.abs(media - predicted) > JUMP_S) {
      this.obs = [];
      this.seg++;
    }
    this.obs.push({ perf, media });
    while (perf - this.obs[0].perf > WINDOW_MS) this.obs.shift();
  }

  private estimate(perf: number): number | null {
    if (!this.obs.length) return null;
    let offset = -Infinity;
    for (const o of this.obs) offset = Math.max(offset, o.media - (o.perf / 1000) * this.rate);
    return offset + (perf / 1000) * this.rate;
  }

  mediaTimeAt(perfMs: number): number | null {
    if (this.st === 'playing') {
      const e = this.estimate(perfMs);
      if (e !== null) return Math.max(0, e);
    }
    return this.last;
  }

  state(): VideoState {
    return this.st;
  }

  segment(): number {
    return this.seg;
  }

  duration(): number {
    const d = this.player.getDuration();
    return Number.isFinite(d) && d > 0 ? d : 0;
  }

  dispose(): void {}
}
