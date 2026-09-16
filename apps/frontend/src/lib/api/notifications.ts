import { api } from './client';

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

export const notificationsApi = {
  list: () =>
    api.get<{ data: Notification[] }>('/api/notifications'),

  unreadCount: () =>
    api.get<{ data: { count: number } }>('/api/notifications/unread-count'),

  markRead: (id: string) =>
    api.patch(`/api/notifications/${id}/read`),

  markAllRead: () =>
    api.patch('/api/notifications/read-all'),
};
