import { useRef, useState, type KeyboardEvent } from 'react';
import { hrefOf, SAMPLE_IDS, type SampleId } from '../../../app/router';
import { formatTime } from '../../../core/math/util';
import { useI18n } from '../../../i18n';
import { formatPct } from '../../../i18n/format';
import type { CurvePoint } from '../../../research/attention';
import { HeroDemo } from '../HeroDemo';
import { useSampleSummary } from './demoData';
import { RevealText } from './RevealText';

/** Krzywa uwagi przykładu (raport zbiorczy) — mały wykres w karcie. */
function MiniCurve({ curve, duration, label }: { curve: CurvePoint[]; duration: number; label: string }) {
  const pts = curve.filter((p) => p.value !== null).map((p) => `${(((p.t + 0.25) / duration) * 300 + 10).toFixed(1)},${(150 - (p.value as number) * 130).toFixed(1)}`);
  const line = pts.length ? `M${pts.join('L')}` : '';
  const area = pts.length ? `${line}L${pts[pts.length - 1].split(',')[0]},150L${pts[0].split(',')[0]},150Z` : '';
  return (
    <figure className="w-full">
      <svg viewBox="0 0 320 180" className="h-auto w-full" role="img" aria-label={label}>
        {[20, 85, 150].map((y) => (
          <line key={y} x1="10" x2="310" y1={y} y2={y} stroke="#c9d4ce" strokeWidth="1" />
        ))}
        <path d={area} fill="#3debb5" fillOpacity="0.18" />
        <path d={line} fill="none" stroke="#0b8c65" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
        <text x="10" y="172" fontSize="11" fill="#55665e">
          {formatTime(0, 0)}
        </text>
        <text x="310" y="172" fontSize="11" fill="#55665e" textAnchor="end">
          {formatTime(Math.round(duration), 0)}
        </text>
      </svg>
    </figure>
  );
}

