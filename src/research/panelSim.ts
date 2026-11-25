/**
 * Symulator widzów (§23): profil uwagi = szansa na sekundę, że widz odwróci wzrok (hazard)
 * i że wróci (recovery). Próbkowanie 30 Hz, deterministyczne ziarno (mulberry32). Wzrok podąża
 * za celem klipu demo; stałe przesunięcie widza, szum pomiaru, mrugnięcie co ~4,3 s.
 */
import { clamp, gaussian, mulberry32 } from '../core/math/util';
import { DEMO_SPECS, type DemoId, type DemoSpec } from '../demo/demoScene';
import { GazeCode } from './compact';
import { CONSENT_VERSION, type AgeBand, type Aoi, type CalibrationInfo, type CompactSamples, type DeviceInfo, type Project, type Variant, type VariantId, type ViewerSession } from './model';
import { assessSession, expiryDate } from './sessions';
import type { ResearchText } from './text';

export interface AttentionProfile {
  hazard(t: number): number;
  recovery(t: number): number;
}

export const seededId = (rng: () => number, len: number) => {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  let s = '';
  for (let i = 0; i < len; i++) s += abc[Math.floor(rng() * abc.length)];
  return s;
};

/** Próbki jednego widza w formacie kolumnowym (pełny ekran, pozycja 0). */
export function simulateViewerData(opts: { seed: number; spec: DemoSpec; profile: AttentionProfile; hz?: number; distractibility?: number; duration?: number }): CompactSamples {
  const hz = opts.hz ?? 30;
  const rng = mulberry32(opts.seed);
  const k = opts.distractibility ?? 1;
  // Stałe przesunięcie widza ~N(0; 0,04/0,05).
  const bias = { x: 0.04 * gaussian(rng), y: 0.05 * gaussian(rng) };
  const out: CompactSamples = { tc: [], vt: [], seg: [], it: [], vx: [], vy: [], cf: [], un: [], st: [] };
  let away = false;
  let pos = { x: 0.5, y: 0.5 };
  const duration = opts.duration ?? opts.spec.duration;
  const n = Math.round(duration * hz);
  for (let i = 0; i < n; i++) {
    const t = i / hz;
    const ph = 1 - (1 - clamp(opts.profile.hazard(t) * k, 0, 0.95)) ** (1 / hz);
    const pr = 1 - (1 - clamp(opts.profile.recovery(t), 0, 0.95)) ** (1 / hz);
    if (!away && rng() < ph) away = true;
    else if (away && rng() < pr) away = false;
    const target = opts.spec.target(t);
    // Wzrok podąża za celem sceny (współczynnik 0,25 na klatkę).
    pos = { x: pos.x + (target.x - pos.x) * 0.25, y: pos.y + (target.y - pos.y) * 0.25 };
    const blink = (t + opts.seed * 0.37) % 4.3 < 0.15;
    const unc = 0.05 + Math.abs(0.02 * gaussian(rng));
    out.tc.push(Math.round((i * 1000) / hz));
    out.vt.push(Math.round(t * 1000) / 1000);
    out.seg.push(1);
    out.it.push(0);
    if (away) {
      out.st.push(GazeCode.AWAY);
      out.vx.push(-1);
      out.vy.push(-1);
      out.cf.push(0);
      out.un.push(-1);
    } else if (blink) {
      out.st.push(GazeCode.UNKNOWN);
      out.vx.push(-1);
      out.vy.push(-1);
      out.cf.push(10);
      out.un.push(-1);
    } else {
      // Szum ~N(0; 0,03/0,035), pewność ~0,8 ± 0,08.
      const x = clamp(pos.x + bias.x + 0.03 * gaussian(rng), 0, 1);
      const y = clamp(pos.y + bias.y + 0.035 * gaussian(rng), 0, 1);
      out.st.push(GazeCode.LOOK);
      out.vx.push(Math.round(x * 1000));
      out.vy.push(Math.round(y * 1000));
      out.cf.push(Math.round(clamp(0.8 + 0.08 * gaussian(rng), 0.3, 0.98) * 100));
      out.un.push(Math.round(unc * 1000));
    }
  }
  return out;
}

/**
 * Profile social (§23): słaby hook (A) — wyraźny spadek w 1–2 s, mocny (B) — mniejszy;
 * spadek w środkowej scenie; powrót po zmianie kadru.
 */
