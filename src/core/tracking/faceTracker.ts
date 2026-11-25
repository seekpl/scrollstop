import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { ClockSource } from '../contracts/types';
import { buildObservation, type FaceObservation } from './features';

export interface TrackerFrame {
  /** Czas przechwycenia klatki (ms, domena performance.now()). */
  captureTime: number;
  clockSource: ClockSource;
  face: FaceObservation | null;
  inferenceMs: number;
  width: number;
  height: number;
}

const REMOTE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

/** Preferuje model hostowany lokalnie (public/models), a zdalny tylko jako fallback. */
async function resolveModelPath(base: string): Promise<{ path: string; local: boolean }> {
  const local = `${base}models/face_landmarker.task`;
  try {
    const res = await fetch(local, { method: 'HEAD' });
    const type = res.headers.get('content-type') ?? '';
    if (res.ok && !type.includes('text/html')) return { path: local, local: true };
  } catch {
    /* brak lokalnego modelu */
  }
  return { path: REMOTE_MODEL, local: false };
}

/**
 * Opakowanie MediaPipe Face Landmarker. Wszystko działa w przeglądarce —
 * obraz z kamery nie opuszcza urządzenia i nie jest zapisywany.
 */
export class FaceTracker {
  private running = false;
  private lastTs = -1;
  private rvfcHandle = 0;
  private rafHandle = 0;
  private gotRvfc = false;
  private video: HTMLVideoElement | null = null;

  private constructor(
    private readonly landmarker: FaceLandmarker,
    readonly modelLocal: boolean,
    readonly delegate: 'GPU' | 'CPU',
  ) {}

  static async create(): Promise<FaceTracker> {
    // Pełny adres także przy względnej ścieżce bazowej (paczka na hosting FTP działa w dowolnym katalogu).
    const base = new URL(import.meta.env.BASE_URL, window.location.href).href;
    const fileset = await FilesetResolver.forVisionTasks(`${base}mediapipe/wasm`);
    const model = await resolveModelPath(base);
    const make = (delegate: 'GPU' | 'CPU') =>
      FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: model.path, delegate },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    try {
      return new FaceTracker(await make('GPU'), model.local, 'GPU');
    } catch (e) {
      console.warn('[attn] GPU niedostępne, przełączam na CPU', e);
      return new FaceTracker(await make('CPU'), model.local, 'CPU');
    }
  }

  start(video: HTMLVideoElement, onFrame: (f: TrackerFrame) => void): void {
    this.stop();
    this.running = true;
    this.video = video;
    this.gotRvfc = false;

    const process = (t: number, source: ClockSource) => {
      // MediaPipe wymaga ściśle rosnących znaczników czasu.
      const ts = Math.max(t, this.lastTs + 0.01);
      this.lastTs = ts;
      const t0 = performance.now();
      let face: FaceObservation | null = null;
      try {
        const res = this.landmarker.detectForVideo(video, ts);
        const lm = res.faceLandmarks?.[0];
        if (lm) {
          face = buildObservation(
            lm,
            video.videoWidth,
            video.videoHeight,
            res.faceBlendshapes?.[0]?.categories,
            res.facialTransformationMatrixes?.[0]?.data,
          );
        }
      } catch (e) {
        console.warn('[attn] detectForVideo', e);
      }
      onFrame({
        captureTime: t,
        clockSource: source,
        face,
        inferenceMs: performance.now() - t0,
        width: video.videoWidth,
        height: video.videoHeight,
      });
    };

    if (typeof video.requestVideoFrameCallback === 'function') {
      const step: VideoFrameRequestCallback = (now, meta) => {
        if (!this.running) return;
        this.gotRvfc = true;
        // captureTime = moment naświetlenia klatki → próbki nie są przesunięte o czas inferencji.
        if (typeof meta.captureTime === 'number' && meta.captureTime > 0) process(meta.captureTime, 'captureTime');
        else process(meta.presentationTime ?? now, 'presentationTime');
        this.rvfcHandle = video.requestVideoFrameCallback(step);
      };
      this.rvfcHandle = video.requestVideoFrameCallback(step);
      // Watchdog: niektóre przeglądarki nie wywołują rVFC dla ukrytego wideo.
      window.setTimeout(() => {
        if (this.running && !this.gotRvfc) this.startRafLoop(video, process);
      }, 1500);
    } else {
      this.startRafLoop(video, process);
    }
  }

  private startRafLoop(video: HTMLVideoElement, process: (t: number, s: ClockSource) => void): void {
    let lastVideoTime = -1;
    const loop = () => {
      if (!this.running) return;
      if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        process(performance.now(), 'performanceNow');
      }
      this.rafHandle = requestAnimationFrame(loop);
    };
    loop();
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafHandle);
    if (this.video && typeof this.video.cancelVideoFrameCallback === 'function') {
      this.video.cancelVideoFrameCallback(this.rvfcHandle);
    }
  }

  close(): void {
    this.stop();
    this.landmarker.close();
  }
}
