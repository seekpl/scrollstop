import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixedScenes, segmentLength } from '../src/core/analysis/scenes';
import { coverCrop } from '../src/core/geometry/coords';
import { SampleBuilder } from '../src/core/pipeline/sampleBuilder';
import { isValidSample } from '../src/core/contracts/types';
import { fetchYouTubeInfo, YT_STATE } from '../src/youtube/api';
import { aspectLabel, snapAspect } from '../src/youtube/aspect';
import { YouTubeClock, type YouTubeClockPlayer } from '../src/youtube/clock';
import { parseYouTubeId, youtubeErrorCode } from '../src/youtube/url';

describe('linki YouTube', () => {
  it('rozpoznaje identyfikator filmu w typowych linkach', () => {
    const id = 'dQw4w9WgXcQ';
    for (const link of [
      id,
      `https://www.youtube.com/watch?v=${id}`,
      `https://www.youtube.com/watch?list=PL123&v=${id}&t=42s`,
      `youtube.com/watch?v=${id}`,
      `https://m.youtube.com/watch?v=${id}`,
      `https://youtu.be/${id}?si=abc`,
      `https://www.youtube.com/embed/${id}`,
      `https://www.youtube-nocookie.com/embed/${id}?rel=0`,
      `https://www.youtube.com/shorts/${id}`,
      `https://www.youtube.com/live/${id}`,
      `  https://youtu.be/${id}  `,
    ]) {
      expect(parseYouTubeId(link), link).toBe(id);
    }
  });

  it('odrzuca linki, które nie wskazują filmu', () => {
    for (const link of [
      '',
      'bajka.mp4',
      'https://www.youtube.com/',
      'https://www.youtube.com/@kanal',
      'https://www.youtube.com/watch?v=za-krotki',
      'https://vimeo.com/123456789',
      'https://example.com/watch?v=dQw4w9WgXcQ',
    ]) {
      expect(parseYouTubeId(link), link).toBeNull();
    }
  });

  it('tłumaczy kody błędów odtwarzacza', () => {
    expect(youtubeErrorCode(150)).toBe('youtube_unembeddable');
    expect(youtubeErrorCode(101)).toBe('youtube_unembeddable');
    expect(youtubeErrorCode(100)).toBe('youtube_unavailable');
    expect(youtubeErrorCode(2)).toBe('youtube_bad_id');
    expect(youtubeErrorCode(999)).toBe('youtube_error');
  });
});

class FakePlayer implements YouTubeClockPlayer {
  state: number = YT_STATE.UNSTARTED;
  time = 0;
  rate = 1;
  getCurrentTime = () => this.time;
  getPlayerState = () => this.state;
  getPlaybackRate = () => this.rate;
  getDuration = () => 300;
}

/** Odtwarzanie od chwili `from` (ms) i czasu filmu `media0`; API podaje czas co 250 ms z opóźnieniem 40 ms. */
function play(p: FakePlayer, clock: YouTubeClock, from: number, to: number, media0: number) {
  const truth = (perf: number) => media0 + (perf - from) / 1000;
  p.state = YT_STATE.PLAYING;
  for (let perf = from; perf <= to; perf += 50) {
    const delivered = from + Math.floor((perf - from) / 250) * 250;
    p.time = Math.max(media0, truth(delivered - 40));
    clock.observe(perf);
  }
  return truth;
}

