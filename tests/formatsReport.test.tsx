import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LocalResearchApi } from '../src/api/local';
import { MemoryLocalStore } from '../src/api/localStore';
import { ResearchProvider } from '../src/app/research';
import { ReportView } from '../src/features/report/ReportView';
import { I18nProvider } from '../src/i18n';
import { RESEARCH_TEXT } from '../src/i18n/research';
import { demoCarouselProject, demoFeedProject, demoGridProject } from '../src/research/formatSim';
import type { Project, ViewerSession } from '../src/research/model';
import { FULL_ACCESS } from '../src/research/plans';

const NOW = '2026-11-20T10:00:00.000Z';
const tx = RESEARCH_TEXT.pl;

function show(demo: { project: Project; sessions: ViewerSession[] }) {
  render(
    <I18nProvider locale="pl">
      <ResearchProvider api={new LocalResearchApi(new MemoryLocalStore())}>
        <ReportView project={demo.project} sessions={demo.sessions} can={FULL_ACCESS} sample />
      </ResearchProvider>
    </I18nProvider>,
  );
}

describe('raporty formatów (§7)', () => {
  it('feed: hook z zatrzymaniem scrolla, panel feedu, wykres z retencją', () => {
    show(demoFeedProject(tx, { createdAt: NOW }));
    expect(screen.getByRole('heading', { name: 'Feed' })).toBeInTheDocument();
    // Zdanie otwierające feedu: zatrzymanie scrolla wobec pozostałych klipów, nie „stabilna uwaga”.
    expect(screen.getByText(/^Na klipie zatrzymało się \d+% widzów \(pozostałe klipy feedu: \d+%\)\.$/)).toBeInTheDocument();
    expect(screen.getAllByText('Zatrzymanie scrolla').length).toBeGreaterThan(0);
    expect(screen.getByText('Ilu widzów zostaje na klipie i patrzy')).toBeInTheDocument();
    expect(screen.getByText('Kiedy widzowie przewijają dalej (sekunda klipu)')).toBeInTheDocument();
  });

  it('miniatura: zamiast krzywej panel siatki, zdanie otwierające i porównanie wersji', () => {
    show(demoGridProject(tx, { createdAt: NOW }));
    expect(screen.getByRole('heading', { name: 'Miniatura w siatce' })).toBeInTheDocument();
    expect(screen.getByText(/^Na badaną miniaturę spojrzało \d+% widzów/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Porównanie miniatur' })).toBeInTheDocument();
    expect(screen.queryByText('Ilu widzów patrzy na ekran')).toBeNull();
  });

  it('karuzela: zasięg slajd po slajdzie i zdanie o ukończeniu', () => {
    show(demoCarouselProject(tx, { createdAt: NOW }));
    expect(screen.getByRole('heading', { name: 'Slajd po slajdzie' })).toBeInTheDocument();
    expect(screen.getByText(/^Do ostatniego slajdu \(z 5\) doszło \d+% widzów\./)).toBeInTheDocument();
    expect(screen.getAllByText('Doszło')).toHaveLength(5);
  });
});
