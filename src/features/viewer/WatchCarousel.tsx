import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { GazeSample } from '../../core/contracts/types';
import { containRect } from '../../core/geometry/coords';
import { SampleBuilder } from '../../core/pipeline/sampleBuilder';
import { useT } from '../../i18n';
import { detectDevice } from '../../research/link';
import type { ItemLog, MediaSource, StudyConfig } from '../../research/model';
import type { MediaController } from '../shared/mediaController';
import type { CalibrationOutcome } from '../shared/useCalibration';
import { gazeSourceFor, ItemTimeline, MediaSurface, PausePanel, SwitchClock, targetFor, useLongPress, useWatchGuards } from './watchCommon';
import type { WatchResult } from './WatchFullscreen';

const SWIPE_PX = 50;

/**
 * Karuzela i slajdy (§4.6): przesunięcie w bok — kolejny slajd, przewinięcie w górę — koniec
 * karuzeli. Slajdy w trybie automatycznym zmieniają się co N sekund. Każdy slajd ma własny zegar.
 */
export function WatchCarousel({ config, calibration, simulated, onFinish }: { config: StudyConfig; calibration: CalibrationOutcome | null; simulated: boolean; onFinish(r: WatchResult): void }) {
  const t = useT();
  const c = t.viewer.carousel;
  const slides: Array<MediaSource | null> = useMemo(() => (config.variant.slides?.length ? config.variant.slides : [config.variant.media]), [config.variant]);
  const auto = config.kind === 'slides' && config.slides?.mode === 'auto';
  const perSlide = Math.min(60, Math.max(2, config.slides?.secondsPerSlide ?? 5));
  const [k, setK] = useState(0);
  const [turn, setTurn] = useState(0);
  const [started, setStarted] = useState(false);
  const [panel, setPanel] = useState(false);
  const clock = useMemo(() => new SwitchClock(), []);
  const timeline = useMemo(() => new ItemTimeline(), []);
  const visits = useRef<ItemLog[]>([]);
  const samples = useRef<GazeSample[]>([]);
  const ctrl = useRef<MediaController | null>(null);
  const t0 = useRef(0);
  const kRef = useRef(0);
  const finished = useRef(false);
  const stopSource = useRef<() => void>(() => undefined);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const target = useRef(targetFor(slides[0]));
  const device = useMemo(detectDevice, []);
  kRef.current = k;
  const since = () => Math.round(performance.now() - t0.current);
  const visit = () => visits.current[visits.current.length - 1] as ItemLog | undefined;
  const w = config.variant.width;
  const h = config.variant.height;

  const finish = (completed: boolean, reported = false) => {
    if (finished.current) return;
    finished.current = true;
    if (autoTimer.current) clearTimeout(autoTimer.current);
    const v = visit();
    if (v && v.exitMs === null) {
      v.exitMs = since();
      v.exitType = completed ? 'finish' : null;
    }
    stopSource.current();
    clock.set(null);
    timeline.mark(performance.now(), -1);
    const seconds = Math.round(since() / 100) / 10;
    onFinish({ samples: samples.current, t0: t0.current, completed, duration: seconds, watchedSeconds: seconds, device, reported, items: visits.current, itemOf: timeline.itemOf });
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  const go = (dir: 1 | -1) => {
    if (!started || panel || finished.current) return;
    const next = kRef.current + dir;
    if (next < 0) return;
    if (next >= slides.length) {
      finishRef.current(true);
      return;
    }
    const v = visit();
    if (v && v.exitMs === null) {
      v.exitMs = since();
      v.exitType = dir > 0 ? 'swipe_next' : 'swipe_prev';
    }
    if (autoTimer.current) clearTimeout(autoTimer.current);
    ctrl.current?.pause();
    clock.set(null);
    timeline.mark(performance.now(), -1);
    setK(next);
    setTurn((x) => x + 1);
  };
  const goRef = useRef(go);
  goRef.current = go;

  const onReady = (m: MediaController) => {
    if (finished.current) return;
    const idx = kRef.current;
    ctrl.current = m;
    clock.set(m.clock);
    timeline.mark(performance.now(), idx);
    target.current = targetFor(slides[idx]);
    visits.current.push({ index: idx, itemId: `slide_${idx + 1}`, role: 'tested', variantId: config.variant.id, enterMs: since(), exitMs: null, exitType: null, loops: 0, events: [] });
    void m.play().catch(() => undefined);
    if (auto) autoTimer.current = setTimeout(() => goRef.current(1), perSlide * 1000);
  };

  const start = () => {
    t0.current = performance.now();
    const builder = new SampleBuilder(2, clock, () => containRect(window.innerWidth, window.innerHeight, w, h));
    const source = gazeSourceFor(simulated, calibration, clock, { target: (tt) => target.current.target(tt) });
    source.start((raw) => samples.current.push(builder.build(raw).sample));
    stopSource.current = () => source.stop();
    setStarted(true);
  };
  useEffect(() => () => stopSource.current(), []);

  useWatchGuards({ onPanel: () => started && setPanel(true), onHidden: () => undefined, onVisible: () => undefined });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goRef.current(1);
      else if (e.key === 'ArrowLeft') goRef.current(-1);
      else if (e.key === 'ArrowDown' || e.key === 'Enter') finishRef.current(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const press = useLongPress(() => setPanel(true));
  const gesture = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: ReactPointerEvent) => {
    gesture.current = { x: e.clientX, y: e.clientY };
    press.start();
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const gst = gesture.current;
    if (gst && Math.hypot(e.clientX - gst.x, e.clientY - gst.y) > 12) press.end();
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    const long = press.end();
    const gst = gesture.current;
    gesture.current = null;
    if (long || !gst || panel) return;
    const dx = e.clientX - gst.x;
    const dy = gst.y - e.clientY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_PX && !auto) goRef.current(dx < 0 ? 1 : -1);
    else if (dy > 60) finishRef.current(true);
  };

  return (
    <div className="fixed inset-0 z-[90] select-none overflow-hidden bg-black text-white" style={{ touchAction: 'none' }} onContextMenu={(e) => e.preventDefault()} data-testid="carousel">
      {started && (
        <div key={turn} className="absolute inset-0">
          <MediaSurface media={slides[k]} size={{ w, h }} muted loop={false} onReady={onReady} label={c.slideLabel(k + 1, slides.length)} />
        </div>
      )}
      <div className="absolute inset-0" aria-hidden onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => press.end()} />
      {started && (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-20 flex justify-center gap-1.5" aria-hidden>
            {slides.map((_, i) => (
              <span key={i} className={`h-2 w-2 rounded-full ${i === k ? 'bg-white' : 'bg-white/35'}`} />
            ))}
          </div>
          {!device.touch && (
            <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-3">
              {!auto && (
                <button type="button" onClick={() => goRef.current(-1)} disabled={k === 0} className="min-h-11 rounded-full bg-white/15 px-4 text-[15px] font-semibold disabled:opacity-30">
                  {c.prev}
                </button>
              )}
              {!auto && (
                <button type="button" onClick={() => goRef.current(1)} disabled={k >= slides.length - 1} className="min-h-11 rounded-full bg-white/15 px-4 text-[15px] font-semibold disabled:opacity-30">
                  {c.next}
                </button>
              )}
              <button type="button" onClick={() => finishRef.current(true)} className="min-h-11 rounded-full bg-white px-4 text-[15px] font-semibold text-ink">
                {c.done}
              </button>
            </div>
          )}
        </>
      )}
      {!started && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-black p-6 text-center">
          <div className="max-w-sm space-y-5">
            <h1 className="text-[24px] font-semibold leading-snug">{c.introTitle}</h1>
            <p className="text-[16px] leading-relaxed text-white/85">{auto ? c.introAuto(perSlide) : device.touch ? c.introTouch : c.introDesktop}</p>
            <button type="button" onClick={start} className="min-h-12 w-full rounded-2xl bg-white px-6 text-[17px] font-semibold text-ink">
              {c.start}
            </button>
          </div>
        </div>
      )}
      {panel && <PausePanel canResume onResume={() => setPanel(false)} onEnd={() => finishRef.current(false)} onReport={() => finishRef.current(false, true)} />}
    </div>
  );
}
