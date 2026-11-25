import { useMemo, useState } from 'react';
import { useI18n } from '../../i18n';
import { BigButton, Screen, Title } from './parts';

/** Kraje do wyboru (kody ISO) — nazwy z Intl w języku badania. */
const COUNTRIES = ['PL', 'DE', 'GB', 'US', 'FR', 'ES', 'IT', 'NL', 'CZ', 'SK', 'UA', 'IE', 'SE', 'AT', 'CH', 'BE', 'PT', 'CA', 'AU'];
export const SCREENER_PLATFORMS = ['tiktok', 'reels', 'shorts', 'youtube'] as const;
const FREQUENCIES = ['daily', 'weekly', 'rarely', 'never'] as const;

/**
 * Pytania przesiewowe (§10.3): tylko listy wyboru, bez pól tekstowych. Nigdy nie pytamy o zdrowie,
 * poglądy, wyznanie, orientację ani pochodzenie.
 */
export function ScreenerScreen({ onDone }: { onDone(country: string | null, answers: Record<string, string>): void }) {
  const { t, tag } = useI18n();
  const s = t.viewer.screener;
  const [country, setCountry] = useState('');
  const [freq, setFreq] = useState<Record<string, string>>({});
  const names = useMemo(() => {
    try {
      const dn = new Intl.DisplayNames([tag], { type: 'region' });
      return COUNTRIES.map((c) => ({ code: c, name: dn.of(c) ?? c })).sort((a, b) => a.name.localeCompare(b.name, tag));
    } catch {
      return COUNTRIES.map((c) => ({ code: c, name: c }));
    }
  }, [tag]);
  const complete = SCREENER_PLATFORMS.every((p) => freq[`platform_${p}`]);
  return (
    <Screen>
      <div className="space-y-6">
        <Title>{s.title}</Title>
        <p className="text-[15px] text-muted">{s.lead}</p>
        <div className="space-y-2">
          <label htmlFor="country" className="text-[15px] font-semibold">
            {s.country}
          </label>
          <select id="country" value={country} onChange={(e) => setCountry(e.target.value)} className="h-12 w-full rounded-2xl bg-surface px-4 text-[16px] ring-1 ring-inset ring-field">
            <option value="">{s.countrySkip}</option>
            {names.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {SCREENER_PLATFORMS.map((p) => (
          <fieldset key={p} className="space-y-2">
            <legend className="text-[15px] font-semibold">{s.howOften(s.platforms[p])}</legend>
            <div className="grid grid-cols-2 gap-2">
              {FREQUENCIES.map((f) => (
                <label key={f} className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl px-3 text-[15px] ring-1 ring-inset ${freq[`platform_${p}`] === f ? 'bg-cobalt/[0.07] ring-2 ring-cobalt' : 'bg-surface ring-field/60'}`}>
                  <input type="radio" name={`platform_${p}`} value={f} checked={freq[`platform_${p}`] === f} onChange={() => setFreq((x) => ({ ...x, [`platform_${p}`]: f }))} className="h-5 w-5 accent-cobalt" />
                  {s.frequencies[f]}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <BigButton disabled={!complete} onClick={() => onDone(country || null, freq)}>
          {t.common.actions.next}
        </BigButton>
      </div>
    </Screen>
  );
}
