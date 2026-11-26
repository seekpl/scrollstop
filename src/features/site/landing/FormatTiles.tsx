import { hrefOf } from '../../../app/router';
import { FORMAT_IDS, type FormatId } from '../../../config/formats';
import { useT } from '../../../i18n';
import { FormatArt } from './art';

/**
 * Kafelki formatów badań (strona główna i „Inne formaty”): ilustracja i nazwa, wyśrodkowane;
 * każdy prowadzi do podstrony formatu.
 */
export function FormatTiles({ exclude, className = '' }: { exclude?: FormatId; className?: string }) {
  const t = useT();
  const ids = FORMAT_IDS.filter((f) => f !== exclude);
  return (
    <ul className={`grid grid-cols-2 gap-px overflow-hidden rounded-[12px] border border-white/12 bg-white/12 sm:grid-cols-3 ${ids.length > 5 ? 'lg:grid-cols-6' : 'lg:grid-cols-5'} ${className}`}>
      {ids.map((f) => (
        <li key={f} className="min-w-0">
          <a
            href={hrefOf({ name: 'format', format: f })}
            aria-label={t.formats.label.tile(t.site.landing.formats[f])}
            className="group flex h-full min-h-[148px] flex-col items-center justify-between gap-3 bg-[color-mix(in_srgb,var(--l-night)_88%,white)] p-4 text-center transition-colors hover:bg-[color-mix(in_srgb,var(--l-night)_78%,white)] focus-visible:relative focus-visible:z-10"
          >
            <span className="transition-transform duration-200 group-hover:-translate-y-0.5">
              <FormatArt id={f} />
            </span>
            <span className="text-[14px] font-medium text-white/90 group-hover:text-white">{t.site.landing.formats[f]}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
