import { IndexedDbSessionStore, type SessionStore } from '../../storage/sessionStore';

/** Magazyn laboratorium (baza `attn-lab`). Testy podmieniają go na pamięciowy. */
let store: SessionStore | null = null;

export function getLabStore(): SessionStore {
  store ??= new IndexedDbSessionStore();
  return store;
}

export function setLabStore(s: SessionStore): void {
  store = s;
}

/** Sesja do otwarcia po wejściu do laboratorium z analizy technicznej projektu. */
export const LAB_OPEN_KEY = 'attn.lab.open';
