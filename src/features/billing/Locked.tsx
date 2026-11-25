import type { ReactNode } from 'react';
import { useI18n } from '../../i18n';
import { formatMoney } from '../../i18n/format';
import { currencyFor } from '../../i18n/locales';
import { PLANS, type PlanId } from '../../research/plans';
import { btnClass, Icon } from '../../ui/kit';

/** Zablokowana funkcja (§16.3): rozmyty podgląd + „Dostępne od planu Pro (199 zł)” + „Odblokuj w planie Pro”. */
export function Locked({ plan, title, children }: { plan: PlanId; title: ReactNode; children?: ReactNode }) {
  const { t, locale } = useI18n();
  const name = t.billing.planNames[plan];
  const price = formatMoney(PLANS[plan].monthly[currencyFor(locale)], locale);
  return (
    <div className="relative overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      {children && (
        <div aria-hidden className="pointer-events-none select-none p-5 opacity-60 blur-[3px]">
          {children}
        </div>
      )}
      <div className={`${children ? 'absolute inset-0' : ''} flex flex-col items-start justify-center gap-3 bg-surface/80 p-5 sm:p-6`}>
        <div className="flex items-center gap-2 text-[15px] font-semibold text-ink">
          <Icon name="lock" size={18} />
          {title}
        </div>
        <p className="text-[14px] text-muted">{t.billing.locked.availableFrom(name, price)}</p>
        <a href={`#/pricing?plan=${plan}`} className={btnClass('primary', 'sm', 'no-print')}>
          {t.billing.locked.unlock(name)}
        </a>
      </div>
    </div>
  );
}
