import { useMemo } from 'react';
import { LabApp } from './LabApp';
import { getLabStore, LAB_OPEN_KEY } from './labStore';

/** Laboratorium jako osobna paczka; sesja przekazana z analizy technicznej projektu (Otwórz w laboratorium). */
export function LabRoute() {
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
