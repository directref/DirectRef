import { api } from './client';
import type { ApiResponse, Connection } from '../types';

export const connectionsApi = {
  send: (addresseeId: string) =>
    api.post<ApiResponse<Connection>>('/api/connections', { addresseeId }),

  list: (params?: { status?: string; direction?: string }) => {
    const qs = Object.entries(params ?? {})
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    return api.get<{ data: Connection[] }>(`/api/connections${qs ? `?${qs}` : ''}`);
  },

  update: (id: string, status: 'accepted' | 'rejected') =>
    api.patch<ApiResponse<Connection>>(`/api/connections/${id}`, { status }),

  remove: (id: string) =>
    api.delete(`/api/connections/${id}`),

  mutual: (userId: string) =>
    api.get<{ data: { isFriend: boolean; connectionId: string | null } }>(
      `/api/connections/mutual/${userId}`,
    ),
};
