// Shared IndexedDB for data the app keeps in the browser: uploaded session files and their transcripts.
// IndexedDB holds large binary files (recordings), unlike localStorage.

export const STORES = {
  sessionFiles: 'session-files',
  transcripts: 'transcripts',
} as const;

type StoreName = (typeof STORES)[keyof typeof STORES];

const DB_NAME = 'sb-capas-lmis';
// Version 2 added the transcripts store.
const DB_VERSION = 2;

let dbPromise: Promise<IDBDatabase> | null = null;

const openDb = () => {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('This browser does not support offline file storage.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      Object.values(STORES).forEach((name) => {
        if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: 'id' });
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  // Let a later call retry if opening failed (for example, storage was blocked).
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
};

export const runTransaction = async <T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | undefined> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const request = work(transaction.objectStore(storeName));
    transaction.oncomplete = () => resolve(request ? request.result : undefined);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
};

// Turns a storage failure into a message the user can act on.
export const storageErrorMessage = (error: unknown) =>
  error instanceof DOMException && error.name === 'QuotaExceededError'
    ? 'The browser has run out of storage space. Remove some files and try again.'
    : 'This could not be saved in this browser. Please try again.';

let persistenceRequested = false;
// Asks the browser not to clear saved data when disk space runs low (best effort; some browsers ignore it).
export const requestPersistentStorage = () => {
  if (persistenceRequested) return;
  persistenceRequested = true;
  void navigator.storage?.persist?.().catch(() => undefined);
};
