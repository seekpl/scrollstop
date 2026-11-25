import type { SampleFlag, TrackingQuality } from '../contracts/types';

/** Estymacja przed wygładzeniem i synchronizacją z filmem — wspólna dla kamery, symulacji i myszy. */
export interface RawGaze {
  tCapture: number;
  faceDetected: boolean;
  eyesOpen: boolean;
  x: number | null;
  y: number | null;
  confidence: number;
  uncertainty: number | null;
  flags: SampleFlag[];
}

/** To, co rysuje marker na ekranie. */
export interface DisplayGaze {
  x: number;
  y: number;
  confidence: number;
  uncertainty: number;
  quality: TrackingQuality;
  /** Niska pewność → marker przerywany i półprzezroczysty. */
  dashed: boolean;
}