describe('zegar odtwarzacza YouTube', () => {
  it('szacuje czas filmu z opóźnionych, skokowych odczytów getCurrentTime()', () => {
    const p = new FakePlayer();
    const clock = new YouTubeClock(p);
    const truth = play(p, clock, 1000, 3000, 5);
    expect(clock.state()).toBe('playing');
    // Ostatni odczyt API spóźnia się nawet o ~0,25 s; zegar — o czas dostarczenia (40 ms).
    expect(truth(3200) - p.getCurrentTime()).toBeGreaterThan(0.2);
    for (const t of [3000, 3020, 3110, 3200]) expect(Math.abs((clock.mediaTimeAt(t) as number) - truth(t))).toBeLessThan(0.05);
  });

  it('pauza zatrzymuje czas, a wznowienie zaczyna nowy odcinek odtwarzania', () => {
    const p = new FakePlayer();
    const clock = new YouTubeClock(p);
    play(p, clock, 0, 2000, 0);
    const seg = clock.segment();
    p.state = YT_STATE.PAUSED;
    p.time = 2.1;
    clock.observe(2100);
    expect(clock.state()).toBe('paused');
    expect(clock.mediaTimeAt(5000)).toBeCloseTo(2.1, 6);

    const b = new SampleBuilder(2, clock, () => ({ x: 0, y: 0, w: 1, h: 1 }));
    const paused = b.build({ tCapture: 5000, faceDetected: true, eyesOpen: true, x: 0.5, y: 0.5, confidence: 0.8, uncertainty: 0.05, flags: [] }).sample;
    expect(paused.flags).toContain('paused');
    expect(isValidSample(paused)).toBe(false);

    const truth = play(p, clock, 6000, 7000, 2.1);
    expect(clock.segment()).toBe(seg + 1);
    expect(clock.mediaTimeAt(7000)).toBeCloseTo(truth(7000), 1);
  });

  it('przewinięcie w trakcie odtwarzania zmienia odcinek i przestawia zegar', () => {
    const p = new FakePlayer();
    const clock = new YouTubeClock(p);
    play(p, clock, 0, 2000, 0);
    const seg = clock.segment();
    const truth = play(p, clock, 2050, 3000, 60);
    expect(clock.segment()).toBe(seg + 1);
    expect(clock.mediaTimeAt(3000)).toBeCloseTo(truth(3000), 1);
  });

  it('buforowanie i zacięcie (np. reklama) są traktowane jak pauza, koniec filmu jak koniec', () => {
    const p = new FakePlayer();
    const clock = new YouTubeClock(p);
    play(p, clock, 0, 1000, 0);
    p.state = YT_STATE.BUFFERING;
    clock.observe(1050);
    expect(clock.state()).toBe('paused');

    play(p, clock, 2000, 3000, 1);
    expect(clock.state()).toBe('playing');
    const frozen = p.time;
    for (let perf = 3050; perf <= 4300; perf += 50) {
      p.time = frozen;
      clock.observe(perf);
    }
    expect(clock.state()).toBe('paused');
    const seg = clock.segment();
    play(p, clock, 4350, 5000, frozen + 0.01);
    expect(clock.state()).toBe('playing');
    expect(clock.segment()).toBe(seg + 1);

    p.state = YT_STATE.ENDED;
    clock.observe(5100);
    expect(clock.state()).toBe('ended');
    expect(clock.duration()).toBe(300);
  });
});

describe('oEmbed', () => {
  afterEach(() => vi.unstubAllGlobals());
  const respond = (status: number, body: unknown = {}) =>
    vi.stubGlobal('fetch', vi.fn(async () => ({ status, ok: status >= 200 && status < 300, json: async () => body }) as Response));

  it('podaje tytuł i proporcje filmu', async () => {
    respond(200, { title: ' Kot w butach ', author_name: 'Kanał', width: 200, height: 150 });
    expect(await fetchYouTubeInfo('dQw4w9WgXcQ')).toEqual({ status: 'ok', title: 'Kot w butach', author: 'Kanał', width: 200, height: 150 });
  });

  it('rozpoznaje filmy bez zgody na osadzanie i niedostępne', async () => {
    respond(401);
    expect(await fetchYouTubeInfo('dQw4w9WgXcQ')).toEqual({ status: 'unembeddable' });
    respond(404);
    expect(await fetchYouTubeInfo('dQw4w9WgXcQ')).toEqual({ status: 'unavailable' });
  });

  it('bez sieci zwraca null (zostają wartości domyślne)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    expect(await fetchYouTubeInfo('dQw4w9WgXcQ')).toBeNull();
  });
});

describe('proporcje i tło', () => {
  it('dopasowuje proporcje z oEmbed do standardowych', () => {
    expect(snapAspect(200, 113)).toEqual({ width: 1280, height: 720 });
    expect(snapAspect(200, 150)).toEqual({ width: 960, height: 720 });
    expect(aspectLabel(1280, 720)).toBe('16:9');
    expect(aspectLabel(snapAspect(113, 200).width, 720)).toBe('9:16');
    expect(aspectLabel(1680, 720)).toBeNull();
  });

  it('przycina miniaturę 4:3 z czarnymi pasami do obrazu 16:9', () => {
    // hqdefault.jpg ma 480×360; obraz 16:9 zajmuje środkowe 480×270.
    expect(coverCrop(480, 360, 1280, 720)).toEqual({ sx: 0, sy: 45, sw: 480, sh: 270 });
    expect(coverCrop(1280, 720, 1280, 720)).toEqual({ sx: 0, sy: 0, sw: 1280, sh: 720 });
  });
});

describe('równe odcinki zamiast scen', () => {
  it('dzieli bajkę na co najwyżej ~12 odcinków', () => {
    expect(segmentLength(60)).toBe(10);
    expect(segmentLength(170)).toBe(15);
    expect(segmentLength(22 * 60)).toBe(120);
  });

  it('krótką końcówkę dołącza do ostatniego odcinka', () => {
    expect(fixedScenes(62, 15).map((s) => [s.start, s.end])).toEqual([
      [0, 15],
      [15, 30],
      [30, 45],
      [45, 62],
    ]);
    expect(fixedScenes(40, 15).map((s) => [s.start, s.end])).toEqual([
      [0, 15],
      [15, 30],
      [30, 40],
    ]);
    expect(fixedScenes(0, 15)).toEqual([]);
    expect(fixedScenes(30, 15).every((s) => s.source === 'manual')).toBe(true);
  });
});
