import { CodedError } from '../errors';
import type { VideoInfo } from '../contracts/types';
import { coverCrop } from '../geometry/coords';
import { drawDemoScene, preloadDemo, type DemoSpec } from '../../demo/demoScene';

/** Źródło klatek materiału do analiz (heat mapa, ścieżka wzroku, sceny). */
export interface FrameSource {
  /** 'image' — jeden statyczny obraz (np. miniatura z YouTube), ten sam dla każdej chwili. */
  readonly kind: 'video' | 'demo' | 'image' | 'placeholder';
  readonly duration: number;
  readonly width: number;
  readonly height: number;
  readonly ready: Promise<void>;
  drawFrame(ctx: CanvasRenderingContext2D, t: number, w: number, h: number): Promise<void>;
  dispose(): void;
}

export function createVideoFrameSource(url: string, opts: { crossOrigin?: boolean } = {}): FrameSource {
  const video = document.createElement('video');
  // Filmy z naszego serwera mają nagłówki CORS — klatki można analizować (wykrywanie scen).
  if (opts.crossOrigin) video.crossOrigin = 'anonymous';
  video.muted = true;
  video.preload = 'auto';
  video.playsInline = true;
  video.src = url;
  let queue: Promise<void> = Promise.resolve();
  const ready = new Promise<void>((resolve, reject) => {
    video.addEventListener('loadeddata', () => resolve(), { once: true });
    video.addEventListener('error', () => reject(new CodedError('media_load_failed')), { once: true });
  });
  ready.catch(() => undefined);

  const seek = (t: number) =>
    new Promise<void>((resolve) => {
      const target = Math.min(Math.max(0, t), Math.max(0, (video.duration || 0) - 0.05));
      if (Math.abs(video.currentTime - target) < 0.005) return resolve();
      const finish = () => {
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(finish, 4000);
      video.addEventListener('seeked', finish, { once: true });
      video.currentTime = target;
    });

  return {
    kind: 'video',
    get duration() {
      return Number.isFinite(video.duration) ? video.duration : 0;
    },
    get width() {
      return video.videoWidth || 16;
    },
    get height() {
      return video.videoHeight || 9;
    },
    ready,
    drawFrame(ctx, t, w, h) {
      // Seek-i muszą być wykonywane po kolei.
      const job = queue.then(async () => {
        await ready;
        await seek(t);
        ctx.drawImage(video, 0, 0, w, h);
      });
      queue = job.catch(() => undefined);
      return job;
    },
    dispose() {
      video.removeAttribute('src');
      video.load();
    },
  };
}

export function createDemoFrameSource(spec: DemoSpec): FrameSource {
  // Klatki raportu dopiero po wczytaniu fotografii klipu (inaczej heat mapa leżałaby na szkicu).
  const ready = preloadDemo(spec);
  return {
    kind: 'demo',
    duration: spec.duration,
    width: spec.w,
    height: spec.h,
    ready,
    async drawFrame(ctx, t, w, h) {
      await ready;
      drawDemoScene(ctx, t, w, h, spec);
    },
    dispose() {},
  };
}

/** Gdy pliku nie da się wczytać (np. po odświeżeniu strony) — neutralne tło z siatką i komunikatem (tekst ze słownika). */
export function createPlaceholderFrameSource(info: Pick<VideoInfo, 'width' | 'height' | 'duration'>, message: string): FrameSource {
  const w = info.width || 1280;
  const h = info.height || 720;
  return {
    kind: 'placeholder',
    duration: info.duration,
    width: w,
    height: h,
    ready: Promise.resolve(),
    async drawFrame(ctx, _t, cw, ch) {
      ctx.fillStyle = '#E6EAF2';
      ctx.fillRect(0, 0, cw, ch);
      ctx.strokeStyle = 'rgba(31,42,68,0.12)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo((cw * i) / 3, 0);
        ctx.lineTo((cw * i) / 3, ch);
        ctx.moveTo(0, (ch * i) / 3);
        ctx.lineTo(cw, (ch * i) / 3);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(31,42,68,0.45)';
      ctx.font = `${Math.round(ch / 22)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(message, cw / 2, ch / 2);
    },
    dispose() {},
  };
}

/** Najmniejsza sensowna miniatura — YouTube zwraca obraz 120×90, gdy danego rozmiaru nie ma. */
const MIN_IMAGE_WIDTH = 121;
const IMAGE_TIMEOUT_MS = 5000;

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    let timer: ReturnType<typeof setTimeout> | undefined = undefined;
    const finish = (ok: boolean) => {
      clearTimeout(timer);
      img.onload = img.onerror = null;
      resolve(ok && img.naturalWidth >= MIN_IMAGE_WIDTH ? img : null);
    };
    timer = setTimeout(() => finish(false), IMAGE_TIMEOUT_MS);
    // CORS: bez tego canvas byłby „skażony” i eksport PNG by nie zadziałał.
    img.crossOrigin = 'anonymous';
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    img.src = url;
  });
}

/**
 * Statyczny obraz jako tło analiz — gdy klatek filmu nie da się odczytać (odtwarzacz YouTube
 * to ramka z innej domeny). Pierwszy działający adres z listy, przycięty jak `object-fit: cover`
 * (miniatury 4:3 mają czarne pasy), z podpisem, że to nie klatka z danej chwili.
 */
export function createImageFrameSource(info: Pick<VideoInfo, 'width' | 'height' | 'duration'>, urls: readonly string[], caption: string, unavailable: string): FrameSource {
  const w = info.width || 1280;
  const h = info.height || 720;
  const fallback = createPlaceholderFrameSource(info, unavailable);
  let img: HTMLImageElement | null = null;
  let disposed = false;
  const ready = (async () => {
    for (const url of urls) {
      if (disposed) return;
      img = await loadImage(url);
      if (img) return;
    }
  })();

  return {
    kind: 'image',
    duration: info.duration,
    width: w,
    height: h,
    ready,
    async drawFrame(ctx, t, cw, ch) {
      await ready;
      if (!img) return fallback.drawFrame(ctx, t, cw, ch);
      const c = coverCrop(img.naturalWidth, img.naturalHeight, cw, ch);
      ctx.drawImage(img, c.sx, c.sy, c.sw, c.sh, 0, 0, cw, ch);
      if (!caption) return;
      const fs = Math.max(11, Math.round(ch / 40));
      const pad = Math.round(fs * 0.6);
      ctx.save();
      ctx.font = `600 ${fs}px system-ui, sans-serif`;
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(31,42,68,0.72)';
      ctx.fillRect(pad, pad, ctx.measureText(caption).width + 2 * pad, fs + 2 * pad);
      ctx.fillStyle = '#fff';
      ctx.fillText(caption, 2 * pad, 2 * pad);
      ctx.restore();
    },
    dispose() {
      disposed = true;
    },
  };
}
