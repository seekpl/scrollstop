import { pathOf } from '../../app/router';
import { useResearch } from '../../app/research';
import { salesEmail } from '../../config/company';
import { useI18n } from '../../i18n';
import { formatMoney } from '../../i18n/format';
import { currencyFor } from '../../i18n/locales';
import { PANEL, PLANS, upgradeTarget, type BlockReason } from '../../research/plans';
import { btnClass, Dialog } from '../../ui/kit';

/** Okno planu przy limicie (§16.3): komunikat, wyższy plan i badanie z panelem. Zawsze ścieżka kontaktu. */
export function PaywallDialog({ reason, onClose, target = 30 }: { reason: BlockReason | null; onClose(): void; target?: number }) {
  const { t, locale } = useI18n();
  const b = t.billing;
  const { account } = useResearch();
  const plan = account?.plan ?? 'free';
  const next = upgradeTarget(plan);
  const cur = currencyFor(locale);
  const body = reason === 'active_projects' ? b.paywall.active_projects : reason === 'project_sessions' ? b.paywall.project_sessions(target) : reason === 'month_sessions' ? b.paywall.month_sessions(PLANS[plan].limits.monthSessions ?? 0) : '';
  const panelPrice = formatMoney(cur === 'PLN' ? PANEL.from.PLN : PANEL.from.EUR, locale, cur === 'PLN' ? 'PLN' : 'EUR');
  return (
    <Dialog open={reason !== null} onClose={onClose} title={b.paywall.title}>
      <p className="text-[15px] leading-relaxed text-ink">{body}</p>
      <div className="mt-5 flex flex-col gap-2">
        <a href={`${pathOf({ name: 'pricing' })}?plan=${next}`} className={btnClass('primary', 'md')} onClick={onClose}>
          {b.paywall.upgrade(b.planNames[next], formatMoney(PLANS[next].monthly[cur], locale, cur))}
        </a>
        <a href={`mailto:${salesEmail()}?subject=${encodeURIComponent(b.panel.mailSubject)}`} className={btnClass('secondary', 'md')}>
          {b.panel.order} ({b.panel.priceFrom(panelPrice)})
        </a>
        <a href={pathOf({ name: 'pricing' })} className={btnClass('quiet', 'md')} onClick={onClose}>
          {b.paywall.seePricing}
        </a>
      </div>
    </Dialog>
  );
}
