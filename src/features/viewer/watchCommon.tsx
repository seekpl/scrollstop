import { useEffect, useRef, useState } from 'react';
import { apiBase } from '../../api/base';
import type { GazeSample } from '../../core/contracts/types';
import { WebcamGazeEstimator } from '../../core/pipeline/webcamEstimator';
import { ManualClock, type PlaybackClock } from '../../core/time/playbackClock';
import { trackingHub } from '../../core/tracking/trackingHub';
import { DEMO_SPECS, type GazeTarget } from '../../demo/demoScene';
import { wanderingTarget } from '../../demo/simulator';
import { useT } from '../../i18n';
import type { VideoState } from '../../core/contracts/types';
import type { MediaSource } from '../../research/model';
import { SimulatedGazeSource, WebcamGazeSource, type GazeSource } from '../../sources/sources';
import { isImageMedia } from '../report/frames';
import { createDemoController, createVideoController, type MediaController } from '../shared/mediaController';
import { playableUrl } from '../shared/mediaLibrary';
import type { CalibrationOutcome } from '../shared/useCalibration';

/** Źródło wzroku dla przebiegu: kamera z modelem z kalibracji albo symulacja (`?sim=1`). */
export function gazeSourceFor(simulated: boolean, calibration: CalibrationOutcome | null, clock: PlaybackClock, target: { target(t: number): GazeTarget }): GazeSource {
  if (simulated || !calibration) return new SimulatedGazeSource(clock, target);
  return new WebcamGazeSource(trackingHub, new WebcamGazeEstimator(calibration.model, calibration.summary));
}

/** Cel symulowanego wzroku dla materiału: klip demo — jego cel; reszta — wędrowanie po kadrze. */
export const targetFor = (m: MediaSource | null) => (m?.kind === 'demo' ? DEMO_SPECS[m.demo] : wanderingTarget);

/**
 * Zegar przełączany między pozycjami (feed, karuzela): próbki dostają czas bieżącej pozycji;
 * w trakcie przejścia stan „pauza” (próbki NOT_PLAYING). Odcinek = pozycja × 1000 + odcinek pozycji.
 */
export class SwitchClock implements PlaybackClock {
  private current: PlaybackClock | null = null;
  private visit = 0;

  set(clock: PlaybackClock | null): void {
    this.current = clock;
    if (clock) this.visit++;
  }

  mediaTimeAt(perfMs: number): number | null {
    return this.current ? this.current.mediaTimeAt(perfMs) : null;
  }

  state(): VideoState {
    return this.current ? this.current.state() : 'paused';
  }

  segment(): number {
    return this.visit * 1000 + (this.current?.segment() ?? 0);
  }

  duration(): number {
    return this.current?.duration() ?? 0;
  }

  dispose(): void {}
}

/** Oś czasu pozycji: która pozycja była na ekranie w chwili przechwycenia klatki (−1 = przejście). */
export class ItemTimeline {
  private readonly marks: Array<{ t: number; item: number }> = [];

  mark(t: number, item: number): void {
    this.marks.push({ t, item });
  }

  at(t: number): number {
    let lo = 0;
    let hi = this.marks.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this.marks[mid].t <= t) {
        found = this.marks[mid].item;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return found;
  }

  itemOf = (s: GazeSample): number => this.at(s.tCapture);
}

/** Kontroler statycznego obrazu: zegar ręczny liczy sekundy na pozycji (slajd, post z obrazem). */
export function createImageController(size: { w: number; h: number }): MediaController {
  const clock = new ManualClock(3600);
  return {
    clock,
    play: async () => clock.play(),
    pause: () => clock.pause(),
    isPaused: () => clock.state() !== 'playing',
    currentTime: () => clock.mediaTimeAt(performance.now()),
    duration: () => 0,
    contentSize: () => size,
    onEnded: () => undefined,
    seek: (t) => clock.seek(t),
    dispose: () => clock.pause(),
  };
}

/**
 * Jedna pozycja na ekranie: klip demo (canvas), plik wideo albo obraz. Tworzy kontroler i oddaje go
 * wyżej; po końcu klipu odtwarza od nowa i zgłasza pętlę (feed).
 */
