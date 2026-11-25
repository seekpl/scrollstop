/** Pełny ekran: geometria kalibracji = geometria oglądania. */
export function enterFullscreen(): void {
  const el = document.documentElement;
  if (!document.fullscreenElement && typeof el.requestFullscreen === 'function') {
    el.requestFullscreen().catch(() => undefined);
  }
}

export function exitFullscreen(): void {
  if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
    document.exitFullscreen().catch(() => undefined);
  }
}

export const isFullscreen = (): boolean => !!document.fullscreenElement;

let audio: AudioContext | null = null;

function audioContext(): AudioContext | null {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  audio ??= new Ctor();
  return audio;
}

/** Cichy dźwięk przy zmianie punktu kalibracji (dla dorosłych wyłączony domyślnie, §5.5). */
export function playChime(volume = 0.06): void {
  try {
    const ctx = audioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(volume, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0005, now + 0.25);
    o.connect(g).connect(ctx.destination);
    o.start(now);
    o.stop(now + 0.3);
  } catch {
    /* dźwięk jest opcjonalny */
  }
}

/** Dźwięk testowy (§10.6): trzy tony ~1,2 s. Zwraca false, gdy przeglądarka nie odtwarza dźwięku. */
export async function playTestTone(): Promise<boolean> {
  try {
    const ctx = audioContext();
    if (!ctx) return false;
    if (ctx.state === 'suspended') await ctx.resume();
    const now = ctx.currentTime;
    [523, 659, 784].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      const t0 = now + i * 0.35;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.18, t0 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.32);
      o.connect(g).connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + 0.35);
    });
    return true;
  } catch {
    return false;
  }
}

export const nextFrame = (): Promise<void> =>
  new Promise((r) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => setTimeout(r, 0)) : setTimeout(r, 16)));
