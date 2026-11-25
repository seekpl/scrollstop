import { useEffect, useRef } from 'react';
import type { DisplayGaze } from '../../core/pipeline/types';
import type { Emitter } from './emitter';

/**
 * Marker wzroku. Aktualizuje DOM bezpośrednio (bez re-renderów React) przy ~30 Hz.
 * Okrąg = niepewność (2σ); niska pewność → marker przerywany i bledszy.
 */
export function GazeMarker({
  bus,
  visible,
  size = 44,
  color = '#F2B705',
}: {
  bus: Emitter<DisplayGaze | null>;
  visible: boolean;
  size?: number;
  color?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(
    () =>
      bus.on((d) => {
        const el = ref.current;
        const ring = ringRef.current;
        if (!el || !ring) return;
        if (!d || !visible) {
          el.style.opacity = '0';
          return;
        }
        const W = window.innerWidth;
        const H = window.innerHeight;
        el.style.transform = `translate(${d.x * W}px, ${d.y * H}px)`;
        el.style.opacity = String(0.35 + 0.65 * Math.min(1, d.confidence / 0.8));
        const r = Math.min(0.4 * Math.min(W, H), Math.max(size * 0.7, d.uncertainty * 2 * ((W + H) / 2)));
        ring.style.width = `${2 * r}px`;
        ring.style.height = `${2 * r}px`;
        ring.style.borderStyle = d.dashed ? 'dashed' : 'solid';
      }),
    [bus, visible, size],
  );

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-40 transition-[transform,opacity] duration-75 ease-out"
      style={{ opacity: 0 }}
    >
      <div
        ref={ringRef}
        className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
        style={{ borderColor: color, backgroundColor: `${color}1A` }}
      />
      <div className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2" style={{ width: size, height: size }}>
        <span className="absolute left-1/2 top-1/2 h-full w-full animate-pulse-ring rounded-full border-2" style={{ borderColor: color }} />
        <svg viewBox="0 0 40 40" width={size} height={size} className="relative drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
          <line x1="20" y1="4" x2="20" y2="36" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
          <line x1="4" y1="20" x2="36" y2="20" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="20" cy="20" r="3.5" fill="#1F2A44" />
        </svg>
      </div>
    </div>
  );
}
