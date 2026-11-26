import { useEffect, useRef, useState } from 'react';
import type { GazeSample } from '../../core/contracts/types';
import { errorCode } from '../../core/errors';
import { containRect } from '../../core/geometry/coords';
import { SampleBuilder } from '../../core/pipeline/sampleBuilder';
import { WebcamGazeEstimator } from '../../core/pipeline/webcamEstimator';
import { trackingHub } from '../../core/tracking/trackingHub';
import { DEMO_SPECS, preloadDemo } from '../../demo/demoScene';
import { wanderingTarget } from '../../demo/simulator';
import { useT } from '../../i18n';
import { detectDevice } from '../../research/link';
import type { DeviceInfo, ItemLog, StudyConfig } from '../../research/model';
import { SimulatedGazeSource, WebcamGazeSource, type GazeSource } from '../../sources/sources';
import { createDemoController, createVideoController, createYouTubeController, type MediaController } from '../shared/mediaController';
import { playableUrl } from '../shared/mediaLibrary';
import type { CalibrationOutcome } from '../shared/useCalibration';
import { apiBase } from '../../api/base';

export interface WatchResult {
  samples: GazeSample[];
  /** Początek sesji w domenie próbek (ms). */
  t0: number;
  completed: boolean;
  duration: number;
  watchedSeconds: number;
  device: DeviceInfo;
  /** Widz zgłosił treść w panelu pauzy (§17.6). */
  reported: boolean;
  /** Feed, siatka, karuzela: wizyty pozycji i pozycja każdej próbki (kolumna `it`). */
  items?: ItemLog[];
  itemOf?: (s: GazeSample) => number;
  /** Test miniatury: wybór widza (deklaracja). */
  choice?: { itemId: string | null };
}

const LONG_PRESS_MS = 1500;
type Blocker = 'tap' | 'rotate' | 'resume' | null;

/**
 * Oglądanie na pełnym ekranie (§10.8): czarne tło, materiał `object-contain`, bez kontrolek
 * i bez znacznika wzroku. Długie przytrzymanie 1,5 s (komputer: Esc) otwiera panel pauzy.
 * Powrót, odświeżenie, zmiana karty i obrót telefonu nie kończą badania po cichu.
 */
