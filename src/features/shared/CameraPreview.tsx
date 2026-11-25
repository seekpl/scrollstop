import { useEffect, useRef } from 'react';
import type { TrackerFrame } from '../../core/tracking/faceTracker';
import { trackingHub } from '../../core/tracking/trackingHub';
import { useT } from '../../i18n';
import { useHubInfo } from './hooks';

/**
 * Podgląd kamery — przepina wspólny element <video> z TrackingHub (§5.1). Lustrzany.
 * Podgląd widzi tylko osoba przed ekranem; obraz nie jest nagrywany.
 */
export function CameraPreview({ overlay, className = 'aspect-video' }: { overlay?: (ctx: CanvasRenderingContext2D, f: TrackerFrame) => void; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const info = useHubInfo();
  const t = useT();

  useEffect(() => {
    if (!box.current || info.status !== 'running') return;
    return trackingHub.adopt(box.current, 'absolute inset-0 h-full w-full object-cover -scale-x-100');
  }, [info.status]);

  useEffect(() => {
    if (!overlay) return;
    return trackingHub.subscribe((f) => {
      const c = canvasRef.current;
      const ctx = c?.getContext('2d');
      if (!c || !ctx || !f.width) return;
      if (c.width !== f.width) c.width = f.width;
      if (c.height !== f.height) c.height = f.height;
      ctx.clearRect(0, 0, c.width, c.height);
      overlay(ctx, f);
    });
  }, [overlay]);

  return (
    <div ref={box} className={`relative w-full overflow-hidden rounded-2xl bg-ink ${className}`}>
      {info.status !== 'running' && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-[14px] text-white/80">
          {info.status === 'starting' ? t.lab.camera.starting : t.lab.camera.off}
        </div>
      )}
      {overlay && <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-10 h-full w-full object-cover -scale-x-100" />}
    </div>
  );
}

/** Punkty oczu i irysy na podglądzie (laboratorium). Rysowane tylko lokalnie, nigdy nie zapisywane. */
export function drawEyeOverlay(ctx: CanvasRenderingContext2D, f: TrackerFrame): void {
  if (!f.face) return;
  const { irisL, irisR, eyePoints } = f.face.debug;
  ctx.fillStyle = '#F2B705';
  for (const p of eyePoints) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(2, f.width / 400), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = f.face.eyesOpen ? '#2747D6' : '#C03636';
  ctx.lineWidth = Math.max(2, f.width / 500);
  for (const p of [irisL, irisR]) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(4, f.width / 160), 0, Math.PI * 2);
    ctx.stroke();
  }
}
