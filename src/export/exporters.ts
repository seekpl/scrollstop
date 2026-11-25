import { SCHEMA_VERSION, type Fixation, type GazeSample, type Session } from '../core/contracts/types';
import { youtubeWatchUrl } from '../youtube/url';

export function sampleToExport(s: GazeSample) {
  return {
    t_capture_ms: s.tCapture,
    video_time: s.videoTime,
    playback_segment: s.segment,
    video_state: s.videoState,
    x: s.x,
    y: s.y,
    video_x: s.vx,
    video_y: s.vy,
    x_filtered: s.fx,
    y_filtered: s.fy,
    confidence: s.confidence,
    uncertainty: s.uncertainty,
    face_detected: s.faceDetected,
    eyes_open: s.eyesOpen,
    tracking_quality: s.quality,
    flags: s.flags,
  };
}

export function sessionToJSON(session: Session, fixations: Fixation[] = []): string {
  return JSON.stringify({
    schema_version: SCHEMA_VERSION,
    session: session.meta,
    samples: session.samples.map(sampleToExport),
    fixations,
    scenes: session.meta.scenes ?? [],
  });
}

export const CSV_COLUMNS = Object.keys(sampleToExport({} as GazeSample)) as Array<keyof ReturnType<typeof sampleToExport>>;

const csvValue = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (Array.isArray(v)) return v.join('|');
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV: linie z „#” to metadane (np. pandas: read_csv(..., comment='#')). */
export function sessionToCSV(session: Session): string {
  const m = session.meta;
  const header = [
    `# schema_version: ${SCHEMA_VERSION}`,
    `# session_id: ${m.id}`,
    `# video: ${m.video.name}`,
    ...(m.video.youtubeId ? [`# youtube: ${youtubeWatchUrl(m.video.youtubeId)}`] : []),
    `# source: ${m.source}`,
    `# mode: ${m.mode}`,
    `# coordinates: normalized 0..1 (x,y = screen; video_x,video_y = media frame)`,
    `# note: webcam-based gaze estimation, not a professional eye tracker`,
  ];
  const rows = session.samples.map((s) => {
    const e = sampleToExport(s);
    return CSV_COLUMNS.map((c) => csvValue(e[c])).join(',');
  });
  return [...header, CSV_COLUMNS.join(','), ...rows].join('\n');
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(text: string, filename: string, mime: string): void {
  downloadBlob(new Blob([text], { type: mime }), filename);
}
