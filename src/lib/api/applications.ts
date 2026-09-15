import { api, serverFetch } from './client';
import type { ApiResponse, ApplicationWithDetails, ApplicationMessage } from '../types';

export const applicationsApi = {
  /** Submit a CV (multipart) */
  submit: (form: FormData) =>
    api.upload<ApiResponse<{ id: string }>>('/api/applications', form),

  /** Referrer inbox — received CVs */
  inbox: (params?: { status?: string; page?: number; limit?: number }) => {
    const qs = params?.status ? `?status=${params.status}` : '';
    return api.get<{ data: ApplicationWithDetails[] }>(`/api/applications/inbox${qs}`);
  },

  /** Seeker's sent applications */
  mine: () =>
    api.get<{ data: ApplicationWithDetails[] }>('/api/applications/mine'),

  /** Single application */
  byId: (id: string) =>
    api.get<{ data: ApplicationWithDetails }>(`/api/applications/${id}`),

  /** Update status (referrer: viewed | forwarded (Download decision) | rejected (Not a fit) |
   *  internally_submitted (confirms a downloaded CV was submitted internally)) */
  updateStatus: (id: string, status: 'viewed' | 'forwarded' | 'rejected' | 'internally_submitted') =>
    api.patch(`/api/applications/${id}/status`, { status }),

  /** Seeker: swap the CV on a pending application — only while status is
   *  'submitted' (before the referrer has opened it). */
  replaceCv: (id: string, file: File) => {
    const form = new FormData();
    form.append('cv', file);
    return api.upload<ApiResponse<{ id: string }>>(`/api/applications/${id}/cv`, form, { method: 'PATCH' });
  },

  /** Seeker: withdraw a pending application — only while status is
   *  'submitted'. Marks it withdrawn rather than deleting it. */
  withdraw: (id: string) =>
    api.post<ApiResponse<{ id: string }>>(`/api/applications/${id}/withdraw`),

  /** CV download URL — forces file save */
  cvUrl: (id: string) =>
    `${process.env.NEXT_PUBLIC_API_URL}/api/applications/${id}/cv`,

  /** CV preview URL — opens inline in browser (PDF displays, Word downloads) */
  cvPreviewUrl: (id: string) =>
    `${process.env.NEXT_PUBLIC_API_URL}/api/applications/${id}/cv/preview`,

  /** Fetch the message thread for an application */
  getMessages: (id: string) =>
    api.get<{ data: { messages: ApplicationMessage[]; unreadCount: number } }>(
      `/api/applications/${id}/messages`,
    ),

  /** Send a message in an application thread */
  sendMessage: (id: string, content: string) =>
    api.post<{ data: ApplicationMessage }>(`/api/applications/${id}/messages`, { content }),
};

/** Server Component: fetch inbox */
export async function getServerInbox(cookieHeader: string) {
  try {
    const res = await serverFetch<{ data: ApplicationWithDetails[] }>(
      '/api/applications/inbox',
      cookieHeader,
    );
    return res.data ?? [];
  } catch {
    return [];
  }
}

/** Server Component: fetch seeker's applications */
export async function getServerMyApplications(cookieHeader: string) {
  try {
    const res = await serverFetch<{ data: ApplicationWithDetails[] }>(
      '/api/applications/mine',
      cookieHeader,
    );
    return res.data ?? [];
  } catch {
    return [];
  }
}
