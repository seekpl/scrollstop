/**
 * Format kolumnowy próbek (§11.3): mały, łatwy do walidacji, bez współrzędnych ekranu i bez
 * jakichkolwiek danych obrazu. Najbardziej odporny sygnał z kamery to „patrzy / nie patrzy”,
 * stąd kody stanu (§5.10).
 */
import { MIN_VALID_CONFIDENCE, type GazeSample, type SampleFlag } from '../core/contracts/types';
import { CodedError } from '../core/errors';
import { GazeCode, LIMITS, type CompactSamples, type GazeCodeValue, type SessionPackage, type ViewerSession } from './model';

export { GazeCode } from './model';

const AWAY_FLAGS: SampleFlag[] = ['no_face', 'head_pose', 'off_screen'];

export function gazeCode(s: GazeSample): GazeCodeValue {
  if (s.videoState !== 'playing' || s.videoTime === null) return GazeCode.NOT_PLAYING;
  if (s.flags.some((f) => AWAY_FLAGS.includes(f))) return GazeCode.AWAY;
  if (s.x !== null && s.y !== null && s.confidence >= MIN_VALID_CONFIDENCE) {
    return s.vx !== null && s.vy !== null ? GazeCode.LOOK : GazeCode.LOOK_OFF_MEDIA;
  }
  return GazeCode.UNKNOWN;
}

const r = (v: number, k: number) => Math.round(v * k);

export const emptyCompact = (): CompactSamples => ({ tc: [], vt: [], seg: [], it: [], vx: [], vy: [], cf: [], un: [], st: [] });

/**
 * Próbki z nagrania → format kolumnowy. `item` podaje indeks pozycji (feed, siatka, slajd)
 * dla każdej próbki; dla pełnego ekranu 0. `t0` to początek sesji (ms, domena próbek).
 */
export function compactSamples(samples: readonly GazeSample[], opts: { t0?: number; item?: (s: GazeSample, i: number) => number } = {}): CompactSamples {
  const out = emptyCompact();
  if (!samples.length) return out;
  const t0 = opts.t0 ?? samples[0].tCapture;
  samples.forEach((s, i) => {
    const code = gazeCode(s);
    const look = code === GazeCode.LOOK;
    out.tc.push(Math.max(0, Math.round(s.tCapture - t0)));
    out.vt.push(s.videoTime === null ? -1 : r(s.videoTime, 1000) / 1000);
    out.seg.push(Math.max(0, Math.min(LIMITS.maxSeg - 1, s.segment)));
    out.it.push(opts.item ? opts.item(s, i) : 0);
    out.vx.push(look ? Math.min(1000, Math.max(0, r(s.vx as number, 1000))) : -1);
    out.vy.push(look ? Math.min(1000, Math.max(0, r(s.vy as number, 1000))) : -1);
    out.cf.push(Math.min(100, Math.max(0, r(s.confidence, 100))));
    out.un.push(s.uncertainty === null ? -1 : Math.min(1000, r(s.uncertainty, 1000)));
    out.st.push(code);
  });
  return out;
}

/** Dokleja próbki (np. kolejna pozycja feedu) do istniejącego zapisu. */
export function appendCompact(target: CompactSamples, more: CompactSamples): void {
  for (const k of COMPACT_KEYS) (target[k] as number[]).push(...more[k]);
}

/** Odwrotność `compactSamples` — próbki zgodne z modułami rdzenia (heat mapa, fiksacje). Tylko pozycja `item`. */
export function expandSamples(c: CompactSamples, item = 0): GazeSample[] {
  const out: GazeSample[] = [];
  for (let i = 0; i < c.tc.length; i++) {
    if (c.it[i] !== item && !(item === 0 && c.it[i] === -1)) continue;
    const code = c.st[i] as GazeCodeValue;
    const look = code === GazeCode.LOOK;
    const onScreen = look || code === GazeCode.LOOK_OFF_MEDIA;
    const vx = look ? c.vx[i] / 1000 : null;
    const vy = look ? c.vy[i] / 1000 : null;
    const flags: SampleFlag[] =
      code === GazeCode.AWAY ? ['no_face'] : code === GazeCode.UNKNOWN ? ['low_conf'] : code === GazeCode.LOOK_OFF_MEDIA ? ['outside_video'] : code === GazeCode.NOT_PLAYING ? ['paused'] : [];
    out.push({
      tCapture: c.tc[i],
      videoTime: c.vt[i] < 0 ? null : c.vt[i],
      segment: c.seg[i],
      videoState: code === GazeCode.NOT_PLAYING ? 'paused' : 'playing',
      // Raport nie potrzebuje współrzędnych ekranu; dla zgodności przyjmujemy współrzędne obrazu.
      x: onScreen ? (vx ?? 0.5) : null,
      y: onScreen ? (vy ?? 0.5) : null,
      vx,
      vy,
      fx: null,
      fy: null,
      confidence: c.cf[i] / 100,
      uncertainty: c.un[i] < 0 ? null : c.un[i] / 1000,
      faceDetected: code !== GazeCode.AWAY,
      eyesOpen: code !== GazeCode.UNKNOWN,
      quality: 'GOOD',
      flags,
    });
  }
  return out;
}

