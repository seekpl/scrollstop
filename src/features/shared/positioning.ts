import { useEffect, useState } from 'react';
import { MEASUREMENT } from '../../core/config';
import { estimateDistanceCm } from '../../core/tracking/features';
import type { TrackerFrame } from '../../core/tracking/faceTracker';
import { trackingHub } from '../../core/tracking/trackingHub';

/** Wynik sprawdzenia ustawienia przed kamerą (§10.5). Ostrzeżenia nie blokują „Dalej”. */
export interface Positioning {
  face: boolean;
  eyes: boolean;
  /** Środek oczu x 0,25–0,75 i y 0,15–0,75 (ostrzeżenie). */
  centered: boolean;
  distanceCm: number;
  distance: 'ok' | 'near' | 'far' | 'unknown';
  /** Średnia luminancja klatki 32×18 (0..255) albo null. */
  brightness: number | null;
  dark: boolean;
  /** Twarz i oczy widoczne nieprzerwanie od ms. */
  steadyMs: number;
}

export const BRIGHTNESS_MIN = 70;
export const STEADY_MS = 800;

/** Czysta funkcja oceny ustawienia (testowalna bez kamery). */
export function assessPositioning(face: TrackerFrame['face'], brightness: number | null, device: 'mobile' | 'desktop', steadyMs: number): Positioning {
  const d = face ? estimateDistanceCm(face.scale) : NaN;
  const range = MEASUREMENT.distanceCm[device];
  return {
    face: !!face,
    eyes: !!face?.eyesOpen,
    centered: !!face && face.center.x >= 0.25 && face.center.x <= 0.75 && face.center.y >= 0.15 && face.center.y <= 0.75,
    distanceCm: d,
    distance: !Number.isFinite(d) ? 'unknown' : d < range.min ? 'near' : d > range.max ? 'far' : 'ok',
    brightness,
    dark: brightness !== null && brightness <= BRIGHTNESS_MIN,
    steadyMs,
  };
}

/** Lista kontrolna odświeżana co 330 ms (§10.5). */
export function usePositioning(device: 'mobile' | 'desktop'): Positioning | null {
  const [p, setP] = useState<Positioning | null>(null);
  useEffect(() => {
    let last = 0;
    let steadySince: number | null = null;
    let brightness: number | null = null;
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 18;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    return trackingHub.subscribe((f) => {
      const ok = !!f.face?.eyesOpen;
      if (ok) steadySince ??= f.captureTime;
      else steadySince = null;
      if (f.captureTime - last < 330) return;
      last = f.captureTime;
      if (ctx) {
        try {
          ctx.drawImage(trackingHub.video, 0, 0, 32, 18);
          const d = ctx.getImageData(0, 0, 32, 18).data;
          let s = 0;
          for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
          brightness = s / (d.length / 4);
        } catch {
          brightness = null;
        }
      }
      setP(assessPositioning(f.face, brightness, device, steadySince === null ? 0 : f.captureTime - steadySince));
    });
  }, [device]);
  return p;
}
