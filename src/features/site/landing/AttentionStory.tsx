import { useEffect, useRef, useState } from 'react';
import { pathOf } from '../../../app/router';
import { formatTime } from '../../../core/math/util';
import { useI18n } from '../../../i18n';
import { PLANS } from '../../../research/plans';
import { MomentIcon } from './art';
import { prefersReducedMotion, useSampleSummary } from './demoData';

const VW = 1000;
const VH = 400;
const DRAW_MS = 2400;

interface Moment {
  kind: 'hook' | 'drop' | 'end';
  t: number;
  value: number;
  label: string;
}

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

/**
 * Fakty o pomiarze i duża krzywa uwagi rolki demo (odpowiednik siatki liczb i krzywej z ikonami
 * z nagrania). Fakty pochodzą z konfiguracji produktu, krzywa i momenty z raportu symulowanego
 * panelu. Krzywa rysuje się, gdy wykres wejdzie w widok; momenty pojawiają się, gdy linia do nich
 * dojdzie. Przy „ogranicz ruch” wykres jest od razu pełny.
 */
export function AttentionStory() {
  const { t, locale } = useI18n();
  const l = t.site.landing;
  const data = useSampleSummary('reel', locale);
  const box = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = box.current;
    if (!el || !data) return;
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      setProgress(1);
      return;
    }
    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const start = performance.now();
        const step = (now: number) => {
          const x = Math.min(1, Math.max(0, now - start) / DRAW_MS);
          setProgress(ease(x));
          if (x < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [data]);

  const r = data?.report;
  const duration = r?.duration ?? 1;
  const px = (tt: number) => (Math.min(Math.max(tt, 0), duration) / duration) * VW;
  const py = (v: number) => (1 - v) * (VH - 24) + 12;
  const pts = (r?.curve ?? []).filter((p) => p.value !== null).map((p) => [px(p.t + r!.bin / 2), py(p.value as number)] as const);
  const line = pts.length ? `M${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L')}` : '';
  const area = pts.length ? `${line}L${pts[pts.length - 1][0].toFixed(1)},${VH}L${pts[0][0].toFixed(1)},${VH}Z` : '';

  const pct = (v: number) => Math.round(v * 100);
  const moments: Moment[] = [];
  if (r) {
    if (r.hook.at3 !== null) moments.push({ kind: 'hook', t: 3, value: r.hook.at3, label: l.markHook(pct(r.hook.at3)) });
    const biggest = [...r.drops].sort((a, b) => b.delta - a.delta)[0];
    if (biggest) moments.push({ kind: 'drop', t: biggest.end, value: biggest.to, label: l.markDrop(pct(biggest.delta)) });
    if (r.endAttention !== null) moments.push({ kind: 'end', t: Math.max(0, duration - 1.5), value: r.endAttention, label: l.markEnd(pct(r.endAttention)) });
  }
  // Etykiety: pod punktem przy wysokiej wartości, nad nim przy niskiej; sąsiednie (bliżej niż 16%
  // szerokości) trafiają na przeciwne strony, żeby się nie nakładały.
  const placed = moments
    .slice()
    .sort((a, b) => a.t - b.t)
    .reduce<Array<Moment & { below: boolean }>>((acc, m) => {
      const prev = acc[acc.length - 1];
      let below = m.value > 0.55;
      if (prev && (px(m.t) - px(prev.t)) / VW < 0.16 && prev.below === below) below = !below;
      acc.push({ ...m, below });
      return acc;
    }, []);
  const facts = [l.facts.rate, l.facts.frames, l.facts.versions(PLANS.pro.maxVariants), l.facts.adults];

  return (
    <section id="krzywa" className="l-sage scroll-mt-20" aria-labelledby="story">
      <div className="mx-auto max-w-[1152px] px-4 py-16 sm:px-6 md:py-24">
        <div className="overflow-hidden rounded-[14px] border border-[var(--l-sage-line)] bg-[var(--l-sage)]">
          <div className="grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-5 p-6 sm:p-8">
              <span className="inline-flex w-fit items-center rounded-md bg-[#cdeee1] px-2.5 py-1 text-[12.5px] font-semibold text-[#0a6a4c]">{l.storyChip}</span>
              <h2 id="story" className="text-[26px] font-normal leading-tight tracking-[-0.025em] sm:text-[32px]">
                {l.chartTitle}
              </h2>
              <p className="min-h-[3em] max-w-[56ch] text-[15.5px] leading-relaxed text-[var(--l-moss)]">{data?.detail ?? ''}</p>
              <a href={pathOf({ name: 'new-project' })} className="l-btn l-btn-mint mt-auto w-fit">
                {t.site.hero.ctaPrimary}
              </a>
            </div>
            <ul className="grid grid-cols-2 border-t border-[var(--l-sage-line)] md:border-l md:border-t-0">
              {facts.map((f, i) => (
                <li key={f.label} className={`min-w-0 p-5 sm:p-7 ${i % 2 ? 'border-l border-[var(--l-sage-line)]' : ''} ${i > 1 ? 'border-t border-[var(--l-sage-line)]' : ''}`}>
                  <span className="tabular block text-[30px] font-normal tracking-[-0.03em] sm:text-[36px]">{f.value}</span>
                  <span className="mt-1 block text-[13.5px] leading-snug text-[var(--l-moss)]">{f.label}</span>
                </li>
              ))}
            </ul>
          </div>

          <div ref={box} className="grid grid-cols-[40px_minmax(0,1fr)] border-t border-[var(--l-sage-line)] sm:grid-cols-[52px_minmax(0,1fr)]">
            <div className="grid grid-rows-[auto_1fr_auto] border-r border-[var(--l-sage-line)] text-[12px] text-[var(--l-moss)]" aria-hidden>
              <span className="border-b border-[var(--l-sage-line)] py-4 text-center [writing-mode:vertical-rl] rotate-180">{l.chartHigh}</span>
              <span className="grid place-items-center py-3 font-semibold text-[var(--l-pine)] [writing-mode:vertical-rl] rotate-180">{l.chartY}</span>
              <span className="border-t border-[var(--l-sage-line)] py-4 text-center [writing-mode:vertical-rl] rotate-180">{l.chartLow}</span>
            </div>
            <div className="relative h-[280px] min-w-0 sm:h-[380px]">
              <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" role="img" aria-label={data ? `${l.chartTitle}: ${data.lead}` : l.chartTitle}>
                <defs>
                  <linearGradient id="l-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#3debb5" stopOpacity="0.32" />
                    <stop offset="1" stopColor="#3debb5" stopOpacity="0" />
                  </linearGradient>
                  <clipPath id="l-reveal">
                    <rect x="0" y="0" width={VW * progress} height={VH} />
                  </clipPath>
                </defs>
                {[0.25, 0.5, 0.75].map((v) => (
                  <line key={v} x1="0" x2={VW} y1={py(v)} y2={py(v)} stroke="#c9d4ce" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />
                ))}
                <path d={area} fill="url(#l-area)" clipPath="url(#l-reveal)" />
                <path d={line} fill="none" stroke="#0b8c65" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" clipPath="url(#l-reveal)" />
              </svg>
              {placed.map((m) => {
                const x = (px(m.t) / VW) * 100;
                const y = (py(m.value) / VH) * 100;
                const shown = progress >= px(m.t) / VW - 0.001;
                const align = x < 18 ? 'left-0' : x > 82 ? 'right-0' : 'left-1/2 -translate-x-1/2';
                return (
                  <div key={m.kind} aria-hidden className="pointer-events-none absolute" style={{ left: `${x}%`, top: `${y}%` }}>
                    <span className={`absolute left-0 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--l-sage)] bg-[var(--l-mint-ink)] transition-[opacity,transform] duration-500 ${shown ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`} />
                    <span
                      className={`absolute ${align} flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-[var(--l-pine)] px-2.5 py-1.5 text-[12.5px] font-semibold text-white shadow-[0_8px_20px_-10px_rgba(16,36,28,0.6)] transition-[opacity,transform] duration-500 ${m.below ? 'top-4' : 'bottom-4'} ${shown ? 'translate-y-0 opacity-100' : `${m.below ? '-translate-y-1' : 'translate-y-1'} opacity-0`}`}
                    >
                      <span className="text-[var(--l-mint)]">
                        <MomentIcon kind={m.kind} />
                      </span>
                      {m.label}
                    </span>
                  </div>
                );
              })}
            </div>
            <span aria-hidden className="border-r border-t border-[var(--l-sage-line)]" />
            <div className="grid grid-cols-[auto_1fr_auto] border-t border-[var(--l-sage-line)] text-[12.5px] text-[var(--l-moss)]" aria-hidden>
              <span className="tabular border-r border-[var(--l-sage-line)] px-4 py-3">{formatTime(0, 0)}</span>
              <span className="py-3 text-center font-semibold text-[var(--l-pine)]">{l.chartX}</span>
              <span className="tabular border-l border-[var(--l-sage-line)] px-4 py-3">{formatTime(Math.round(duration), 0)}</span>
            </div>
          </div>
          {/* Momenty także jako tekst (czytniki ekranu, druk). */}
          <ul className="sr-only">
            {moments.map((m) => (
              <li key={m.kind}>{`${formatTime(Math.floor(m.t), 0)}: ${m.label}`}</li>
            ))}
          </ul>
        </div>
        <p className="mt-5 max-w-[80ch] text-[13.5px] leading-relaxed text-[var(--l-moss)]">{l.accuracyNote}</p>
      </div>
    </section>
  );
}
