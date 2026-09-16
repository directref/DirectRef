'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { FileText, MessageCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { MessageThread } from '@/components/application/MessageThread';
import { applicationsApi } from '@/lib/api/applications';
import { STATUS_LABELS, STATUS_COLORS, timeAgo } from '@/lib/utils';
import type { ApplicationWithDetails } from '@/lib/types';

export function ApplicationCard({ data }: { data: ApplicationWithDetails }) {
  const { application, job, referrer } = data;
  const [msgOpen, setMsgOpen] = useState(false);
  const statusLabel = STATUS_LABELS[application.status] ?? application.status;
  const statusColor = STATUS_COLORS[application.status] ?? '';

  // Poll unread count; shares SWR key with MessageThread so opening clears badge
  const { data: msgData, mutate: mutateMsgs } = useSWR(
    `messages-${application.id}`,
    () => applicationsApi.getMessages(application.id).then((r) => r.data),
    { refreshInterval: 30_000, revalidateOnFocus: false },
  );
  const unreadCount = msgData?.unreadCount ?? 0;

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <Avatar src={referrer?.avatarUrl} name={referrer?.fullName ?? '?'} size="md" />
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-bold text-text-primary text-sm">{job.title}</p>
              <p className="text-xs text-text-secondary mt-0.5">
                {job.companyName} · via {referrer?.fullName}
              </p>
            </div>
            <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full border ${statusColor}`}>
              {statusLabel}
            </span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="inline-flex items-center gap-1 text-xs text-text-muted">
              <FileText className="w-3.5 h-3.5" strokeWidth={1.8} /> {application.cvOriginalName}
            </span>
            <span className="text-xs text-text-muted">{timeAgo(application.createdAt)}</span>
          </div>

          {/* Message button */}
          <div className="mt-3">
            <Button
              variant="ghost"
              size="sm"
              className="relative gap-1.5"
              onClick={() => setMsgOpen(true)}
            >
              <MessageCircle className="w-3.5 h-3.5" strokeWidth={1.8} /> Message
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-crit text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                  {unreadCount}
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Message thread dialog */}
      <MessageThread
        applicationId={application.id}
        otherPartyName={referrer?.fullName ?? 'Referrer'}
        open={msgOpen}
        onClose={() => setMsgOpen(false)}
        onRead={() => mutateMsgs()}
      />
    </Card>
  );
}

