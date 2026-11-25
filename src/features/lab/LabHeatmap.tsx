import { useMemo, useState } from 'react';
import { detectFixations } from '../../core/analysis/fixations';
import { colorize, computeDensity, DEFAULT_DENSITY, normalizeDensity, paletteCss, selectRange, type Density, type PaletteName } from '../../core/analysis/heatmap';
import { detectScenes, fixedScenes, segmentLength } from '../../core/analysis/scenes';
import { regionOf, sessionDuration, type Region } from '../../core/analysis/stats';
import type { Fixation, Scene, Session } from '../../core/contracts/types';
import { errorCode } from '../../core/errors';
import { formatTime, mean, median } from '../../core/math/util';
import type { FrameSource } from '../../core/render/frameSource';
import { drawExportFooter, drawHeatmapLayer } from '../../core/render/draw';
import { downloadBlob } from '../../export/exporters';
import { useT } from '../../i18n';
import { Btn, Callout, Segmented, Surface } from '../../ui/kit';
import { useCanvasFrame } from '../shared/useCanvasFrame';
import { useFrameSource } from './hooks';
import { useLab } from './LabContext';
import { mediaLabel, NoSession, SessionBar, Slider } from './parts';
import { RangeTimeline } from './RangeTimeline';

interface HeatResult {
  range: [number, number];
  density: Density;
  norm: Float32Array;
  fixations: Fixation[];
  dominant: Region | null;
}

const MIN_VALID_SECONDS = 3;

