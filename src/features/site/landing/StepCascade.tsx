import { useEffect, useState } from 'react';
import { prefersReducedMotion } from './demoData';

/** Położenie kart w pudełku 100 × 100 (%): lewe ramię „V” schodzi ukośnie, prawe wznosi się. */
const ARM = [
  { left: 4, top: 3 },
  { left: 12, top: 21 },
  { left: 20, top: 39 },
  { left: 28, top: 57 },
  { left: 36, top: 75 },
];
const RIGHT = [
  { left: 70, top: 57 },
  { left: 75, top: 39 },
  { left: 80, top: 21 },
];
const CARD_W = 34;
const CARD_H = 14;

/**
 * Przebieg badania jako ukośna kaskada (schemat „V” z nagrania): pięć kroków od materiału do scen
 * do poprawy. Podświetlenie przechodzi po krokach co 1,9 s; przy „ogranicz ruch” stoi na krzywej
 * uwagi. Prawe ramię to sam kontur — nie niesie treści.
 */
export function StepCascade({ steps, label }: { steps: string[]; label: string }) {
  const [active, setActive] = useState(3);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    setActive(0);
    const timer = window.setInterval(() => setActive((a) => (a + 1) % steps.length), 1900);
    return () => window.clearInterval(timer);
  }, [steps.length]);
  return (
    <div className="relative mx-auto aspect-[560/400] w-full max-w-[560px]">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden focusable="false">
        {ARM.slice(0, -1).map((p, i) => {
          const n = ARM[i + 1];
          return <line key={i} x1={p.left + CARD_W * 0.62} y1={p.top + CARD_H} x2={n.left + CARD_W * 0.5} y2={n.top} stroke={i < active ? '#a3b4ff' : '#ffffff'} strokeOpacity={i < active ? 0.7 : 0.18} strokeWidth="1" vectorEffect="non-scaling-stroke" />;
        })}
        <path d={`M${ARM[4].left + CARD_W - 2} ${ARM[4].top}L${RIGHT[0].left + 3} ${RIGHT[0].top + CARD_H}`} stroke="#fff" strokeOpacity="0.14" strokeWidth="1" vectorEffect="non-scaling-stroke" fill="none" />
      </svg>
      <ol aria-label={label} className="absolute inset-0">
        {steps.map((s, i) => (
          <li
            key={s}
            data-active={i === active}
            className="l-step absolute grid place-items-center rounded-[5px] border border-white/15 bg-white/[0.035] text-white/70"
            style={{ left: `${ARM[i].left}%`, top: `${ARM[i].top}%`, width: `${CARD_W}%`, height: `${CARD_H}%` }}
          >
            <span className="block px-3 text-center text-[clamp(11px,1.6vw,13.5px)] font-medium leading-tight">{s}</span>
          </li>
        ))}
      </ol>
      {RIGHT.map((p, i) => (
        <span key={i} aria-hidden className="l-step absolute rounded-[5px] border border-white/10" style={{ left: `${p.left}%`, top: `${p.top}%`, width: `${CARD_W * 0.5}%`, height: `${CARD_H}%`, opacity: 0.8 - i * 0.2 }} />
      ))}
    </div>
  );
}
