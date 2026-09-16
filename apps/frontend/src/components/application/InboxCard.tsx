'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { FileText, Eye, Download, MessageCircle, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { MessageThread } from '@/components/application/MessageThread';
import { applicationsApi } from '@/lib/api/applications';
import { STATUS_LABELS, STATUS_COLORS, formatBytes, timeAgo, jobCode } from '@/lib/utils';
import { ApiError, ensureFreshSession } from '@/lib/api/client';
import type { ApplicationWithDetails } from '@/lib/types';

interface InboxCardProps {
  data: ApplicationWithDetails;
  onUpdate: () => void;
}

export function InboxCard({ data, onUpdate }: InboxCardProps) {
  const { application, job, seeker } = data;
  const [declining, setDeclining]           = useState(false);
  const [confirmDecline, setConfirmDecline] = useState(false);
  const [msgOpen, setMsgOpen]               = useState(false);

  // Lightweight unread count poll — shares SWR key with MessageThread so opening clears badge
  const { data: msgData, mutate: mutateMsgs } = useSWR(
    `messages-${application.id}`,
    () => applicationsApi.getMessages(application.id).then((r) => r.data),
    { refreshInterval: 30_000, revalidateOnFocus: false },
  );
  const unreadCount = msgData?.unreadCount ?? 0;

  const cvUrl        = applicationsApi.cvUrl(application.id);
  const cvPreviewUrl = applicationsApi.cvPreviewUrl(application.id);
  const statusLabel = STATUS_LABELS[application.status] ?? application.status;
  const statusColor = STATUS_COLORS[application.status] ?? '';
  const isDone      = application.status === 'rejected';

  const handleView = async () => {
    // window.open navigates straight to a cookie-authed URL — it can't retry
    // on a 401 the way apiFetch does, so make sure the token is fresh first.
    const ok = await ensureFreshSession();
    if (!ok) { toast.error('Your session expired — refresh the page and log in again.'); return; }
    // Opens inline in browser tab — PDF displays, Word downloads
    window.open(cvPreviewUrl, '_blank');
    setTimeout(onUpdate, 1500);
  };

  const handleDownloadClick = async () => {
    const ok = await ensureFreshSession();
    if (!ok) { toast.error('Your session expired — refresh the page and log in again.'); return; }
    const link = document.createElement('a');
    link.href = cvUrl;
    link.download = application.cvOriginalName;
    link.click();
  };

  const handleDecline = async () => {
    setDeclining(true);
    try {
      await applicationsApi.updateStatus(application.id, 'rejected');
      toast.success('Marked as not a fit');
      onUpdate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed');
    } finally {
      setDeclining(false);
      setConfirmDecline(false);
    }
  };

  return (
    <Card className={`p-4 ${isDone ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-3">
        <Avatar src={seeker?.avatarUrl} name={seeker?.fullName ?? '?'} size="md" />
        <div className="flex-1 min-w-0">

          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-bold text-text-primary text-sm">{seeker?.fullName}</p>
              <p className="text-xs text-text-secondary mt-0.5">
                Applied: {job.title}
                <span className="ml-2 text-text-muted font-mono text-[11px]">{jobCode(job.companyName, job.id)}</span>
              </p>
            </div>
            <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full border ${statusColor}`}>
              {statusLabel}
            </span>
          </div>

          {/* Cover note */}
          {application.coverNote && (
            <div className="mt-2 text-xs text-text-secondary bg-input rounded-lg px-3 py-2 line-clamp-2 italic">
              &ldquo;{application.coverNote}&rdquo;
            </div>
          )}

          {/* CV file info */}
          <div className="flex items-center gap-2 mt-3">
            <span className="inline-flex items-center gap-1 text-xs text-text-muted">
              <FileText className="w-3.5 h-3.5" strokeWidth={1.8} /> {application.cvOriginalName} · {formatBytes(application.cvSizeBytes)}
            </span>
            <span className="text-xs text-text-muted ml-auto">{timeAgo(application.createdAt)}</span>
          </div>

          {/* Actions — always show all options (can view multiple times) */}
          {!isDone && (
            <div className="mt-3 space-y-2">
              <div className="flex gap-2 flex-wrap">
                {/* View — always available */}
                <Button variant="secondary" size="sm" onClick={handleView} className="shrink-0 gap-1.5">
                  <Eye className="w-3.5 h-3.5" strokeWidth={1.8} /> View
                </Button>

                {/* Download — always available */}
                <Button variant="primary" size="sm" onClick={handleDownloadClick} className="flex-1 gap-1.5">
                  <Download className="w-3.5 h-3.5" strokeWidth={1.8} /> Download CV
                </Button>

                {/* Message */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="relative shrink-0 gap-1.5"
                  onClick={() => setMsgOpen(true)}
                >
                  <MessageCircle className="w-3.5 h-3.5" strokeWidth={1.8} /> Message
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-crit text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                      {unreadCount}
                    </span>
                  )}
                </Button>

                {/* Not a fit */}
                {!confirmDecline && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-text-muted hover:text-crit shrink-0"
                    onClick={() => setConfirmDecline(true)}
                  >
                    Not a fit
                  </Button>
                )}
              </div>

              {/* Confirm decline */}
              {confirmDecline && (
                <div className="flex items-center gap-2 bg-crit/10 border border-crit/20 rounded-lg px-3 py-2">
                  <span className="text-xs text-text-secondary flex-1">Mark as not a fit?</span>
                  <Button variant="danger" size="sm" isLoading={declining} onClick={handleDecline}>
                    Confirm
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDecline(false)}>
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Done state — still allow messaging */}
          {isDone && (
            <div className="mt-3 flex items-center gap-2">
              <Badge variant="muted">
                <XCircle className="w-3 h-3" strokeWidth={2} /> Not a fit
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="relative ml-auto shrink-0 gap-1.5"
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
          )}

        </div>
      </div>

      {/* Message thread dialog */}
      <MessageThread
        applicationId={application.id}
        otherPartyName={seeker?.fullName ?? 'Applicant'}
        open={msgOpen}
        onClose={() => setMsgOpen(false)}
        onRead={() => mutateMsgs()}
      />
    </Card>
  );
}