export function LabHeatmap() {
  const lab = useLab();
  const t = useT();
  const h = t.lab.heatmap;
  const session = lab.activeSession;
  const src = useFrameSource(session);
  const [compare, setCompare] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [sceneError, setSceneError] = useState<string | null>(null);
  if (!session) return <NoSession />;
  const scenes = session.meta.scenes ?? [];
  const duration = sessionDuration(session.samples, session.meta.video.duration);
  const hasFrames = src?.kind === 'video' || src?.kind === 'demo';
  const segLen = segmentLength(duration);

  const autoDetect = async () => {
    if (!src || !hasFrames) {
      setSceneError(h.needFrames);
      return;
    }
    setSceneError(null);
    setProgress(0);
    try {
      await lab.updateActiveMeta({ scenes: await detectScenes(src, { onProgress: setProgress }) });
    } catch (e) {
      setSceneError((t.errors as Record<string, string>)[errorCode(e)] ?? t.errors.unknown);
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-[28px] font-semibold tracking-[-0.02em] sm:text-[34px]">{h.title}</h1>
      <SessionBar />
      <div className="flex flex-wrap items-center gap-3">
        <Btn onClick={() => void autoDetect()} disabled={progress !== null}>
          {progress !== null ? h.analyzing(Math.round(progress * 100)) : h.detectScenes}
        </Btn>
        {duration > 0 && (
          <Btn
            onClick={() => {
              setSceneError(null);
              void lab.updateActiveMeta({ scenes: fixedScenes(duration, segLen) });
            }}
          >
            {h.splitInto(segLen)}
          </Btn>
        )}
        <label className="flex items-center gap-2 text-[14px] font-semibold">
          <input type="checkbox" className="h-4 w-4 accent-cobalt" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
          {h.compare}
        </label>
        {sceneError && <span className="text-[14px] font-semibold text-poor">{sceneError}</span>}
      </div>
      <div className={compare ? 'grid gap-6 xl:grid-cols-2' : ''}>
        <HeatmapPanel key={`a-${session.meta.id}`} idPrefix="a" label={compare ? h.sceneA : undefined} session={session} src={src} scenes={scenes} duration={duration} initial={scenes[0] ? [scenes[0].start, scenes[0].end] : [0, duration]} />
        {compare && (
          <HeatmapPanel key={`b-${session.meta.id}`} idPrefix="b" label={h.sceneB} session={session} src={src} scenes={scenes} duration={duration} initial={scenes[1] ? [scenes[1].start, scenes[1].end] : [duration / 2, duration]} />
        )}
      </div>
    </div>
  );
}

function HeatmapPanel({ label, idPrefix, session, src, scenes, duration, initial }: { label?: string; idPrefix: string; session: Session; src: FrameSource | null; scenes: Scene[]; duration: number; initial: [number, number] }) {
  const t = useT();
  const h = t.lab.heatmap;
  const [range, setRange] = useState<[number, number]>(initial);
  const [opacity, setOpacity] = useState(0.7);
  const [useUnc, setUseUnc] = useState(true);
  const [palette, setPalette] = useState<PaletteName>('inferno');
  const [result, setResult] = useState<HeatResult | null>(null);
  const [frameT, setFrameT] = useState((initial[0] + initial[1]) / 2);
  const rgba = useMemo(() => (result ? colorize(result.norm, palette) : null), [result, palette]);

  const generate = () => {
    const sel = selectRange(session.samples, range[0], range[1]);
    const density = computeDensity(sel, { ...DEFAULT_DENSITY, useUncertainty: useUnc });
    const fixations = detectFixations(sel);
    const counts: Record<Region, number> = { left: 0, center: 0, right: 0 };
    sel.forEach((s) => counts[regionOf(s.vx as number)]++);
    const dominant = sel.length ? (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as Region) : null;
    setResult({ range: [...range], density, norm: normalizeDensity(density), fixations, dominant });
    // Tło = klatka ze „środka” faktycznie zebranych danych, nie środka zakresu.
    setFrameT(sel.length ? median(sel.map((s) => s.videoTime as number)) : (range[0] + range[1]) / 2);
  };

  const canvasRef = useCanvasFrame(
    src,
    frameT,
    (ctx, w, hh) => {
      if (result && rgba) drawHeatmapLayer(ctx, rgba, result.density.w, result.density.h, w, hh, opacity);
    },
    [result, rgba, opacity],
  );

  const exportPng = () => {
    const c = canvasRef.current;
    if (!c || !result) return;
    const out = document.createElement('canvas');
    out.width = c.width;
    out.height = c.height;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(c, 0, 0);
    drawExportFooter(
      ctx,
      out.width,
      out.height,
      [
        `${mediaLabel(session.meta.video, t)}  ${formatTime(result.range[0])}–${formatTime(result.range[1])}`,
        h.samplesLine(result.density.n, result.density.validSeconds.toFixed(1), (result.density.meanUncertainty * 100).toFixed(1)),
        t.lab.footer.disclaimer,
      ],
      palette,
      { low: h.legendLow, high: h.legendHigh },
    );
    out.toBlob((b) => b && downloadBlob(b, `heatmap_${session.meta.id}_${result.range[0].toFixed(1)}-${result.range[1].toFixed(1)}.png`), 'image/png');
  };

  const enough = result && result.density.validSeconds >= MIN_VALID_SECONDS;
  return (
    <Surface>
      {label && <h2 className="mb-3 text-[17px] font-semibold">{label}</h2>}
      <RangeTimeline idPrefix={idPrefix} duration={duration} value={range} onChange={setRange} scenes={scenes} />
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Btn variant="primary" size="lg" onClick={generate}>
          {h.generate}
        </Btn>
        <label className="flex items-center gap-2 text-[14px] font-semibold">
          <input type="checkbox" className="h-4 w-4 accent-cobalt" checked={useUnc} onChange={(e) => setUseUnc(e.target.checked)} />
          {h.uncertainty}
        </label>
        <Segmented<PaletteName> label={h.palette} value={palette} onChange={setPalette} options={(['inferno', 'viridis'] as PaletteName[]).map((p) => ({ value: p, label: h.palettes[p] }))} />
      </div>
      <div className="mt-5 overflow-hidden rounded-2xl bg-ink">
        <canvas ref={canvasRef} className="mx-auto block h-auto max-h-[70vh] w-auto max-w-full" role="img" aria-label={h.canvasLabel} />
      </div>
      <div className="mt-4 space-y-3">
        <div className="flex items-center gap-3 text-[12.5px] text-muted">
          <span>{h.legendLow}</span>
          <span className="h-2.5 flex-1 rounded-full" style={{ background: paletteCss(palette) }} />
          <span>{h.legendHigh}</span>
        </div>
        <Slider label={h.opacity} value={opacity} min={0.2} max={1} step={0.05} onChange={setOpacity} format={(v) => `${Math.round(v * 100)}%`} />
        {result && <Slider label={h.frame} value={frameT} min={result.range[0]} max={result.range[1]} step={0.1} onChange={setFrameT} format={(v) => formatTime(v, 1)} />}
      </div>
      {result && (
        <div className="mt-5 space-y-3">
          <p className="tabular text-[14px]">{h.samplesLine(result.density.n, result.density.validSeconds.toFixed(1), (result.density.meanUncertainty * 100).toFixed(1))}</p>
          <dl className="tabular grid grid-cols-3 gap-3 text-[14px]">
            <div>
              <dt className="text-muted">{h.fixations}</dt>
              <dd className="text-[18px] font-semibold">{result.fixations.length}</dd>
            </div>
            <div>
              <dt className="text-muted">{h.meanFix}</dt>
              <dd className="text-[18px] font-semibold">{result.fixations.length ? `${mean(result.fixations.map((f) => f.duration)).toFixed(2)} s` : '–'}</dd>
            </div>
            <div>
              <dt className="text-muted">{h.dominant}</dt>
              <dd className="text-[18px] font-semibold">{result.dominant ? h.regions[result.dominant] : '–'}</dd>
            </div>
          </dl>
          {!enough && <Callout tone="warn">{h.tooLittle}</Callout>}
          <Btn onClick={exportPng}>{h.exportPng}</Btn>
        </div>
      )}
    </Surface>
  );
}
