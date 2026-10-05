/**
 * Stockage des positions dans IndexedDB (carnet D-004).
 * Une base « carnet-crypto », un magasin « positions » (clé : id). Si IndexedDB
 * est indisponible (navigation privée stricte, navigateur ancien), repli en
 * mémoire : l'interface le signale, la sauvegarde JSON reste possible.
 */
import type { Position } from '../core/model';

export interface PositionStore {
  /** false : données en mémoire, perdues à la fermeture. */
  readonly persistent: boolean;
  all(): Promise<Position[]>;
  put(position: Position): Promise<void>;
  /** Remplace tout le contenu en une transaction. */
  replaceAll(positions: readonly Position[]): Promise<void>;
  remove(id: string): Promise<void>;
}

const DB_NAME = 'carnet-crypto';
const STORE = 'positions';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction annulée'));
  });
}

/** Copie sans proxy ($state) : IndexedDB exige des objets clonables. */
function plain(position: Position): Position {
  return JSON.parse(JSON.stringify(position)) as Position;
}

class IdbStore implements PositionStore {
  readonly persistent = true;
  constructor(private readonly db: IDBDatabase) {}

  all(): Promise<Position[]> {
    return request(this.db.transaction(STORE, 'readonly').objectStore(STORE).getAll() as IDBRequest<Position[]>);
  }

  async put(position: Position): Promise<void> {
    const tx = this.db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(plain(position));
    await done(tx);
  }

  async replaceAll(positions: readonly Position[]): Promise<void> {
    const tx = this.db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    store.clear();
    for (const p of positions) store.put(plain(p));
    await done(tx);
  }

  async remove(id: string): Promise<void> {
    const tx = this.db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    await done(tx);
  }
}

export class MemoryPositionStore implements PositionStore {
  readonly persistent = false;
  private data = new Map<string, Position>();
  async all() {
    return [...this.data.values()].map(plain);
  }
  async put(p: Position) {
    this.data.set(p.id, plain(p));
  }
  async replaceAll(positions: readonly Position[]) {
    this.data = new Map(positions.map((p) => [p.id, plain(p)]));
  }
  async remove(id: string) {
    this.data.delete(id);
  }
}

/** Ouvre IndexedDB ; repli en mémoire en cas d'échec. */
export async function openPositionStore(factory: IDBFactory | null = globalThis.indexedDB ?? null): Promise<PositionStore> {
  if (!factory) return new MemoryPositionStore();
  try {
    const req = factory.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    return new IdbStore(await request(req));
  } catch {
    return new MemoryPositionStore();
  }
}
