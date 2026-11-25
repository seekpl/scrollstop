import { useState, type ReactNode } from 'react';
import { useResearch } from '../../app/research';
import { errorCode } from '../../core/errors';
import { formatTime } from '../../core/math/util';
import { useI18n } from '../../i18n';
import type { AiInsightsResult } from '../../api/types';
import type { Finding } from '../../research/insights';
import type { VariantId } from '../../research/model';
import { planFor, type Entitlements } from '../../research/plans';
import { Badge, Btn, Icon } from '../../ui/kit';
import { Locked } from '../billing/Locked';

const SEV_TONE: Record<Finding['severity'], 'poor' | 'fair' | 'good'> = { high: 'poor', medium: 'fair', positive: 'good' };

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[132px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-[12.5px] font-semibold text-muted">{label}</dt>
      <dd className="text-[14.5px] leading-relaxed text-ink">{children}</dd>
    </div>
  );
}

/**
 * „Co poprawić” (§7 pkt 6, §8): karty z numerem, wagą, przyciskiem „Pokaż 00:07” i polami Fakt,
 * Obserwacja, Hipoteza, Rekomendacja. Bez planu z wnioskami: hipoteza i rekomendacja zablokowane.
 * Rekomendacje AI w wyższym planie (tryb serwerowy).
 */
export function Findings({ findings, onJump, projectId, variantId, can }: { findings: Finding[]; onJump?(t: number): void; projectId?: string; variantId?: VariantId; can: Entitlements }) {
  const { api } = useResearch();
  const { locale, t } = useI18n();
  const tf = t.report.findings;
  const [ai, setAi] = useState<AiInsightsResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problems = findings.filter((f) => f.severity !== 'positive');
  const positives = findings.filter((f) => f.severity === 'positive');
  if (!findings.length) return <p className="text-[14.5px] text-muted">{tf.empty}</p>;

  const generate = async () => {
    if (!projectId || !variantId) return;
    setBusy(true);
    setError(null);
    try {
      setAi(await api.insights(projectId, variantId, locale));
    } catch (e) {
      setError((t.errors as Record<string, string>)[errorCode(e)] ?? t.errors.unknown);
    } finally {
      setBusy(false);
    }
  };
  const aiList = ai?.source === 'ai' && ai.insights.length ? ai.insights.map((i, k) => ({ ...i, id: `ai-${k}`, severity: 'medium' as const, preliminary: false, kind: null })) : null;
  return (
    <div className="space-y-6">
      <ol className="space-y-4">
        {(aiList ?? problems).map((f, i) => (
          <li key={f.id} className="print-avoid rounded-2xl bg-surface p-4 ring-1 ring-line sm:p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-[12px] font-bold text-white">{i + 1}</span>
              <h3 className="mr-auto min-w-0 text-[16px] font-semibold text-ink">{f.title}</h3>
              {f.kind !== null && <Badge tone={SEV_TONE[f.severity]}>{tf.severity[f.severity]}</Badge>}
              {f.preliminary && <Badge>{tf.preliminary}</Badge>}
              {onJump && (
                <Btn size="sm" variant="quiet" className="no-print" onClick={() => onJump(f.t0)}>
                  {tf.show(formatTime(Math.floor(f.t0), 0))}
                </Btn>
              )}
            </div>
            <dl className="space-y-2.5">
              <Row label={tf.fact}>{f.fact}</Row>
              {f.observation && <Row label={tf.observation}>{f.observation}</Row>}
              {can.findings ? (
                <>
                  {f.hypothesis && <Row label={tf.hypothesis}>{f.hypothesis}</Row>}
                  {f.recommendation && (
                    <Row label={tf.recommendation}>
                      <span className="font-semibold">{f.recommendation}</span>
                    </Row>
                  )}
                </>
              ) : (
                <Row label={tf.recommendation}>
                  <span className="inline-flex flex-wrap items-center gap-1.5 text-muted">
                    <Icon name="lock" size={15} /> {tf.recommendationLocked(t.billing.planNames[planFor('findings')])}
                  </span>
                </Row>
              )}
            </dl>
          </li>
        ))}
      </ol>
      {!aiList &&
        positives.map((f) => (
          <p key={f.id} className="flex items-start gap-2 text-[14.5px] text-ink">
            <span className="mt-0.5 shrink-0 text-good">
              <Icon name="check" />
            </span>
            <span>
              <strong className="font-semibold">{f.title}.</strong> {f.fact} {can.findings ? f.recommendation : ''}
            </span>
          </p>
        ))}
      {projectId && variantId && (
        <div className="no-print border-t border-line pt-4">
          {!can.recommendations ? (
            <Locked plan={planFor('recommendations')} title={tf.ai.generate} />
          ) : api.mode !== 'server' ? (
            <p className="text-[13px] text-muted">{tf.ai.serverOnly}</p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Btn size="sm" onClick={() => void generate()} disabled={busy}>
                {busy ? tf.ai.busy : ai ? tf.ai.regenerate : tf.ai.generate}
              </Btn>
              <span className="text-[12.5px] text-muted">{ai ? (ai.source === 'ai' ? tf.ai.source(ai.model ?? '', ai.rejected) : tf.ai.fallback) : tf.ai.note}</span>
              {error && <span className="text-[13px] font-semibold text-poor">{error}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
