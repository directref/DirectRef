import { useCallback } from 'react';
import useSWR from 'swr';
import { jobsApi } from '../api/jobs';
import type { JobWithReferrer } from '../types';

interface UseJobsParams {
  q?: string;
  company?: string;
  page?: number;
  limit?: number;
}

export function useJobFeed(params?: UseJobsParams, initialData?: JobWithReferrer[]) {
  const key = ['jobs/feed', params] as const;
  const { data, error, isLoading, mutate } = useSWR(
    key,
    ([, p]) => jobsApi.feed(p ?? undefined).then((r) => r.data),
    {
      fallbackData: initialData,
      keepPreviousData: true,
      revalidateOnFocus: false,
    },
  );
  return { jobs: data ?? [], error, isLoading, mutate };
}

export function useJobSearch(params?: UseJobsParams) {
  const key = params?.q || params?.company ? ['jobs/search', params] : null;
  const { data, error, isLoading } = useSWR(
    key,
    ([, p]) => jobsApi.search(p as UseJobsParams | undefined).then((r) => r.data),
    { keepPreviousData: true },
  );
  return { jobs: data ?? [], error, isLoading };
}

export function useJob(id: string | null) {
  const { data, error, isLoading } = useSWR(
    id ? `jobs/${id}` : null,
    () => jobsApi.byId(id!).then((r) => r.data),
  );
  return { jobData: data ?? null, error, isLoading };
}

export function useMyJobs() {
  const { data, error, isLoading, mutate } = useSWR(
    'jobs/mine',
    () => jobsApi.mine().then((r) => r.data),
  );
  return { jobs: data ?? [], error, isLoading, mutate };
}
