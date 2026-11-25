import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import type { GazeSample } from '../../core/contracts/types';
import { containRect } from '../../core/geometry/coords';
import { SampleBuilder } from '../../core/pipeline/sampleBuilder';
import { useT } from '../../i18n';
import { DEFAULT_FEED } from '../../research/feed';
import { detectDevice } from '../../research/link';
import type { ItemLog, MediaSource, StudyConfig } from '../../research/model';
import type { MediaController } from '../shared/mediaController';
import type { CalibrationOutcome } from '../shared/useCalibration';
import { gazeSourceFor, ItemTimeline, MediaSurface, PausePanel, SwitchClock, targetFor, useLongPress, useWatchGuards } from './watchCommon';
import type { WatchResult } from './WatchFullscreen';

interface Entry {
  index: number;
  itemId: string;
  role: ItemLog['role'];
  media: MediaSource | null;
  duration: number;
  w: number;
  h: number;
  handle: string;
}

/** Neutralne nazwy kont przy wypełniaczach (bez marek i nazw platform). */
const HANDLES = ['kadr.dnia', 'na_szybko', 'zwykly.wtorek', 'pol_minuty', 'notatki_z_miasta', 'krotko.i.na.temat'];
const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 24) || 'tworca';

/** Kolejność feedu: badany klip na pozycji 2–5 (nigdy pierwszy), wypełniacze losowo (§4.4). */
export function buildFeed(config: StudyConfig, items: number, rng: () => number = Math.random): Entry[] {
  const fillers = [...config.fillers];
  for (let i = fillers.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [fillers[i], fillers[j]] = [fillers[j], fillers[i]];
  }
  const chosen = fillers.slice(0, Math.max(1, items - 1));
  const pos = Math.min(chosen.length, 1 + Math.floor(rng() * Math.min(4, chosen.length)));
  const v = config.variant;
  const list: Array<Omit<Entry, 'index'>> = chosen.map((f, k) => ({ itemId: f.id, role: 'filler', media: f.media, duration: f.duration, w: f.width, h: f.height, handle: HANDLES[k % HANDLES.length] }));
  list.splice(pos, 0, { itemId: 'tested', role: 'tested', media: v.media, duration: v.duration, w: v.width, h: v.height, handle: slug(config.creatorName) });
  return list.map((e, index) => ({ ...e, index }));
}

const SWIPE_PX = 60;
const SWIPE_VELOCITY = 0.3;
const WHEEL_SUM = 50;
const MOVE_GAP_MS = 350;

/**
 * Test w feedzie (§4.4): przewijanie jak w aplikacjach z rolkami. Telefon: przesunięcie w górę/dół,
 * komputer: kółko, ↑/↓, J/K. Dotknięcie wstrzymuje i wznawia, klip po końcu leci od nowa (pętla).
 * Widz nie wie, który klip jest badany. Koniec: po ostatniej pozycji albo po limicie czasu.
 */
