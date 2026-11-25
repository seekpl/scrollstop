import { useEffect, useRef, useState } from 'react';
import { SCHEMA_VERSION, type SessionMeta, type TrackingQuality } from '../../core/contracts/types';
import { errorCode } from '../../core/errors';
import { containRect } from '../../core/geometry/coords';
import { formatTime } from '../../core/math/util';
import { SampleBuilder } from '../../core/pipeline/sampleBuilder';
import type { DisplayGaze, RawGaze } from '../../core/pipeline/types';
import { WebcamGazeEstimator } from '../../core/pipeline/webcamEstimator';
import { SessionRecorder } from '../../core/session/recorder';
import { trackingHub } from '../../core/tracking/trackingHub';
import { DEMO_SPECS } from '../../demo/demoScene';
import { newLabSessionId } from '../../demo/simulator';
import { useT, type Messages } from '../../i18n';
import { MouseGazeSource, SimulatedGazeSource, WebcamGazeSource, type GazeSource } from '../../sources/sources';
import { Btn } from '../../ui/kit';
import { isFullscreen } from '../shared/browser';
import { Emitter } from '../shared/emitter';
import { GazeMarker } from '../shared/GazeMarker';
import { createDemoController, createVideoController, type MediaController } from '../shared/mediaController';
import { useLab, type LabMedia, type LabValue } from './LabContext';
import { QualityBadge } from './parts';

interface Status {
  quality: TrackingQuality;
  message: string | null;
  t: number;
  duration: number;
  paused: boolean;
}

function messageFor(raw: RawGaze | null, quality: TrackingQuality, t: Messages): string | null {
  const w = t.lab.watch.status;
  if (!raw) return null;
  if (raw.flags.includes('no_face')) return w.noFace;
  if (raw.flags.includes('head_pose')) return w.headPose;
  if (raw.flags.includes('distance')) return w.distance;
  if (raw.flags.includes('off_screen')) return w.offScreen;
  if (quality === 'POOR') return w.poor;
  return null;
}

function createSource(lab: LabValue, ctrl: MediaController, media: LabMedia): GazeSource {
  if (lab.source === 'webcam') {
    if (!lab.calibration) throw new Error('no_calibration');
    return new WebcamGazeSource(trackingHub, new WebcamGazeEstimator(lab.calibration.model, lab.calibration.summary));
  }
  if (lab.source === 'mouse') return new MouseGazeSource();
  return new SimulatedGazeSource(ctrl.clock, media.kind === 'demo' ? DEMO_SPECS[media.demo] : DEMO_SPECS.video);
}

function createMeta(lab: LabValue, media: LabMedia, ctrl: MediaController): SessionMeta {
  const size = ctrl.contentSize();
  const hub = trackingHub.getInfo();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: newLabSessionId(),
    createdAt: new Date().toISOString(),
    mode: lab.mode,
    source: lab.source,
    participant: lab.participant,
    video: {
      kind: media.kind,
      name: media.kind === 'file' ? media.name : media.demo,
      size: media.kind === 'file' ? media.size : undefined,
      duration: ctrl.duration(),
      width: size.w,
      height: size.h,
    },
    screen: { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio || 1, fullscreen: isFullscreen() },
    camera: lab.source === 'webcam' && hub.status === 'running' ? { label: hub.deviceLabel ?? '', width: hub.width ?? 0, height: hub.height ?? 0 } : undefined,
    engine: { name: lab.source === 'webcam' ? `mediapipe-face-landmarker+${lab.calibration?.summary.model ?? 'none'}` : lab.source, smoothingLevel: lab.smoothing },
    calibration: lab.source === 'webcam' ? lab.calibration?.summary : undefined,
    scenes: media.kind === 'demo' ? DEMO_SPECS[media.demo].cuts.map((start, i, a) => ({ id: `scene_${String(i + 1).padStart(2, '0')}`, start, end: a[i + 1] ?? DEMO_SPECS[media.demo].duration, source: 'manual' as const })) : undefined,
    sampleCount: 0,
    disclaimerShown: true,
  };
}

