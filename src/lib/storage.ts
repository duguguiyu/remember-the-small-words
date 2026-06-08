const DB_NAME = 'rtsw_v2_db'
const DB_VERSION = 1
const STORE_NAME = 'kv'

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

export const Storage = {
  async get<T>(key: string, defaultValue: T): Promise<T> {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(key)
      req.onsuccess = () => {
        resolve(req.result !== undefined ? req.result : defaultValue)
      }
      req.onerror = () => resolve(defaultValue)
    })
  },

  async set<T>(key: string, value: T): Promise<void> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  },

  async remove(key: string): Promise<void> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.delete(key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  },

  async exportAll(): Promise<Record<string, unknown>> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.getAll()
      const keysReq = store.getAllKeys()
      const result: Record<string, unknown> = {}
      tx.oncomplete = () => {
        const keys = keysReq.result
        const values = req.result
        keys.forEach((k, i) => {
          result[k as string] = values[i]
        })
        resolve(result)
      }
      tx.onerror = () => reject(tx.error)
    })
  },
}

export const KEYS = {
  WORD_STATS: 'word_stats',
  PLANS: 'plans',
  SESSIONS: 'sessions',
  WORDBOOKS: 'wordbooks',
  PROGRESS: 'progress',
  STREAK: 'streak',
  LAST_BACKUP: 'last_backup',
  SETTINGS: 'settings',
} as const
