import { useEffect, useId, useRef, useState, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { useT } from '../i18n';

export { LanguageSelect } from '../i18n';

/**
 * Komponenty studia, strony i raportu (§19.3). Spokojna hierarchia: jedna akcja główna na ekran,
 * cienkie linie zamiast cieni, zaokrąglenia zależne od roli (kontrolki 10 px, karty 16 px).
 * Etykiety przycisków to czasowniki („Utwórz projekt”), nigdy „OK”.
 */
type Variant = 'primary' | 'secondary' | 'quiet' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const BTN_V: Record<Variant, string> = {
  primary: 'bg-cobalt text-white hover:bg-cobalt-dark',
  secondary: 'bg-surface text-ink ring-1 ring-inset ring-field/70 hover:ring-ink/50',
  quiet: 'text-ink hover:bg-ink/[0.06]',
  danger: 'text-poor ring-1 ring-inset ring-poor/40 hover:bg-poor/[0.06]',
};
// Wysokość jako minimum: długie etykiety łamią się na wąskim ekranie zamiast wychodzić poza niego (§24).
const BTN_S: Record<Size, string> = {
  sm: 'min-h-8 px-3 py-1 text-[13px]',
  md: 'min-h-10 px-4 py-1.5 text-[14px]',
  lg: 'min-h-12 px-5 py-2 text-[15px]',
};
export const btnClass = (v: Variant, s: Size, extra = '') =>
  `inline-flex items-center justify-center gap-2 rounded-[10px] text-center font-semibold leading-snug whitespace-normal transition-colors disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40 ${BTN_V[v]} ${BTN_S[s]} ${extra}`;

export function Btn({ variant = 'secondary', size = 'md', className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type="button" className={btnClass(variant, size, className)} {...rest} />;
}

export function LinkBtn({ variant = 'secondary', size = 'md', className = '', ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant; size?: Size }) {
  return <a className={btnClass(variant, size, className)} {...rest} />;
}

export function Section({ title, aside, children, className = '', id }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`print-avoid min-w-0 ${className}`}>
      {(title || aside) && (
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          {title && <h2 className="text-[21px] font-semibold tracking-[-0.01em] text-ink sm:text-[24px]">{title}</h2>}
          {aside && <div className="text-[13px] text-muted">{aside}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Karta dla grupy kontrolek; nie każdy blok treści potrzebuje ramki. */
export function Surface({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`min-w-0 rounded-2xl bg-surface p-4 ring-1 ring-line sm:p-6 ${className}`}>{children}</div>;
}

export type Tone = 'neutral' | 'good' | 'fair' | 'poor' | 'info' | 'marker';
/*
 * Tło odznak mieszane z bielą (nie przezroczyste): kontrast tekstu ≥ 4,5:1 niezależnie od tła pod
 * spodem (szare tło strony obniżało go do 4,4:1, §19.6).
 */
const TONE: Record<Tone, string> = {
  neutral: 'bg-ink/[0.06] text-ink',
  good: 'bg-[color-mix(in_srgb,var(--color-good)_10%,white)] text-good',
  fair: 'bg-[color-mix(in_srgb,var(--color-fair)_10%,white)] text-fair',
  poor: 'bg-[color-mix(in_srgb,var(--color-poor)_10%,white)] text-poor',
  info: 'bg-[color-mix(in_srgb,var(--color-cobalt)_10%,white)] text-cobalt',
  marker: 'bg-marker/25 text-ink',
};

export function Badge({ tone = 'neutral', children, icon }: { tone?: Tone; children: ReactNode; icon?: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[12.5px] font-semibold ${TONE[tone]}`}>
      {icon}
      {children}
    </span>
  );
}

export function Callout({ tone = 'info', title, children, action }: { tone?: 'info' | 'warn' | 'locked'; title?: ReactNode; children?: ReactNode; action?: ReactNode }) {
  const cls = tone === 'warn' ? 'bg-fair/[0.08] ring-fair/25' : tone === 'locked' ? 'bg-ink/[0.03] ring-line' : 'bg-cobalt/[0.05] ring-cobalt/15';
  return (
    <div role={tone === 'warn' ? 'note' : undefined} className={`flex flex-col gap-3 rounded-xl px-4 py-3.5 ring-1 ring-inset sm:flex-row sm:items-center sm:justify-between ${cls}`}>
      <div className="flex min-w-0 gap-2.5 text-[14px] leading-relaxed text-ink">
        {tone !== 'info' && (
          <span className={`mt-0.5 shrink-0 ${tone === 'warn' ? 'text-fair' : 'text-muted'}`}>
            <Icon name={tone === 'warn' ? 'alert' : 'lock'} size={17} />
          </span>
        )}
        <div className="min-w-0">
          {title && <div className="font-semibold">{title}</div>}
          {children && <div className={title ? 'mt-0.5 text-muted' : ''}>{children}</div>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Pole z etykietą widoczną zawsze; podpowiedź i błąd powiązane przez `aria-describedby`. */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: (id: string, describedBy: string | undefined) => ReactNode;
}) {
  const id = useId();
  const hintId = hint || error ? `${id}-hint` : undefined;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-[13.5px] font-semibold text-ink">
        {label}
      </label>
      {children(id, hintId)}
      {(hint || error) && (
        <p id={hintId} className={`text-[12.5px] leading-snug ${error ? 'font-semibold text-poor' : 'text-muted'}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  'h-10 w-full min-w-0 rounded-[10px] bg-surface px-3 text-[14px] text-ink ring-1 ring-inset ring-field placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-cobalt';

/** Wybór jednej opcji jako karty radiowe (np. rodzaj badania). Strzałki przesuwają wybór. */
export function ChoiceCards<T extends string>({
  value,
  onChange,
  options,
  label,
  columns = 3,
}: {
  value: T;
  onChange(v: T): void;
  options: Array<{ value: T; title: string; body?: string; visual?: ReactNode; disabled?: boolean; badge?: ReactNode }>;
  label: string;
  columns?: 2 | 3;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    for (let k = 1; k <= options.length; k++) {
      const j = (i + d * k + options.length) % options.length;
      if (!options[j].disabled) {
        onChange(options[j].value);
        refs.current[j]?.focus();
        return;
      }
    }
  };
  return (
    <div role="radiogroup" aria-label={label} className={`grid gap-2 ${columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={`flex min-w-0 items-start gap-3 rounded-xl p-3.5 text-left ring-inset transition-colors disabled:opacity-50 ${on ? 'bg-cobalt/[0.06] ring-2 ring-cobalt' : 'bg-surface ring-1 ring-field/60 hover:ring-ink/40'}`}
          >
            {o.visual}
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-ink">
                {o.title}
                {o.badge}
              </span>
              {o.body && <span className="mt-0.5 block text-[13px] leading-snug text-muted">{o.body}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Przełącznik segmentowy (np. Otwarte / Wstrzymane / Zamknięte). */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ value: T; label: string }>; onChange(v: T): void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex max-w-full flex-wrap gap-1 rounded-xl bg-ink/[0.05] p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`min-h-8 rounded-lg px-3 text-[13.5px] font-semibold transition-colors ${o.value === value ? 'bg-surface text-ink shadow-sm ring-1 ring-line' : 'text-muted hover:text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Kroki projektu (Przygotuj, Zbierz, Raport…) z licznikiem. */
/** Kroki projektu; `tone="night"` — w granatowym pasie z tytułem. */
export function Stepper({ steps, current, label, tone = 'light' }: { steps: Array<{ id: string; title: string; href?: string; count?: ReactNode }>; current: string; label: string; tone?: 'light' | 'night' }) {
  const night = tone === 'night';
  return (
    <nav aria-label={label} className="-mx-1 relative overflow-x-auto">
      <ol className="flex min-w-max gap-1 px-1">
        {steps.map((s, i) => {
          const on = s.id === current;
          const inner = (
            <>
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold ${on ? 'bg-cobalt text-white' : night ? 'bg-white/[0.12] text-white' : 'bg-ink/[0.07] text-ink'}`}>{i + 1}</span>
              <span>{s.title}</span>
              {s.count !== undefined && <span className={`tabular ${on || !night ? 'text-muted' : 'text-white/65'}`}>{s.count}</span>}
            </>
          );
          const cls = `flex min-h-10 items-center gap-2 rounded-[10px] px-3 text-[14px] font-semibold ${on ? 'bg-surface text-ink ring-1 ring-line' : night ? 'text-white/80 ring-1 ring-inset ring-white/15 hover:bg-white/[0.07] hover:text-white' : 'text-muted hover:text-ink'}`;
          return (
            <li key={s.id}>
              {s.href ? (
                <a href={s.href} aria-current={on ? 'step' : undefined} className={cls}>
                  {inner}
                </a>
              ) : (
                <span aria-current={on ? 'step' : undefined} className={cls}>
                  {inner}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const p = Math.max(0, Math.min(1, max ? value / max : 0));
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className="h-2 w-full overflow-hidden rounded-full bg-cobalt/15">
      <div className="h-full rounded-full bg-cobalt transition-[width] duration-500" style={{ width: `${p * 100}%` }} />
    </div>
  );
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Okno dialogowe: pułapka fokusu, Esc zamyka, fokus wraca do elementu, który je otworzył. */
export function Dialog({ open, onClose, title, children, wide = false }: { open: boolean; onClose(): void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const t = useT();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab' || !ref.current) return;
      const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!items.length) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-[80] flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-2xl outline-none sm:rounded-2xl sm:p-6 ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-[20px] font-semibold tracking-[-0.01em] text-ink">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label={t.ui.close} className="-m-2 grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-ink/[0.06] hover:text-ink">
            <Icon name="close" size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Pole tylko do odczytu z przyciskiem kopiowania (link do badania, gotowe wiadomości). */
export function CopyField({ value, label, multiline = false }: { value: string; label: string; multiline?: boolean }) {
  const t = useT();
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle');
  const id = useId();
  useEffect(() => {
    if (state === 'idle') return;
    const h = setTimeout(() => setState('idle'), 2200);
    return () => clearTimeout(h);
  }, [state]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState('done');
    } catch {
      setState('failed');
    }
  };
  const cls = `${inputClass} font-mono text-[13px]`;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-[13.5px] font-semibold text-ink">
        {label}
      </label>
      <div className="flex min-w-0 gap-2">
        {multiline ? (
          <textarea id={id} readOnly value={value} rows={3} className={`${cls} h-auto py-2 font-sans text-[14px]`} onFocus={(e) => e.currentTarget.select()} />
        ) : (
          <input id={id} readOnly value={value} className={cls} onFocus={(e) => e.currentTarget.select()} />
        )}
        <Btn onClick={copy} className="shrink-0 self-start" aria-label={`${t.common.actions.copy}: ${label}`}>
          <Icon name={state === 'done' ? 'check' : 'copy'} size={16} />
          <span className="hidden sm:inline">{state === 'done' ? t.common.actions.copied : t.common.actions.copy}</span>
        </Btn>
      </div>
      <p aria-live="polite" className="min-h-[1em] text-[12.5px] text-muted">
        {state === 'done' ? t.ui.copyDone : state === 'failed' ? t.ui.copyFailed : ''}
      </p>
    </div>
  );
}

export function Empty({ title, children, action }: { title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-field/60 px-5 py-12 text-center">
      <h3 className="text-[17px] font-semibold text-ink">{title}</h3>
      {children && <p className="mx-auto mt-2 max-w-[52ch] text-[14px] leading-relaxed text-muted">{children}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function KeyValue({ items }: { items: Array<{ k: ReactNode; v: ReactNode }> }) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 text-[14px]">
      {items.map((it, i) => (
        <div key={i} className="contents">
          <dt className="text-muted">{it.k}</dt>
          <dd className="min-w-0 font-medium break-words text-ink">{it.v}</dd>
        </div>
      ))}
    </dl>
  );
}

export type IconName =
  | 'check'
  | 'alert'
  | 'lock'
  | 'phone'
  | 'monitor'
  | 'grid'
  | 'copy'
  | 'download'
  | 'upload'
  | 'play'
  | 'flag'
  | 'trash'
  | 'qr'
  | 'close'
  | 'menu'
  | 'arrow-right'
  | 'eye'
  | 'globe';

/** Ikony liniowe 20×20 (bez zewnętrznej biblioteki). „upload” do wgrywania, „download” do pobierania (§24.14). */
export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const p: Record<IconName, ReactNode> = {
    check: <path d="M4 10.5l4 4 8-9" />,
    alert: (
      <>
        <path d="M10 3l8 14H2L10 3z" />
        <path d="M10 8v4M10 14.5v.5" />
      </>
    ),
    lock: (
      <>
        <rect x="4" y="9" width="12" height="8" rx="2" />
        <path d="M7 9V7a3 3 0 016 0v2" />
      </>
    ),
    phone: (
      <>
        <rect x="6" y="2.5" width="8" height="15" rx="2" />
        <path d="M9 15h2" />
      </>
    ),
    monitor: (
      <>
        <rect x="2.5" y="3.5" width="15" height="10" rx="1.5" />
        <path d="M7 17h6M10 13.5V17" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="6" height="6" rx="1" />
        <rect x="11" y="3" width="6" height="6" rx="1" />
        <rect x="3" y="11" width="6" height="6" rx="1" />
        <rect x="11" y="11" width="6" height="6" rx="1" />
      </>
    ),
    copy: (
      <>
        <rect x="7" y="7" width="10" height="10" rx="2" />
        <path d="M13 7V5a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2" />
      </>
    ),
    download: <path d="M10 3v10M6 9l4 4 4-4M4 17h12" />,
    upload: <path d="M10 13V3M6 7l4-4 4 4M4 17h12" />,
    play: <path d="M7 4.5v11l9-5.5-9-5.5z" />,
    flag: <path d="M5 17V3.5M5 4h9l-2 3.5 2 3.5H5" />,
    trash: <path d="M4 6h12M8 6V4h4v2M6 6l1 11h6l1-11" />,
    qr: (
      <>
        <rect x="3" y="3" width="5" height="5" rx="0.5" />
        <rect x="12" y="3" width="5" height="5" rx="0.5" />
        <rect x="3" y="12" width="5" height="5" rx="0.5" />
        <path d="M12 12h2v2M17 12v5h-3M12 15v2" />
      </>
    ),
    close: <path d="M5 5l10 10M15 5L5 15" />,
    menu: <path d="M3 6h14M3 10h14M3 14h14" />,
    'arrow-right': <path d="M4 10h12M11 5l5 5-5 5" />,
    eye: (
      <>
        <path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z" />
        <circle cx="10" cy="10" r="2.5" />
      </>
    ),
    globe: (
      <>
        <circle cx="10" cy="10" r="7.2" />
        <path d="M2.8 10h14.4M10 2.8c2.2 2.4 2.2 12 0 14.4M10 2.8c-2.2 2.4-2.2 12 0 14.4" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      {p[name]}
    </svg>
  );
}
