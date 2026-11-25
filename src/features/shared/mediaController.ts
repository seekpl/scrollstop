import { containRect } from '../../core/geometry/coords';
import { CodedError } from '../../core/errors';
import { ManualClock, VideoElementClock, type PlaybackClock } from '../../core/time/playbackClock';
import { drawDemoScene, type DemoSpec } from '../../demo/demoScene';
import { loadYouTubeApi, YT_STATE, type YTPlayer } from '../../youtube/api';
import { YouTubeClock } from '../../youtube/clock';
import { YOUTUBE_EMBED_HOST, youtubeErrorCode } from '../../youtube/url';

/** Wspólny interfejs odtwarzacza: plik wideo, film z YouTube albo klip demo (canvas). */
export interface MediaController {
  readonly clock: PlaybackClock;
  play(): Promise<void>;
  pause(): void;
  isPaused(): boolean;
  currentTime(): number;
  duration(): number;
  contentSize(): { w: number; h: number };
  onEnded(cb: () => void): void;
  /** Błędy (kody) zgłaszane przez odtwarzacz w trakcie oglądania (YouTube). */
  onError?(cb: (code: string) => void): void;
  /** Tytuł znany dopiero z odtwarzacza (YouTube). */
  title?(): string | null;
  setMuted?(muted: boolean): void;
  seek?(t: number): void;
  dispose(): void;
}

export function createVideoController(video: HTMLVideoElement): MediaController {
  const clock = new VideoElementClock(video);
  const endedCbs: Array<() => void> = [];
  const onEnded = () => endedCbs.forEach((c) => c());
  video.addEventListener('ended', onEnded);
  return {
    clock,
    play: () => video.play(),
    pause: () => video.pause(),
    isPaused: () => video.paused,
    currentTime: () => video.currentTime,
    duration: () => (Number.isFinite(video.duration) ? video.duration : 0),
    contentSize: () => ({ w: video.videoWidth || 16, h: video.videoHeight || 9 }),
    onEnded: (cb) => endedCbs.push(cb),
    setMuted: (m) => {
      video.muted = m;
    },
    seek: (t) => {
      video.currentTime = t;
    },
    dispose: () => {
      video.removeEventListener('ended', onEnded);
      clock.dispose();
    },
  };
}

/**
 * Klip demo rysowany na canvasie. Canvas zajmuje element (np. pełny ekran); obraz w środku
 * jak `object-fit: contain` z czarnymi pasami.
 */
export function createDemoController(canvas: HTMLCanvasElement, spec: DemoSpec, opts: { loop?: boolean } = {}): MediaController {
  const clock = new ManualClock(spec.duration);
  const endedCbs: Array<() => void> = [];
  let raf = 0;
  let disposed = false;
  const ctx = canvas.getContext('2d');

  const render = () => {
    if (disposed) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = Math.max(1, Math.round((rect.width || window.innerWidth) * dpr));
    const H = Math.max(1, Math.round((rect.height || window.innerHeight) * dpr));
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;
    const t = clock.mediaTimeAt(performance.now());
    if (ctx) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      const r = containRect(W, H, spec.w, spec.h);
      ctx.save();
      ctx.translate(r.x * W, r.y * H);
      drawDemoScene(ctx, t, r.w * W, r.h * H, spec);
      ctx.restore();
    }
    if (clock.state() === 'playing' && t >= spec.duration) {
      if (opts.loop) clock.seek(0);
      else clock.end();
      endedCbs.forEach((c) => c());
    }
    raf = requestAnimationFrame(render);
  };
  raf = requestAnimationFrame(render);

  return {
    clock,
    play: async () => clock.play(),
    pause: () => clock.pause(),
    isPaused: () => clock.state() !== 'playing',
    currentTime: () => clock.mediaTimeAt(performance.now()),
    duration: () => spec.duration,
    contentSize: () => ({ w: spec.w, h: spec.h }),
    onEnded: (cb) => endedCbs.push(cb),
    seek: (t) => clock.seek(t),
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(raf);
    },
  };
}

