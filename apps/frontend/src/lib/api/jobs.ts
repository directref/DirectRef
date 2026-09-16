import { api, serverFetch } from './client';
import type { ApiResponse, JobWithReferrer, Job } from '../types';

interface JobsParams {
  q?: string;
  company?: string;
  page?: number;
  limit?: number;
}

function toQuery(params?: JobsParams | Record<string, string | number | undefined>): string {
  if (!params) return '';
  const qs = Object.entries(params as Record<string, unknown>)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');
  return qs ? `?${qs}` : '';
}

export const jobsApi = {
  /** Feed: jobs from accepted connections */
  feed: (params?: JobsParams) =>
    api.get<{ data: JobWithReferrer[] }>(`/api/jobs/feed${toQuery(params)}`),

  /** Search all active jobs */
  search: (params?: JobsParams) =>
    api.get<{ data: JobWithReferrer[] }>(`/api/jobs${toQuery(params)}`),

  /** Jobs matching the seeker's saved profile preferences (desired role,
   *  location, employment type, seniority) */
  suggested: (limit?: number) =>
    api.get<{ data: JobWithReferrer[] }>(`/api/jobs/suggested${toQuery({ limit })}`),

  /** Referrer's own posted jobs */
  mine: (params?: Pick<JobsParams, 'page' | 'limit'>) =>
    api.get<{ data: Job[] }>(`/api/jobs/mine${toQuery(params)}`),

  /** Single job + referrer info */
  byId: (id: string) =>
    api.get<{ data: JobWithReferrer }>(`/api/jobs/${id}`),

  /** Create a job posting */
  create: (body: Partial<Job> & { sourceUrl: string; title: string; companyName: string }) =>
    api.post<ApiResponse<Job>>('/api/jobs', body),

  /** Scrape a URL for job metadata */
  scrape: (url: string) =>
    api.post<{ data: Partial<Job> }>('/api/jobs/scrape', { url }),

  /** Update a job posting */
  update: (id: string, body: Partial<Job>) =>
    api.patch<ApiResponse<Job>>(`/api/jobs/${id}`, body),

  /** Deactivate a job posting */
  delete: (id: string) =>
    api.delete(`/api/jobs/${id}`),
};

/** Server Component: fetch job feed with forwarded cookies */
export async function getServerJobFeed(cookieHeader: string, params?: JobsParams) {
  try {
    const res = await serverFetch<{ data: JobWithReferrer[] }>(
      `/api/jobs/feed${toQuery(params)}`,
      cookieHeader,
    );
    return res.data ?? [];
  } catch {
    return [];
  }
}

/** Server Component: fetch single job */
export async function getServerJob(id: string, cookieHeader: string) {
  return serverFetch<{ data: JobWithReferrer }>(`/api/jobs/${id}`, cookieHeader);
}
