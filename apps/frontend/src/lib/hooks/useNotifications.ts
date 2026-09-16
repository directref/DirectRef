import useSWR from 'swr';
import { notificationsApi, type Notification } from '../api/notifications';

export function useNotifications() {
  const { data, error, isLoading, mutate } = useSWR(
    'notifications',
    () => notificationsApi.list().then((r) => r.data),
    { refreshInterval: 15_000 }, // poll every 15s
  );
  return { notifications: data ?? [], error, isLoading, mutate };
}

export function useUnreadCount() {
  const { data, mutate } = useSWR(
    'notifications/unread-count',
    () => notificationsApi.unreadCount().then((r) => r.data.count),
    { refreshInterval: 15_000 },
  );
  return { count: data ?? 0, mutate };
}
