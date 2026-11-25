import { useEffect, useRef, useState } from 'react';
import { BRAND, brandSlug } from '../../config/brand';
import { formatTime } from '../../core/math/util';
import { downloadBlob } from '../../export/exporters';
import { useI18n } from '../../i18n';
import { planFor, type Entitlements } from '../../research/plans';
import type { VariantReport } from '../../research/report';
import { Btn, Dialog, Icon, Segmented } from '../../ui/kit';
import { drawShareImage, SHARE_SIZES, type ShareFormat, type ShareImageSpec } from './shareImage';

type Stat = 'hook' | 'mean' | 'drop';

const FONT = '"Instrument Sans Variable", system-ui, -apple-system, "Segoe UI", sans-serif';
const pct = (v: number) => Math.round(v * 100);

/** Liczby dostępne na grafice dla tego raportu (hook wymaga ≥ 3,5 s materiału). */
export function availableStats(r: VariantReport): Stat[] {
  return (['hook', 'mean', 'drop'] as const).filter((s) => (s === 'hook' ? r.hook.at3 !== null : s === 'mean' ? r.meanAttention !== null : r.drops.length > 0));
}

/** Dane do narysowania (bez płótna) — tylko wartości zbiorcze z raportu. */
export function shareSpecFor(r: VariantReport, opts: { format: ShareFormat; stat: Stat; title: string | null; watermark: boolean }, s: ReturnType<typeof useI18n>['t']['report']['share'], watermarkText: string): ShareImageSpec {
  const biggest = [...r.drops].sort((a, b) => b.delta - a.delta)[0];
  const stat =
    opts.stat === 'drop' && biggest
      ? { label: s.dropLabel, value: s.dropValue(pct(biggest.delta)), detail: s.range(formatTime(Math.floor(biggest.start), 0), formatTime(Math.ceil(biggest.end), 0)) }
      : opts.stat === 'hook' && r.hook.at3 !== null
        ? { label: s.hookLabel, value: `${pct(r.hook.at3)}%`, detail: null }
        : { label: s.meanLabel, value: `${pct(r.meanAttention ?? 0)}%`, detail: null };
  const facts = [...(opts.stat !== 'mean' && r.meanAttention !== null ? [s.meanFact(pct(r.meanAttention))] : []), s.viewers(r.viewers)];
  return {
    format: opts.format,
    curve: r.curve.map((p) => ({ t: p.t + r.bin / 2, value: p.value })),
    duration: r.duration,
    stat,
    facts,
    title: opts.title,
    highlight: opts.stat === 'drop' && biggest ? { t0: biggest.start, t1: biggest.end } : null,
    axis: { start: formatTime(0, 0), end: formatTime(Math.round(r.duration), 0) },
    brandName: BRAND.name,
    footer: s.footer(BRAND.name, BRAND.domain),
    watermark: opts.watermark ? watermarkText : null,
    fontFamily: FONT,
  };
}

/**
 * Przycisk i okno grafiki do udostępnienia (§7.1): podgląd na płótnie, format posta albo relacji,
 * wybór głównej liczby, opcjonalna nazwa materiału; pobranie PNG albo udostępnienie (Web Share).
 */
