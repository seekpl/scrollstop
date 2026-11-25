import { useT } from '../../i18n';
import { PageHeader } from '../../ui/kit';
import { StudioShell } from './Shell';

/** Zespół (§9.6): członkowie, zaproszenia i foldery klientów wymagają kont na serwerze (M5). */
export function WorkspacePage() {
  const t = useT();
  const w = t.studio.workspace;
  return (
    <StudioShell crumbs={[{ label: w.title }]} title={w.title}>
      <PageHeader title={w.title} lead={w.serverOnly} />
    </StudioShell>
  );
}
