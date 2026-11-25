import { useMemo } from 'react';
import { LabApp } from '../features/lab/LabApp';
import { getLabStore, LAB_OPEN_KEY } from '../features/lab/labStore';
import { BuildingPage } from '../features/site/Building';
import { NotFound, SoonPage } from '../features/site/Pages';
import { ErrorBoundary } from './ErrorBoundary';
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
      return <BuildingPage />;
    case 'lab':
      return <LabRoute />;
    case 'not-found':
      return <NotFound />;
    default:
      return <SoonPage />;
  }
}

/** Aplikacja: strona publiczna, studio twórcy, badanie widza i laboratorium. */
export function Root() {
  const route = useRoute();
  return (
    <ErrorBoundary>
      <RouteView route={route} />
    </ErrorBoundary>
  );
}
