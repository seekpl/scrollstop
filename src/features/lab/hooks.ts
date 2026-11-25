import { useEffect, useState } from 'react';
import type { Session, SessionMeta, VideoInfo } from '../../core/contracts/types';
import { createDemoFrameSource, createPlaceholderFrameSource, createVideoFrameSource, type FrameSource } from '../../core/render/frameSource';
import { DEMO_SPECS, isDemoId } from '../../demo/demoScene';
import { useT } from '../../i18n';
import { useLab } from './LabContext';

export function useSessions(): SessionMeta[] {
  const lab = useLab();
  const [list, setList] = useState<SessionMeta[]>([]);
  useEffect(() => {
    let alive = true;
    void lab.store.listSessions().then((l) => alive && setList(l));
    return () => {
      alive = false;
    };
  }, [lab.store, lab.sessionsVersion]);
  return list;
}

/** Klucz w bibliotece plików dla klatek materiału (plik wczytany w tej karcie). */
export function libraryRef(video: VideoInfo): { name: string; size?: number } | null {
  return video.kind === 'file' ? { name: video.name, size: video.size } : null;
}

/** Klatki materiału dla aktywnej sesji: plik (jeśli wczytany), klip demo albo neutralne tło. */
export function useFrameSource(session: Session | null): FrameSource | null {
  const lab = useLab();
  const t = useT();
  const meta = session?.meta;
  const ref = meta ? libraryRef(meta.video) : null;
  const url = ref ? lab.libraryUrl(ref.name, ref.size) : null;
  const [src, setSrc] = useState<FrameSource | null>(null);
  useEffect(() => {
    if (!meta) {
      setSrc(null);
      return;
    }
    const demo = meta.video.kind === 'demo' && isDemoId(meta.video.name) ? DEMO_SPECS[meta.video.name] : null;
    const s = demo ? createDemoFrameSource(demo) : url ? createVideoFrameSource(url) : createPlaceholderFrameSource(meta.video, t.lab.sessionBar.framesMissing);
    setSrc(s);
    return () => s.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta?.id, url]);
  return src;
}