export const PROFILES = {
  reelWeakHook: {
    hazard: (t: number) => (t >= 0.5 && t < 2.5 ? 0.3 : t >= 7 && t < 9 ? 0.2 : t >= 13.5 ? 0.06 : 0.02),
    recovery: (t: number) => (t >= 9 && t < 10.5 ? 0.6 : t >= 2.5 && t < 4 ? 0.25 : t >= 7 && t < 9 ? 0.03 : 0.08),
  },
  reelStrongHook: {
    hazard: (t: number) => (t >= 0.5 && t < 2.5 ? 0.03 : t >= 7 && t < 9 ? 0.18 : t >= 13.5 ? 0.05 : 0.02),
    recovery: (t: number) => (t >= 9 && t < 10.5 ? 0.6 : t >= 7 && t < 9 ? 0.04 : 0.12),
  },
  video: {
    hazard: (t: number) => (t < 2 ? 0.01 : t >= 27 && t < 36 ? 0.08 : t >= 55 ? 0.06 : 0.012),
    recovery: (t: number) => (t >= 36 && t < 39 ? 0.45 : t >= 27 && t < 36 ? 0.03 : 0.3),
  },
} satisfies Record<string, AttentionProfile>;

export const PHONE: DeviceInfo = { type: 'mobile', orientation: 'portrait', screenW: 390, screenH: 844, dpr: 3, touch: true };
export const DESKTOPS: DeviceInfo[] = [
  { type: 'desktop', orientation: 'landscape', screenW: 1440, screenH: 900, dpr: 2, touch: false },
  { type: 'desktop', orientation: 'landscape', screenW: 1920, screenH: 1080, dpr: 1, touch: false },
];
export const AGES: AgeBand[] = ['18-24', '25-34'];

export interface SimulationOptions {
  projectId: string;
  variantId: VariantId;
  spec: DemoSpec;
  profile: AttentionProfile;
  /** Ważne sesje (dobra lub średnia kalibracja). */
  valid: number;
  /** Sesje odrzucone automatycznie (słaba kalibracja). */
  rejected?: number;
  /** Udział telefonów (reszta: komputery). */
  phoneShare: number;
  seed: number;
  audio: 'on' | 'off';
  createdAt?: string;
  retentionDays?: number;
}

export function simulateSessions(opts: SimulationOptions): ViewerSession[] {
  const rng = mulberry32(opts.seed);
  const createdAt = opts.createdAt ?? new Date().toISOString();
  const total = opts.valid + (opts.rejected ?? 0);
  const phones = Math.round(opts.valid * opts.phoneShare);
  return Array.from({ length: total }, (_, i) => {
    const seed = opts.seed * 1000 + i;
    const poor = i >= opts.valid;
    const roll = rng();
    const quality: CalibrationInfo['quality'] = poor ? 'POOR' : roll < 0.62 ? 'GOOD' : 'FAIR';
    const calibration: CalibrationInfo = {
      quality,
      xPct: Math.round((quality === 'GOOD' ? 4 + rng() * 2 : quality === 'FAIR' ? 7 + rng() * 5 : 15 + rng() * 6) * 10) / 10,
      yPct: Math.round((quality === 'GOOD' ? 5 + rng() * 3 : quality === 'FAIR' ? 9 + rng() * 5 : 17 + rng() * 6) * 10) / 10,
      points: 9,
    };
    const data = simulateViewerData({ seed, spec: opts.spec, profile: opts.profile, distractibility: 0.6 + rng() * 0.9 });
    const device = i < phones ? PHONE : DESKTOPS[i % DESKTOPS.length];
    const verdict = assessSession({ source: 'simulated', calibration, data, mediaDuration: opts.spec.duration }, { treatSimulatedAsWebcam: true });
    return {
      schemaVersion: '1.0',
      id: `ses_${seededId(rng, 16)}`,
      projectId: opts.projectId,
      variantId: opts.variantId,
      participantId: `p_${seededId(rng, 12)}`,
      ageBand: AGES[Math.floor(rng() * AGES.length)],
      country: null,
      screener: {},
      device,
      consent: { version: CONSENT_VERSION, acceptedAt: createdAt, adult: true, processing: true, localOnly: true },
      source: 'simulated',
      calibration,
      audio: { mode: opts.audio, confirmed: opts.audio === 'on' },
      watchedSeconds: opts.spec.duration,
      mediaDuration: opts.spec.duration,
      completed: true,
      answers: {},
      createdAt,
      expiresAt: expiryDate(createdAt, opts.retentionDays ?? 90),
      status: verdict.status,
      rejectCode: verdict.rejectCode,
      manual: false,
      data,
    };
  });
}

