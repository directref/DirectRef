'use client';

import { mutate } from 'swr';
import { useRouter } from 'next/navigation';
import { Eye, Send, Inbox, XCircle, Handshake, CheckCircle2, Bell, ChevronRight, type LucideIcon } from 'lucide-react';
import { useNotifications } from '@/lib/hooks/useNotifications';
import { notificationsApi } from '@/lib/api/notifications';
import { Button } from '@/components/ui/Button';
import { timeAgo, cn } from '@/lib/utils';

const TYPE_ICON: Record<string, LucideIcon> = {
  cv_viewed:            Eye,
  cv_forwarded:         Send,
  cv_received:          Inbox,
  cv_rejected:          XCircle,
  connection_request:   Handshake,
  connection_accepted:  CheckCircle2,
};

export default function NotificationsPage() {
  const router = useRouter();
  const { notifications, isLoading, mutate: refresh } = useNotifications();

  const handleMarkAll = async () => {
    await notificationsApi.markAllRead();
    refresh();
    mutate('notifications/unread-count');
  };

  const handleMarkOne = async (id: string) => {
    await notificationsApi.markRead(id);
    refresh();
    mutate('notifications/unread-count');
  };

  const unread = notifications.filter((n) => !n.isRead);

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-0.5">Notifications</h1>
          <p className="text-sm text-text-secondary">
            {unread.length > 0 ? `${unread.length} unread` : 'All caught up'}
          </p>
        </div>
        {unread.length > 0 && (
          <Button variant="ghost" size="sm" onClick={handleMarkAll}>
            Mark all read
          </Button>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-card rounded-xl animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20">
          <Bell className="w-10 h-10 mx-auto mb-4 text-text-muted" strokeWidth={1.5} />
          <h3 className="text-base font-bold text-text-primary mb-2">No notifications yet</h3>
          <p className="text-sm text-text-secondary">
            When someone views or forwards your CV you&apos;ll see it here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const isClickable = !!n.linkUrl || !n.isRead;
            return (
              <div
                key={n.id}
                onClick={() => {
                  if (!n.isRead) handleMarkOne(n.id);
                  if (n.linkUrl) router.push(n.linkUrl);
                }}
                className={cn(
                  'flex items-start gap-3 px-4 py-3.5 rounded-xl border transition-all',
                  n.isRead ? 'bg-card border-border opacity-60' : 'bg-card border-gold-300/20',
                  isClickable && 'cursor-pointer hover:border-gold-300/40 hover:bg-card-hover',
                )}
              >
                {/* Icon */}
                <div className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
                  n.isRead ? 'bg-input' : 'bg-gold-300/15',
                )}>
                  {(() => {
                    const Icon = TYPE_ICON[n.type] ?? Bell;
                    return <Icon className="w-[18px] h-[18px] text-text-secondary" strokeWidth={1.8} />;
                  })()}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-sm leading-snug',
                    n.isRead ? 'text-text-secondary' : 'text-text-primary font-semibold',
                  )}>
                    {n.title}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">{n.body}</p>
                  <p className="text-xs text-text-muted mt-1">{timeAgo(n.createdAt)}</p>
                </div>

                {/* Unread dot + affordance chevron */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {!n.isRead && (
                    <div className="w-2 h-2 rounded-full bg-gold-300" />
                  )}
                  {n.linkUrl && (
                    <ChevronRight className="w-4 h-4 text-text-muted" strokeWidth={1.8} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
