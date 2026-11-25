import { useResearch } from '../../app/research';
import { brandSlug } from '../../config/brand';
import { downloadText } from '../../export/exporters';
import { useI18n } from '../../i18n';
import { planFor } from '../../research/plans';
import { Btn, Icon } from '../../ui/kit';
import { ReportView } from '../report/ReportView';
import { projectToCsv, projectToJson } from './exportRaw';
import { ShareLinkPanel } from './ShareLink';
import type { ProjectCtx } from './ProjectPage';

/** Raport w studiu: edycja stref, eksport (PDF przez druk, surowe dane w planie z `rawExport`). */
export function ProjectReport({ project, sessions, update }: ProjectCtx) {
  const { t } = useI18n();
  const r = t.studio.report;
  const { can } = useResearch();
  const actions = (
    <div className="no-print flex flex-wrap items-center gap-2">
      <Btn size="sm" onClick={() => window.print()}>
        <Icon name="download" size={16} />
        {r.pdf}
      </Btn>
      {can.rawExport ? (
        <>
          <Btn size="sm" variant="quiet" onClick={() => downloadText(projectToJson(project, sessions), `${brandSlug()}_${project.id}.json`, 'application/json')}>
            {r.json}
          </Btn>
          <Btn size="sm" variant="quiet" onClick={() => downloadText(projectToCsv(project, sessions), `${brandSlug()}_${project.id}.csv`, 'text/csv')}>
            {r.csv}
          </Btn>
        </>
      ) : (
        <span className="text-[12.5px] text-muted">{r.rawLocked(t.billing.planNames[planFor('rawExport')])}</span>
      )}
      <span className="text-[12.5px] text-muted">{can.watermark ? r.pdfWatermark : r.pdfHint}</span>
      <div className="w-full">
        <ShareLinkPanel project={project} />
      </div>
    </div>
  );
  return (
    <ReportView
      project={project}
      sessions={sessions}
      can={can}
      actions={actions}
      onSaveAois={async (variantId, aois) => {
        await update({ variants: project.variants.map((v) => (v.id === variantId ? { ...v, aois } : v)) });
      }}
    />
  );
}
