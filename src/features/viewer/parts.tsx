import type { ReactNode } from 'react';
import { Icon } from '../../ui/kit';

/** Ekran widza: szerokość do 448 px (zgoda do 672 px), bezpieczne obszary telefonu, 100dvh (§10). */
export function Screen({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="safe-pad min-h-dvh-safe bg-mist text-ink">
      <main className={`mx-auto flex min-h-dvh-safe flex-col px-4 py-8 sm:px-5 sm:py-12 ${wide ? 'max-w-[672px]' : 'max-w-[448px]'}`}>{children}</main>
    </div>
  );
}

/** Duży przycisk (56 px) — główne akcje widza. */
export function BigButton({ children, onClick, disabled, variant = 'primary', type = 'button' }: { children: ReactNode; onClick?(): void; disabled?: boolean; variant?: 'primary' | 'secondary' | 'danger'; type?: 'button' | 'submit' }) {
  const cls = variant === 'primary' ? 'bg-cobalt text-white hover:bg-cobalt-dark' : variant === 'danger' ? 'bg-surface text-poor ring-1 ring-inset ring-poor/40' : 'bg-surface text-ink ring-1 ring-inset ring-field/70';
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`min-h-14 w-full rounded-2xl px-4 py-2 text-[17px] font-semibold leading-snug transition-colors disabled:opacity-40 ${cls}`}>
      {children}
    </button>
  );
}

export function Steps({ items }: { items: Array<[string, string]> }) {
  return (
    <ol className="space-y-4">
      {items.map(([title, body], i) => (
        <li key={title} className="flex gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-[14px] font-bold text-white">{i + 1}</span>
          <span className="min-w-0">
            <span className="block text-[16px] font-semibold">{title}</span>
            <span className="block text-[15px] leading-snug text-muted">{body}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function CheckItem({ ok, warn = false, children }: { ok: boolean; warn?: boolean; children: string }) {
  return (
    <li className="flex items-start gap-3 text-[15px]">
      <span aria-hidden className={`mt-0.5 shrink-0 ${ok ? 'text-good' : warn ? 'text-fair' : 'text-poor'}`}>
        <Icon name={ok ? 'check' : 'alert'} size={20} />
      </span>
      <span>{children}</span>
    </li>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">{children}</h1>;
}
