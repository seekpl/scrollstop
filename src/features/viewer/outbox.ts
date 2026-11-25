import { IndexedDbLocalStore, type LocalStore } from '../../api/localStore';
import { STORAGE } from '../../config/brand';
import type { ViewerSession } from '../../research/model';

/**
 * Kolejka sesji, których nie udało się wysłać (§12.3). Dane zostają w przeglądarce widza tylko do
 * skutecznej wysyłki (ponowienie przy kolejnym otwarciu linku) i są wtedy usuwane.
 */
interface Pending {
  id: string;
  value: { token: string; session: ViewerSession };
}

let store: LocalStore | null = null;
const db = () => (store ??= new IndexedDbLocalStore(STORAGE.outboxDb));

export function setOutboxStore(s: LocalStore): void {
  store = s;
}

export async function queueSession(token: string, session: ViewerSession): Promise<boolean> {
  try {
    await db().put<Pending>('kv', { id: `pending:${session.id}`, value: { token, session } });
    return true;
  } catch {
    // Tryb prywatny bez IndexedDB — ponowienie tylko z ekranu końcowego.
    return false;
  }
}

export async function pendingFor(token: string): Promise<ViewerSession[]> {
  try {
    return (await db().all<Pending>('kv')).filter((p) => p.id.startsWith('pending:') && p.value.token === token).map((p) => p.value.session);
  } catch {
    return [];
  }
}

export async function clearPending(sessionId: string): Promise<void> {
  try {
    await db().del('kv', `pending:${sessionId}`);
  } catch {
    /* nic do usunięcia */
  }
}
