import { CONSENT_VERSION, type Project, type ViewerSession } from '../../research/model';

/** Eksport surowy (§9.5, Załącznik B): projekt + sesje (JSON), wiersz na próbkę (CSV z nagłówkiem metadanych). */
export function projectToJson(project: Project, sessions: ViewerSession[]): string {
  return JSON.stringify({ format: 'attn-export', version: 1, consentVersion: CONSENT_VERSION, project, sessions });
}

const COLS = ['session_id', 'variant', 'participant', 'device', 'age_band', 'status', 'reject_code', 'tc_ms', 'media_time', 'segment', 'item', 'x', 'y', 'confidence', 'uncertainty', 'state'];

export function projectToCsv(project: Project, sessions: ViewerSession[]): string {
  const header = [
    `# project_id: ${project.id}`,
    `# project: ${project.name.replace(/[\r\n]/g, ' ')}`,
    `# exported_at: ${new Date().toISOString()}`,
    '# coordinates: media frame 0..1 (x, y = -1 when not looking at the media)',
    '# state: 0 look, 1 look off media, 2 away, 3 unknown, 4 not playing',
    '# note: webcam-based gaze estimation, not a professional eye tracker',
    COLS.join(','),
  ];
  const rows: string[] = [];
  for (const s of sessions) {
    const d = s.data;
    for (let i = 0; i < d.tc.length; i++) {
      rows.push(
        [s.id, s.variantId, s.participantId, s.device.type, s.ageBand, s.status, s.rejectCode ?? '', d.tc[i], d.vt[i], d.seg[i], d.it[i], d.vx[i] < 0 ? '' : d.vx[i] / 1000, d.vy[i] < 0 ? '' : d.vy[i] / 1000, d.cf[i] / 100, d.un[i] < 0 ? '' : d.un[i] / 1000, d.st[i]].join(','),
      );
    }
  }
  return [...header, ...rows].join('\n');
}
