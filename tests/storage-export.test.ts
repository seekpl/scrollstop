import { describe, expect, it } from 'vitest';
import { CSV_COLUMNS, sessionToCSV, sessionToJSON } from '../src/export/exporters';
import { DEMO_SPECS } from '../src/demo/demoScene';
import { generateDemoSession } from '../src/demo/simulator';
import { MemorySessionStore } from '../src/storage/sessionStore';
import { SessionRecorder } from '../src/core/session/recorder';

describe('magazyn sesji', () => {
  it('zapisuje próbki porcjami i odtwarza je w kolejności', async () => {
    const store = new MemorySessionStore();
    const demo = generateDemoSession(DEMO_SPECS.video);
    const rec = new SessionRecorder({ ...demo.meta, sampleCount: 0 }, store);
    await rec.begin();
    demo.samples.slice(0, 500).forEach((s) => rec.add(s));
    await rec.flush();
    demo.samples.slice(500).forEach((s) => rec.add(s));
    const meta = await rec.finish();
    expect(meta.sampleCount).toBe(demo.samples.length);
    const loaded = await store.loadSession(demo.meta.id);
    expect(loaded?.samples).toHaveLength(demo.samples.length);
    expect(loaded?.samples.map((s) => s.tCapture)).toEqual(demo.samples.map((s) => s.tCapture));
    await store.deleteSession(demo.meta.id);
    expect(await store.loadSession(demo.meta.id)).toBeNull();
  });
});

describe('eksport', () => {
  const session = generateDemoSession(DEMO_SPECS.video);

  it('JSON zawiera sesję, znormalizowane próbki i sceny', () => {
    const data = JSON.parse(sessionToJSON(session));
    expect(data.schema_version).toBe('1.1');
    expect(data.session.id).toBe(session.meta.id);
    expect(data.samples).toHaveLength(session.samples.length);
    expect(Object.keys(data.samples[0])).toEqual(expect.arrayContaining(['video_time', 'x', 'y', 'confidence', 'uncertainty', 'face_detected']));
    expect(data.scenes).toHaveLength(5);
  });

  it('CSV ma nagłówek metadanych, kolumny i wiersz na próbkę', () => {
    const lines = sessionToCSV(session).split('\n');
    const header = lines.find((l) => !l.startsWith('#'))!;
    expect(header.split(',')).toEqual(CSV_COLUMNS);
    const rows = lines.filter((l) => !l.startsWith('#')).slice(1);
    expect(rows).toHaveLength(session.samples.length);
    expect(rows.every((r) => r.split(',').length === CSV_COLUMNS.length)).toBe(true);
  });

  it('dla bajki z YouTube JSON i CSV zawierają identyfikator filmu', () => {
    const yt = { ...session, meta: { ...session.meta, video: { ...session.meta.video, kind: 'youtube' as const, youtubeId: 'dQw4w9WgXcQ' } } };
    expect(JSON.parse(sessionToJSON(yt)).session.video.youtubeId).toBe('dQw4w9WgXcQ');
    expect(sessionToCSV(yt).split('\n')).toContain('# youtube: https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });
});
