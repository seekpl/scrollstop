import { useEffect, useState } from 'react';
import { pathOf } from '../../app/router';
import { useResearch } from '../../app/research';
import { useI18n } from '../../i18n';
import type { Usage } from '../../api/types';
import type { Project } from '../../research/model';
import { PLANS } from '../../research/plans';
import { Badge, btnClass, Empty, Icon, Meter, PageHeader } from '../../ui/kit';
import { StudioShell } from './Shell';

export function aspectName(w: number, h: number): string {
  const r = w / h;
  if (Math.abs(r - 9 / 16) < 0.03) return '9:16';
  if (Math.abs(r - 4 / 5) < 0.03) return '4:5';
  if (Math.abs(r - 1) < 0.03) return '1:1';
  if (Math.abs(r - 16 / 9) < 0.03) return '16:9';
  return `${w}×${h}`;
}

/** Lista projektów (§9.1): limity planu, karty projektów, pusty stan. */
export function ProjectsPage() {
  const { t } = useI18n();
  const p = t.studio.projects;
  const { api, account } = useResearch();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  useEffect(() => {
    void api.listProjects().then(setProjects);
    void api.usage().then(setUsage);
  }, [api]);
  const plan = PLANS[account?.plan ?? 'free'];
  return (
    <StudioShell title={p.title}>
      <div className="space-y-8">
        <PageHeader
          title={p.title}
          lead={p.lead}
          actions={
            <a href={pathOf({ name: 'new-project' })} className={btnClass('primary', 'md')}>
              {p.new}
            </a>
          }
        />
        {usage && <p className="text-[13.5px] text-muted">{p.limits(t.billing.planNames[plan.id], usage.activeProjects, plan.limits.activeProjects, usage.monthSessions, plan.limits.monthSessions)}</p>}
        {projects && projects.length === 0 && (
          <Empty
            title={p.emptyTitle}
            action={
              <>
                <a href={pathOf({ name: 'new-project' })} className={btnClass('primary', 'md')}>
                  {p.create}
                </a>
                <a href={pathOf({ name: 'sample', sample: 'reel' })} className={btnClass('secondary', 'md')}>
                  {t.site.hero.ctaSample}
                </a>
              </>
            }
          >
            {p.emptyBody}
          </Empty>
        )}
        {projects && projects.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((pr) => {
              const v0 = pr.variants[0];
              const vertical = v0.height > v0.width;
              const valid = pr.counts?.valid ?? 0;
              const ids = pr.variants.map((v) => v.id);
              return (
                <li key={pr.id}>
                  <a href={pathOf({ name: 'project', id: pr.id, step: valid ? 'report' : 'prepare' })} className="flex h-full min-w-0 flex-col gap-3 rounded-2xl bg-surface p-5 ring-1 ring-line hover:ring-ink/30">
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink/[0.06] text-ink" aria-hidden>
                        <Icon name={pr.context === 'grid' ? 'grid' : vertical ? 'phone' : 'monitor'} size={20} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[16px] font-semibold text-ink">{pr.name}</span>
                        <span className="block text-[13px] text-muted">
                          {p.meta(t.common.studyKinds[pr.kind], aspectName(v0.width, v0.height), t.common.platforms[pr.platform], ids.length > 1 ? `${ids[0]}–${ids[ids.length - 1]}` : null)}
                        </span>
                      </span>
                    </div>
                    <Meter value={valid} max={pr.targetSessions} label={p.progress(valid, pr.targetSessions)} />
                    <div className="flex items-center justify-between gap-2 text-[13px]">
                      <span className="tabular text-muted">{p.progress(valid, pr.targetSessions)}</span>
                      <Badge tone={pr.status === 'collecting' ? 'good' : pr.status === 'paused' ? 'fair' : 'neutral'}>{p.status[pr.status]}</Badge>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </StudioShell>
  );
}