function SamplePanel({ id }: { id: SampleId }) {
  const { t, locale } = useI18n();
  const l = t.site.landing;
  const data = useSampleSummary(id, locale);
  const r = data?.report;
  const P = (v: number | null | undefined) => formatPct(v ?? null, locale);
  const stats = r
    ? id === 'feed'
      ? [
          { label: l.sampleStats.stop, value: P(r.feed?.stop) },
          { label: l.sampleStats.mean, value: P(r.meanAttention) },
          { label: l.sampleStats.viewers, value: String(r.viewers) },
        ]
      : [
          { label: l.sampleStats.mean, value: P(r.meanAttention) },
          { label: l.sampleStats.hook, value: P(r.hook.at3) },
          { label: l.sampleStats.viewers, value: String(r.viewers) },
        ]
    : [];
  return (
    <div className="grid overflow-hidden rounded-b-[12px] rounded-tr-[12px] bg-[var(--l-sage-2)] text-[var(--l-pine)] md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-5 p-6 sm:p-8">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-md bg-[#cdeee1] px-2.5 py-1 text-[12.5px] font-semibold text-[#0a6a4c]">{l.sampleKinds[id]}</span>
        <h3 className="text-[24px] font-normal leading-tight tracking-[-0.02em] sm:text-[28px]">{t.site.samplePage.tabs[id]}</h3>
        <p className="min-h-[3em] max-w-[52ch] text-[15.5px] leading-relaxed text-[var(--l-moss)]">{data?.lead ?? ''}</p>
        <dl className="grid grid-cols-3 gap-4 border-t border-[var(--l-sage-line)] pt-5">
          {stats.map((s) => (
            <div key={s.label} className="min-w-0">
              <dt className="text-[12.5px] leading-snug text-[var(--l-moss)]">{s.label}</dt>
              <dd className="tabular mt-1 text-[26px] font-normal tracking-[-0.02em]">{s.value}</dd>
            </div>
          ))}
        </dl>
        <a href={hrefOf({ name: 'sample', sample: id })} className="mt-auto inline-flex min-h-10 w-fit items-center font-semibold text-[var(--l-mint-deep)] underline decoration-[var(--l-mint-deep)]/40 underline-offset-4 hover:decoration-[var(--l-mint-deep)]">
          {l.sampleOpen}
        </a>
      </div>
      <div className="grid min-w-0 place-items-center border-t border-[var(--l-sage-line)] p-6 sm:p-8 md:border-l md:border-t-0">
        {id === 'reel' ? <HeroDemo compact /> : r ? <MiniCurve curve={r.curve} duration={r.duration} label={l.sampleCurve(t.site.samplePage.tabs[id])} /> : <div className="aspect-[16/9] w-full" />}
      </div>
    </div>
  );
}

/**
 * Przykładowe raporty (odpowiednik „historii klientów” z nagrania): zakładki z trzema przykładami
 * z symulowanego panelu. Liczby i zdania liczy ten sam kod co raport twórcy — nic nie jest wpisane
 * na sztywno. Zakładki obsługują strzałki, Home i End.
 */
export function SampleTabs() {
  const { t } = useI18n();
  const l = t.site.landing;
  const [current, setCurrent] = useState<SampleId>('reel');
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onKey = (e: KeyboardEvent) => {
    const i = SAMPLE_IDS.indexOf(current);
    const next = e.key === 'ArrowRight' ? (i + 1) % SAMPLE_IDS.length : e.key === 'ArrowLeft' ? (i - 1 + SAMPLE_IDS.length) % SAMPLE_IDS.length : e.key === 'Home' ? 0 : e.key === 'End' ? SAMPLE_IDS.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    setCurrent(SAMPLE_IDS[next]);
    refs.current[SAMPLE_IDS[next]]?.focus();
  };
  return (
    <section className="l-night relative" aria-labelledby="samples">
      <div className="mx-auto max-w-[1152px] px-4 pb-20 pt-16 sm:px-6 md:pb-28 md:pt-24">
        <div className="mx-auto max-w-[760px] text-center">
          <RevealText id="samples" tone="night" text={l.samplesTitle} className="text-[30px] font-normal leading-[1.12] tracking-[-0.03em] sm:text-[40px]" />
          <p className="mx-auto mt-4 max-w-[60ch] text-[16px] leading-relaxed text-white/70">{l.samplesLead}</p>
        </div>
        <div className="mt-10">
          <div role="tablist" aria-label={t.site.samplePage.tabsLabel} className="grid grid-cols-3 overflow-hidden rounded-t-[12px] border border-b-0 border-white/12" onKeyDown={onKey}>
            {SAMPLE_IDS.map((id) => {
              const on = id === current;
              return (
                <button
                  key={id}
                  ref={(el) => {
                    refs.current[id] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`tab-${id}`}
                  aria-selected={on}
                  aria-controls={`panel-${id}`}
                  aria-label={t.site.samplePage.tabs[id]}
                  tabIndex={on ? 0 : -1}
                  onClick={() => setCurrent(id)}
                  className={`flex min-h-14 min-w-0 items-center justify-center gap-2 border-white/12 px-2 text-[13.5px] font-semibold transition-colors sm:text-[15px] [&:not(:first-child)]:border-l ${on ? 'bg-[var(--l-sage-2)] text-[var(--l-pine)]' : 'bg-white/[0.03] text-white/75 hover:bg-white/[0.07] hover:text-white'}`}
                >
                  <span className="min-w-0 truncate sm:hidden">{l.sampleKinds[id]}</span>
                  <span className="hidden min-w-0 truncate sm:inline">{t.site.samplePage.tabs[id]}</span>
                </button>
              );
            })}
          </div>
          <div role="tabpanel" id={`panel-${current}`} aria-labelledby={`tab-${current}`} tabIndex={0}>
            <SamplePanel key={current} id={current} />
          </div>
        </div>
      </div>
    </section>
  );
}
