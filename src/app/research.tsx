import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Account, ResearchApi } from '../api/types';

interface ResearchValue {
  api: ResearchApi;
  /** null = niezalogowany (tryb serwerowy); undefined = wczytywanie. */
  account: Account | null | undefined;
  refreshAccount(): Promise<void>;
}

const Ctx = createContext<ResearchValue | null>(null);

/** Kontekst danych badań (§12.7 app/research): interfejs API i bieżące konto. */
export function ResearchProvider({ api, children }: { api: ResearchApi; children: ReactNode }) {
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const refreshAccount = useCallback(async () => {
    try {
      setAccount(await api.me());
    } catch {
      setAccount(null);
    }
  }, [api]);
  useEffect(() => {
    void refreshAccount();
  }, [refreshAccount]);
  const value = useMemo(() => ({ api, account, refreshAccount }), [api, account, refreshAccount]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useResearch(): ResearchValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useResearch outside ResearchProvider');
  return v;
}