/** Oglądanie w laboratorium: pełny ekran, opcjonalny marker wzroku, zapis próbek do bazy `attn-lab`. */
export function LabWatch() {
  const lab = useLab();
  const t = useT();
  const w = t.lab.watch;
  const labRef = useRef(lab);
  labRef.current = lab;
  const media = lab.media;
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ctrl, setCtrl] = useState<MediaController | null>(null);
  const [needsTap, setNeedsTap] = useState(false);
  const [markerOn, setMarkerOn] = useState(lab.mode === 'demo_overlay');
  const [controls, setControls] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ quality: 'POOR', message: null, t: 0, duration: 0, paused: true });
  const bus = useRef(new Emitter<DisplayGaze | null>()).current;
  const finishRef = useRef<() => Promise<void>>(async () => undefined);
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    if (!media) return;
    const c = media.kind === 'demo' ? createDemoController(canvasRef.current as HTMLCanvasElement, DEMO_SPECS[media.demo]) : createVideoController(videoRef.current as HTMLVideoElement);
    setCtrl(c);
    return () => c.dispose();
  }, [media]);

  useEffect(() => {
    if (!ctrl || !media) return;
    const a = labRef.current;
    let source: GazeSource;
    try {
      source = createSource(a, ctrl, media);
    } catch (e) {
      setError(errorCode(e));
      return;
    }
    const recorder = new SessionRecorder(createMeta(a, media, ctrl), a.store);
    const builder = new SampleBuilder(a.smoothing, ctrl.clock, () => {
      const s = ctrl.contentSize();
      return containRect(window.innerWidth, window.innerHeight, s.w, s.h);
    });
    let lastRaw: RawGaze | null = null;
    let lastQuality: TrackingQuality = 'POOR';
    let finished = false;
    void recorder.begin();
    source.start((raw) => {
      lastRaw = raw;
      const r = builder.build(raw);
      lastQuality = r.quality;
      recorder.add(r.sample);
      bus.emit(r.display);
    });
    ctrl.play().catch(() => setNeedsTap(true));
    const finish = async () => {
      if (finished) return;
      finished = true;
      source.stop();
      ctrl.pause();
      const s = ctrl.contentSize();
      const meta = await recorder.finish({ video: { ...recorder.meta.video, duration: ctrl.duration(), width: s.w, height: s.h } });
      labRef.current.openSession(meta.id);
    };
    finishRef.current = finish;
    ctrl.onEnded(() => void finish());
    const ui = setInterval(() => {
      if (ctrl.clock.state() === 'playing') setNeedsTap(false);
      setStatus({ quality: lastQuality, message: messageFor(lastRaw, lastQuality, tRef.current), t: ctrl.currentTime(), duration: ctrl.duration(), paused: ctrl.isPaused() });
    }, 250);
    return () => {
      clearInterval(ui);
      if (!finished) {
        finished = true;
        source.stop();
        void recorder.finish();
      }
    };
  }, [ctrl, media, bus]);

  // Panel sterowania chowa się po 3 s bez ruchu — widz widzi czysty materiał.
  useEffect(() => {
    let timer = setTimeout(() => setControls(false), 3000);
    const show = () => {
      setControls(true);
      clearTimeout(timer);
      timer = setTimeout(() => setControls(false), 3000);
    };
    window.addEventListener('pointermove', show);
    window.addEventListener('keydown', show);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', show);
      window.removeEventListener('keydown', show);
    };
  }, []);

  if (!media) {
    return (
      <div className="fixed inset-0 grid place-items-center bg-paper p-8">
        <div className="max-w-md text-center">
          <h1 className="text-[24px] font-semibold">{w.noMedia}</h1>
          <Btn className="mt-6" variant="primary" onClick={() => lab.leaveFullscreenView('setup')}>
            {w.toSetup}
          </Btn>
        </div>
      </div>
    );
  }

  const startPlayback = () => {
    if (ctrl) void ctrl.play().then(() => setNeedsTap(false), () => undefined);
  };
  const togglePlay = () => {
    if (!ctrl) return;
    if (ctrl.isPaused()) startPlayback();
    else ctrl.pause();
  };

  return (
    <div className={`fixed inset-0 z-50 bg-black ${controls ? '' : 'cursor-none'}`}>
      {media.kind === 'file' && <video ref={videoRef} src={media.url} className="absolute inset-0 h-full w-full object-contain" playsInline />}
      {media.kind === 'demo' && <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label={t.lab.demoNames[media.demo as keyof typeof t.lab.demoNames]} />}
      <GazeMarker bus={bus} visible={markerOn} size={lab.marker.size} color={lab.marker.color} />
      {error && (
        <div className="absolute inset-0 grid place-items-center bg-black/70 p-8 text-center text-white">
          <div>
            <p className="text-[19px] font-semibold">{(t.errors as Record<string, string>)[error] ?? t.errors.unknown}</p>
            <Btn className="mt-6" variant="primary" onClick={() => lab.leaveFullscreenView('setup')}>
              {w.toSetup}
            </Btn>
          </div>
        </div>
      )}
      {needsTap && !error && (
        <button type="button" onClick={startPlayback} className="absolute inset-0 grid place-items-center bg-black/40 text-[22px] font-semibold text-white">
          {w.tapToPlay}
        </button>
      )}
      {status.message && controls && <div className="absolute left-4 top-4 rounded-full bg-white/90 px-4 py-2 text-[14px] font-semibold text-ink">{status.message}</div>}
      <div className={`absolute inset-x-4 bottom-4 flex flex-wrap items-center gap-3 rounded-2xl bg-white/95 p-3 shadow-xl ring-1 ring-line transition-opacity duration-300 ${controls ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
        <Btn variant="primary" onClick={togglePlay}>
          {status.paused ? w.play : w.pause}
        </Btn>
        <span className="tabular text-[14px] font-semibold">
          {formatTime(status.t, 0)} / {formatTime(status.duration, 0)}
        </span>
        <QualityBadge quality={status.quality} prefix={w.qualityPrefix} />
        <label className="ml-auto flex items-center gap-2 text-[14px] font-semibold">
          <input type="checkbox" className="h-4 w-4 accent-cobalt" checked={markerOn} onChange={(e) => setMarkerOn(e.target.checked)} />
          {w.showMarker}
        </label>
        <Btn variant="danger" onClick={() => void finishRef.current()}>
          {w.finish}
        </Btn>
      </div>
    </div>
  );
}
