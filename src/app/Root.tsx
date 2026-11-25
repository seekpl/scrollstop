import { useMemo } from 'react';
import type { ResearchApi } from '../api/types';
import { LabApp } from '../features/lab/LabApp';
import { DeleteSessionPage } from '../features/viewer/DeleteSession';
import { ViewerApp } from '../features/viewer/ViewerApp';
import { getLabStore, LAB_OPEN_KEY } from '../features/lab/labStore';
import { LandingPage } from '../features/site/Landing';
import { NotFound, SoonPage } from '../features/site/Pages';
import { PricingPage } from '../features/site/Pricing';
import { PrivacyPage } from '../features/site/Privacy';
import { SamplePage } from '../features/site/Sample';
import { AccountPage } from '../features/studio/Account';
import { NewProjectPage } from '../features/studio/NewProject';
import { ProjectPage } from '../features/studio/ProjectPage';
import { ProjectsPage } from '../features/studio/Projects';
import { WorkspacePage } from '../features/studio/Workspace';
import { ErrorBoundary } from './ErrorBoundary';
import { ResearchProvider } from './research';
import { useRoute, type Route } from './router';

function LabRoute() {
  // Sesja przekazana z analizy technicznej projektu (Otwórz w laboratorium).
  const initial = useMemo(() => {
    try {
      const id = sessionStorage.getItem(LAB_OPEN_KEY);
      sessionStorage.removeItem(LAB_OPEN_KEY);
      return id;
    } catch {
      return null;
    }
  }, []);
  return <LabApp store={getLabStore()} initialSessionId={initial} />;
}

function RouteView({ route }: { route: Route }) {
  switch (route.name) {
    case 'landing':
      return <LandingPage />;
    case 'pricing':
      return <PricingPage />;
    case 'privacy':
      return <PrivacyPage />;
    case 'sample':
      return <SamplePage sample={route.sample} />;
    case 'projects':
      return <ProjectsPage />;
    case 'new-project':
      return <NewProjectPage />;
    case 'project':
      return <ProjectPage key={route.id} id={route.id} step={route.step} />;
    case 'account':
      return <AccountPage />;
    case 'workspace':
      return <WorkspacePage />;
    case 'lab':
      return <LabRoute />;
    case 'study':
      return <ViewerApp key={route.token} token={route.token} />;
    case 'study-package':
      return <ViewerApp key={route.payload} payload={route.payload} />;
    case 'delete-session':
      return <DeleteSessionPage id={route.id} />;
    case 'not-found':
      return <NotFound />;
    case 'login':
    case 'register':
      // Konta są w trybie serwerowym (M5); w trybie lokalnym studio działa bez logowania.
      return <SoonPage />;
  }
}

/** Aplikacja: strona publiczna, studio twórcy, badanie widza i laboratorium. */
export function Root({ api }: { api: ResearchApi }) {
  const route = useRoute();
  return (
    <ErrorBoundary>
      <ResearchProvider api={api}>
        <RouteView route={route} />
      </ResearchProvider>
    </ErrorBoundary>
  );
}
