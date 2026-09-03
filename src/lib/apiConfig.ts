/**
 * SMA - Dynamic API Configuration & Resilient Fetch
 * Permite que toda la plataforma funcione de forma transparente tanto en:
 * 1. Desarrollo Local (localhost:3000 -> localhost:8000 con fallback a Render)
 * 2. Producción Cloud (Vercel -> Render)
 */

export const CLOUD_BACKEND_URL = "https://sma-backend-m7ia.onrender.com";
export const LOCAL_BACKEND_URL = "http://localhost:8000";

/**
 * Retorna la lista ordenada de URLs candidatas del backend.
 * Si el usuario configuró NEXT_PUBLIC_API_URL, esa tiene prioridad P0.
 * En desarrollo local, prueba primero localhost:8000 y luego la nube.
 * En producción (Vercel), apunta directamente a Render.
 */
export function getBackendCandidates(): string[] {
  // 1. Variable de entorno explícita (definida en .env, .env.local o Vercel)
  if (process.env.NEXT_PUBLIC_API_URL) {
    return [process.env.NEXT_PUBLIC_API_URL];
  }

  // 2. En el Navegador (Cliente)
  if (typeof window !== "undefined") {
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (isLocalhost) {
      // En tu PC local: intenta tu backend local primero; si no está corriendo, usa el de Render
      return [LOCAL_BACKEND_URL, CLOUD_BACKEND_URL];
    }
    return [CLOUD_BACKEND_URL];
  }

  // 3. En el Servidor Node.js (Next.js API Routes en desarrollo)
  if (process.env.NODE_ENV === "development") {
    return [LOCAL_BACKEND_URL, CLOUD_BACKEND_URL];
  }

  // 4. Producción por defecto (Vercel Serverless)
  return [CLOUD_BACKEND_URL];
}

/**
 * Retorna la URL preferida del backend según el entorno
 */
export function getPreferredBackendUrl(): string {
  const candidates = getBackendCandidates();
  return candidates[0] || CLOUD_BACKEND_URL;
}

/**
 * Fetch resiliente que intenta el backend local (si está en dev) y si no responde
 * o da error de conexión, conmuta automáticamente al backend de producción en Render.
 */
export async function resilientFetch(
  endpoint: string,
  init?: RequestInit,
  timeoutMs: number = 45000
): Promise<Response> {
  const candidates = getBackendCandidates();
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  let lastError: unknown = null;

  for (let i = 0; i < candidates.length; i++) {
    const baseUrl = candidates[i];
    const fullUrl = `${baseUrl}${cleanEndpoint}`;

    // Si hay más de un candidato y estamos probando localhost, damos un timeout corto (2.5s)
    // para que no demore al usuario si el servidor local de python no fue encendido.
    const isLocal = baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1");
    const candidateTimeout = isLocal && candidates.length > 1 ? 2500 : timeoutMs;

    try {
      const res = await fetch(fullUrl, {
        ...init,
        signal: AbortSignal.timeout(candidateTimeout),
      });

      // Si respondió (incluso si devuelve un código HTTP 400 o 500 del backend), es una respuesta válida del servidor
      return res;
    } catch (err) {
      console.warn(`[SMA ResilientFetch] No se pudo conectar a ${baseUrl}${cleanEndpoint}:`, err);
      lastError = err;
      // Continúa al siguiente candidato (ej: pasa de localhost a Render)
    }
  }

  throw lastError || new Error("No se pudo conectar con ningún backend disponible (local ni en la nube).");
}
