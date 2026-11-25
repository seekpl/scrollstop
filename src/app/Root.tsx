import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import type { ResearchApi } from '../api/types';
import { LoginPage, RegisterPage } from '../features/site/Auth';
import { LandingPage } from '../features/site/Landing';
import { NotFound } from '../features/site/Pages';
import { PricingPage } from '../features/site/Pricing';
import { PrivacyPage } from '../features/site/Privacy';
import { TermsPage } from '../features/site/Terms';
import { useT } from '../i18n';
import { ErrorBoundary } from './ErrorBoundary';
import { ResearchProvider, useResearch } from './research';
import { navigate, pathOf, useRoute, type Route } from './router';

/*
 * Podział paczek (§20): strona publiczna w paczce głównej; badanie widza, studio, raporty
 * i laboratorium jako osobne pliki wczytywane przy wejściu na ścieżkę. Widz nie pobiera studia,
 * a odwiedzający stronę główną — kodu badania.
 */
const ViewerApp = lazy(() => import('../features/viewer/ViewerApp').then((m) => ({ default: m.ViewerApp })));
const DeleteSessionPage = lazy(() => import('../features/viewer/DeleteSession').then((m) => ({ default: m.DeleteSessionPage })));
const LabRoute = lazy(() => import('../features/lab/LabRoute').then((m) => ({ default: m.LabRoute })));
const SharedReportPage = lazy(() => import('../features/report/SharedReport').then((m) => ({ default: m.SharedReportPage })));
const SamplePage = lazy(() => import('../features/site/Sample').then((m) => ({ default: m.SamplePage })));
const InvitePage = lazy(() => import('../features/site/Invite').then((m) => ({ default: m.InvitePage })));
const ProjectsPage = lazy(() => import('../features/studio/Projects').then((m) => ({ default: m.ProjectsPage })));
const NewProjectPage = lazy(() => import('../features/studio/NewProject').then((m) => ({ default: m.NewProjectPage })));
const ProjectPage = lazy(() => import('../features/studio/ProjectPage').then((m) => ({ default: m.ProjectPage })));
const AccountPage = lazy(() => import('../features/studio/Account').then((m) => ({ default: m.AccountPage })));
const WorkspacePage = lazy(() => import('../features/studio/Workspace').then((m) => ({ default: m.WorkspacePage })));

/** Wczytywanie fragmentu aplikacji: nic przez pierwsze 400 ms (bez mignięcia), potem krótki komunikat. */
function RouteLoading() {
  const t = useT();
  const [show, setShow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 400);
    return () => clearTimeout(timer);
  }, []);
  return show ? (
    <p role="status" className="px-4 py-16 text-center text-[15px] text-muted">
      {t.ui.loading}
    </p>
  ) : null;
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
    case 'terms':
      return <TermsPage />;
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
        <Suspense fallback={<RouteLoading />}>
          <RouteView route={route} />
        </Suspense>
      </ResearchProvider>
    </ErrorBoundary>
  );
}
