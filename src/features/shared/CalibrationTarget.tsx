import type { TargetState } from '../../core/calibration/calibration';

/**
 * Cel kalibracji dla dorosłych (§5.5): neutralny punkt z pierścieniem, który kurczy się podczas
 * postoju, żeby skupić wzrok na samym środku. Bez dekoracji („iskierki” były dla dzieci).
 */
export function CalibrationTarget({ state, size = 92 }: { state: TargetState; size?: number }) {
  const ring = state.phase === 'dwell' ? Math.max(0.28, 1 - (state.dwellElapsed / 1200) * 0.72) : 1;
  return (
    <div
      aria-hidden
      data-testid="calibration-target"
      className="pointer-events-none fixed left-0 top-0 z-20"
      style={{ transform: `translate(${state.x * window.innerWidth}px, ${state.y * window.innerHeight}px)` }}
    >
      <div className="relative" style={{ width: size, height: size, transform: 'translate(-50%, -50%)' }}>
        <span
          className="absolute left-1/2 top-1/2 rounded-full border-[3px] border-cobalt transition-[width,height] duration-100"
          style={{ width: size * ring, height: size * ring, transform: 'translate(-50%, -50%)' }}
        />
        <span className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink" />
      </div>
    </div>
  );
}
