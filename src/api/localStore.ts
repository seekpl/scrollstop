/** Minimalny magazyn dokumentów dla trybu lokalnego: IndexedDB w przeglądarce, pamięć w testach. */
import { STORAGE } from '../config/brand';

export type LocalCollection = 'projects' | 'sessions' | 'kv' | 'orders';

export interface LocalStore {
  all<T>(c: LocalCollection): Promise<T[]>;
  get<T>(c: LocalCollection, id: string): Promise<T | undefined>;
  put<T extends { id: string }>(c: LocalCollection, value: T): Promise<void>;
  del(c: LocalCollection, id: string): Promise<void>;
}

export class MemoryLocalStore implements LocalStore {
  private readonly data = new Map<LocalCollection, Map<string, unknown>>();

  private col(c: LocalCollection) {
    let m = this.data.get(c);
    if (!m) this.data.set(c, (m = new Map()));
    return m;
  }

  async all<T>(c: LocalCollection): Promise<T[]> {
    return [...this.col(c).values()].map((v) => structuredClone(v) as T);
  }

  async get<T>(c: LocalCollection, id: string): Promise<T | undefined> {
    const v = this.col(c).get(id);
    return v === undefined ? undefined : (structuredClone(v) as T);
  }

  async put<T extends { id: string }>(c: LocalCollection, value: T): Promise<void> {
    this.col(c).set(value.id, structuredClone(value));
  }

  async del(c: LocalCollection, id: string): Promise<void> {
    this.col(c).delete(id);
  }
}

const COLLECTIONS: LocalCollection[] = ['projects', 'sessions', 'kv', 'orders'];

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export class IndexedDbLocalStore implements LocalStore {
  private db: Promise<IDBDatabase> | null = null;

  constructor(private readonly name: string = STORAGE.researchDb) {}

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('storage_unavailable'));
      const r = indexedDB.open(this.name, 1);
      r.onupgradeneeded = () => {
        for (const c of COLLECTIONS) if (!r.result.objectStoreNames.contains(c)) r.result.createObjectStore(c, { keyPath: 'id' });
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    return this.db;
  }

  private async tx(c: LocalCollection, mode: IDBTransactionMode) {
    return (await this.open()).transaction(c, mode).objectStore(c);
  }

  async all<T>(c: LocalCollection): Promise<T[]> {
    return (await req((await this.tx(c, 'readonly')).getAll())) as T[];
  }

  async get<T>(c: LocalCollection, id: string): Promise<T | undefined> {
    return (await req((await this.tx(c, 'readonly')).get(id))) as T | undefined;
  }

  async put<T extends { id: string }>(c: LocalCollection, value: T): Promise<void> {
    await req((await this.tx(c, 'readwrite')).put(value));
  }

  async del(c: LocalCollection, id: string): Promise<void> {
    await req((await this.tx(c, 'readwrite')).delete(id));
  }
}