export const COMPACT_KEYS: Array<keyof CompactSamples> = ['tc', 'vt', 'seg', 'it', 'vx', 'vy', 'cf', 'un', 'st'];

/**
 * Sprawdza strukturę i zakresy danych (§11.4). Zwraca listę kodów błędów (pusta = poprawne):
 * `samples_missing`, `samples_extra_fields`, `samples_length`, `samples_too_many`, `samples_range`.
 */
export function validateCompact(c: unknown): string[] {
  const errors: string[] = [];
  if (!c || typeof c !== 'object' || Array.isArray(c)) return ['samples_missing'];
  const obj = c as Record<string, unknown>;
  if (Object.keys(obj).some((k) => !COMPACT_KEYS.includes(k as keyof CompactSamples))) errors.push('samples_extra_fields');
  const n = Array.isArray(obj.tc) ? obj.tc.length : -1;
  if (n < 0) return [...errors, 'samples_missing'];
  if (n > LIMITS.maxSamples) errors.push('samples_too_many');
  for (const k of COMPACT_KEYS) {
    const a = obj[k];
    if (!Array.isArray(a)) {
      errors.push('samples_missing');
      break;
    }
    if (a.length !== n) {
      errors.push('samples_length');
      break;
    }
  }
  if (errors.length) return errors;
  const d = obj as unknown as CompactSamples;
  const check = (k: keyof CompactSamples, ok: (v: number) => boolean): boolean => {
    for (const v of d[k]) if (typeof v !== 'number' || !Number.isFinite(v) || !ok(v)) return false;
    return true;
  };
  const okAll =
    check('tc', (v) => v >= 0 && v <= LIMITS.maxTcMs) &&
    check('vt', (v) => v === -1 || (v >= 0 && v <= LIMITS.maxMediaSeconds)) &&
    check('seg', (v) => Number.isInteger(v) && v >= 0 && v < LIMITS.maxSeg) &&
    check('it', (v) => Number.isInteger(v) && v >= -1 && v < LIMITS.maxItems) &&
    check('vx', (v) => Number.isInteger(v) && v >= -1 && v <= 1000) &&
    check('vy', (v) => Number.isInteger(v) && v >= -1 && v <= 1000) &&
    check('cf', (v) => Number.isInteger(v) && v >= 0 && v <= 100) &&
    check('un', (v) => Number.isInteger(v) && v >= -1 && v <= 1000) &&
    check('st', (v) => Number.isInteger(v) && v >= 0 && v <= 4);
  if (!okAll) errors.push('samples_range');
  return errors;
}

/** Plik sesji do odesłania twórcy (badanie bez serwera, Załącznik B). */
export function encodePackage(session: ViewerSession): string {
  const pkg: SessionPackage = { kind: 'attn-session', version: 1, session };
  return JSON.stringify(pkg);
}

/** Dekoduje plik sesji; błędy jako kody: `package_json`, `package_kind`, `package_damaged`. Pełna walidacja: `sanitizeSession`. */
export function decodePackage(text: string): unknown {
  let pkg: unknown;
  try {
    pkg = JSON.parse(text);
  } catch {
    throw new CodedError('package_json');
  }
  const p = pkg as Partial<SessionPackage> | null;
  if (!p || typeof p !== 'object' || p.kind !== 'attn-session' || p.version !== 1 || !p.session) throw new CodedError('package_kind');
  if (validateCompact((p.session as Partial<ViewerSession>).data).length) throw new CodedError('package_damaged');
  return p.session;
}
