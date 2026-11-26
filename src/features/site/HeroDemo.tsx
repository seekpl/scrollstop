import { useEffect, useMemo, useRef, useState } from 'react';
import { pathOf } from '../../app/router';
import { DEMO_SPECS, drawDemoScene } from '../../demo/demoScene';
import { useI18n } from '../../i18n';
import { formatPct } from '../../i18n/format';
import { RESEARCH_TEXT } from '../../i18n/research';
import type { CurvePoint } from '../../research/attention';
import { demoProject } from '../../research/panelSim';
import { buildVariantReport, headline } from '../../research/report';
import { TOKENS } from '../../ui/tokens';

const W = 270;
const H = 480;
/** Pasmo krzywej na klipie (ułamek wysokości): 1.0 uwagi u góry pasma, 0 u dołu. */
const BAND_TOP = 0.5;
const BAND_BOTTOM = 0.86;

interface DemoData {
  curve: CurvePoint[];
  viewers: number;
  lead: string;
  duration: number;
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

function valueAt(curve: CurvePoint[], t: number): number | null {
  let v: number | null = null;
  for (const p of curve) {
    if (p.t > t) break;
    if (p.value !== null) v = p.value;
  }
  return v;
}

function pathFor(curve: CurvePoint[], duration: number, upTo: number): string {
  let d = '';
  for (const p of curve) {
    if (p.value === null || p.t > upTo) continue;
    const x = (Math.min(p.t, duration) / duration) * 100;
    const y = (BAND_TOP + (1 - p.value) * (BAND_BOTTOM - BAND_TOP)) * 100;
    d += `${d ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`;
  }
  return d;
}

/**
 * Pierwszy ekran strony głównej (§19.7): pionowy klip demo z krzywą uwagi rysowaną na bieżąco.
 * Krzywa i podpis liczą się z symulowanego panelu (`demoProject`), więc liczby pochodzą z danych.
 * Przy `prefers-reduced-motion` klip stoi na kadrze spadku, a krzywa jest pełna.
 */
export function HeroDemo({ compact = false }: { compact?: boolean } = {}) {
  const { t, locale } = useI18n();
  const l = t.site.landing;
  const canvas = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState<DemoData | null>(null);
  const [now, setNow] = useState(0);
  const spec = DEMO_SPECS.reel;

  // Symulacja panelu po pierwszym malowaniu, żeby nie opóźniać wejścia na stronę.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const tx = RESEARCH_TEXT[locale];
      const { project, sessions } = demoProject('reel', tx, { createdAt: '2026-01-01T00:00:00.000Z' });
      const r = buildVariantReport(project, project.variants[0], sessions, tx, { includeSimulated: true });
      setData({ curve: r.curve, viewers: r.viewers, lead: headline(r, tx).lead, duration: r.duration });
    }, 0);
    return () => window.clearTimeout(id);
  }, [locale]);

  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = W * dpr;
    c.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (reducedMotion()) {
      drawDemoScene(ctx, 3, W, H, spec);
      setNow(spec.duration);
      return;
    }
    let raf = 0;
    const start = performance.now();
    let last = -1;
    const loop = (ts: number) => {
      // Znacznik klatki rAF bywa wcześniejszy niż `start` — czas ujemny przycinamy do 0.
      const time = (Math.max(0, ts - start) / 1000) % (spec.duration + 1.5);
      const tt = Math.min(time, spec.duration);
      drawDemoScene(ctx, tt, W, H, spec);
      // Stan Reacta tylko 10× na sekundę — krzywa i etykieta nie muszą odświeżać się co klatkę.
      const q = Math.floor(tt * 10);
      if (q !== last) {
        last = q;
        setNow(tt);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [spec]);

  const path = useMemo(() => (data ? pathFor(data.curve, data.duration, now) : ''), [data, now]);
  const current = data ? valueAt(data.curve, now) : null;
  const headX = data ? (Math.min(now, data.duration) / data.duration) * 100 : 0;
  const headY = current !== null ? (BAND_TOP + (1 - current) * (BAND_BOTTOM - BAND_TOP)) * 100 : null;

  return (
    <figure className={`mx-auto w-full ${compact ? 'max-w-[236px]' : 'max-w-[300px]'}`}>
      <div className="relative overflow-hidden rounded-[30px] bg-ink p-2.5 shadow-[0_24px_48px_-24px_rgba(31,42,68,0.55)]">
        <div className="relative overflow-hidden rounded-[22px]" style={{ aspectRatio: `${W} / ${H}` }}>
          <canvas ref={canvas} className="absolute inset-0 h-full w-full" role="img" aria-label={l.demoAlt} />
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden focusable="false">
            <rect x="0" y={BAND_TOP * 100 - 4} width="100" height={(BAND_BOTTOM - BAND_TOP) * 100 + 8} fill={TOKENS.ink} opacity="0.38" />
            <path d={path} fill="none" stroke={TOKENS.ink} vectorEffect="non-scaling-stroke" strokeLinejoin="round" style={{ strokeWidth: 7 }} />
            <path d={path} fill="none" stroke={TOKENS.marker} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" style={{ strokeWidth: 4 }} />
          </svg>
          {headY !== null && (
            <span aria-hidden className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-marker ring-[3px] ring-ink" style={{ left: `${headX}%`, top: `${headY}%` }} />
          )}
          {current !== null && (
            <span className="tabular absolute left-3 top-3 rounded-full bg-ink/85 px-2.5 py-1 text-[12.5px] font-semibold text-white" aria-hidden>
              {l.demoNow(formatPct(current, locale))}
            </span>
          )}
        </div>
      </div>
      <figcaption className="mt-4 space-y-1.5 text-[13.5px] leading-snug text-muted">
        {data ? (
          <>
            {!compact && <span className="block font-semibold text-ink">{data.lead}</span>}
            <span className="block">{l.demoLabel(data.viewers)}</span>
          </>
        ) : (
          <span className="block h-10" />
        )}
        {/* W karcie przykładu (strona główna) link do raportu jest obok — tu go nie powtarzamy. */}
        {!compact && (
          <a href={pathOf({ name: 'sample', sample: 'reel' })} className="inline-flex min-h-9 items-center font-semibold text-cobalt underline underline-offset-4">
            {l.demoLink}
          </a>
        )}
      </figcaption>
    </figure>
  );
}
