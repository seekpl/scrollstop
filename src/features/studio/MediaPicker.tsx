import { useState } from 'react';
import { useResearch } from '../../app/research';
import { aspectFits, type Platform } from '../../config/platforms';
import { DEMO_SPECS, type DemoId } from '../../demo/demoScene';
import { useI18n } from '../../i18n';
import type { NewVariant } from '../../api/types';
import { fetchYouTubeInfo } from '../../youtube/api';
import { snapAspect } from '../../youtube/aspect';
import { parseYouTubeId } from '../../youtube/url';
import { Btn, Callout, Field, Icon, inputClass } from '../../ui/kit';
import { registerLocalFile } from '../shared/mediaLibrary';

type Tab = 'file' | 'youtube' | 'url' | 'demo';

/** Materiał wybrany w kreatorze; `file` — plik do wgrania na serwer po utworzeniu projektu (tryb serwerowy). */
export type PickedMedia = NewVariant & { file?: File };
const DEMOS: DemoId[] = ['reel', 'reel_b', 'video'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
export const MAX_VIDEO_MB = 1024;

/** Długość i rozmiar obrazu pliku albo adresu (metadane elementu <video>). */
export function probeVideo(url: string): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    const timer = setTimeout(() => reject(new Error('timeout')), 15000);
    v.onloadedmetadata = () => {
      clearTimeout(timer);
      resolve({ duration: Number.isFinite(v.duration) ? v.duration : 0, width: v.videoWidth || 1080, height: v.videoHeight || 1920 });
    };
    v.onerror = () => {
      clearTimeout(timer);
      reject(new Error('media_load_failed'));
    };
    v.src = url;
  });
}

/**
 * Materiał wersji (§9.2 krok 3): zakładki Wgraj plik / YouTube / Link do pliku / Klip demo.
 * W trybie lokalnym plik zostaje na tym komputerze; po dodaniu — podsumowanie i „Zmień”.
 */