/** Strefy klipu demo z nazwami w języku raportu. */
export function demoAois(id: DemoId, tx: ResearchText): Aoi[] {
  return DEMO_SPECS[id].aois.map((a, i) => ({ id: `aoi_${a.key}_${i}`, name: tx.demo.aoi[a.key], type: a.type, x: a.x, y: a.y, w: a.w, h: a.h, t0: a.t0, t1: a.t1, ...(a.words ? { words: a.words } : {}) }));
}

export function demoVariant(id: DemoId, variantId: VariantId, tx: ResearchText, label?: string): Variant {
  const spec = DEMO_SPECS[id];
  return {
    id: variantId,
    label: label ?? tx.version(variantId),
    media: { kind: 'demo', demo: id },
    mediaName: id === 'reel' ? tx.demo.reelA : id === 'reel_b' ? tx.demo.reelB : tx.demo.video,
    duration: spec.duration,
    width: spec.w,
    height: spec.h,
    scenes: spec.cuts.map((start, i) => ({ id: `scene_${String(i + 1).padStart(2, '0')}`, start, end: spec.cuts[i + 1] ?? spec.duration, source: 'manual' as const })),
    aois: demoAois(id, tx),
    ...(spec.sharedFrom ? { sharedFrom: spec.sharedFrom } : {}),
  };
}

export type DemoProjectId = 'reel' | 'video';

/**
 * Projekt demonstracyjny z symulowanym panelem 31 ważnych widzów na wersję (+ odrzucone sesje):
 * `reel` — test hooka A/B na TikToku, `video` — film 16:9 na YouTube.
 */
export function demoProject(id: DemoProjectId, tx: ResearchText, opts: { createdAt?: string; valid?: number } = {}): { project: Project; sessions: ViewerSession[] } {
  const createdAt = opts.createdAt ?? new Date().toISOString();
  const projectId = `demo_${id}`;
  const valid = opts.valid ?? 31;
  const reel = id === 'reel';
  const variants = reel ? [demoVariant('reel', 'A', tx, tx.demo.versionA), demoVariant('reel_b', 'B', tx, tx.demo.versionB)] : [demoVariant('video', 'A', tx)];
  const project: Project = {
    id: projectId,
    workspaceId: 'demo',
    name: reel ? tx.demo.reelProject : tx.demo.videoProject,
    creatorName: tx.demo.creator,
    kind: reel ? 'hook' : 'video',
    platform: reel ? 'tiktok' : 'youtube',
    audio: reel ? 'off' : 'on',
    context: 'fullscreen',
    platformUi: 'none',
    targetDevice: reel ? 'mobile' : 'desktop',
    variants,
    fillers: [],
    questions: ['finish'],
    audience: { source: 'panel', ageBands: ['18-24', '25-34'], countries: [], screenPlatforms: false },
    targetSessions: reel ? 50 : 30,
    status: 'collecting',
    linkToken: `demo-${id}`,
    retentionDays: 90,
    locale: 'pl',
    createdAt,
    updatedAt: createdAt,
  };
  const sessions = reel
    ? [
        ...simulateSessions({ projectId, variantId: 'A', spec: DEMO_SPECS.reel, profile: PROFILES.reelWeakHook, valid, rejected: 3, phoneShare: 24 / 31, seed: 21, audio: 'off', createdAt }),
        ...simulateSessions({ projectId, variantId: 'B', spec: DEMO_SPECS.reel_b, profile: PROFILES.reelStrongHook, valid, rejected: 2, phoneShare: 24 / 31, seed: 37, audio: 'off', createdAt }),
      ]
    : simulateSessions({ projectId, variantId: 'A', spec: DEMO_SPECS.video, profile: PROFILES.video, valid, rejected: 3, phoneShare: 7 / 31, seed: 53, audio: 'on', createdAt });
  return { project, sessions };
}
