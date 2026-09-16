import { api } from './client';

export interface InviteInfo {
  inviter: {
    id: string;
    fullName: string;
    companyName: string | null;
    avatarUrl: string | null;
  };
  token: string;
}

export interface Colleague {
  id: string;
  fullName: string;
  headline: string | null;
  avatarUrl: string | null;
  companyName: string | null;
}

export const invitesApi = {
  getLink: () =>
    api.get<{ data: { url: string } }>('/api/invites/link'),

  getInfo: (token: string) =>
    api.get<{ data: InviteInfo }>(`/api/invites/join/${token}`),

  redeem: (token: string) =>
    api.post(`/api/invites/redeem/${token}`),

  getColleagues: (company?: string) => {
    const qs = company ? `?company=${encodeURIComponent(company)}` : '';
    return api.get<{ data: Colleague[] }>(`/api/invites/colleagues${qs}`);
  },
};
