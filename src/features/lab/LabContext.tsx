import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CalibrationSummary, GazeSourceKind, Session, SessionMeta, SessionMode, SmoothingLevel } from '../../core/contracts/types';
import type { GazeModel } from '../../core/estimation/gazeModel';
import type { DemoId } from '../../demo/demoScene';
import type { SessionStore } from '../../storage/sessionStore';
import { enterFullscreen, exitFullscreen } from '../shared/browser';

export type LabView = 'setup' | 'live' | 'calibration' | 'watch' | 'sessions' | 'heatmap' | 'path' | 'stats';

export type LabMedia = { kind: 'file'; name: string; size: number; url: string } | { kind: 'demo'; demo: DemoId };

export interface Calibrated {
  model: GazeModel;
  summary: CalibrationSummary;
}

export interface MarkerStyle {
  size: number;
  color: string;
}

export interface LabValue {
  store: SessionStore;
  view: LabView;
  setView(v: LabView): void;
  media: LabMedia | null;
  selectFile(file: File): void;
  selectDemo(demo: DemoId): void;
  /** Wiąże plik z materiałem zapisanym w sesji (np. po odświeżeniu strony). */
  linkFile(name: string, size: number | undefined, file: File): void;
  libraryUrl(name: string, size?: number): string | null;
  libraryVersion: number;
  source: GazeSourceKind;
  setSource(s: GazeSourceKind): void;
  cameraId: string | null;
  setCameraId(id: string | null): void;
  participant: string;
  setParticipant(p: string): void;
  mode: SessionMode;
  setMode(m: SessionMode): void;
  smoothing: SmoothingLevel;
  setSmoothing(s: SmoothingLevel): void;
  marker: MarkerStyle;
  setMarker(m: MarkerStyle): void;
  calibration: Calibrated | null;
  setCalibration(c: Calibrated | null): void;
  activeSessionId: string | null;
  activeSession: Session | null;
  openSession(id: string | null, view?: LabView): void;
  updateActiveMeta(patch: Partial<SessionMeta>): Promise<void>;
  sessionsVersion: number;
  refreshSessions(): void;
  startCalibration(): void;
  startWatching(): void;
  leaveFullscreenView(view?: LabView): void;
}

const Ctx = createContext<LabValue | null>(null);
const libKey = (name: string, size?: number) => `${name}|${size ?? ''}`;

export function LabProvider({ store, children, initialSessionId = null }: { store: SessionStore; children: ReactNode; initialSessionId?: string | null }) {
  const [view, setView] = useState<LabView>(initialSessionId ? 'sessions' : 'setup');
  const [media, setMedia] = useState<LabMedia | null>(null);
  const library = useRef(new Map<string, string>());
  const [libraryVersion, setLibraryVersion] = useState(0);
  const [source, setSource] = useState<GazeSourceKind>('webcam');
  const [cameraId, setCameraId] = useState<string | null>(null);
  const [participant, setParticipant] = useState('P1');
  const [mode, setMode] = useState<SessionMode>('measurement');
  const [smoothing, setSmoothing] = useState<SmoothingLevel>(2);
  const [marker, setMarker] = useState<MarkerStyle>({ size: 44, color: '#F2B705' });
  const [calibration, setCalibration] = useState<Calibrated | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(initialSessionId);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [sessionsVersion, setSessionsVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    if (!activeSessionId) {
      setActiveSession(null);
      return;
    }
    void store.loadSession(activeSessionId).then((s) => alive && setActiveSession(s));
    return () => {
      alive = false;
    };
  }, [activeSessionId, store, sessionsVersion]);

  const registerFile = useCallback((key: string, file: File) => {
    const prev = library.current.get(key);
    if (prev) URL.revokeObjectURL(prev);
    const url = URL.createObjectURL(file);
    library.current.set(key, url);
    setLibraryVersion((v) => v + 1);
    return url;
  }, []);

  const value = useMemo<LabValue>(
    () => ({
      store,
      view,
      setView,
      media,
      selectFile(file) {
        const url = registerFile(libKey(file.name, file.size), file);
        setMedia({ kind: 'file', name: file.name, size: file.size, url });
      },
      selectDemo(demo) {
        setMedia({ kind: 'demo', demo });
      },
      linkFile(name, size, file) {
        registerFile(libKey(name, size), file);
      },
      libraryUrl(name, size) {
        return library.current.get(libKey(name, size)) ?? null;
      },
      libraryVersion,
      source,
      setSource,
      cameraId,
      setCameraId,
      participant,
      setParticipant,
      mode,
      setMode,
      smoothing,
      setSmoothing,
      marker,
      setMarker,
      calibration,
      setCalibration,
      activeSessionId,
      activeSession,
      openSession(id, v = 'sessions') {
        exitFullscreen();
        setActiveSessionId(id);
        setSessionsVersion((n) => n + 1);
        setView(v);
      },
      async updateActiveMeta(patch) {
        if (!activeSession) return;
        const meta = { ...activeSession.meta, ...patch };
        await store.saveMeta(meta);
        setActiveSession({ ...activeSession, meta });
      },
      sessionsVersion,
      refreshSessions() {
        setSessionsVersion((n) => n + 1);
      },
      startCalibration() {
        enterFullscreen();
        setView('calibration');
      },
      startWatching() {
        enterFullscreen();
        setView('watch');
      },
      leaveFullscreenView(v = 'setup') {
        exitFullscreen();
        setView(v);
      },
    }),
    [store, view, media, libraryVersion, source, cameraId, participant, mode, smoothing, marker, calibration, activeSessionId, activeSession, sessionsVersion, registerFile],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLab(): LabValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLab outside LabProvider');
  return v;
}
