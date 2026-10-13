/** Pacotes PNG de setor guardados no IndexedDB para uso sem rede. */

export type OfflinePackItem = {
  tag: string;
  equipamento: string;
  setor: string;
  dataUrl: string;
  filename: string;
};

export type OfflinePack = {
  id: string;
  setor: string;
  monthKeys: string[];
  sizeId: string;
  createdAt: string;
  items: OfflinePackItem[];
};

const DB_NAME = "aionscope-etiquetas";
const DB_VERSION = 1;
const STORE = "packs";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB indisponível neste navegador"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Falha ao abrir IndexedDB"));
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Operação IndexedDB falhou"));
  });
}

export function makeOfflinePackId(setor: string, monthKeys: string[]): string {
  const months = [...monthKeys].sort().join(",");
  return `${setor.trim() || "sem-setor"}|${months}|${Date.now()}`;
}

export async function listOfflinePacks(): Promise<OfflinePack[]> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const all = await reqToPromise(store.getAll() as IDBRequest<OfflinePack[]>);
    return (all ?? []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } finally {
    db.close();
  }
}

export async function saveOfflinePack(pack: OfflinePack): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    await reqToPromise(tx.objectStore(STORE).put(pack));
  } finally {
    db.close();
  }
}

export async function deleteOfflinePack(id: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    await reqToPromise(tx.objectStore(STORE).delete(id));
  } finally {
    db.close();
  }
}

export async function getOfflinePack(id: string): Promise<OfflinePack | null> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readonly");
    const pack = await reqToPromise(tx.objectStore(STORE).get(id) as IDBRequest<OfflinePack>);
    return pack ?? null;
  } finally {
    db.close();
  }
}
