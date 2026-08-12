const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const TOKEN_KEY = "instituto_erp_token";

// El token vive en localStorage para sobrevivir a un refresh de página (F5).
// No es un artifact de Claude, es la app real que se le entrega al cliente,
// así que localStorage es la opción correcta acá (no hay backend de sesión).
function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request<T>(path: string, options: RequestInit = {}, _retried = false): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch (networkError) {
    // Fetch solo tira acá por problemas de red (servidor caído, sin
    // conexión), nunca por códigos de error HTTP. Un único reintento y solo
    // para GET (operación idempotente) evita que un corte momentáneo tire
    // abajo la pantalla, sin arriesgar un doble envío en POST/PUT/DELETE.
    const method = (options.method || "GET").toUpperCase();
    if (!_retried && method === "GET") {
      await sleep(600);
      return request<T>(path, options, true);
    }
    throw new ApiError(0, "No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.");
  }

  if (res.status === 401) {
    clearToken();
    // Avisa a la app (ver AuthContext) para que redirija a /login sin que
    // este cliente HTTP, que no es un componente React, tenga que conocer
    // el router. Cubre tanto un token vencido como uno inválido.
    window.dispatchEvent(new CustomEvent("auth:unauthorized"));
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      /* respuesta sin cuerpo JSON */
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Como `request`, pero además devuelve el total reportado por el backend
 * en el header X-Total-Count (usado por los listados paginados). */
async function requestWithTotal<T>(path: string, options: RequestInit = {}): Promise<{ data: T; total: number | null }> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new CustomEvent("auth:unauthorized"));
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      /* respuesta sin cuerpo JSON */
    }
    throw new ApiError(res.status, detail);
  }
  const totalHeader = res.headers.get("X-Total-Count");
  return { data: (await res.json()) as T, total: totalHeader ? Number(totalHeader) : null };
}

/**
 * Descarga un archivo binario (ej: PDF de comprobante) protegido por login.
 * No se puede usar window.open(url) para esto: esa navegación no manda el
 * header Authorization (solo lo agrega este cliente fetch), así que el
 * backend devuelve 401 "No autenticado" y el usuario ve ese JSON crudo en
 * una pestaña nueva. En cambio, acá se pide el archivo con el token, se arma
 * un blob en memoria y se dispara la descarga desde un <a> temporal.
 */
async function downloadFile(path: string, fallbackFilename: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new CustomEvent("auth:unauthorized"));
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      /* respuesta sin cuerpo JSON */
    }
    throw new ApiError(res.status, detail);
  }

  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename=([^;]+)/);
  const filename = match ? match[1].trim().replace(/^"|"$/g, "") : fallbackFilename;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  getWithTotal: <T>(path: string) => requestWithTotal<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  downloadFile,
};

export { ApiError, BASE_URL, getToken, setToken, clearToken, downloadFile };
