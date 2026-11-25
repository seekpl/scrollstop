import { salesEmail } from '../../config/company';
import { useT } from '../../i18n';
import { Badge, Icon } from '../../ui/kit';
import { SiteShell } from './SiteShell';

/** Strona „w budowie” (M0): hasło produktu, zasady prywatności i kontakt. Bez obietnic funkcji. */
export function BuildingPage() {
  const t = useT();
  const b = t.site.building;
  return (
    <SiteShell>
      <div className="mx-auto grid max-w-[1152px] gap-10 px-4 py-12 sm:px-6 md:grid-cols-[minmax(0,1fr)_280px] md:items-center md:py-20">
        <div className="min-w-0">
          <Badge tone="marker">{b.badge}</Badge>
          <h1 className="mt-4 max-w-[21ch] text-[38px] font-semibold leading-[1.04] tracking-[-0.035em] text-ink md:text-[56px]">{t.site.hero.title}</h1>
          <p className="mt-5 max-w-[60ch] text-[16px] leading-relaxed text-muted md:text-[17px]">{t.site.hero.lead}</p>
          <h2 className="mt-10 text-[21px] font-semibold tracking-[-0.01em] text-ink">{b.title}</h2>
          <p className="mt-2 max-w-[64ch] text-[15px] leading-relaxed text-muted">{b.body}</p>
          <ul className="mt-5 space-y-2.5">
            {b.points.map((p) => (
              <li key={p} className="flex gap-2.5 text-[15px] leading-relaxed text-ink">
                <span className="mt-0.5 shrink-0 text-good">
                  <Icon name="check" size={18} />
                </span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-[15px] text-ink">
            {b.contact}:{' '}
            <a className="font-semibold text-cobalt underline underline-offset-4" href={`mailto:${salesEmail()}`}>
              {salesEmail()}
            </a>
          </p>
        </div>
        <ClipIllustration />
      </div>
    </SiteShell>
  );
}

/** Ilustracja: pionowy kadr z krzywą uwagi (bez liczb — to nie są dane). */
function ClipIllustration() {
  return (
    <svg viewBox="0 0 280 440" className="mx-auto w-full max-w-[280px]" aria-hidden focusable="false">
      <rect x="40" y="8" width="200" height="424" rx="28" fill="#1f2a44" />
      <rect x="52" y="20" width="176" height="400" rx="18" fill="#2b3a5e" />
      <circle cx="140" cy="150" r="40" fill="#3f527d" />
      <rect x="92" y="210" width="96" height="120" rx="40" fill="#3f527d" />
      <rect x="70" y="44" width="140" height="18" rx="5" fill="#f4f6f9" opacity="0.92" />
      <path d="M8 120 C 50 118, 70 122, 96 128 S 122 210, 150 214 S 210 196, 272 192" fill="none" stroke="#f2b705" strokeWidth="6" strokeLinecap="round" />
      <defs>
        <clipPath id="clip-screen">
          <rect x="52" y="20" width="176" height="400" rx="18" />
        </clipPath>
      </defs>
      <path clipPath="url(#clip-screen)" d="M8 120 C 50 118, 70 122, 96 128 S 122 210, 150 214 S 210 196, 272 192 L 272 440 L 8 440 Z" fill="#f2b705" opacity="0.16" />
    </svg>
  );
}
