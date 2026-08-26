/* eslint-disable @typescript-eslint/no-explicit-any */

const DB_NAME = "SMA_CONSTRUCTORA_DB";
const DB_VERSION = 1;
const STORE_NAME = "keyval_store";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB no está disponible en este entorno"));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Guarda un objeto de cualquier tamaño en IndexedDB (soporta cientos de MB sin errores de cuota)
 * y en localStorage como respaldo optimizado.
 */
export async function saveLargeItem(key: string, value: any): Promise<void> {
  if (typeof window === "undefined") return;

  // 1. Guardar en IndexedDB (Primario, sin límites de 5MB)
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (idbErr) {
    console.warn("[IndexedDB] Error al guardar en base de datos local:", idbErr);
  }

  // 2. Intentar guardar en localStorage una versión ligera (sin puntos distribuidos masivos redundantes)
  try {
    let lightValue = value;
    if (value && typeof value === "object" && Array.isArray(value.distributedDataPoints)) {
      // Omitir distributedDataPoints en localStorage porque el frontend los recalcula en memoria en 5ms
      const { distributedDataPoints, ...rest } = value;
      lightValue = rest;
    }
    localStorage.setItem(key, JSON.stringify(lightValue));
  } catch {
    // Si localStorage está lleno, limpiar la clave para no generar excepciones en cascada
    try {
      localStorage.removeItem(key);
    } catch {}
  }
}

/**
 * Obtiene un objeto desde IndexedDB o localStorage
 */
export async function getLargeItem<T = any>(key: string): Promise<T | null> {
  if (typeof window === "undefined") return null;

  // 1. Intentar leer de IndexedDB primero
  try {
    const db = await openDB();
    const result = await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });

    if (result) return result;
  } catch (idbErr) {
    console.warn("[IndexedDB] Fallback a localStorage:", idbErr);
  }

  // 2. Fallback a localStorage
  try {
    const local = localStorage.getItem(key);
    if (local) {
      return JSON.parse(local) as T;
    }
  } catch (localErr) {
    console.error("[Storage] Error leyendo de localStorage:", localErr);
  }

  return null;
}

/**
 * Elimina una clave de IndexedDB y localStorage
 */
export async function removeLargeItem(key: string): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (idbErr) {
    console.warn("[IndexedDB] Error eliminando clave:", idbErr);
  }

  try {
    localStorage.removeItem(key);
  } catch {}
}