const YT_POLL_MS = 50;
const YT_READY_TIMEOUT_MS = 20000;
const YT_PLAY_TIMEOUT_MS = 6000;

/**
 * Film z YouTube w odtwarzaczu IFrame (`youtube-nocookie.com`, bez kontrolek, §5.8).
 * Gotowość w 20 s, start odtwarzania w 6 s, inaczej błąd z kodem.
 */
export async function createYouTubeController(host: HTMLElement, videoId: string, size: { w: number; h: number }): Promise<MediaController> {
  const YT = await loadYouTubeApi();
  const mount = document.createElement('div');
  host.replaceChildren(mount);
  const endedCbs: Array<() => void> = [];
  const errorCbs: Array<(code: string) => void> = [];
  const playWaiters = new Set<() => void>();
  let clock: YouTubeClock | null = null;
  let instance: YTPlayer | null = null;
  const destroy = () => {
    try {
      instance?.destroy();
    } catch {
      /* odtwarzacz mógł już zniknąć */
    }
    host.replaceChildren();
  };

  const player = await new Promise<YTPlayer>((resolve, reject) => {
    let ready = false;
    const timer = setTimeout(() => reject(new CodedError('youtube_timeout')), YT_READY_TIMEOUT_MS);
    instance = new YT.Player(mount, {
      host: YOUTUBE_EMBED_HOST,
      videoId,
      width: '100%',
      height: '100%',
      playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, rel: 0, iv_load_policy: 3, playsinline: 1, cc_load_policy: 0 },
      events: {
        onReady: (e) => {
          ready = true;
          clearTimeout(timer);
          resolve(e.target);
        },
        onStateChange: (e) => {
          clock?.observe();
          if (e.data === YT_STATE.PLAYING) playWaiters.forEach((w) => w());
          if (e.data === YT_STATE.ENDED) endedCbs.forEach((c) => c());
        },
        onError: (e) => {
          const code = youtubeErrorCode(e.data);
          if (ready) errorCbs.forEach((c) => c(code));
          else {
            clearTimeout(timer);
            reject(new CodedError(code));
          }
        },
      },
    });
  }).catch((err: unknown) => {
    destroy();
    throw err;
  });

  // Widz nie powinien móc kliknąć w odtwarzacz (linki do YouTube, inne filmy).
  const iframe = host.querySelector('iframe');
  if (iframe) Object.assign(iframe.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' });

  const yc = new YouTubeClock(player);
  clock = yc;
  yc.observe();
  const poll = setInterval(() => yc.observe(), YT_POLL_MS);
  const state = () => player.getPlayerState();

  return {
    clock: yc,
    play: () =>
      new Promise<void>((resolve, reject) => {
        if (state() === YT_STATE.PLAYING) return resolve();
        const timer = setTimeout(() => {
          playWaiters.delete(done);
          reject(new CodedError('autoplay_blocked'));
        }, YT_PLAY_TIMEOUT_MS);
        const done = () => {
          clearTimeout(timer);
          playWaiters.delete(done);
          resolve();
        };
        playWaiters.add(done);
        player.playVideo();
      }),
    pause: () => player.pauseVideo(),
    isPaused: () => state() !== YT_STATE.PLAYING && state() !== YT_STATE.BUFFERING,
    currentTime: () => yc.mediaTimeAt(performance.now()) ?? 0,
    duration: () => yc.duration(),
    contentSize: () => size,
    onEnded: (cb) => endedCbs.push(cb),
    onError: (cb) => errorCbs.push(cb),
    title: () => player.getVideoData?.()?.title?.trim() || null,
    setMuted: (m) => (m ? player.mute?.() : player.unMute?.()),
    dispose: () => {
      clearInterval(poll);
      playWaiters.clear();
      destroy();
    },
  };
}
