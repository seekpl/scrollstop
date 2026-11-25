import { SCHEMA_VERSION, type Session, type SessionMeta } from '../core/contracts/types';
import { FULL_RECT } from '../core/geometry/coords';
import { clamp, clamp01, gaussian, mulberry32 } from '../core/math/util';
import { SampleBuilder } from '../core/pipeline/sampleBuilder';
import type { RawGaze } from '../core/pipeline/types';
import { ManualClock } from '../core/time/playbackClock';
import type { DemoSpec } from './demoScene';

export interface SimOptions {
  seed: number;
  noise: number;
}

/**
 * Symulowany wzrok jednego widza dla laboratorium: dochodzenie do celu klipu demo, szum pomiaru,
 * powolny dryf, mrugnięcia co ~4,3 s i krótkie odwrócenia głowy — żeby demo przypominało dane z kamery.
 * (Symulacja paneli widzów z profilami uwagi: `research/panelSim.ts`.)
 */
export class GazeSimulator {
  private readonly rng: () => number;
  private pos: { x: number; y: number } | null = null;
  private lastT: number | null = null;

  constructor(
    private readonly spec: Pick<DemoSpec, 'target'>,
    private readonly opts: SimOptions = { seed: 7, noise: 0.012 },
  ) {
    this.rng = mulberry32(opts.seed);
  }

  sample(t: number, tCapture: number): RawGaze {
    const target = this.spec.target(t);
    const dt = this.lastT === null ? 0 : t - this.lastT;
    this.lastT = t;
    if (!this.pos || dt < 0 || dt > 0.5) this.pos = { x: target.x, y: target.y };
    else {
      const k = 1 - Math.exp(-dt / 0.05);
      this.pos.x += (target.x - this.pos.x) * k;
      this.pos.y += (target.y - this.pos.y) * k;
    }
    const base = { tCapture, x: null, y: null, confidence: 0, uncertainty: null } as const;
    // Krótkie odwrócenie głowy raz na ~11 s.
    if (t % 11 > 9.6 && t % 11 < 10.3) return { ...base, faceDetected: false, eyesOpen: false, flags: ['no_face'] };
    if (t % 4.3 < 0.15) return { ...base, faceDetected: true, eyesOpen: false, flags: ['blink'] };
    const n = this.opts.noise;
    const x = clamp01(this.pos.x + 0.012 * Math.sin(t * 0.4) + n * gaussian(this.rng));
    const y = clamp01(this.pos.y + 0.01 * Math.cos(t * 0.33) + n * gaussian(this.rng));
    return {
      tCapture,
      faceDetected: true,
      eyesOpen: true,
      x,
      y,
      confidence: clamp(0.82 + 0.06 * gaussian(this.rng), 0.3, 0.98),
      uncertainty: 0.045 + 0.01 * Math.abs(gaussian(this.rng)),
      flags: [],
    };
  }
}

/** Cel wzroku dla materiału, który nie jest klipem demo (próba twórcy bez kamery): powolne błądzenie po środku kadru. */
export const wanderingTarget = { target: (t: number) => ({ x: 0.5 + 0.18 * Math.sin(t * 0.7), y: 0.45 + 0.15 * Math.sin(t * 0.43 + 1), key: 'background' as const }) };

export function newLabSessionId(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `lab_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}_${Math.random().toString(36).slice(2, 6)}`;
}

/** Natychmiastowo generuje kompletną sesję laboratorium dla klipu demo (30 Hz) — do testów analiz i eksportu. */
export function generateDemoSession(spec: DemoSpec, opts: { hz?: number; participant?: string; name?: string } = {}): Session {
  const hz = opts.hz ?? 30;
  const clock = new ManualClock(spec.duration);
  clock.play(0);
  const builder = new SampleBuilder(2, clock, () => FULL_RECT);
  const sim = new GazeSimulator(spec);
  const samples = [];
  for (let i = 0; i < spec.duration * hz; i++) {
    const tCap = (i * 1000) / hz;
    samples.push(builder.build(sim.sample(tCap / 1000, tCap)).sample);
  }
  const now = new Date().toISOString();
  const meta: SessionMeta = {
    schemaVersion: SCHEMA_VERSION,
    id: newLabSessionId(),
    createdAt: now,
    endedAt: now,
    mode: 'measurement',
    source: 'simulated',
    participant: opts.participant ?? 'P1',
    video: { kind: 'demo', name: opts.name ?? spec.id, duration: spec.duration, width: spec.w, height: spec.h },
    screen: { width: spec.w, height: spec.h, dpr: 1, fullscreen: true },
    engine: { name: 'simulator', smoothingLevel: 2 },
    scenes: spec.cuts.map((start, i) => ({
      id: `scene_${String(i + 1).padStart(2, '0')}`,
      start,
      end: spec.cuts[i + 1] ?? spec.duration,
      source: 'manual' as const,
    })),
    sampleCount: samples.length,
    disclaimerShown: true,
  };
  return { meta, samples };
}