export function ShareImageButton({ report, projectName, can }: { report: VariantReport; projectName: string; can: Entitlements }) {
  const { t } = useI18n();
  const s = t.report.share;
  const stats = availableStats(report);
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ShareFormat>('portrait');
  const [stat, setStat] = useState<Stat>(stats[0] ?? 'mean');
  const [showTitle, setShowTitle] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const watermark = !can.shareImageClean;
  const spec = shareSpecFor(report, { format, stat, title: showTitle ? projectName : null, watermark }, s, t.report.header.watermark);
  const specKey = JSON.stringify(spec);

  useEffect(() => {
    if (!open) return;
    let live = true;
    void (async () => {
      // Czcionka marki musi być wczytana, zanim trafi na płótno.
      try {
        await document.fonts?.load?.(`700 40px ${FONT}`);
      } catch {
        /* zostaje czcionka systemowa */
      }
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!live || !canvas || !ctx) return;
      canvas.width = SHARE_SIZES[spec.format].w;
      canvas.height = SHARE_SIZES[spec.format].h;
      drawShareImage(ctx, spec);
    })();
    return () => {
      live = false;
    };
    // Rysujemy ponownie tylko przy zmianie treści grafiki.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, specKey]);

  if (!stats.length || report.viewers === 0) return null;
  const fileName = `${brandSlug()}-${s.fileStem}-${format === 'portrait' ? '4x5' : '9x16'}.png`;
  const blob = () => new Promise<Blob | null>((res) => (canvasRef.current ? canvasRef.current.toBlob(res, 'image/png') : res(null)));
  const nav = navigator as Navigator & { canShare?(d: { files: File[] }): boolean };
  const canShareFiles = typeof nav.canShare === 'function' && typeof File !== 'undefined' && nav.canShare({ files: [new File([''], fileName, { type: 'image/png' })] });

  return (
    <>
      <Btn size="sm" variant="quiet" onClick={() => setOpen(true)}>
        <Icon name="download" size={16} />
        {s.open}
      </Btn>
      <Dialog open={open} onClose={() => setOpen(false)} title={s.title} wide>
        <p className="text-[14.5px] leading-relaxed text-muted">{s.lead}</p>
        <div className="mt-4 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,260px)]">
          <div className="grid min-w-0 place-items-center rounded-xl bg-ink/[0.05] p-3">
            <canvas ref={canvasRef} width={SHARE_SIZES[format].w} height={SHARE_SIZES[format].h} role="img" aria-label={s.preview(s.formats[format])} className="block h-auto max-h-[52vh] w-auto max-w-full rounded-lg shadow-sm" />
          </div>
          <div className="min-w-0 space-y-4">
            <div className="space-y-1.5">
              <span className="text-[13.5px] font-semibold text-ink">{s.format}</span>
              <Segmented<ShareFormat> label={s.format} value={format} onChange={setFormat} options={(['portrait', 'story'] as const).map((f) => ({ value: f, label: s.formats[f] }))} />
            </div>
            {stats.length > 1 && (
              <fieldset>
                <legend className="mb-1.5 text-[13.5px] font-semibold text-ink">{s.statLabel}</legend>
                <div className="space-y-1.5">
                  {stats.map((x) => (
                    <label key={x} className="flex min-h-9 cursor-pointer items-center gap-2 text-[14px]">
                      <input type="radio" name="share-stat" className="h-4 w-4 accent-cobalt" checked={stat === x} onChange={() => setStat(x)} />
                      {s.stats[x]}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <label className="flex min-h-9 cursor-pointer items-center gap-2 text-[14px]">
              <input type="checkbox" className="h-4 w-4 accent-cobalt" checked={showTitle} onChange={(e) => setShowTitle(e.target.checked)} />
              {s.showTitle}
            </label>
            {watermark && <p className="text-[13px] text-muted">{s.watermarkNote(t.billing.planNames[planFor('shareImageClean')])}</p>}
            <div className="flex flex-wrap gap-2">
              <Btn
                variant="primary"
                onClick={async () => {
                  const b = await blob();
                  if (b) downloadBlob(b, fileName);
                }}
              >
                {s.download}
              </Btn>
              {canShareFiles && (
                <Btn
                  onClick={async () => {
                    const b = await blob();
                    if (!b) return;
                    try {
                      await navigator.share({ files: [new File([b], fileName, { type: 'image/png' })], title: projectName });
                    } catch {
                      /* anulowano udostępnianie */
                    }
                  }}
                >
                  {s.share}
                </Btn>
              )}
            </div>
          </div>
        </div>
      </Dialog>
    </>
  );
}
