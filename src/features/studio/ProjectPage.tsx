import { useCallback, useEffect, useState } from 'react';
import { pathOf, type ProjectStep } from '../../app/router';
import { useResearch } from '../../app/research';
import { errorCode } from '../../core/errors';
import { useI18n } from '../../i18n';
import type { ProjectPatch } from '../../api/types';
import type { Project, ViewerSession } from '../../research/model';
import { btnClass, Callout, Stepper } from '../../ui/kit';
import { Collect } from './Collect';
import { Prepare } from './Prepare';
import { ProjectReport } from './ProjectReport';
import { StudioShell } from './Shell';
import { Technical } from './Technical';

export interface ProjectCtx {
  project: Project;
  sessions: ViewerSession[];
  reload(): Promise<void>;
  update(patch: ProjectPatch): Promise<void>;
}

/** Strona projektu (§9.3–§9.5): kroki Przygotuj, Zbierz widzów, Raport, Analiza techniczna. */
export function ProjectPage({ id, step }: { id: string; step: ProjectStep }) {
  const { t } = useI18n();
  const s = t.studio.project;
  const { api } = useResearch();
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [sessions, setSessions] = useState<ViewerSession[]>([]);
  const reload = useCallback(async () => {
    const p = await api.getProject(id);
    setProject(p);
    if (p) setSessions(await api.listSessions(id));
  }, [api, id]);
  // Świeże sesje przy zmianie kroku i po powrocie do karty; na kroku „Zbierz widzów” w trybie
  // serwerowym co 20 s (widzowie wysyłają sesje z własnych urządzeń).
  useEffect(() => {
    void reload();
  }, [reload, step]);
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && void reload();
    document.addEventListener('visibilitychange', onVisible);
    const timer = api.mode === 'server' && step === 'collect' ? window.setInterval(onVisible, 20_000) : null;
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      if (timer !== null) window.clearInterval(timer);
    };
  }, [reload, step, api.mode]);
  // Błąd zapisu (np. funkcja spoza planu — 402) jako komunikat na stronie, nie wyjątek w tle.
  const [error, setError] = useState<{ code: string; text: string } | null>(null);
  const update = async (patch: ProjectPatch) => {
    setError(null);
    try {
      setProject(await api.updateProject(id, patch));
    } catch (e) {
      const code = errorCode(e);
      setError({ code, text: (t.errors as Record<string, string>)[code] ?? t.errors.unknown });
    }
  };
  if (project === undefined) return <StudioShell>{null}</StudioShell>;
  if (project === null) {
    return (
      <StudioShell>
        <h1 className="text-[28px] font-semibold">{t.errors.not_found}</h1>
      </StudioShell>
    );
  }
  const valid = sessions.filter((x) => x.status === 'valid' && x.source !== 'simulated').length;
  const ctx: ProjectCtx = { project, sessions, reload, update };
  const steps: Array<{ id: ProjectStep; title: string; count?: string }> = [
    { id: 'prepare', title: s.steps.prepare },
    { id: 'collect', title: s.steps.collect, count: `${valid}/${project.targetSessions}` },
    { id: 'report', title: s.steps.report },
    { id: 'technical', title: s.steps.technical },
  ];
  return (
    <StudioShell crumbs={[{ label: project.name }]} title={project.name}>
      <div className="space-y-8">
        <div className="space-y-4">
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] sm:text-[34px]">{project.name}</h1>
          <Stepper label={s.stepsLabel} current={step} steps={steps.map((x) => ({ ...x, href: pathOf({ name: 'project', id, step: x.id }) }))} />
        </div>
        {error && (
          <div role="alert">
            <Callout
              tone={error.code.startsWith('feature_') || error.code === 'active_projects' ? 'locked' : 'warn'}
              action={
                error.code.startsWith('feature_') || error.code === 'active_projects' ? (
                  <a href={pathOf({ name: 'pricing' })} className={btnClass('primary', 'sm')}>
                    {t.billing.paywall.seePricing}
                  </a>
                ) : undefined
              }
            >
              {error.text}
            </Callout>
          </div>
        )}
        {step === 'prepare' && <Prepare {...ctx} />}
        {step === 'collect' && <Collect {...ctx} />}
        {step === 'report' && <ProjectReport {...ctx} />}
        {step === 'technical' && <Technical {...ctx} />}
      </div>
    </StudioShell>
  );
}