export function MediaSurface({ media, size, muted, loop, onReady, onLoop, label }: { media: MediaSource | null; size: { w: number; h: number }; muted: boolean; loop: boolean; onReady(c: MediaController): void; onLoop?(): void; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const image = isImageMedia(media) && media?.kind !== 'demo';
  const demoImage = media?.kind === 'demo' && DEMO_SPECS[media.demo].kind === 'image';
  const url = media && media.kind !== 'demo' ? playableUrl(media, apiBase()) : null;
  const ready = useRef(onReady);
  const looped = useRef(onLoop);
  ready.current = onReady;
  looped.current = onLoop;
  useEffect(() => {
    let c: MediaController;
    if (media?.kind === 'demo') {
      const spec = DEMO_SPECS[media.demo];
      if (spec.kind === 'image') {
        // Statyczny slajd demo: rysujemy raz, czas liczy zegar ręczny.
        const canvas = canvasRef.current as HTMLCanvasElement;
        const draw = createDemoController(canvas, spec);
        const still = createImageController({ w: spec.w, h: spec.h });
        c = { ...still, dispose: () => (draw.dispose(), still.dispose()) };
      } else {
        c = createDemoController(canvasRef.current as HTMLCanvasElement, spec, { loop });
        if (loop) c.onEnded(() => looped.current?.());
      }
    } else if (image) {
      c = createImageController(size);
    } else {
      const video = videoRef.current as HTMLVideoElement;
      c = createVideoController(video);
      c.setMuted?.(muted);
      if (loop)
        c.onEnded(() => {
          looped.current?.();
          c.seek?.(0);
          void c.play().catch(() => undefined);
        });
    }
    ready.current(c);
    return () => c.dispose();
    // Jedna pozycja = jeden kontroler (klucz komponentu zmienia się przy przejściu).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      {media?.kind === 'demo' && <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label={label} />}
      {image && url && <img src={url} alt={label} className="absolute inset-0 h-full w-full object-contain" draggable={false} />}
      {!image && !demoImage && url && <video ref={videoRef} src={url} className="absolute inset-0 h-full w-full object-contain" playsInline muted={muted} disablePictureInPicture controlsList="nodownload nofullscreen noremoteplayback" crossOrigin={media?.kind === 'hosted' ? 'anonymous' : undefined} aria-label={label} />}
    </>
  );
}

/**
 * Ochrona przebiegu (§10.8) wspólna dla feedu, siatki i karuzeli: blokada wygaszania, ostrzeżenie
 * przy wyjściu, Wstecz → panel pauzy, ukrycie karty → pauza, Esc → panel.
 */
export function useWatchGuards(opts: { onPanel(): void; onHidden(): void; onVisible(): void }): void {
  const ref = useRef(opts);
  ref.current = opts;
  useEffect(() => {
    type Lock = { release(): Promise<void> };
    let lock: Lock | null = null;
    const wake = async () => {
      try {
        lock = (await (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<Lock> } }).wakeLock?.request('screen')) ?? null;
      } catch {
        lock = null;
      }
    };
    void wake();
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    history.pushState({ attnWatch: true }, '');
    const onPop = () => {
      history.pushState({ attnWatch: true }, '');
      ref.current.onPanel();
    };
    const onVisibility = () => {
      if (document.hidden) ref.current.onHidden();
      else {
        void wake();
        ref.current.onVisible();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') ref.current.onPanel();
    };
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('popstate', onPop);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('keydown', onKey);
    return () => {
      void lock?.release().catch(() => undefined);
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('popstate', onPop);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('keydown', onKey);
    };
  }, []);
}

/** Długie przytrzymanie (1,5 s) otwiera panel pauzy; krótkie dotknięcie zwraca `false`. */
export function useLongPress(onLong: () => void, ms = 1500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const start = () => {
    fired.current = false;
    timer.current = setTimeout(() => {
      fired.current = true;
      onLong();
    }, ms);
  };
  const end = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    return fired.current;
  };
  return { start, end };
}

/** Panel pauzy (§10.8): wznów, zakończ, zgłoś treść (z potwierdzeniem). */
export function PausePanel({ canResume, onResume, onEnd, onReport }: { canResume: boolean; onResume(): void; onEnd(): void; onReport(): void }) {
  const t = useT();
  const w = t.viewer.watch;
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-black/70 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="pause-title" className="w-full max-w-sm rounded-3xl bg-surface p-6 text-ink">
        {confirm ? (
          <>
            <h2 id="pause-title" className="text-[20px] font-semibold">
              {w.reportTitle}
            </h2>
            <p className="mt-2 text-[15px] text-muted">{w.reportBody}</p>
            <div className="mt-5 flex flex-col gap-2">
              <button type="button" onClick={onReport} className="min-h-12 rounded-2xl bg-poor text-[16px] font-semibold text-white">
                {w.reportConfirm}
              </button>
              <button type="button" onClick={() => setConfirm(false)} className="min-h-12 rounded-2xl text-[16px] font-semibold ring-1 ring-inset ring-field">
                {t.common.actions.back}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="pause-title" className="text-[20px] font-semibold">
              {w.pausedTitle}
            </h2>
            <p className="mt-2 text-[15px] text-muted">{w.pausedBody}</p>
            <div className="mt-5 flex flex-col gap-2">
              {canResume && (
                <button type="button" onClick={onResume} className="min-h-12 rounded-2xl bg-cobalt text-[16px] font-semibold text-white">
                  {w.resume}
                </button>
              )}
              <button type="button" onClick={onEnd} className="min-h-12 rounded-2xl text-[16px] font-semibold text-poor ring-1 ring-inset ring-poor/40">
                {w.end}
              </button>
              <button type="button" onClick={() => setConfirm(true)} className="min-h-11 text-[14.5px] font-semibold text-muted underline underline-offset-4">
                {w.report}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
