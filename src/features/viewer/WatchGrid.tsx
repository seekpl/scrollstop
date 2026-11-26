import { useEffect, useMemo, useRef, useState } from 'react';
import { apiBase } from '../../api/base';
import type { GazeSample } from '../../core/contracts/types';
import { SampleBuilder } from '../../core/pipeline/sampleBuilder';
import { ManualClock } from '../../core/time/playbackClock';
import { DEMO_SPECS, drawDemoScene, preloadDemo, type GazeTarget } from '../../demo/demoScene';
import { useT } from '../../i18n';
import { DEFAULT_GRID, gridCells, type GridCellBox } from '../../research/grid';
import { detectDevice } from '../../research/link';
import type { ItemLog, MediaSource, StudyConfig } from '../../research/model';
import { playableUrl } from '../shared/mediaLibrary';
import type { CalibrationOutcome } from '../shared/useCalibration';
import { gazeSourceFor, PausePanel, useLongPress, useWatchGuards } from './watchCommon';
import type { WatchResult } from './WatchFullscreen';

interface Cell {
  itemId: string;
  role: ItemLog['role'];
  media: MediaSource | null;
  title: string;
}

/** Układ siatki: badana miniatura na losowej pozycji, wypełniacze w losowej kolejności (§4.5). */
export function buildGrid(config: StudyConfig, n: number, rng: () => number = Math.random): Cell[] {
  const fillers = [...config.fillers];
  for (let i = fillers.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [fillers[i], fillers[j]] = [fillers[j], fillers[i]];
  }
  const pos = Math.floor(rng() * n);
  return Array.from({ length: n }, (_, i): Cell => {
    if (i === pos) return { itemId: 'tested', role: 'tested', media: config.variant.media, title: config.variant.title ?? '' };
    const f = fillers[(i > pos ? i - 1 : i) % Math.max(1, fillers.length)];
    return { itemId: f?.id ?? `fil_${i}`, role: 'filler', media: f?.media ?? null, title: f?.title ?? '' };
  });
}

/** Miniatura bez odtwarzania: klip/obraz demo rysowany raz, obraz z pliku albo adresu. */
function Still({ media, label }: { media: MediaSource | null; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || media?.kind !== 'demo') return;
    const spec = DEMO_SPECS[media.demo];
    let alive = true;
    const draw = () => {
      if (!alive) return;
      const r = c.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.max(1, Math.round(r.width * dpr));
      c.height = Math.max(1, Math.round(r.height * dpr));
      const ctx = c.getContext('2d');
      if (ctx) drawDemoScene(ctx, Math.min(1, spec.duration), c.width, c.height, spec);
    };
    draw();
    // Po wczytaniu fotografii — jeszcze raz, już ze zdjęciem.
    void preloadDemo(spec).then(draw);
    return () => {
      alive = false;
    };
  }, [media]);
  if (media?.kind === 'demo') return <canvas ref={ref} className="h-full w-full rounded-lg" role="img" aria-label={label} />;
  const url = playableUrl(media, apiBase());
  return url ? <img src={url} alt={label} className="h-full w-full rounded-lg object-cover" draggable={false} /> : <div className="h-full w-full rounded-lg bg-ink/10" role="img" aria-label={label} />;
}

const pct = (v: number) => `${v * 100}%`;

/**
 * Test miniatury (§4.5): siatka jak na stronie z filmami przez czas ekspozycji (domyślnie 6 s),
 * potem pytanie „Który film chcesz obejrzeć?”. Wzrok przypisujemy komórkom w raporcie.
 */
