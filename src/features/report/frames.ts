import { useEffect, useState, useSyncExternalStore } from 'react';
import { apiBase } from '../../api/base';
import { createDemoFrameSource, createImageFrameSource, createPlaceholderFrameSource, createVideoFrameSource, type FrameSource } from '../../core/render/frameSource';
import { DEMO_SPECS } from '../../demo/demoScene';
import { useT, type Messages } from '../../i18n';
import type { Variant } from '../../research/model';
import { youtubeThumbnailUrls } from '../../youtube/url';
import { onLibraryChange, playableUrl } from '../shared/mediaLibrary';

let libVersion = 0;
onLibraryChange(() => libVersion++);

/** Zmienia się, gdy twórca wczyta plik lokalny (klatki stają się dostępne). */
export function useLibraryVersion(): number {
  return useSyncExternalStore(
    (l) => onLibraryChange(l),
    () => libVersion,
  );
}

/** Klatki materiału wersji: klip demo, plik, miniatura z YouTube albo neutralne tło z komunikatem. */
export function frameSourceForVariant(v: Pick<Variant, 'media' | 'duration' | 'width' | 'height'>, text: Messages['report']['frames']): FrameSource {
  const info = { duration: v.duration, width: v.width, height: v.height };
  const m = v.media;
  if (m?.kind === 'demo') return createDemoFrameSource(DEMO_SPECS[m.demo]);
  if (m?.kind === 'youtube') return createImageFrameSource(info, youtubeThumbnailUrls(m.youtubeId), text.youtubeThumbnail, text.thumbnailUnavailable);
  const url = playableUrl(m, apiBase());
  // CORS tylko dla plików z naszego serwera; obcy serwer bez CORS zablokowałby wczytanie.
  if (url) return createVideoFrameSource(url, { crossOrigin: m?.kind === 'hosted' });
  return createPlaceholderFrameSource(info, m?.kind === 'local' ? text.loadFile : text.noFrames);
}

export function useVariantFrames(v: Variant | null): FrameSource | null {
  const text = useT().report.frames;
  const lib = useLibraryVersion();
  const key = v ? `${v.id}|${JSON.stringify(v.media)}|${v.width}x${v.height}` : '';
  const [src, setSrc] = useState<FrameSource | null>(null);
  useEffect(() => {
    if (!v) {
      setSrc(null);
      return;
    }
    const s = frameSourceForVariant(v, text);
    setSrc(s);
    return () => s.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, lib, text]);
  return src;
}
