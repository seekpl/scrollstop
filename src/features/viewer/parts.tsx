import type { ReactNode } from 'react';
import { BrandMark } from '../../ui/BrandMark';
import { Icon } from '../../ui/kit';

/**
 * Ekran widza: granatowy pasek z logo jak w całym serwisie (bez menu — widz nie wychodzi z badania
 * w trakcie), jasna treść o szerokości do 448 px (zgoda do 672 px), bezpieczne obszary telefonu,
 * 100dvh (§10).
 */
export function Screen({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const width = wide ? 'max-w-[672px]' : 'max-w-[448px]';
  return (
    <div className="flex min-h-dvh-safe flex-col bg-paper text-ink">
      <header className="bg-ink pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)]">
        <div className={`mx-auto flex h-14 items-center px-4 sm:px-5 ${width}`}>
          <BrandMark tone="night" size={26} />
        </div>
      </header>
      <main className={`mx-auto flex w-full flex-1 flex-col px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8 sm:px-5 sm:pt-12 ${width}`}>{children}</main>
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
