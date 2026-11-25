import { describe, expect, it } from 'vitest';
import { containRect, toVideoCoords } from '../src/core/geometry/coords';
import { SampleBuilder } from '../src/core/pipeline/sampleBuilder';
import type { RawGaze } from '../src/core/pipeline/types';
import { interpolateMediaTime, ManualClock } from '../src/core/time/playbackClock';
import { isValidSample } from '../src/core/contracts/types';

const raw = (t: number, x = 0.5, y = 0.5): RawGaze => ({
  tCapture: t,
  faceDetected: true,
  eyesOpen: true,
  x,
  y,
  confidence: 0.8,
  uncertainty: 0.05,
  flags: [],
});

describe('synchronizacja z filmem', () => {
  it('interpoluje czas filmu z ostatniej wyświetlonej klatki', () => {
    const pairs = [
      { display: 1000, media: 10.0 },
      { display: 1040, media: 10.04 },
      { display: 1080, media: 10.08 },
    ];
    expect(interpolateMediaTime(pairs, 1060, 1, true, null)).toBeCloseTo(10.06, 6);
    expect(interpolateMediaTime(pairs, 1100, 2, true, null)).toBeCloseTo(10.12, 6);
    expect(interpolateMediaTime(pairs, 1100, 1, false, null)).toBeCloseTo(10.08, 6);
    expect(interpolateMediaTime([], 5, 1, true, 3.3)).toBe(3.3);
  });

  it('timestamp próbki odpowiada chwili przechwycenia klatki kamery, nie przetwarzania', () => {
    const clock = new ManualClock(600);
    clock.play(2000); // bajka startuje w chwili 2000 ms
    const b = new SampleBuilder(2, clock, () => ({ x: 0, y: 0, w: 1, h: 1 }));
    const s = b.build(raw(5250)).sample;
    expect(s.videoTime).toBeCloseTo(3.25, 4); // 00:03.250
    expect(s.videoState).toBe('playing');
    expect(isValidSample(s)).toBe(true);
  });

  it('gaze synchronizuje się z filmem także po pauzie i przewinięciu', () => {
    const clock = new ManualClock(600);
    const b = new SampleBuilder(2, clock, () => ({ x: 0, y: 0, w: 1, h: 1 }));
    clock.play(0);
    expect(b.build(raw(1000)).sample.videoTime).toBeCloseTo(1, 4);
    clock.pause(2000);
    const paused = b.build(raw(3000)).sample;
    expect(paused.videoTime).toBeCloseTo(2, 4);
    expect(paused.flags).toContain('paused');
    expect(isValidSample(paused)).toBe(false);
    clock.seek(100, 4000);
    clock.play(4000);
    const after = b.build(raw(4500)).sample;
    expect(after.videoTime).toBeCloseTo(100.5, 4);
    expect(after.segment).toBeGreaterThan(1);
  });

  it('mapuje punkt ekranu na obraz bajki z czarnymi pasami (object-fit: contain)', () => {
    // Ekran 16:10, film 16:9 → pasy u góry i u dołu.
    const r = containRect(1920, 1200, 1920, 1080);
    expect(r.w).toBeCloseTo(1, 6);
    expect(r.h).toBeCloseTo(0.9, 6);
    expect(toVideoCoords(0.5, 0.5, r)).toMatchObject({ vx: 0.5, vy: 0.5, inside: true });
    expect(toVideoCoords(0.5, 0.02, r).inside).toBe(false);
    const clock = new ManualClock(10);
    clock.play(0);
    const s = new SampleBuilder(0, clock, () => r).build(raw(100, 0.5, 0.02)).sample;
    expect(s.flags).toContain('outside_video');
    expect(s.vx).toBeNull();
  });
});
