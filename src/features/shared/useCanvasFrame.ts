import { useEffect, useRef } from 'react';
import type { FrameSource } from '../../core/render/frameSource';

/**
 * Rysuje klatkę (czas t) i nakładkę `overlay` na canvasie. Seek wideo jest asynchroniczny,
 * więc rysujemy tylko najnowsze żądanie (pomijając pośrednie).
 */
export function useCanvasFrame(
  src: FrameSource | null,
  t: number,
  overlay: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  deps: unknown[],
  width = 1280,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const busy = useRef(false);
  const pending = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!src || !canvas) return;
    const job = async () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const w = width;
      const h = Math.round((width * src.height) / src.width) || Math.round((width * 9) / 16);
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      try {
        await src.drawFrame(ctx, t, w, h);
      } catch {
        ctx.fillStyle = '#E6EAF2';
        ctx.fillRect(0, 0, w, h);
      }
      overlay(ctx, w, h);
    };
    const run = async (j: () => Promise<void>) => {
      busy.current = true;
      await j();
      busy.current = false;
      const next = pending.current;
      pending.current = null;
      if (next) void run(next);
    };
    if (busy.current) pending.current = job;
    else void run(job);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, t, width, ...deps]);

  return canvasRef;
}
