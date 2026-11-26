import type { ReactNode } from 'react';

/**
 * Ciemny nagłówek podstrony w wyglądzie strony głównej: poświata, siatka, tytuł z jednorazowym
 * miętowym błyskiem. Wchodzi pod przezroczysty nagłówek serwisu (`-mt-16`).
 */
export function PageIntro({ title, lead, children, narrow = false }: { title: string; lead?: ReactNode; children?: ReactNode; narrow?: boolean }) {
  return (
    <section className="l-night relative -mt-16 overflow-hidden pt-16">
      <div aria-hidden className="l-glow pointer-events-none absolute inset-0" />
      <div aria-hidden className="l-grid pointer-events-none absolute inset-0" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-[var(--l-night)]" />
      <div className={`relative mx-auto px-4 pb-12 pt-12 sm:px-6 md:pb-16 md:pt-20 ${narrow ? 'max-w-[808px]' : 'max-w-[1152px]'}`}>
        <h1 className="max-w-[22ch] text-[36px] font-normal leading-[1.06] tracking-[-0.035em] md:text-[52px]">
          <span className="l-sweep l-sweep-white">{title}</span>
        </h1>
        {lead && <div className="mt-5 max-w-[62ch] text-[16.5px] leading-relaxed text-white/75">{lead}</div>}
        {children}
      </div>
    </section>
  );
}