export function WatchFeed({ config, calibration, simulated, muted, onFinish }: { config: StudyConfig; calibration: CalibrationOutcome | null; simulated: boolean; muted: boolean; onFinish(r: WatchResult): void }) {
  const t = useT();
  const f = t.viewer.feed;
  const settings = config.feed ?? DEFAULT_FEED;
  const entries = useMemo(() => buildFeed(config, settings.items), [config, settings.items]);
  const [pos, setPos] = useState(0);
  // Numer przejścia: każda wizyta (także powrót do poprzedniej pozycji) to nowy odtwarzacz.
  const [turn, setTurn] = useState(0);
  const [started, setStarted] = useState(false);
  const [panel, setPanel] = useState(false);
  const [paused, setPaused] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const clock = useMemo(() => new SwitchClock(), []);
  const timeline = useMemo(() => new ItemTimeline(), []);
  const ctrl = useRef<MediaController | null>(null);
  const visits = useRef<ItemLog[]>([]);
  const samples = useRef<GazeSample[]>([]);
  const t0 = useRef(0);
  const finished = useRef(false);
  const lastMove = useRef(0);
  const posRef = useRef(0);
  const target = useRef(targetFor(entries[0].media));
  const stopSource = useRef<() => void>(() => undefined);
  const itemCap = useRef<ReturnType<typeof setTimeout> | null>(null);
  const device = useMemo(detectDevice, []);
  posRef.current = pos;
  const entry = entries[pos];
  const visit = () => visits.current[visits.current.length - 1] as ItemLog | undefined;
  const since = () => Math.round(performance.now() - t0.current);

  const finish = (completed: boolean, reported = false) => {
    if (finished.current) return;
    finished.current = true;
    if (itemCap.current) clearTimeout(itemCap.current);
    const v = visit();
    if (v && v.exitMs === null) {
      v.exitMs = since();
      v.exitType = completed ? 'finish' : null;
    }
    stopSource.current();
    ctrl.current?.pause();
    clock.set(null);
    timeline.mark(performance.now(), -1);
    const tested = entries.find((e) => e.role === 'tested') as Entry;
    let watched = 0;
    for (const s of samples.current) if (s.videoState === 'playing' && s.videoTime !== null && timeline.itemOf(s) === tested.index) watched = Math.max(watched, s.videoTime);
    onFinish({ samples: samples.current, t0: t0.current, completed, duration: tested.duration, watchedSeconds: Math.round(watched * 10) / 10, device, reported, items: visits.current, itemOf: timeline.itemOf });
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  /** Przejście do sąsiedniej pozycji; `exit` — jak widz opuścił bieżącą. */
  const move = (dir: 1 | -1, exit: ItemLog['exitType'] = dir > 0 ? 'swipe_next' : 'swipe_prev') => {
    if (!started || panel || finished.current) return;
    const now = performance.now();
    if (now - lastMove.current < MOVE_GAP_MS) return;
    const next = posRef.current + dir;
    if (next < 0) return;
    lastMove.current = now;
    const v = visit();
    if (v && v.exitMs === null) {
      v.exitMs = since();
      v.exitType = exit;
    }
    if (itemCap.current) clearTimeout(itemCap.current);
    ctrl.current?.pause();
    ctrl.current = null;
    clock.set(null);
    timeline.mark(now, -1);
    if (next >= entries.length) finishRef.current(true);
    else {
      setPaused(false);
      setPos(next);
      setTurn((x) => x + 1);
    }
  };
  const moveRef = useRef(move);
  moveRef.current = move;

  /** Nowa pozycja na ekranie: zegar, oś czasu, wpis wizyty, limit czasu pozycji. */
  const onReady = (c: MediaController) => {
    if (finished.current) return;
    const e = entries[posRef.current];
    ctrl.current = c;
    clock.set(c.clock);
    timeline.mark(performance.now(), e.index);
    target.current = targetFor(e.media);
    visits.current.push({ index: e.index, itemId: e.itemId, role: e.role, ...(e.role === 'tested' ? { variantId: config.variant.id } : {}), enterMs: since(), exitMs: null, exitType: null, loops: 0, events: [] });
    void c.play().catch(() => setBlocked(true));
    // Jedna pozycja trwa najwyżej max(3 × długość, 60 s).
    const cap = Math.max(3 * (e.duration || 20), 60) * 1000;
    itemCap.current = setTimeout(() => moveRef.current(1, 'end_cap'), cap);
  };

  const onLoop = () => {
    const v = visit();
    if (!v) return;
    v.loops++;
    v.events.push({ t: since(), type: 'loop' });
  };

  const togglePause = () => {
    const c = ctrl.current;
    const v = visit();
    if (!c || !v) return;
    if (c.isPaused()) {
      void c.play().catch(() => setBlocked(true));
      v.events.push({ t: since(), type: 'resume' });
      setPaused(false);
    } else {
      c.pause();
      v.events.push({ t: since(), type: 'pause' });
      setPaused(true);
    }
  };

  // Start: pomiar od pierwszego gestu (polityka autoodtwarzania), limit całej sesji.
  const start = () => {
    t0.current = performance.now();
    const rect = () => {
      const e = entries[posRef.current];
      return containRect(window.innerWidth, window.innerHeight, e.w, e.h);
    };
    const builder = new SampleBuilder(2, clock, rect);
    const source = gazeSourceFor(simulated, calibration, clock, { target: (tt) => target.current.target(tt) });
    source.start((raw) => samples.current.push(builder.build(raw).sample));
    const cap = setTimeout(() => {
      const v = visit();
      if (v && v.exitMs === null) {
        v.exitMs = since();
        v.exitType = 'end_cap';
      }
      finishRef.current(true);
    }, settings.capSeconds * 1000);
    stopSource.current = () => {
      clearTimeout(cap);
      source.stop();
    };
    setStarted(true);
  };
  useEffect(() => () => stopSource.current(), []);

  const openPanel = () => {
    ctrl.current?.pause();
    setPanel(true);
  };
  useWatchGuards({ onPanel: openPanel, onHidden: () => ctrl.current?.pause(), onVisible: () => setBlocked(true) });

  // Komputer: strzałki i J/K, spacja — pauza.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'j' || e.key === 'J') moveRef.current(1);
      else if (e.key === 'ArrowUp' || e.key === 'k' || e.key === 'K') moveRef.current(-1);
      else if (e.key === ' ') {
        e.preventDefault();
        togglePause();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const press = useLongPress(openPanel);
  const gesture = useRef<{ x: number; y: number; t: number } | null>(null);
  const wheel = useRef({ sum: 0, timer: 0 as unknown as ReturnType<typeof setTimeout> });
  const onPointerDown = (e: ReactPointerEvent) => {
    gesture.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    press.start();
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const g = gesture.current;
    if (g && Math.hypot(e.clientX - g.x, e.clientY - g.y) > 12) press.end();
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    const long = press.end();
    const g = gesture.current;
    gesture.current = null;
    if (long || !g || panel) return;
    const dy = g.y - e.clientY;
    const dt = Math.max(1, performance.now() - g.t);
    if (dy > SWIPE_PX || (dy > 20 && dy / dt > SWIPE_VELOCITY)) moveRef.current(1);
    else if (dy < -SWIPE_PX || (dy < -20 && -dy / dt > SWIPE_VELOCITY)) moveRef.current(-1);
    else if (Math.abs(dy) < 12 && dt < 400) {
      if (blocked) {
        setBlocked(false);
        void ctrl.current?.play().catch(() => setBlocked(true));
      } else togglePause();
    }
  };
  const onWheel = (e: ReactWheelEvent) => {
    const w = wheel.current;
    w.sum += e.deltaY;
    clearTimeout(w.timer);
    w.timer = setTimeout(() => (w.sum = 0), 250);
    if (w.sum > WHEEL_SUM) {
      w.sum = 0;
      moveRef.current(1);
    } else if (w.sum < -WHEEL_SUM) {
      w.sum = 0;
      moveRef.current(-1);
    }
  };

  const generic = config.platformUi === 'generic';
  return (
    <div className="fixed inset-0 z-[90] select-none overflow-hidden bg-black text-white" style={{ touchAction: 'none' }} onContextMenu={(e) => e.preventDefault()} data-testid="feed">
      {started && entry && (
        <div key={turn} className="absolute inset-0" data-testid="feed-item" data-role={entry.role}>
          <MediaSurface media={entry.media} size={{ w: entry.w, h: entry.h }} muted={muted} loop onReady={onReady} onLoop={onLoop} label={f.itemLabel(pos + 1, entries.length)} />
          {generic && <PlatformOverlay handle={entry.handle} caption={entry.role === 'tested' ? (config.caption ?? '') : ''} />}
        </div>
      )}
      <div className="absolute inset-0" aria-hidden onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => press.end()} onWheel={onWheel} />
      {!started && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-black p-6 text-center">
          <div className="max-w-sm space-y-5">
            <h1 className="text-[24px] font-semibold leading-snug">{f.introTitle}</h1>
            <p className="text-[16px] leading-relaxed text-white/85">{f.introBody}</p>
            <p className="text-[14px] text-white/70">{device.touch ? f.hintTouch : f.hintDesktop}</p>
            <button type="button" onClick={start} className="min-h-12 w-full rounded-2xl bg-white px-6 text-[17px] font-semibold text-ink">
              {f.start}
            </button>
          </div>
        </div>
      )}
      {started && (paused || blocked) && !panel && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="rounded-full bg-black/55 px-5 py-3 text-[17px] font-semibold">{blocked ? t.viewer.watch.tapResume : f.paused}</span>
        </div>
      )}
      {panel && (
        <PausePanel
          canResume
          onResume={() => {
            setPanel(false);
            void ctrl.current?.play().catch(() => setBlocked(true));
          }}
          onEnd={() => finishRef.current(false)}
          onReport={() => finishRef.current(false, true)}
        />
      )}
    </div>
  );
}

/** Neutralna nakładka aplikacji z rolkami (§4.4): ikony po prawej, konto i opis na dole. Bez znaków platform. */
function PlatformOverlay({ handle, caption }: { handle: string; caption: string }) {
  const t = useT();
  const f = t.viewer.feed;
  const icon = (d: string, label: string) => (
    <span className="grid h-11 w-11 place-items-center rounded-full bg-black/25" aria-label={label} role="img">
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={d} />
      </svg>
    </span>
  );
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute bottom-28 right-3 flex flex-col items-center gap-4">
        {icon('M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z', f.like)}
        {icon('M5 5h14v10H9l-4 4z', f.comment)}
        {icon('M4 12l15-7-4 15-3-6z', f.share)}
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-8 pt-16">
        <p className="text-[15px] font-semibold">@{handle}</p>
        {caption ? <p className="mt-1 line-clamp-2 max-w-[80%] text-[14px] text-white/90">{caption}</p> : <span className="mt-2 block h-2.5 w-2/3 max-w-[260px] rounded bg-white/45" aria-hidden />}
      </div>
    </div>
  );
}
