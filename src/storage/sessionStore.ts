import { STORAGE } from '../config/brand';
import type { GazeSample, Session, SessionMeta } from '../core/contracts/types';

/** Lokalny magazyn sesji laboratorium (baza `attn-lab`). Nic nie jest wysyłane poza urządzenie. */
export interface SessionStore {
  saveMeta(meta: SessionMeta): Promise<void>;
  appendSamples(id: string, chunkIndex: number, samples: GazeSample[]): Promise<void>;
  listSessions(): Promise<SessionMeta[]>;
  loadSession(id: string): Promise<Session | null>;
  deleteSession(id: string): Promise<void>;
}

const byNewest = (a: SessionMeta, b: SessionMeta) => b.createdAt.localeCompare(a.createdAt);

export class MemorySessionStore implements SessionStore {
  private metas = new Map<string, SessionMeta>();
  private chunks = new Map<string, Map<number, GazeSample[]>>();

  async saveMeta(meta: SessionMeta): Promise<void> {
    this.metas.set(meta.id, structuredClone(meta));
  }

  async appendSamples(id: string, chunkIndex: number, samples: GazeSample[]): Promise<void> {
    if (!this.chunks.has(id)) this.chunks.set(id, new Map());
    this.chunks.get(id)!.set(chunkIndex, structuredClone(samples));
  }

  async listSessions(): Promise<SessionMeta[]> {
    return [...this.metas.values()].sort(byNewest);
  }

  async loadSession(id: string): Promise<Session | null> {
    const meta = this.metas.get(id);
    if (!meta) return null;
    const chunks = [...(this.chunks.get(id)?.entries() ?? [])].sort((a, b) => a[0] - b[0]);
    return { meta: structuredClone(meta), samples: chunks.flatMap(([, s]) => s) };
  }

  async deleteSession(id: string): Promise<void> {
    this.metas.delete(id);
    this.chunks.delete(id);
  }
}

const DB_NAME = STORAGE.labDb;
const DB_VERSION = 1;

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

interface ChunkRecord {
  sessionId: string;
  index: number;
  samples: GazeSample[];
}

export class IndexedDbSessionStore implements SessionStore {
  private db: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    if (!this.db) {
      this.db = new Promise((resolve, reject) => {
        const r = indexedDB.open(DB_NAME, DB_VERSION);
        r.onupgradeneeded = () => {
          const db = r.result;
          if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('chunks')) {
            const s = db.createObjectStore('chunks', { keyPath: ['sessionId', 'index'] });
            s.createIndex('bySession', 'sessionId');
          }
        };
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    }
    return this.db;
  }

  async saveMeta(meta: SessionMeta): Promise<void> {
    const db = await this.open();
    const tx = db.transaction('sessions', 'readwrite');
    tx.objectStore('sessions').put(meta);
    await done(tx);
  }

  async appendSamples(id: string, chunkIndex: number, samples: GazeSample[]): Promise<void> {
    const db = await this.open();
    const tx = db.transaction('chunks', 'readwrite');
    const rec: ChunkRecord = { sessionId: id, index: chunkIndex, samples };
    tx.objectStore('chunks').put(rec);
    await done(tx);
  }

  async listSessions(): Promise<SessionMeta[]> {
    const db = await this.open();
    const all = await req(db.transaction('sessions').objectStore('sessions').getAll());
    return (all as SessionMeta[]).sort(byNewest);
  }

  async loadSession(id: string): Promise<Session | null> {
    const db = await this.open();
    const tx = db.transaction(['sessions', 'chunks']);
    const meta = (await req(tx.objectStore('sessions').get(id))) as SessionMeta | undefined;
    if (!meta) return null;
    const chunks = (await req(tx.objectStore('chunks').index('bySession').getAll(IDBKeyRange.only(id)))) as ChunkRecord[];
    chunks.sort((a, b) => a.index - b.index);
    return { meta, samples: chunks.flatMap((c) => c.samples) };
  }

  async deleteSession(id: string): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(['sessions', 'chunks'], 'readwrite');
    tx.objectStore('sessions').delete(id);
    const index = tx.objectStore('chunks').index('bySession');
    const keys = await req(index.getAllKeys(IDBKeyRange.only(id)));
    for (const k of keys) tx.objectStore('chunks').delete(k);
    await done(tx);
  }
}
