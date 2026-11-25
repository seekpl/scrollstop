import { BRAND } from '../config/brand';

/** Znak marki: pionowy kadr z krzywą uwagi (jak favicon) i nazwa. */
export function BrandMark({ hideNameBelow400 = false, size = 30 }: { hideNameBelow400?: boolean; size?: number }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden focusable="false" className="shrink-0">
        <rect width="64" height="64" rx="16" fill="#1f2a44" />
        <rect x="20" y="9" width="24" height="46" rx="5" fill="none" stroke="#fff" strokeWidth="3.5" />
        <path d="M14 26c6 0 8 2 12 2s5 10 9 10 6-4 15-4" fill="none" stroke="#f2b705" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <span className={`truncate text-[17px] font-semibold tracking-[-0.02em] text-ink ${hideNameBelow400 ? 'max-[399px]:sr-only' : ''}`}>{BRAND.name}</span>
    </span>
  );
}
