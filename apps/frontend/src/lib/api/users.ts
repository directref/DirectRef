import { api } from './client';
import type { ApiResponse, User, PublicUser } from '../types';

export const usersApi = {
  me: () =>
    api.get<ApiResponse<User>>('/api/users/me'),

  updateMe: (
    body: Partial<Pick<User, 'fullName' | 'headline' | 'companyName' | 'isReferrer' | 'isSeeker' | 'avatarUrl' | 'onboarded' | 'desiredRole' | 'preferredLocation' | 'yearsOfExperience' | 'employmentType' | 'seniority'>>
      // Clearing a verified LinkedIn link is the one allowed write here — setting it goes through OAuth connect.
      & { linkedinId?: null },
  ) =>
    api.patch<ApiResponse<User>>('/api/users/me', body),

  /** Submits (or replaces) a work email and sends a confirmation link —
   *  required before posting a job (see jobs/post/page.tsx). */
  submitWorkEmail: (workEmail: string) =>
    api.post<{ message: string }>('/api/users/me/work-email', { workEmail }),

  byId: (id: string) =>
    api.get<ApiResponse<PublicUser>>(`/api/users/${id}`),

  search: (q: string, page = 1, limit = 50) =>
    api.get<{ data: PublicUser[] }>(`/api/users/search?q=${encodeURIComponent(q)}&page=${page}&limit=${limit}`),

  deleteMe: () =>
    api.delete('/api/users/me'),

  /** Upload (or replace) the CV of record on the profile */
  uploadCv: (file: File) => {
    const form = new FormData();
    form.append('cv', file);
    return api.upload<ApiResponse<User>>('/api/users/me/cv', form);
  },

  removeCv: () =>
    api.delete<ApiResponse<User>>('/api/users/me/cv'),

  /** Profile CV download URL — forces file save */
  cvUrl: () =>
    `${process.env.NEXT_PUBLIC_API_URL}/api/users/me/cv`,

  /** Profile CV preview URL — opens inline in browser (PDF displays, Word downloads) */
  cvPreviewUrl: () =>
    `${process.env.NEXT_PUBLIC_API_URL}/api/users/me/cv/preview`,
};
