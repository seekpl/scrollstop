import { useEffect, useMemo, type ReactNode } from 'react';
import type { ResearchApi } from '../api/types';
import { LabApp } from '../features/lab/LabApp';
import { DeleteSessionPage } from '../features/viewer/DeleteSession';
import { ViewerApp } from '../features/viewer/ViewerApp';
import { getLabStore, LAB_OPEN_KEY } from '../features/lab/labStore';
import { SharedReportPage } from '../features/report/SharedReport';
import { LoginPage, RegisterPage } from '../features/site/Auth';
import { InvitePage } from '../features/site/Invite';
import { LandingPage } from '../features/site/Landing';
import { NotFound } from '../features/site/Pages';
import { PricingPage } from '../features/site/Pricing';
import { PrivacyPage } from '../features/site/Privacy';
import { SamplePage } from '../features/site/Sample';
import { AccountPage } from '../features/studio/Account';
import { NewProjectPage } from '../features/studio/NewProject';
import { ProjectPage } from '../features/studio/ProjectPage';
import { ProjectsPage } from '../features/studio/Projects';
import { WorkspacePage } from '../features/studio/Workspace';
import { ErrorBoundary } from './ErrorBoundary';
import { ResearchProvider, useResearch } from './research';
import { navigate, pathOf, useRoute, type Route } from './router';

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

/** Studio w trybie serwerowym wymaga konta: bez logowania — strona logowania z powrotem tutaj. */
function RequireAccount({ children }: { children: ReactNode }) {
  const { api, account } = useResearch();
  useEffect(() => {
    if (api.mode === 'server' && account === null) navigate(`${pathOf({ name: 'login' })}?next=${encodeURIComponent(window.location.hash)}`, { replace: true });
  }, [api.mode, account]);
  if (api.mode === 'server' && !account) return null;
  return <>{children}</>;
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
      return (
        <RequireAccount>
          <ProjectsPage />
        </RequireAccount>
      );
    case 'new-project':
      return (
        <RequireAccount>
          <NewProjectPage />
        </RequireAccount>
      );
    case 'project':
      return (
        <RequireAccount>
          <ProjectPage key={route.id} id={route.id} step={route.step} />
        </RequireAccount>
      );
    case 'account':
      return (
        <RequireAccount>
          <AccountPage />
        </RequireAccount>
      );
    case 'workspace':
      return (
        <RequireAccount>
          <WorkspacePage />
        </RequireAccount>
      );
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
      return <LoginPage />;
    case 'register':
      return <RegisterPage />;
    case 'invite':
      return <InvitePage key={route.token} token={route.token} />;
    case 'shared-report':
      return <SharedReportPage key={route.token} token={route.token} />;
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
