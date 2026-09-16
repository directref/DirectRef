import useSWR, { mutate as globalMutate } from 'swr';
import { applicationsApi } from '../api/applications';
import type { ApplicationWithDetails } from '../types';

export function useInbox(status?: string, initialData?: ApplicationWithDetails[]) {
  const key = ['applications/inbox', status];
  const { data, error, isLoading, mutate } = useSWR(
    key,
    ([, s]) => applicationsApi.inbox({ status: s ?? undefined }).then((r) => r.data),
    { fallbackData: initialData, refreshInterval: 30_000 },
  );
  return { applications: data ?? [], error, isLoading, mutate };
}

export function useMyApplications(initialData?: ApplicationWithDetails[]) {
  const { data, error, isLoading, mutate } = useSWR(
    'applications/mine',
    () => applicationsApi.mine().then((r) => r.data),
    { fallbackData: initialData },
  );
  return { applications: data ?? [], error, isLoading, mutate };
}

/**
 * Returns a Map of jobId → status for every job the user applied to.
 * Used by JobCard for the status icon + tooltip.
 */
export function useMyApplicationsMap() {
  const { data, mutate } = useSWR(
    'applications/mine/map',
    () => applicationsApi.mine().then((r) => {
      const map = new Map<string, string>();
      (r.data ?? []).forEach((a) => map.set(a.job.id, a.application.status));
      return map;
    }),
    { revalidateOnFocus: true },
  );
  return { appMap: data ?? new Map<string, string>(), mutate };
}

/**
 * Returns a Set of jobIds the current user has already applied to.
 */
export function useAppliedJobIds() {
  const { appMap } = useMyApplicationsMap();
  return new Set(appMap.keys());
}

/** Optimistically add a job to the applied map after sending a CV */
export function optimisticAddApplication(jobId: string) {
  globalMutate(
    'applications/mine/map',
    (current: Map<string, string> | undefined) => {
      const updated = new Map(current ?? []);
      updated.set(jobId, 'submitted');
      return updated;
    },
    { revalidate: true },
  );
  globalMutate('applications/mine');
}
