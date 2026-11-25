import { CodedError } from '../core/errors';
import { youtubeWatchUrl } from './url';

/** Stany odtwarzacza z IFrame Player API (YT.PlayerState). */
export const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

/** Część API odtwarzacza, z której korzysta aplikacja. */
export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  getPlaybackRate(): number;
  /** Nieudokumentowane, ale stabilne od lat — tytuł filmu, gdy oEmbed był niedostępny. */
  getVideoData?(): { title?: string };
  mute?(): void;
  unMute?(): void;
  destroy(): void;
}

export interface YTPlayerOptions {
  host?: string;
  videoId: string;
  width?: string | number;
  height?: string | number;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?(e: { target: YTPlayer }): void;
    onStateChange?(e: { data: number; target: YTPlayer }): void;
    onError?(e: { data: number; target: YTPlayer }): void;
  };
}

export interface YTNamespace {
  Player: new (el: HTMLElement, opts: YTPlayerOptions) => YTPlayer;
}

type YTWindow = Window & { YT?: Partial<YTNamespace>; onYouTubeIframeAPIReady?: () => void };

const API_URL = 'https://www.youtube.com/iframe_api';
let loading: Promise<YTNamespace> | null = null;

/** Wczytuje IFrame Player API (raz na stronę). */
export function loadYouTubeApi(timeoutMs = 15000): Promise<YTNamespace> {
  const w = window as YTWindow;
  if (w.YT?.Player) return Promise.resolve(w.YT as YTNamespace);
  loading ??= new Promise<YTNamespace>((resolve, reject) => {
    const fail = () => {
      clearTimeout(timer);
      loading = null;
      reject(new CodedError('youtube_api_failed'));
    };
    const timer = setTimeout(fail, timeoutMs);
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      prev?.();
      clearTimeout(timer);
      resolve(w.YT as YTNamespace);
    };
    const script = document.createElement('script');
    script.src = API_URL;
    script.async = true;
    script.onerror = () => {
      script.remove();
      fail();
    };
    document.head.appendChild(script);
  });
  return loading;
}

export type YouTubeInfo =
  | { status: 'ok'; title: string; author: string | null; width: number; height: number }
  | { status: 'unembeddable' }
  | { status: 'unavailable' };

/**
 * Tytuł i proporcje filmu z oEmbed (bez klucza API). `null`, gdy nie da się tego
 * ustalić (brak sieci, blokada) — wtedy zostają wartości domyślne.
 */
export async function fetchYouTubeInfo(id: string, signal?: AbortSignal): Promise<YouTubeInfo | null> {
  try {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(youtubeWatchUrl(id))}`, { signal });
    // oEmbed odpowiada 401 dla filmów z wyłączonym osadzaniem, 403/404 dla prywatnych i nieistniejących.
    if (r.status === 401) return { status: 'unembeddable' };
    if (r.status === 403 || r.status === 404) return { status: 'unavailable' };
    if (!r.ok) return null;
    const j = (await r.json()) as { title?: unknown; author_name?: unknown; width?: unknown; height?: unknown };
    const width = Number(j.width);
    const height = Number(j.height);
    const ratio = width / height;
    const valid = Number.isFinite(ratio) && ratio > 0.3 && ratio < 3;
    return {
      status: 'ok',
      title: typeof j.title === 'string' && j.title.trim() ? j.title.trim() : `YouTube ${id}`,
      author: typeof j.author_name === 'string' ? j.author_name : null,
      width: valid ? width : 16,
      height: valid ? height : 9,
    };
  } catch {
    return null;
  }
}
