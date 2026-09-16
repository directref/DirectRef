import useSWR from 'swr';
import { connectionsApi } from '../api/connections';
import type { Connection } from '../types';

export function useConnections(params?: { status?: string; direction?: string }, initialData?: Connection[]) {
  const key = params
    ? (['connections', params] as const)
    : (['connections', {}] as const);
  const { data, error, isLoading, mutate } = useSWR(
    key,
    ([, p]) => connectionsApi.list(p as { status?: string; direction?: string }).then((r) => r.data),
    { fallbackData: initialData },
  );
  return { connections: data ?? [], error, isLoading, mutate };
}