export function WatchFullscreen({ config, calibration, simulated, muted, onFinish }: { config: StudyConfig; calibration: CalibrationOutcome | null; simulated: boolean; muted: boolean; onFinish(r: WatchResult): void }) {
  const t = useT();
  const w = t.viewer.watch;
  const v = config.variant;
  const media = v.media;
  const vertical = v.height > v.width;
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ytRef = useRef<HTMLDivElement>(null);
  const [ctrl, setCtrl] = useState<MediaController | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blocker, setBlocker] = useState<Blocker>(null);
  const [panel, setPanel] = useState(false);
  const [confirmReport, setConfirmReport] = useState(false);
  const finishRef = useRef<(completed: boolean, reported?: boolean) => void>(() => undefined);
  const url = playableUrl(media, apiBase());

  // Odtwarzacz
  useEffect(() => {
    if (!media) {
      setError('local_media');
      return;
    }
    if (media.kind === 'youtube') {
      let alive = true;
      let created: MediaController | null = null;
      createYouTubeController(ytRef.current as HTMLDivElement, media.youtubeId, { w: v.width, h: v.height }).then(
        (c) => {
          if (!alive) return c.dispose();
          created = c;
          c.onError?.(setError);
          if (muted) c.setMuted?.(true);
          setCtrl(c);
        },
        (e: unknown) => alive && setError(errorCode(e)),
      );
      return () => {
        alive = false;
        created?.dispose();
      };
    }
    if (media.kind === 'demo') {
      const spec = DEMO_SPECS[media.demo];
      const c = createDemoController(canvasRef.current as HTMLCanvasElement, spec);
      // Odtwarzanie dopiero z wczytanymi fotografiami klipu (widz nie widzi szkicu zastępczego).
      let alive = true;
      void preloadDemo(spec).then(() => alive && setCtrl(c));
      return () => {
        alive = false;
        c.dispose();
      };
    }
    if (!url) {
      setError('local_media');
      return;
    }
    const c = createVideoController(videoRef.current as HTMLVideoElement);
    c.setMuted?.(muted);
    setCtrl(c);
    return () => c.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pomiar: źródło wzroku → próbki zsynchronizowane z materiałem.
  useEffect(() => {
    if (!ctrl) return;
    let source: GazeSource;
    if (simulated || !calibration) source = new SimulatedGazeSource(ctrl.clock, media?.kind === 'demo' ? DEMO_SPECS[media.demo] : wanderingTarget);
    else source = new WebcamGazeSource(trackingHub, new WebcamGazeEstimator(calibration.model, calibration.summary));
    const rect = () => {
      const s = ctrl.contentSize();
      return containRect(window.innerWidth, window.innerHeight, s.w, s.h);
    };
    const builder = new SampleBuilder(2, ctrl.clock, rect);
    const samples: GazeSample[] = [];
    const t0 = performance.now();
    let maxT = 0;
    let finished = false;
    const device = detectDevice();
    source.start((raw) => {
      const r = builder.build(raw);
      samples.push(r.sample);
      if (r.sample.videoState === 'playing' && r.sample.videoTime !== null) maxT = Math.max(maxT, r.sample.videoTime);
    });
    ctrl.play().catch(() => setBlocker('tap'));
    const finish = (completed: boolean, reported = false) => {
      if (finished) return;
      finished = true;
      source.stop();
      ctrl.pause();
      onFinish({ samples, t0, completed, duration: ctrl.duration() || v.duration, watchedSeconds: Math.round(maxT * 10) / 10, device, reported });
    };
    finishRef.current = finish;
    ctrl.onEnded(() => finish(true));
    // Strażnik co 500 ms: zdejmuje komunikat, gdy odtwarzanie ruszyło.
    const watchdog = setInterval(() => {
      if (ctrl.clock.state() === 'playing') setBlocker((b) => (b === 'tap' || b === 'resume' ? null : b));
    }, 500);
    return () => {
      clearInterval(watchdog);
      if (!finished) source.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctrl]);

  // Ochrona przebiegu: blokada wygaszania, ostrzeżenie przy wyjściu, Wstecz, ukrycie karty, Esc, obrót.
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
    const openPanel = () => {
      ctrl?.pause();
      setPanel(true);
    };
    const onPop = () => {
      history.pushState({ attnWatch: true }, '');
      openPanel();
    };
    const onVisibility = () => {
      if (document.hidden) ctrl?.pause();
      else {
        void wake();
        setBlocker((b) => b ?? 'resume');
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') openPanel();
    };
    const onResize = () => {
      if (!vertical) return;
      const landscape = window.innerWidth > window.innerHeight && detectDevice().touch;
      if (landscape) {
        ctrl?.pause();
        setBlocker('rotate');
      } else setBlocker((b) => (b === 'rotate' ? 'resume' : b));
    };
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('popstate', onPop);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    if (ctrl) onResize();
    return () => {
      void lock?.release().catch(() => undefined);
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('popstate', onPop);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [ctrl, vertical]);

  const press = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPress = () => {
    press.current = setTimeout(() => {
      ctrl?.pause();
      setPanel(true);
    }, LONG_PRESS_MS);
  };
  const endPress = () => {
    if (press.current) clearTimeout(press.current);
    press.current = null;
  };
  const resume = () => {
    setBlocker(null);
    setPanel(false);
    setConfirmReport(false);
    void ctrl?.play().catch(() => setBlocker('tap'));
  };
  const errorText = error ? ((t.errors as Record<string, string>)[error] ?? w.playbackFailed) : null;

  return (
    <div className="fixed inset-0 z-[90] select-none overflow-hidden bg-black" style={{ touchAction: 'none' }} onContextMenu={(e) => e.preventDefault()} data-testid="watch">
      {media?.kind === 'youtube' && <div ref={ytRef} className="absolute inset-0" />}
      {media?.kind === 'demo' && <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label={w.media} />}
      {url && (
        <video
          ref={videoRef}
          src={url}
          className="absolute inset-0 h-full w-full object-contain"
          playsInline
          muted={muted}
          disablePictureInPicture
          controlsList="nodownload nofullscreen noremoteplayback"
          crossOrigin={media?.kind === 'hosted' ? 'anonymous' : undefined}
        />
      )}
      {/* Warstwa nad materiałem: dotyk nie trafia do odtwarzacza; długie przytrzymanie otwiera panel pauzy. */}
      <div className="absolute inset-0" aria-hidden onPointerDown={startPress} onPointerUp={endPress} onPointerCancel={endPress} onPointerLeave={endPress} />
      {!ctrl && !error && <div className="absolute inset-0 grid place-items-center text-[18px] font-semibold text-white/75">{w.loading}</div>}
      {(blocker || error) && !panel && (
        <button type="button" onClick={() => (error ? setPanel(true) : resume())} className="absolute inset-0 grid place-items-center bg-black/55 p-8 text-center text-white">
          <span>
            <span className="block text-[24px] font-semibold">{errorText ?? (blocker === 'rotate' ? w.rotate : blocker === 'resume' ? w.tapResume : w.tapStart)}</span>
            {blocker === 'rotate' && <span className="mt-2 block text-[16px] text-white/85">{w.rotateNote}</span>}
          </span>
        </button>
      )}
      {panel && (
        <div className="absolute inset-0 grid place-items-center bg-black/70 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="pause-title" className="w-full max-w-sm rounded-3xl bg-surface p-6 text-ink">
            {confirmReport ? (
              <>
                <h2 id="pause-title" className="text-[20px] font-semibold">
                  {w.reportTitle}
                </h2>
                <p className="mt-2 text-[15px] text-muted">{w.reportBody}</p>
                <div className="mt-5 flex flex-col gap-2">
                  <button type="button" onClick={() => finishRef.current(false, true)} className="min-h-12 rounded-2xl bg-poor text-[16px] font-semibold text-white">
                    {w.reportConfirm}
                  </button>
                  <button type="button" onClick={() => setConfirmReport(false)} className="min-h-12 rounded-2xl text-[16px] font-semibold ring-1 ring-inset ring-field">
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
                  {!error && (
                    <button type="button" onClick={resume} className="min-h-12 rounded-2xl bg-cobalt text-[16px] font-semibold text-white">
                      {w.resume}
                    </button>
                  )}
                  <button type="button" onClick={() => finishRef.current(false)} className="min-h-12 rounded-2xl text-[16px] font-semibold text-poor ring-1 ring-inset ring-poor/40">
                    {w.end}
                  </button>
                  <button type="button" onClick={() => setConfirmReport(true)} className="min-h-11 text-[14.5px] font-semibold text-muted underline underline-offset-4">
                    {w.report}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
