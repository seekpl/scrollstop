import { BuildingPage } from '../features/site/Building';
import { NotFound, SoonPage } from '../features/site/Pages';
import { ErrorBoundary } from './ErrorBoundary';
import { useRoute, type Route } from './router';

function RouteView({ route }: { route: Route }) {
  switch (route.name) {
    case 'landing':
      return <BuildingPage />;
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
