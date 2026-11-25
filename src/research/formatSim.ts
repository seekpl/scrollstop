/**
 * Symulowane panele dla feedu, siatki miniatur i karuzeli (§23). Te same zasady co `panelSim`
 * (deterministyczne ziarno, 30 Hz, szum pomiaru), plus zachowanie: przewinięcia, pętle, wybór
 * miniatury, kolejne slajdy. Służą raportom przykładowym i testom metryk.
 */
import { clamp, gaussian, mulberry32 } from '../core/math/util';
import { DEMO_SPECS, FILLER_IDS, SLIDE_IDS, THUMB_IDS, type DemoId } from '../demo/demoScene';
import { appendCompact, emptyCompact } from './compact';
import { gridCells } from './grid';
import { CONSENT_VERSION, GazeCode, type CalibrationInfo, type CompactSamples, type DeviceInfo, type FillerItem, type GridSettings, type ItemLog, type Project, type VariantId, type ViewerSession } from './model';
import { AGES, DESKTOPS, demoVariant, PHONE, seededId, simulateViewerData, type AttentionProfile } from './panelSim';
import type { ResearchText } from './text';
import { assessSession, expiryDate } from './sessions';

const HZ = 30;
const CALM: AttentionProfile = { hazard: () => 0.03, recovery: () => 0.25 };
const DRIFTING: AttentionProfile = { hazard: () => 0.45, recovery: () => 0.08 };
const ENGAGED: AttentionProfile = { hazard: (t) => (t > 6 ? 0.05 : 0.015), recovery: () => 0.3 };

interface Base {
  projectId: string;
  variantId: VariantId;
  valid: number;
  seed: number;
  phoneShare?: number;
  createdAt?: string;
  retentionDays?: number;
}

