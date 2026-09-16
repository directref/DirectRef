import { api, serverFetch } from './client';
import type { ApiResponse, User } from '../types';
import { API_BASE } from '../constants';

export const authApi = {
  register: (body: { email: string; password: string; fullName: string; isReferrer?: boolean }) =>
    api.post<ApiResponse<User>>('/api/auth/register', body),

  login: (body: { email: string; password: string }) =>
    api.post<ApiResponse<User>>('/api/auth/login', body),

  logout: () => api.post('/api/auth/logout'),

  me: () => api.get<ApiResponse<User>>('/api/auth/me'),

  refresh: () => api.post('/api/auth/refresh'),

  forgotPassword: (email: string) =>
    api.post('/api/auth/forgot-password', { email }),

  resetPassword: (token: string, newPassword: string) =>
    api.post('/api/auth/reset-password', { token, newPassword }),

  verifyEmail: (token: string) =>
    api.get<{ message: string }>(`/api/auth/verify-email/${token}`),

  verifyWorkEmail: (token: string) =>
    api.get<{ message: string }>(`/api/auth/verify-work-email/${token}`),

  /** Full-page Google OAuth redirect — use window.location */
  googleOAuthUrl: () => `${API_BASE}/api/auth/google`,
};

/** Server Component version — forwards cookies from Next.js request */
export async function getServerUser(cookieHeader: string): Promise<User | null> {
  try {
    const res = await serverFetch<ApiResponse<User>>('/api/users/me', cookieHeader);
    return res.data;
  } catch {
    return null;
  }
}
