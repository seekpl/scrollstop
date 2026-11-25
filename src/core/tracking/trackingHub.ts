import type { ClockSource } from '../contracts/types';
import { errorCode } from '../errors';
import { openCamera } from './camera';
import type { FaceTracker, TrackerFrame } from './faceTracker';

export type HubStatus = 'idle' | 'starting' | 'running' | 'error';

export interface HubInfo {
  status: HubStatus;
  /** Kod błędu (tłumaczony w słowniku `errors`, np. camera_denied). */
  error?: string;
  deviceId?: string;
  deviceLabel?: string;
  width?: number;
  height?: number;
  fps: number;
  inferenceMs: number;
  clockSource?: ClockSource;
  delegate?: 'GPU' | 'CPU';
  modelLocal?: boolean;
}

type FrameListener = (f: TrackerFrame) => void;
type InfoListener = (i: HubInfo) => void;

/**
 * Jedno źródło klatek z kamery dla całej aplikacji (podgląd, kalibracja, sesja).
 * Strumień pozostaje otwarty między widokami, żeby nie prosić ponownie o zgodę
 * i nie tracić stabilnego ustawienia ekspozycji.
 */
class TrackingHub {
  private tracker: FaceTracker | null = null;
  private stream: MediaStream | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private dock: HTMLDivElement | null = null;
  private readonly listeners = new Set<FrameListener>();
  private readonly infoListeners = new Set<InfoListener>();
  private info: HubInfo = { status: 'idle', fps: 0, inferenceMs: 0 };
  private frameTimes: number[] = [];
  private lastInfoEmit = 0;
  lastFrame: TrackerFrame | null = null;

  get video(): HTMLVideoElement {
    if (!this.videoEl) {
      const v = document.createElement('video');
      v.muted = true;
      v.playsInline = true;
      v.autoplay = true;
      this.videoEl = v;
      this.dockVideo();
    }
    return this.videoEl;
  }

  /** Wideo musi być w DOM, aby przeglądarka dostarczała klatki do requestVideoFrameCallback. */
  private dockVideo(): void {
    if (!this.dock) {
      const d = document.createElement('div');
      d.setAttribute('aria-hidden', 'true');
      Object.assign(d.style, {
        position: 'fixed', left: '0', bottom: '0', width: '2px', height: '2px',
        opacity: '0.01', pointerEvents: 'none', overflow: 'hidden', zIndex: '-1',
      });
      document.body.appendChild(d);
      this.dock = d;
    }
    const v = this.video;
    v.removeAttribute('style');
    v.style.width = '2px';
    v.style.height = '2px';
    this.dock.appendChild(v);
  }

  /** Wstawia wideo kamery do kontenera podglądu; zwraca funkcję oddającą je do „doku”. */
  adopt(container: HTMLElement, className = ''): () => void {
    const v = this.video;
    v.removeAttribute('style');
    v.className = className;
    container.appendChild(v);
    return () => {
      v.className = '';
      this.dockVideo();
    };
  }

  async start(deviceId?: string | null): Promise<void> {
    if (this.info.status === 'running' && (!deviceId || deviceId === this.info.deviceId)) return;
    this.stop();
    this.setInfo({ status: 'starting', error: undefined });
    try {
      this.stream = await openCamera(deviceId);
      const v = this.video;
      v.srcObject = this.stream;
      await v.play();
      if (!this.tracker) {
        const mod = await import('./faceTracker');
        this.tracker = await mod.FaceTracker.create();
      }
      this.tracker.start(v, (f) => this.onFrame(f));
      const track = this.stream.getVideoTracks()[0];
      const s = track?.getSettings() ?? {};
      this.setInfo({
        status: 'running',
        deviceId: s.deviceId,
        deviceLabel: track?.label,
        width: s.width,
        height: s.height,
        delegate: this.tracker.delegate,
        modelLocal: this.tracker.modelLocal,
      });
    } catch (e) {
      this.stop();
      this.setInfo({ status: 'error', error: errorCode(e) === 'unknown' ? 'camera_unknown' : errorCode(e) });
    }
  }

  stop(): void {
    this.tracker?.stop();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.videoEl) this.videoEl.srcObject = null;
    this.lastFrame = null;
    this.frameTimes = [];
    if (this.info.status !== 'idle') this.setInfo({ status: 'idle', fps: 0 });
  }

  subscribe(listener: FrameListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onInfo(listener: InfoListener): () => void {
    this.infoListeners.add(listener);
    listener(this.info);
    return () => this.infoListeners.delete(listener);
  }

  getInfo(): HubInfo {
    return this.info;
  }

  private setInfo(patch: Partial<HubInfo>): void {
    this.info = { ...this.info, ...patch };
    this.infoListeners.forEach((l) => l(this.info));
  }

  private onFrame(f: TrackerFrame): void {
    this.lastFrame = f;
    this.frameTimes.push(f.captureTime);
    while (this.frameTimes.length && this.frameTimes[0] < f.captureTime - 1000) this.frameTimes.shift();
    this.info.inferenceMs = this.info.inferenceMs * 0.9 + f.inferenceMs * 0.1;
    this.info.fps = this.frameTimes.length;
    this.info.clockSource = f.clockSource;
    if (f.captureTime - this.lastInfoEmit > 500) {
      this.lastInfoEmit = f.captureTime;
      this.setInfo({});
    }
    this.listeners.forEach((l) => l(f));
  }
}

export const trackingHub = new TrackingHub();