function shuffle<T>(rng: () => number, xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Wspólna część sesji (zgoda, kalibracja, urządzenie) i ocena jakości jak dla kamery. */
function session(rng: () => number, o: Base, i: number, device: DeviceInfo, data: CompactSamples, items: ItemLog[], extra: { mediaDuration: number; watchedSeconds: number; choice?: ViewerSession['choice'] }): ViewerSession {
  const createdAt = o.createdAt ?? new Date().toISOString();
  const quality: CalibrationInfo['quality'] = rng() < 0.62 ? 'GOOD' : 'FAIR';
  const calibration: CalibrationInfo = { quality, xPct: Math.round((quality === 'GOOD' ? 4 + rng() * 2 : 7 + rng() * 5) * 10) / 10, yPct: Math.round((quality === 'GOOD' ? 5 + rng() * 3 : 9 + rng() * 5) * 10) / 10, points: 9 };
  const verdict = assessSession({ source: 'simulated', calibration, data, mediaDuration: extra.mediaDuration, items }, { treatSimulatedAsWebcam: true });
  return {
    schemaVersion: '1.0',
    id: `ses_${seededId(rng, 16)}`,
    projectId: o.projectId,
    variantId: o.variantId,
    participantId: `p_${seededId(rng, 12)}`,
    ageBand: AGES[(i + Math.floor(rng() * 2)) % AGES.length],
    country: null,
    screener: {},
    device,
    consent: { version: CONSENT_VERSION, acceptedAt: createdAt, adult: true, processing: true, localOnly: true },
    source: 'simulated',
    calibration,
    audio: { mode: 'off', confirmed: false },
    watchedSeconds: extra.watchedSeconds,
    mediaDuration: extra.mediaDuration,
    completed: true,
    items,
    ...(extra.choice ? { choice: extra.choice } : {}),
    answers: {},
    createdAt,
    expiresAt: expiryDate(createdAt, o.retentionDays ?? 90),
    status: verdict.status,
    rejectCode: verdict.rejectCode,
    manual: false,
    data,
  };
}

/** Próbki jednej wizyty: czas od `enterMs`, czas materiału w pętli, indeks pozycji. */
function visitData(seed: number, id: DemoId, seconds: number, profile: AttentionProfile, enterMs: number, index: number): CompactSamples {
  const spec = DEMO_SPECS[id];
  const d = simulateViewerData({ seed, spec, profile, duration: Math.max(1 / HZ, seconds) });
  const loop = spec.duration > 0 ? spec.duration : Number.POSITIVE_INFINITY;
  d.tc = d.tc.map((t) => t + enterMs);
  d.vt = d.vt.map((t) => Math.round((t % loop) * 1000) / 1000);
  d.it = d.it.map(() => index);
  return d;
}

export interface FeedSimOptions extends Base {
  tested: DemoId;
  fillers: DemoId[];
  /** Szansa, że widz przewinie badany klip przed T_stop. */
  skip: number;
  /** To samo dla wypełniaczy. */
  fillerSkip: number;
  stopSeconds?: number;
  items?: number;
}

/** Feed (§4.4): badany klip na pozycji 2–5, wypełniacze w losowej kolejności, przewinięcia i pętle. */
export function simulateFeedSessions(o: FeedSimOptions): ViewerSession[] {
  const rng = mulberry32(o.seed);
  const stop = o.stopSeconds ?? 2;
  const n = Math.min(o.items ?? 6, o.fillers.length + 1);
  return Array.from({ length: o.valid }, (_, v) => {
    const order = shuffle(rng, o.fillers).slice(0, n - 1);
    const pos = 1 + Math.floor(rng() * Math.min(4, n - 1));
    order.splice(pos, 0, o.tested);
    const data = emptyCompact();
    const items: ItemLog[] = [];
    let tc = 0;
    let testedDwell = 0;
    order.forEach((id, index) => {
      const tested = index === pos;
      const dur = DEMO_SPECS[id].duration;
      const early = rng() < (tested ? o.skip : o.fillerSkip);
      let dwell: number;
      let loops = 0;
      if (early) dwell = 0.5 + rng() * (stop - 0.5);
      else if (rng() < (tested ? 0.45 : 0.25)) {
        loops = rng() < 0.3 ? 2 : 1;
        dwell = dur * loops + rng() * 1.2;
      } else dwell = stop + rng() * Math.max(0.5, dur - stop);
      if (tested) testedDwell = dwell;
      const last = index === order.length - 1;
      const enterMs = Math.round(tc);
      const exitMs = Math.round(tc + dwell * 1000);
      appendCompact(data, visitData(o.seed * 7919 + v * 31 + index, id, dwell, early ? DRIFTING : tested ? ENGAGED : CALM, enterMs, index));
      items.push({
        index,
        itemId: tested ? 'tested' : id,
        role: tested ? 'tested' : 'filler',
        ...(tested ? { variantId: o.variantId } : {}),
        enterMs,
        exitMs,
        exitType: last ? 'finish' : 'swipe_next',
        loops,
        events: Array.from({ length: loops }, (_, k) => ({ t: Math.round(enterMs + dur * 1000 * (k + 1)), type: 'loop' as const })),
      });
      tc = exitMs + 250;
    });
    const device = v < Math.round(o.valid * (o.phoneShare ?? 0.8)) ? PHONE : DESKTOPS[v % DESKTOPS.length];
    const dur = DEMO_SPECS[o.tested].duration;
    return session(rng, o, v, device, data, items, { mediaDuration: dur, watchedSeconds: Math.round(Math.min(dur, testedDwell) * 10) / 10 });
  });
}

export interface GridSimOptions extends Base {
  tested: DemoId;
  fillers: DemoId[];
  layout: GridSettings['layout'];
  /** Siła przyciągania badanej miniatury (1 = jak przeciętna). */
  appeal: number;
  exposureSeconds?: number;
}

/** Siatka miniatur (§4.5): ciąg spojrzeń z efektem pozycji, potem wybór (deklaracja). */
export function simulateGridSessions(o: GridSimOptions): ViewerSession[] {
  const rng = mulberry32(o.seed);
  const exposure = o.exposureSeconds ?? 6;
  const desktop = o.layout === 'yt_home';
  return Array.from({ length: o.valid }, (_, v) => {
    const device = desktop ? DESKTOPS[v % DESKTOPS.length] : PHONE;
    const cells = gridCells(o.layout, device.screenW / device.screenH);
    const n = cells.length;
    const pos = Math.floor(rng() * n);
    const fill = shuffle(rng, o.fillers);
    const ids = cells.map((_, i) => (i === pos ? o.tested : fill[i % fill.length]));
    const data = emptyCompact();
    const visited = new Array<boolean>(n).fill(false);
    const looked = new Array<number>(n).fill(0);
    const bias = { x: 0.02 * gaussian(rng), y: 0.02 * gaussian(rng) };
    let t = 0;
    let cell = -1;
    let until = 0;
    for (let k = 0; k < exposure * HZ; k++) {
      t = k / HZ;
      if (t >= until) {
        // Kolejna komórka: kolejność czytania (lewa góra częściej pierwsza) × atrakcyjność × nowość.
        const w = cells.map((_, i) => (1 / (1 + 0.28 * i)) * (i === pos ? o.appeal : 1) * (visited[i] ? 0.35 : 1) * (i === cell ? 0.05 : 1));
        const sum = w.reduce((a, b) => a + b, 0);
        let r = rng() * sum;
        cell = w.findIndex((x) => (r -= x) <= 0);
        if (cell < 0) cell = n - 1;
        visited[cell] = true;
        until = t + (0.35 + rng() * 0.85) * (cell === pos ? 1 + (o.appeal - 1) * 0.5 : 1);
      }
      const box = cells[cell].thumb;
      const blink = (t + v * 0.41) % 4.3 < 0.15;
      const away = rng() < 0.03;
      data.tc.push(Math.round(t * 1000));
      data.vt.push(Math.round(t * 1000) / 1000);
      data.seg.push(1);
      data.it.push(0);
      if (blink || away) {
        data.st.push(away ? GazeCode.AWAY : GazeCode.UNKNOWN);
        data.vx.push(-1);
        data.vy.push(-1);
        data.cf.push(away ? 0 : 10);
        data.un.push(-1);
      } else {
        const x = clamp(box.x + box.w * (0.5 + 0.18 * gaussian(rng)) + bias.x, 0, 1);
        const y = clamp(box.y + box.h * (0.5 + 0.18 * gaussian(rng)) + bias.y, 0, 1);
        looked[cell]++;
        data.st.push(GazeCode.LOOK);
        data.vx.push(Math.round(x * 1000));
        data.vy.push(Math.round(y * 1000));
        data.cf.push(Math.round(clamp(0.8 + 0.08 * gaussian(rng), 0.3, 0.98) * 100));
        data.un.push(Math.round((0.05 + Math.abs(0.02 * gaussian(rng))) * 1000));
      }
    }
    const items: ItemLog[] = cells.map((c, i) => ({ index: i, itemId: i === pos ? 'tested' : ids[i], role: i === pos ? 'tested' : 'filler', ...(i === pos ? { variantId: o.variantId } : {}), enterMs: 0, exitMs: exposure * 1000, exitType: 'finish', loops: 0, events: [], rect: c.rect }));
    const total = looked.reduce((a, b) => a + b, 0) || 1;
    const pTested = clamp(0.1 + (looked[pos] / total) * 1.4 * o.appeal, 0, 0.9);
    const roll = rng();
    const others = items.filter((it) => it.role === 'filler' && looked[it.index] > 0);
    const choice = roll < pTested ? { itemId: 'tested' } : roll < 0.92 && others.length ? { itemId: others[Math.floor(rng() * others.length)].itemId } : { itemId: null };
    return session(rng, o, v, device, data, items, { mediaDuration: exposure, watchedSeconds: exposure, choice });
  });
}

export interface CarouselSimOptions extends Base {
  slides: DemoId[];
  /** Szansa przejścia ze slajdu k na k+1. */
  continueProb: number[];
}

/** Karuzela (§4.6): slajd po slajdzie, odejście z prawdopodobieństwem zależnym od slajdu. */
export function simulateCarouselSessions(o: CarouselSimOptions): ViewerSession[] {
  const rng = mulberry32(o.seed);
  return Array.from({ length: o.valid }, (_, v) => {
    const data = emptyCompact();
    const items: ItemLog[] = [];
    let tc = 0;
    for (let k = 0; k < o.slides.length; k++) {
      const dwell = 1.4 + rng() * 3.2;
      const enterMs = Math.round(tc);
      const exitMs = Math.round(tc + dwell * 1000);
      appendCompact(data, visitData(o.seed * 104729 + v * 37 + k, o.slides[k], dwell, CALM, enterMs, k));
      const next = k < o.slides.length - 1 && rng() < (o.continueProb[k] ?? 0.8);
      items.push({ index: k, itemId: o.slides[k], role: 'tested', variantId: o.variantId, enterMs, exitMs, exitType: next ? 'swipe_next' : 'finish', loops: 0, events: [] });
      tc = exitMs + 200;
      if (!next) break;
    }
    const device = v < Math.round(o.valid * (o.phoneShare ?? 0.85)) ? PHONE : DESKTOPS[v % DESKTOPS.length];
    const seconds = Math.round(tc / 100) / 10;
    return session(rng, o, v, device, data, items, { mediaDuration: seconds, watchedSeconds: seconds });
  });
}

// ——— projekty demonstracyjne (raporty przykładowe, testy) ———

function demoBase(id: string, name: string, tx: ResearchText, createdAt: string): Omit<Project, 'kind' | 'platform' | 'context' | 'targetDevice' | 'variants'> {
  return {
    id,
    workspaceId: 'demo',
    name,
    creatorName: tx.demo.creator,
    audio: 'off',
    platformUi: 'generic',
    fillers: [],
    questions: ['finish'],
    audience: { source: 'panel', ageBands: ['18-24', '25-34'], countries: [], screenPlatforms: false },
    targetSessions: 30,
    status: 'collecting',
    linkToken: `demo-${id}`,
    retentionDays: 90,
    locale: 'pl',
    createdAt,
    updatedAt: createdAt,
  };
}

const filler = (id: DemoId): FillerItem => ({ id, media: { kind: 'demo', demo: id }, duration: DEMO_SPECS[id].duration, width: DEMO_SPECS[id].w, height: DEMO_SPECS[id].h });

/** Rolka B w feedzie z 5 wypełniaczami (raport przykładowy „Rolka w feedzie”). */
export function demoFeedProject(tx: ResearchText, opts: { createdAt?: string; valid?: number } = {}): { project: Project; sessions: ViewerSession[] } {
  const createdAt = opts.createdAt ?? new Date().toISOString();
  const project: Project = {
    ...demoBase('demo_feed', tx.demo.feedProject, tx, createdAt),
    kind: 'feed',
    platform: 'reels',
    context: 'feed',
    targetDevice: 'mobile',
    variants: [demoVariant('reel_b', 'A', tx, tx.demo.reelB)],
    fillers: FILLER_IDS.map(filler),
    feed: { items: 6, stopSeconds: 2, capSeconds: 180 },
  };
  const sessions = simulateFeedSessions({ projectId: project.id, variantId: 'A', tested: 'reel_b', fillers: FILLER_IDS, valid: opts.valid ?? 31, seed: 71, skip: 0.32, fillerSkip: 0.16, createdAt });
  return { project, sessions };
}

/** Miniatura w siatce strony głównej YouTube, dwie wersje okładki. */
export function demoGridProject(tx: ResearchText, opts: { createdAt?: string; valid?: number } = {}): { project: Project; sessions: ViewerSession[] } {
  const createdAt = opts.createdAt ?? new Date().toISOString();
  const thumb = (id: DemoId, v: VariantId) => ({ ...demoVariant(id, v, tx), mediaName: `${tx.version(v)}`, title: tx.demo.thumbTitle, aois: [] });
  const project: Project = {
    ...demoBase('demo_grid', tx.demo.gridProject, tx, createdAt),
    kind: 'thumbnail',
    platform: 'youtube',
    context: 'grid',
    targetDevice: 'desktop',
    variants: [thumb('thumb_1', 'A'), thumb('thumb_4', 'B')],
    fillers: THUMB_IDS.filter((x) => x !== 'thumb_1' && x !== 'thumb_4').map(filler),
    grid: { layout: 'yt_home', exposureSeconds: 6, askChoice: true },
  };
  const fill = THUMB_IDS.filter((x) => x !== 'thumb_1' && x !== 'thumb_4');
  const sessions = [
    ...simulateGridSessions({ projectId: project.id, variantId: 'A', tested: 'thumb_1', fillers: fill, layout: 'yt_home', valid: opts.valid ?? 30, seed: 81, appeal: 2.2, createdAt }),
    ...simulateGridSessions({ projectId: project.id, variantId: 'B', tested: 'thumb_4', fillers: fill, layout: 'yt_home', valid: opts.valid ?? 30, seed: 82, appeal: 1.1, createdAt }),
  ];
  return { project, sessions };
}

/** Karuzela 5 slajdów 4:5 (raport karuzeli). */
export function demoCarouselProject(tx: ResearchText, opts: { createdAt?: string; valid?: number } = {}): { project: Project; sessions: ViewerSession[] } {
  const createdAt = opts.createdAt ?? new Date().toISOString();
  const project: Project = {
    ...demoBase('demo_carousel', tx.demo.carouselProject, tx, createdAt),
    kind: 'carousel',
    platform: 'instagram_feed',
    context: 'carousel',
    targetDevice: 'mobile',
    variants: [{ id: 'A', label: tx.version('A'), media: { kind: 'demo', demo: 'slide_1' }, slides: SLIDE_IDS.map((demo) => ({ kind: 'demo' as const, demo })), mediaName: tx.demo.carouselProject, duration: 0, width: 1080, height: 1350, scenes: [], aois: [] }],
    slides: { mode: 'self', secondsPerSlide: 4 },
  };
  const sessions = simulateCarouselSessions({ projectId: project.id, variantId: 'A', slides: SLIDE_IDS, valid: opts.valid ?? 31, seed: 91, continueProb: [0.92, 0.66, 0.84, 0.8], createdAt });
  return { project, sessions };
}