export function MediaPicker({ value, onChange, platform, label }: { value: PickedMedia | null; onChange(v: PickedMedia | null): void; platform: Platform; label: string }) {
  const { t } = useI18n();
  const m = t.studio.media;
  const { api } = useResearch();
  const [tab, setTab] = useState<Tab>('file');
  const [yt, setYt] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (value) {
    const kind = value.media?.kind ?? 'demo';
    const fits = aspectFits(platform, value.width ?? 0, value.height ?? 0);
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface p-3 ring-1 ring-line">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-ink/[0.06]" aria-hidden>
            <Icon name="play" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14.5px] font-semibold text-ink">{value.mediaName}</span>
            <span className="block text-[13px] text-muted">{m.summary(m.kinds[kind], value.duration ? Math.round(value.duration) : null, value.width && value.height ? `${value.width}×${value.height}` : null)}</span>
          </span>
          <Btn size="sm" onClick={() => onChange(null)}>
            {t.common.actions.change}
          </Btn>
        </div>
        {!fits && <Callout tone="warn">{m.aspectWarn(t.common.platforms[platform])}</Callout>}
        {kind === 'local' && <p className="text-[12.5px] text-muted">{m.localNote}</p>}
      </div>
    );
  }

  const pickFile = async (file: File) => {
    setError(null);
    if (!VIDEO_TYPES.includes(file.type) && !/\.(mp4|mov|webm|m4v)$/i.test(file.name)) return setError(t.errors.unsupported_type);
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) return setError(t.errors.too_large);
    setBusy(true);
    try {
      const media = registerLocalFile(file);
      const probe = await probeVideo(URL.createObjectURL(file)).catch(() => ({ duration: 0, width: 1080, height: 1920 }));
      onChange({ media, mediaName: file.name, ...probe, ...(api.mode === 'server' ? { file } : {}) });
    } finally {
      setBusy(false);
    }
  };
  const addYoutube = async () => {
    setError(null);
    const id = parseYouTubeId(yt);
    if (!id) return setError(m.errors.notYoutube);
    setBusy(true);
    const info = await fetchYouTubeInfo(id);
    setBusy(false);
    if (info?.status === 'unavailable') return setError(m.errors.private);
    if (info?.status === 'unembeddable') return setError(m.errors.unembeddable);
    const size = info?.status === 'ok' ? snapAspect(info.width, info.height) : { width: 1920, height: 1080 };
    onChange({ media: { kind: 'youtube', youtubeId: id }, mediaName: info?.status === 'ok' ? info.title : `YouTube ${id}`, duration: 0, ...size });
  };
  const addUrl = async () => {
    setError(null);
    const u = url.trim();
    if (!/^https:\/\//i.test(u)) return setError(m.errors.https);
    setBusy(true);
    try {
      const probe = await probeVideo(u);
      onChange({ media: { kind: 'url', url: u }, mediaName: decodeURIComponent(u.split('/').pop() || u).slice(0, 200), ...probe });
    } catch {
      setError(m.errors.unreadable);
    } finally {
      setBusy(false);
    }
  };
  const tabs: Tab[] = ['file', 'youtube', 'url', 'demo'];
  return (
    <div className="space-y-3">
      <div role="tablist" aria-label={label} className="flex flex-wrap gap-1 rounded-xl bg-ink/[0.05] p-1">
        {tabs.map((x) => (
          <button key={x} type="button" role="tab" aria-selected={tab === x} onClick={() => setTab(x)} className={`min-h-9 rounded-lg px-3 text-[13.5px] font-semibold ${tab === x ? 'bg-surface text-ink shadow-sm ring-1 ring-line' : 'text-muted hover:text-ink'}`}>
            {m.tabs[x]}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="space-y-3">
        {tab === 'file' && (
          <>
            <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-field/60 bg-surface px-4 py-6 text-center hover:border-cobalt">
              <Icon name="upload" size={22} />
              <span className="text-[14.5px] font-semibold text-ink">{busy ? m.reading : m.pickFile}</span>
              <span className="text-[12.5px] text-muted">{m.fileTypes(MAX_VIDEO_MB)}</span>
              <input
                type="file"
                accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void pickFile(f);
                }}
              />
            </label>
            {api.mode === 'local' && <p className="text-[12.5px] text-muted">{m.localNote}</p>}
          </>
        )}
        {tab === 'youtube' && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <Field label={m.youtubeLabel} hint={m.youtubeHint}>
                {(id, d) => <input id={id} aria-describedby={d} className={inputClass} value={yt} onChange={(e) => setYt(e.target.value)} placeholder="https://youtu.be/…" />}
              </Field>
            </div>
            <Btn onClick={() => void addYoutube()} disabled={busy || !yt.trim()} className="sm:mb-6">
              {m.add}
            </Btn>
          </div>
        )}
        {tab === 'url' && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <Field label={m.urlLabel} hint={m.urlHint}>
                {(id, d) => <input id={id} aria-describedby={d} className={inputClass} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/rolka.mp4" />}
              </Field>
            </div>
            <Btn onClick={() => void addUrl()} disabled={busy || !url.trim()} className="sm:mb-6">
              {m.add}
            </Btn>
          </div>
        )}
        {tab === 'demo' && (
          <div className="flex flex-wrap gap-2">
            {DEMOS.map((d) => (
              <Btn key={d} onClick={() => onChange({ media: { kind: 'demo', demo: d }, mediaName: t.lab.demoNames[d as keyof typeof t.lab.demoNames], duration: DEMO_SPECS[d].duration, width: DEMO_SPECS[d].w, height: DEMO_SPECS[d].h, scenes: DEMO_SPECS[d].cuts.map((start, i, a) => ({ id: `scene_${i + 1}`, start, end: a[i + 1] ?? DEMO_SPECS[d].duration, source: 'manual' as const })), ...(DEMO_SPECS[d].sharedFrom ? { sharedFrom: DEMO_SPECS[d].sharedFrom } : {}) })}>
                {m.useDemo(t.lab.demoNames[d as keyof typeof t.lab.demoNames])}
              </Btn>
            ))}
          </div>
        )}
        {error && (
          <p className="text-[13.5px] font-semibold text-poor" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
