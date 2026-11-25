import type { ReactNode } from 'react';
import type { TrackingQuality, VideoInfo } from '../../core/contracts/types';
import { isDemoId } from '../../demo/demoScene';
import { useT, type Messages } from '../../i18n';
import { Badge, Btn, Surface } from '../../ui/kit';
import { useLab } from './LabContext';
import { useSessions, libraryRef } from './hooks';

/** Nazwa materiału do wyświetlenia: klipy demo zapisują identyfikator, pokazujemy przetłumaczoną nazwę. */
export function mediaLabel(video: Pick<VideoInfo, 'kind' | 'name'>, t: Messages): string {
  if (video.kind === 'demo' && isDemoId(video.name) && video.name in t.lab.demoNames) return t.lab.demoNames[video.name as keyof Messages['lab']['demoNames']];
  return video.name;
}

export function QualityBadge({ quality, prefix }: { quality: TrackingQuality; prefix?: string }) {
  const t = useT();
  const tone = quality === 'GOOD' ? 'good' : quality === 'FAIR' ? 'fair' : 'poor';
  return (
    <Badge tone={tone}>
      {prefix ? `${prefix}: ` : ''}
      {t.common.quality[quality]}
    </Badge>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[13px] text-muted">{label}</div>
      <div className="tabular truncate text-[24px] font-semibold tracking-[-0.01em] text-ink">{value}</div>
      {hint && <div className="text-[12.5px] text-muted">{hint}</div>}
    </div>
  );
}

export function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="truncate text-[14px] font-semibold text-ink">{value}</dd>
    </div>
  );
}

export function Slider({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange(v: number): void; format?: (v: number) => string }) {
  return (
    <label className="flex min-w-0 items-center gap-3 text-[14px]">
      <span className="w-36 shrink-0 text-muted">{label}</span>
      <input type="range" className="min-w-0 flex-1 accent-cobalt" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="tabular w-16 text-right font-semibold">{format ? format(value) : value}</span>
    </label>
  );
}

/** Nagłówek widoków wyników: wybór sesji + ponowne wczytanie pliku materiału. */
export function SessionBar() {
  const lab = useLab();
  const t = useT();
  const sessions = useSessions();
  const meta = lab.activeSession?.meta;
  const ref = meta ? libraryRef(meta.video) : null;
  const linked = !!ref && !!lab.libraryUrl(ref.name, ref.size);
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <label className="flex min-w-0 items-center gap-2 text-[14px]">
        <span className="text-muted">{t.lab.sessionBar.label}</span>
        <select
          className="h-10 max-w-[22rem] min-w-0 rounded-[10px] bg-surface px-3 font-semibold ring-1 ring-inset ring-field"
          value={lab.activeSessionId ?? ''}
          onChange={(e) => e.target.value && lab.openSession(e.target.value, lab.view)}
        >
          {!lab.activeSessionId && <option value="">{t.lab.sessionBar.choose}</option>}
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {t.lab.sessionBar.option(new Date(s.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }), mediaLabel(s.video, t), Math.round(s.video.duration))}
            </option>
          ))}
        </select>
      </label>
      {meta && ref && !linked && (
        <label className="inline-flex cursor-pointer flex-wrap items-center gap-2 rounded-[10px] bg-fair/10 px-3 py-2 text-[14px]">
          <span>{t.lab.sessionBar.needFile(meta.video.name)}</span>
          <input
            type="file"
            accept="video/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) lab.linkFile(meta.video.name, meta.video.size, f);
            }}
          />
          <span className="font-semibold text-cobalt underline">{t.lab.sessionBar.pickFile}</span>
        </label>
      )}
    </div>
  );
}

export function NoSession() {
  const lab = useLab();
  const t = useT();
  return (
    <Surface>
      <h2 className="text-[19px] font-semibold">{t.lab.noSession.title}</h2>
      <p className="mt-2 max-w-prose text-[14.5px] text-muted">{t.lab.noSession.body}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Btn variant="primary" onClick={() => lab.setView('setup')}>
          {t.lab.noSession.toSetup}
        </Btn>
        <Btn onClick={() => lab.setView('sessions')}>{t.lab.noSession.toList}</Btn>
      </div>
    </Surface>
  );
}
