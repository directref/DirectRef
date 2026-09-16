import { api } from './client';
import type { SavedJob } from '../types';

export const savedJobsApi = {
  getAll: () =>
    api.get<{ data: SavedJob[] }>('/api/saved-jobs'),

  save: (jobId: string) =>
    api.post<void>(`/api/saved-jobs/${jobId}`, {}),

  unsave: (jobId: string) =>
    api.delete(`/api/saved-jobs/${jobId}`),
};