export function WatchGrid({ config, calibration, simulated, onFinish }: { config: StudyConfig; calibration: CalibrationOutcome | null; simulated: boolean; onFinish(r: WatchResult): void }) {
  const t = useT();
  const g = t.viewer.grid;
  const settings = config.grid ?? DEFAULT_GRID;
  const aspect = useMemo(() => window.innerWidth / Math.max(1, window.innerHeight), []);
  const boxes = useMemo(() => gridCells(settings.layout, aspect), [settings.layout, aspect]);
  // Wypełniacze bez tytułu (demo) dostają neutralne tytuły w języku badania — tekst nie może wyróżniać badanej.
  const cells = useMemo(() => buildGrid(config, boxes.length).map((c, i) => (c.role === 'filler' && !c.title && config.variant.title ? { ...c, title: g.fillerTitles[i % g.fillerTitles.length] } : c)), [config, boxes.length, g.fillerTitles]);
  const [stage, setStage] = useState<'intro' | 'exposure' | 'choice'>('intro');
  const [panel, setPanel] = useState(false);
  const samples = useRef<GazeSample[]>([]);
  const t0 = useRef(0);
  const stopRef = useRef<() => void>(() => undefined);
  const device = useMemo(detectDevice, []);
  const exposure = Math.min(10, Math.max(3, settings.exposureSeconds));

  const items = (): ItemLog[] => cells.map((c, i) => ({ index: i, itemId: c.itemId, role: c.role, ...(c.role === 'tested' ? { variantId: config.variant.id } : {}), enterMs: 0, exitMs: exposure * 1000, exitType: 'finish', loops: 0, events: [], rect: boxes[i].rect }));
  const finish = (completed: boolean, choice: string | null | undefined, reported = false) => {
    stopRef.current();
    onFinish({ samples: samples.current, t0: t0.current, completed, duration: exposure, watchedSeconds: exposure, device, reported, items: items(), itemOf: () => 0, ...(choice !== undefined ? { choice: { itemId: choice } } : {}) });
  };

  const start = () => {
    t0.current = performance.now();
    const clock = new ManualClock(exposure + 1);
    clock.play();
    // Siatka zajmuje cały ekran: współrzędne wzroku = współrzędne ekranu.
    const builder = new SampleBuilder(2, clock, () => ({ x: 0, y: 0, w: 1, h: 1 }));
    const order = boxes.map((_, i) => i).sort(() => Math.random() - 0.5);
    const target = { target: (tt: number): GazeTarget => {
      const b = boxes[order[Math.floor(tt / 0.8) % order.length]].thumb;
      return { x: b.x + b.w / 2, y: b.y + b.h / 2, key: 'background' };
    } };
    const source = gazeSourceFor(simulated, calibration, clock, target);
    source.start((raw) => samples.current.push(builder.build(raw).sample));
    const timer = setTimeout(() => {
      source.stop();
      clock.pause();
      if (settings.askChoice) setStage('choice');
      else finish(true, undefined);
    }, exposure * 1000);
    stopRef.current = () => {
      clearTimeout(timer);
      source.stop();
      clock.pause();
    };
    setStage('exposure');
  };
  useEffect(() => () => stopRef.current(), []);

  useWatchGuards({ onPanel: () => stage !== 'intro' && setPanel(true), onHidden: () => undefined, onVisible: () => undefined });
  const press = useLongPress(() => setPanel(true));

  const cellLabel = (i: number) => (cells[i].title ? cells[i].title : g.cell(i + 1));
  const renderCell = (c: Cell, i: number, b: GridCellBox, choose: boolean) => {
    const inner = (
      <>
        <span className="absolute overflow-hidden rounded-lg" style={{ left: pct((b.thumb.x - b.rect.x) / b.rect.w), top: pct((b.thumb.y - b.rect.y) / b.rect.h), width: pct(b.thumb.w / b.rect.w), height: pct(b.thumb.h / b.rect.h) }}>
          <Still media={c.media} label={cellLabel(i)} />
        </span>
        {settings.layout !== 'profile_grid' && (
          <span className={`absolute ${settings.layout === 'yt_search_mobile' ? 'right-0 top-1' : 'bottom-0 left-0 right-0'} space-y-1`} style={settings.layout === 'yt_search_mobile' ? { left: pct((b.thumb.w + 0.02) / b.rect.w) } : { top: pct((b.thumb.h + 0.008) / b.rect.h) }}>
            {c.title ? <span className="line-clamp-2 text-left text-[13px] font-semibold leading-snug text-ink">{c.title}</span> : <span className="block h-2.5 w-11/12 rounded bg-ink/25" />}
            <span className="block h-2 w-1/2 rounded bg-ink/15" />
          </span>
        )}
      </>
    );
    const style = { left: pct(b.rect.x), top: pct(b.rect.y), width: pct(b.rect.w), height: pct(b.rect.h) };
    return choose ? (
      <button key={i} type="button" className="absolute rounded-xl text-left ring-cobalt hover:ring-4 focus-visible:ring-4" style={style} aria-label={cellLabel(i)} onClick={() => finish(true, c.itemId)}>
        {inner}
      </button>
    ) : (
      <div key={i} className="absolute" style={style}>
        {inner}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[90] select-none overflow-hidden bg-white" onContextMenu={(e) => e.preventDefault()} data-testid="grid">
      {stage !== 'intro' && <div className="absolute inset-0" aria-label={g.gridLabel} role="group" onPointerDown={() => press.start()} onPointerUp={() => press.end()}>{boxes.map((b, i) => renderCell(cells[i], i, b, stage === 'choice'))}</div>}
      {stage === 'intro' && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-black p-6 text-center text-white">
          <div className="max-w-sm space-y-5">
            <h1 className="text-[24px] font-semibold leading-snug">{g.introTitle}</h1>
            <p className="text-[16px] leading-relaxed text-white/85">{g.introBody(exposure)}</p>
            <button type="button" onClick={start} className="min-h-12 w-full rounded-2xl bg-white px-6 text-[17px] font-semibold text-ink">
              {g.start}
            </button>
          </div>
        </div>
      )}
      {stage === 'choice' && (
        <>
          <div className="absolute inset-x-0 top-0 z-10 bg-white/95 px-4 py-3 text-center shadow-sm">
            <h1 className="text-[18px] font-semibold text-ink">{g.choiceTitle}</h1>
          </div>
          <div className="absolute inset-x-0 bottom-0 z-10 flex justify-center bg-white/95 p-3">
            <button type="button" onClick={() => finish(true, null)} className="min-h-11 rounded-2xl px-6 text-[16px] font-semibold text-ink ring-1 ring-inset ring-field">
              {g.none}
            </button>
          </div>
        </>
      )}
      {panel && <PausePanel canResume onResume={() => setPanel(false)} onEnd={() => finish(false, undefined)} onReport={() => finish(false, undefined, true)} />}
    </div>
  );
}
