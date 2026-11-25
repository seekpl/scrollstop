import { useRef, useState, type PointerEvent } from 'react';
import type { Platform } from '../../config/platforms';
import { formatTime } from '../../core/math/util';
import type { FrameSource } from '../../core/render/frameSource';
import { useI18n } from '../../i18n';
import { formatNumber, formatPct } from '../../i18n/format';
import type { AoiResult } from '../../research/aoi';
import { randomId } from '../../research/link';
import { AOI_TYPES, type Aoi, type AoiType } from '../../research/model';
import { Badge, Btn, Field, Icon, inputClass } from '../../ui/kit';
import { FrameCanvas } from './Visuals';

type Rect = { x: number; y: number; w: number; h: number };

/**
 * Strefy zainteresowania (§7 pkt 9): tabela (zasięg z „N z M”, udział patrzenia, pierwsze spojrzenie,
 * flagi czytelności i strefy zasłoniętej) oraz edytor (prostokąt przeciągnięciem albo polami liczbowymi).
 */
export function AoiPanel({ results, aois, src, duration, width, height, platform, onSave }: { results: AoiResult[]; aois: Aoi[]; src: FrameSource | null; duration: number; width: number; height: number; platform: Platform; onSave?(aois: Aoi[]): Promise<void> }) {
  const { t, locale } = useI18n();
  const ta = t.report.aoi;
  const labels = t.common.aoiTypes;
  const P = (v: number | null) => formatPct(v, locale);
  const [editing, setEditing] = useState(false);
  const flags = (r: AoiResult) => (
    <div className="mt-1 flex flex-wrap gap-1">
      {r.small && <Badge tone="fair">{ta.small}</Badge>}
      {r.reading?.tooShort && <Badge tone="poor">{ta.tooShort}</Badge>}
      {r.reading?.fewRead && <Badge tone="fair">{ta.fewRead}</Badge>}
      {r.unsafe && <Badge tone="poor">{ta.unsafe}</Badge>}
    </div>
  );
  return (
    <div className="space-y-4">
      {results.length > 0 && (
        <ul className="divide-y divide-line rounded-2xl bg-surface ring-1 ring-line sm:hidden">
          {results.map((r) => (
            <li key={r.aoi.id} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-semibold text-ink">{r.aoi.name}</span>
                <span className="tabular block text-[12.5px] text-muted">{ta.mobileMeta(labels[r.aoi.type], `${formatTime(r.aoi.t0, 0)}–${formatTime(r.aoi.t1, 0)}`, r.lookers, r.n)}</span>
                {flags(r)}
              </span>
              <span className={`tabular text-[18px] font-semibold ${r.reach !== null && r.reach < 0.5 ? 'text-poor' : 'text-ink'}`}>{P(r.reach)}</span>
            </li>
          ))}
        </ul>
      )}
      {results.length > 0 ? (
        <div className="hidden relative overflow-x-auto rounded-2xl bg-surface ring-1 ring-line sm:block">
          <table className="w-full min-w-[640px] text-left text-[14px]">
            <caption className="sr-only">{ta.caption}</caption>
            <thead className="text-[12.5px] text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-3 font-semibold">{ta.zone}</th>
                <th className="px-4 py-3 font-semibold">{ta.time}</th>
                <th className="px-4 py-3 font-semibold">{ta.lookers}</th>
                <th className="px-4 py-3 font-semibold">{ta.dwell}</th>
                <th className="px-4 py-3 font-semibold">{ta.firstLook}</th>
                {onSave && (
                  <th className="px-4 py-3">
                    <span className="sr-only">{ta.remove}</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.aoi.id} className="border-b border-line align-top last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-ink">{r.aoi.name}</div>
                    <div className="text-[12.5px] text-muted">{labels[r.aoi.type]}</div>
                    {flags(r)}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {formatTime(r.aoi.t0, 0)}–{formatTime(r.aoi.t1, 0)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${r.reach !== null && r.reach < 0.5 ? 'text-poor' : 'text-ink'}`}>{P(r.reach)}</span>
                    <span className="ml-2 text-[12.5px] text-muted">{ta.lookersOf(r.lookers, r.n)}</span>
                  </td>
                  <td className="px-4 py-3 text-ink">{P(r.dwellShare)}</td>
                  <td className="px-4 py-3 text-ink">{r.firstLook === null ? '–' : ta.firstLookAfter(formatNumber(r.firstLook, locale, 1))}</td>
                  {onSave && (
                    <td className="px-4 py-3 text-right">
                      <button type="button" aria-label={ta.removeAria(r.aoi.name)} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-poor/10 hover:text-poor" onClick={() => void onSave(aois.filter((a) => a.id !== r.aoi.id))}>
                        <Icon name="trash" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-[14.5px] text-muted">{ta.empty}</p>
      )}
      <p className="text-[12.5px] text-muted">{ta.note}</p>
      {onSave && !editing && (
        <Btn className="no-print" onClick={() => setEditing(true)}>
          {ta.add}
        </Btn>
      )}
      {onSave && editing && (
        <AoiEditor
          src={src}
          duration={duration}
          width={width}
          height={height}
          platform={platform}
          existing={aois}
          onCancel={() => setEditing(false)}
          onAdd={async (a) => {
            await onSave([...aois, a]);
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}

export function AoiEditor({ src, duration, width, height, platform, existing, onAdd, onCancel }: { src: FrameSource | null; duration: number; width: number; height: number; platform: Platform; existing: Aoi[]; onAdd(a: Aoi): Promise<void>; onCancel(): void }) {
  const tr = useI18n().t;
  const te = tr.report.aoi.editor;
  const labels = tr.common.aoiTypes;
  const vertical = height > width;
  const dur = Math.max(1, Math.round(duration || 1));
  const [t, setT] = useState(Math.min(dur / 2, Math.max(0, dur - 1)));
  const [draft, setDraft] = useState<Rect | null>(null);
  const [type, setType] = useState<AoiType>('text');
  const [name, setName] = useState('');
  const [words, setWords] = useState('');
  const [range, setRange] = useState<[number, number]>([0, dur]);
  const [showUnsafe, setShowUnsafe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const pos = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const rect: Rect = draft ?? { x: 0, y: 0, w: 0, h: 0 };
  const setField = (k: keyof Rect, pct: number) => {
    const v = Math.min(1, Math.max(0, pct / 100));
    setDraft({ ...rect, [k]: v });
  };
  const save = async () => {
    if (!draft || draft.w < 0.02 || draft.h < 0.02) return setError(te.noRect);
    if (range[1] <= range[0]) return setError(te.badRange);
    const w = Number(words);
    await onAdd({
      id: `aoi_${randomId(6)}`,
      name: name.trim().slice(0, 80) || labels[type],
      type,
      x: draft.x,
      y: draft.y,
      w: Math.min(draft.w, 1 - draft.x),
      h: Math.min(draft.h, 1 - draft.y),
      t0: range[0],
      t1: range[1],
      ...((type === 'text' || type === 'subtitle') && w > 0 ? { words: Math.round(w) } : {}),
    });
  };
  return (
    <div className={`no-print grid gap-5 rounded-2xl bg-surface p-4 ring-1 ring-line ${vertical ? 'md:grid-cols-[260px_minmax(0,1fr)]' : 'lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]'}`}>
      <div className="min-w-0">
        <div
          className={`relative touch-none overflow-hidden rounded-xl bg-ink ${vertical ? 'mx-auto max-w-[260px]' : ''}`}
          style={{ cursor: 'crosshair' }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            start.current = pos(e);
            setDraft({ ...start.current, w: 0, h: 0 });
          }}
          onPointerMove={(e) => {
            if (!start.current) return;
            const p = pos(e);
            const s = start.current;
            setDraft({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
          }}
          onPointerUp={() => (start.current = null)}
        >
          <FrameCanvas src={src} t={t} overlay={{ aois: existing, draft, unsafe: showUnsafe ? platform : null }} label={te.frameLabel} vertical={vertical} />
        </div>
        <label className="mt-3 flex items-center gap-3 text-[13px] text-muted">
          {te.frame}
          <input type="range" min={0} max={Math.max(0, dur - 0.1)} step={0.1} value={t} onChange={(e) => setT(Number(e.target.value))} className="min-w-0 flex-1 accent-cobalt" aria-label={te.frameLabel} />
          <span className="tabular w-12 text-right text-ink">{formatTime(t, 0)}</span>
        </label>
        <label className="mt-2 flex items-center gap-2 text-[13.5px] font-semibold">
          <input type="checkbox" className="h-4 w-4 accent-cobalt" checked={showUnsafe} onChange={(e) => setShowUnsafe(e.target.checked)} />
          {tr.report.visuals.showUnsafe}
        </label>
      </div>
      <div className="min-w-0 space-y-4">
        <p className="text-[14px] text-ink">{te.instructions}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(['x', 'y', 'w', 'h'] as const).map((k) => (
            <Field key={k} label={te.rect[k]}>
              {(id) => <input id={id} type="number" min={0} max={100} step={1} value={Math.round(rect[k] * 100)} onChange={(e) => setField(k, Number(e.target.value))} className={inputClass} />}
            </Field>
          ))}
        </div>
        <Field label={te.type}>
          {(id) => (
            <select id={id} value={type} onChange={(e) => setType(e.target.value as AoiType)} className={inputClass}>
              {AOI_TYPES.map((x) => (
                <option key={x} value={x}>
                  {labels[x]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={te.name} hint={te.nameHint}>
          {(id, d) => <input id={id} aria-describedby={d} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className={inputClass} />}
        </Field>
        {(type === 'text' || type === 'subtitle') && (
          <Field label={te.words} hint={te.wordsHint}>
            {(id, d) => <input id={id} aria-describedby={d} type="number" min={1} max={200} value={words} onChange={(e) => setWords(e.target.value)} className={inputClass} />}
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label={te.from}>{(id) => <input id={id} type="number" min={0} max={dur} step={0.5} value={range[0]} onChange={(e) => setRange([Number(e.target.value), range[1]])} className={inputClass} />}</Field>
          <Field label={te.to}>{(id) => <input id={id} type="number" min={0} max={dur} step={0.5} value={range[1]} onChange={(e) => setRange([range[0], Number(e.target.value)])} className={inputClass} />}</Field>
        </div>
        {error && (
          <p className="text-[13px] font-semibold text-poor" role="alert">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Btn variant="primary" onClick={() => void save()}>
            {te.save}
          </Btn>
          <Btn variant="quiet" onClick={onCancel}>
            {tr.common.actions.cancel}
          </Btn>
        </div>
      </div>
    </div>
  );
}
