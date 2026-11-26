import type { ReactNode } from 'react';

/**
 * Granatowy pas z tytułem podstrony — wspólny dla strony, studia, raportu z linku i usuwania
 * danych: poświata, siatka, tytuł (na stronie publicznej z jednorazowym jasnym błyskiem).
 * Wchodzi pod przezroczysty nagłówek serwisu (`-mt-16`).
 *
 * `compact` — wersja dla studia: niższy pas, mniejszy tytuł, bez błysku przy każdym przejściu.
 * `top` — wiersz nad tytułem (okruszki, plan); `actions` — przyciski obok tytułu.
 */
export function PageIntro({
  title,
  lead,
  children,
  narrow = false,
  compact = false,
  top,
  actions,
}: {
  title?: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
  narrow?: boolean;
  compact?: boolean;
  top?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="l-night relative -mt-16 overflow-hidden pt-16 print:mt-0 print:pt-0">
      <div aria-hidden className="no-print l-glow pointer-events-none absolute inset-0" />
      <div aria-hidden className="no-print l-grid pointer-events-none absolute inset-0" />
      <div aria-hidden className="no-print pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-[var(--l-night)]" />
      <div className={`relative mx-auto px-4 sm:px-6 ${compact ? 'pb-8 pt-6 md:pb-10 md:pt-8' : 'pb-12 pt-12 md:pb-16 md:pt-20'} ${narrow ? 'max-w-[808px]' : 'max-w-[1152px]'}`}>
        {top}
        {(title || lead || actions) && (
          <div className={`${top ? 'mt-5' : ''} ${actions ? 'flex flex-col gap-5 md:flex-row md:items-end md:justify-between' : ''}`}>
            <div className="min-w-0">
              {title &&
                (compact ? (
                  <h1 className="max-w-[30ch] text-[30px] font-normal leading-[1.1] tracking-[-0.03em] md:text-[40px]">{title}</h1>
                ) : (
                  <h1 className="max-w-[22ch] text-[36px] font-normal leading-[1.06] tracking-[-0.035em] md:text-[52px]">
                    <span className="l-sweep l-sweep-white">{title}</span>
                  </h1>
                ))}
              {lead && <div className={`max-w-[62ch] leading-relaxed text-white/75 ${compact ? 'mt-3 text-[15.5px]' : 'mt-5 text-[16.5px]'}`}>{lead}</div>}
            </div>
            {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
