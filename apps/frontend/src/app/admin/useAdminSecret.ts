'use client';

import { useCallback, useEffect, useState } from 'react';
import { API_BASE } from '@/lib/constants';

const KEY = 'directref.adminSecret';

/** The admin secret lives in sessionStorage: survives a refresh, gone when
 *  the tab closes. Storage can throw (private mode, blocked site data) — then
 *  it simply has to be typed again. */
export function useAdminSecret() {
  const [secret, setSecretState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try { setSecretState(sessionStorage.getItem(KEY)); } catch { /* no storage */ }
    setReady(true);
  }, []);

  const setSecret = useCallback((value: string | null) => {
    setSecretState(value);
    try {
      if (value) sessionStorage.setItem(KEY, value);
      else sessionStorage.removeItem(KEY);
    } catch { /* no storage */ }
  }, []);

  return { secret, setSecret, ready };
}

export class AdminFetchError extends Error {
  constructor(public code: 'BAD_SECRET' | 'DISABLED' | 'FAILED', message: string) {
    super(message);
  }
}

/** Plain fetch, not apiFetch: a wrong admin secret is a 401 that must NOT
 *  trigger the app's token refresh or the global SWR "auth:logout" handler,
 *  which only look at `status` — so this error deliberately carries none. */
export async function adminFetch<T>(path: string, secret: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { 'x-admin-secret': secret } });
  if (res.status === 401) throw new AdminFetchError('BAD_SECRET', 'Wrong admin secret');
  if (res.status === 503) throw new AdminFetchError('DISABLED', 'The admin API is disabled until ADMIN_SECRET is set on the backend');
  if (!res.ok) throw new AdminFetchError('FAILED', `Request failed (${res.status})`);
  return ((await res.json()) as { data: T }).data;
}
