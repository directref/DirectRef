import { API_BASE } from '../constants';

// ── Typed API Error ──────────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── Refresh state (singleton across module) ──────────────────────────────────
let isRefreshing = false;
const refreshQueue: Array<() => void> = [];

function drainQueue() {
  refreshQueue.splice(0).forEach((fn) => fn());
}

// ── Core fetch wrapper ───────────────────────────────────────────────────────
export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
  _isRetry = false,
): Promise<T> {
  const url = `${API_BASE}${path}`;

  const headers: HeadersInit = {};
  // Don't set Content-Type for FormData (browser sets it with boundary)
  if (!(init.body instanceof FormData)) {
    Object.assign(headers, { 'Content-Type': 'application/json' });
  }

  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: { ...headers, ...init.headers },
  });

  // ── Handle 401 with auto-refresh ──────────────────────────────────────────
  if (res.status === 401 && !_isRetry && path !== '/api/auth/refresh') {
    if (isRefreshing) {
      // Queue this request until the refresh completes
      return new Promise<T>((resolve, reject) => {
        refreshQueue.push(() =>
          apiFetch<T>(path, init, true).then(resolve).catch(reject),
        );
      });
    }

    isRefreshing = true;
    try {
      const refreshRes = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!refreshRes.ok) {
        // Refresh failed — user must log in again
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('auth:logout'));
        }
        throw new ApiError(401, 'Session expired. Please log in again.');
      }

      drainQueue();
      return apiFetch<T>(path, init, true); // retry original
    } finally {
      isRefreshing = false;
    }
  }

  // ── Handle 204 No Content ─────────────────────────────────────────────────
  if (res.status === 204) return undefined as T;

  // ── Parse error responses ─────────────────────────────────────────────────
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as {
      error?: { message?: string; code?: string };
    };
    throw new ApiError(
      res.status,
      body.error?.message ?? res.statusText,
      body.error?.code,
    );
  }

  return res.json() as Promise<T>;
}

/**
 * Proactively refreshes the access-token cookie (15min TTL). Call this before
 * handing a raw file URL to something that can't retry on 401 itself — an
 * <iframe src>, window.open, or a plain <a href> download all bypass
 * apiFetch's reactive refresh-on-401 above, so a token that's simply gone
 * stale surfaces as a broken/failed file load instead of a fresh one.
 * Returns false if the session is fully expired (refresh token also gone).
 */
export async function ensureFreshSession(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Convenient method wrappers ───────────────────────────────────────────────
export const api = {
  get: <T>(path: string, init?: RequestInit) =>
    apiFetch<T>(path, { ...init, method: 'GET' }),

  post: <T>(path: string, body?: unknown, init?: RequestInit) =>
    apiFetch<T>(path, {
      ...init,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(path: string, body?: unknown, init?: RequestInit) =>
    apiFetch<T>(path, {
      ...init,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T = void>(path: string, init?: RequestInit) =>
    apiFetch<T>(path, { ...init, method: 'DELETE' }),

  /** Multipart upload — caller builds FormData, Content-Type set by browser.
   *  Defaults to POST; pass init.method to override (e.g. PATCH to replace). */
  upload: <T>(path: string, form: FormData, init?: RequestInit) =>
    apiFetch<T>(path, { method: 'POST', ...init, body: form }),
};

// ── Server-side fetch (forwards Next.js cookies) ─────────────────────────────
export async function serverFetch<T>(
  path: string,
  cookieHeader: string,
  init?: RequestInit,
): Promise<T> {
  return apiFetch<T>(path, {
    ...init,
    headers: { Cookie: cookieHeader, ...init?.headers },
  });
}
