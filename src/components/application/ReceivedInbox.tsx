'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { Tooltip } from '@/components/ui/Tooltip';
import { MessageThread } from '@/components/application/MessageThread';
import { applicationsApi } from '@/lib/api/applications';
import { STATUS_COLORS, STATUS_TOOLTIPS, formatBytes, cn } from '@/lib/utils';
import { ApiError, ensureFreshSession } from '@/lib/api/client';
import type { ApplicationWithDetails } from '@/lib/types';

// Status pill wording — the underlying status column reads 'submitted' |
// 'viewed' | 'forwarded' | 'rejected' etc., these are just the referrer-
// facing display labels.
const STATUS_LABEL: Record<string, string> = {
  // "Submitted" read as something the referrer had already done, when it
  // means the opposite — nothing has happened on their side yet. Matches
  // the "Awaiting review" wording the filter chip below already uses for
  // this same bucket, so the two never say different things about one state.
  submitted: 'Awaiting review',
  viewed: 'Viewed',
  forwarded: 'Downloaded',
  internally_submitted: 'Submitted internally',
  rejected: 'Not a fit',
  expired: 'Expired',
  withdrawn: 'Withdrawn',
};

// The 4 KPI/filter chips — fixed set. Submitted + Viewed collapse into one
// "Awaiting review" bucket here (the row's own status pill still tells them
// apart — "Awaiting review" vs "Viewed") — this is a display-only grouping,
// not a new status value.
type Filter = 'all' | 'pending' | 'forwarded' | 'rejected';

const FILTER_CHIPS: { id: Filter; label: string; match: (status: string) => boolean; countColor: string }[] = [
  { id: 'all', label: 'All', match: () => true, countColor: 'text-text-primary' },
  { id: 'pending', label: 'Awaiting review', match: (s) => s === 'submitted' || s === 'viewed', countColor: 'text-warn' },
  { id: 'forwarded', label: 'Downloaded', match: (s) => s === 'forwarded', countColor: 'text-good' },
  { id: 'rejected', label: 'Not a fit', match: (s) => s === 'rejected', countColor: 'text-text-muted' },
];

/** "Today" / "Yesterday" / "N days ago", falling back to a short date further out. */
function relativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** List-row preview: the seeker's note (first sentence) if they wrote one,
 *  otherwise their profile headline — lets a referrer skim intent before opening the detail panel. */
function listPreview(coverNote: string | null | undefined, headline: string | null | undefined): string {
  const source = coverNote?.trim() || headline?.trim() || '';
  if (!source) return '';
  const firstSentence = source.match(/^[^.!?\n]+[.!?]?/)?.[0] ?? source;
  return firstSentence.trim();
}

function FileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="shrink-0">
      <path d="M6 2h9l5 5v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" />
      <path d="M15 2v5h5" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
    </svg>
  );
}

// One row in the request list — its own component (not just a .map() body)
// so it can poll its own unread-message count via useSWR; hooks can't be
// called per-iteration inside a loop. Shares the `messages-${id}` SWR key
// with DetailPanel/MessageThread, so opening the thread clears this badge too.
function InboxListRow({
  a,
  isSelected,
  onSelect,
}: {
  a: ApplicationWithDetails;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const preview = listPreview(a.application.coverNote, a.seeker?.headline);
  const { data: msgData } = useSWR(
    `messages-${a.application.id}`,
    () => applicationsApi.getMessages(a.application.id).then((r) => r.data),
    { refreshInterval: 30_000, revalidateOnFocus: false },
  );
  const unreadCount = msgData?.unreadCount ?? 0;

  return (
    <button
      onClick={onSelect}
      className={cn(
        'text-left bg-card border rounded-xl px-4 py-3.5 transition-colors cursor-pointer',
        isSelected ? 'border-gold-300 ring-1 ring-gold-300/30' : 'border-border hover:border-border-strong',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-sm font-bold text-text-primary truncate">{a.seeker?.fullName}</p>
        <div className="flex items-center gap-1.5 shrink-0">
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[15px] h-[15px] px-1 rounded-full bg-gold-300 text-[#0A0A0A] text-[10px] font-bold leading-none">
              {unreadCount}
            </span>
          )}
          <Tooltip content={STATUS_TOOLTIPS[a.application.status]}>
            {/* No tabIndex here — this row is already a <button>; a focusable
                child inside it would be a nested-interactive-element a11y bug. */}
            <span
              className={cn(
                'shrink-0 inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border cursor-help',
                STATUS_COLORS[a.application.status],
              )}
            >
              {STATUS_LABEL[a.application.status] ?? a.application.status}
            </span>
          </Tooltip>
        </div>
      </div>
      <p className="text-xs text-text-secondary mb-0.5 truncate">{a.job.title}</p>
      {preview && <p className="text-xs text-text-muted line-clamp-2 mb-1">{preview}</p>}
      <p className="text-[11px] text-text-muted">{relativeDate(a.application.createdAt)}</p>
    </button>
  );
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="shrink-0">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function ReceivedInbox({
  apps,
  onUpdate,
  initialOpenMessageId,
}: {
  apps: ApplicationWithDetails[];
  onUpdate: () => void;
  initialOpenMessageId?: string | null;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(initialOpenMessageId ?? null);

  // Counts always reflect the full dataset, regardless of the active filter.
  const counts = Object.fromEntries(
    FILTER_CHIPS.map((c) => [c.id, apps.filter((a) => c.match(a.application.status)).length]),
  ) as Record<Filter, number>;

  const activeChip = FILTER_CHIPS.find((c) => c.id === filter)!;
  const filtered = apps.filter((a) => activeChip.match(a.application.status));

  const selected = useMemo(
    () => filtered.find((a) => a.application.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  if (apps.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-16 text-center">
        <p className="text-sm font-semibold text-text-primary mb-1">No CVs yet</p>
        <p className="text-xs text-text-muted">When someone applies to your job posting, their CV will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPI chips — also the filter control; counts stay fixed to the full dataset */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {FILTER_CHIPS.map((c) => {
          const active = filter === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setFilter(c.id)}
              className={cn(
                'text-left rounded-xl px-5 py-4 transition-colors cursor-pointer',
                active ? 'bg-card border-2 border-gold-300' : 'bg-page border border-border-strong hover:border-text-muted',
              )}
            >
              <p
                className={cn(
                  'text-[11px] font-semibold uppercase tracking-wide mb-1.5',
                  active ? 'text-text-primary' : 'text-text-muted',
                )}
              >
                {c.label}
              </p>
              <p className={cn('text-3xl font-bold', c.countColor)}>{counts[c.id]}</p>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-text-muted">No requests in this filter.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-5 items-start">
          {/* Left — request list */}
          <div className="flex flex-col gap-2 lg:max-h-[calc(100vh-260px)] lg:overflow-y-auto lg:pr-1">
            {filtered.map((a) => (
              <InboxListRow
                key={a.application.id}
                a={a}
                isSelected={selected?.application.id === a.application.id}
                onSelect={() => setSelectedId(a.application.id)}
              />
            ))}
          </div>

          {/* Right — sticky detail panel */}
          <div className="lg:sticky lg:top-6">
            {selected && (
              <DetailPanel
                key={selected.application.id}
                data={selected}
                onUpdate={onUpdate}
                autoOpenMessages={selected.application.id === initialOpenMessageId}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailPanel({
  data,
  onUpdate,
  autoOpenMessages,
}: {
  data: ApplicationWithDetails;
  onUpdate: () => void;
  autoOpenMessages?: boolean;
}) {
  const { application, job, seeker } = data;
  const [busy, setBusy] = useState<'download' | 'reject' | 'confirm' | null>(null);
  const [msgOpen, setMsgOpen] = useState(autoOpenMessages ?? false);
  const [cvOpen, setCvOpen] = useState(false);

  // Lightweight unread count poll — shares SWR key with MessageThread so opening clears the badge
  const { data: msgData, mutate: mutateMsgs } = useSWR(
    `messages-${application.id}`,
    () => applicationsApi.getMessages(application.id).then((r) => r.data),
    { refreshInterval: 30_000, revalidateOnFocus: false },
  );
  const unreadCount = msgData?.unreadCount ?? 0;

  // 'forwarded' (downloaded) isn't terminal anymore — the referrer still owes a
  // yes/no on whether they submitted it internally, so it gets its own branch below.
  const isAwaitingSubmission = application.status === 'forwarded';
  // 'withdrawn' only ever happens before a referrer views it (see
  // withdrawApplication), but a withdrawn application can still be opened
  // later from the "All" filter — without this it fell through to the
  // default branch and offered Download/Not a fit on an application whose
  // CV file no longer even exists on disk.
  const isDecided = application.status === 'rejected' || application.status === 'expired' || application.status === 'withdrawn';
  const cvUrl = applicationsApi.cvUrl(application.id);
  const cvPreviewUrl = applicationsApi.cvPreviewUrl(application.id);

  const roleLine = [seeker?.headline?.trim(), seeker?.yearsOfExperience != null ? `${seeker.yearsOfExperience} yrs` : null]
    .filter(Boolean)
    .join(', ');

  const handleViewCv = async () => {
    // The iframe navigates straight to a cookie-authed URL — it can't retry on
    // a 401 the way apiFetch does, so make sure the token is fresh first.
    const ok = await ensureFreshSession();
    if (!ok) { toast.error('Your session expired — refresh the page and log in again.'); return; }
    // Inline preview modal, not a download prompt — the referrer reads it without leaving the page.
    setCvOpen(true);
    if (application.status === 'submitted') setTimeout(onUpdate, 1200);
  };

  const handleDownload = async () => {
    setBusy('download');
    try {
      const ok = await ensureFreshSession();
      if (!ok) { toast.error('Your session expired — refresh the page and log in again.'); return; }
      const link = document.createElement('a');
      link.href = cvUrl;
      link.download = application.cvOriginalName;
      link.click();
      await applicationsApi.updateStatus(application.id, 'forwarded');
      toast.success('CV downloaded');
      onUpdate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update status');
    } finally {
      setBusy(null);
    }
  };

  const handleNotAFit = async () => {
    setBusy('reject');
    try {
      await applicationsApi.updateStatus(application.id, 'rejected');
      toast.success('Marked as not a fit');
      onUpdate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update status');
    } finally {
      setBusy(null);
    }
  };

  const handleConfirmSubmitted = async () => {
    setBusy('confirm');
    try {
      await applicationsApi.updateStatus(application.id, 'internally_submitted');
      toast.success('Marked as submitted internally');
      onUpdate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update status');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar src={seeker?.avatarUrl} name={seeker?.fullName ?? '?'} size="lg" />
          <div className="min-w-0">
            <p className="text-base font-bold text-text-primary truncate">{seeker?.fullName}</p>
            {roleLine && <p className="text-sm text-text-secondary truncate">{roleLine}</p>}
          </div>
        </div>

        {/* Secondary, ongoing-conversation action — quieter than the two decision buttons below */}
        <button
          onClick={() => setMsgOpen(true)}
          className="relative shrink-0 flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-gold-500 transition-colors py-1 cursor-pointer"
        >
          <MessageIcon />
          Message
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] px-1 bg-gold-300 text-[#0A0A0A] text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Applying for */}
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1">Applying for</p>
      <p className="text-sm text-text-primary mb-5">{job.title}</p>

      {/* Note — optional, omitted entirely when the seeker didn't write one */}
      {application.coverNote && (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1">Note</p>
          <p className="text-sm text-text-secondary bg-input rounded-lg px-3 py-2.5 mb-5 whitespace-pre-wrap leading-relaxed">
            {application.coverNote}
          </p>
        </>
      )}

      {/* CV file row */}
      <div className="flex items-center justify-between gap-3 bg-page border border-border rounded-lg px-3.5 py-3 mb-5">
        <span className="flex items-center gap-2 text-sm text-text-primary min-w-0">
          <FileIcon />
          <span className="truncate">{application.cvOriginalName}</span>
          <span className="text-xs text-text-muted shrink-0">· {formatBytes(application.cvSizeBytes)}</span>
        </span>
        <Button variant="secondary" size="sm" onClick={handleViewCv} className="shrink-0">
          View CV
        </Button>
      </div>

      {/* Decision — replaced by a static status line once fully resolved; no re-deciding after the fact */}
      {isAwaitingSubmission ? (
        <div className="space-y-3">
          <p className="text-sm text-text-secondary bg-input rounded-lg px-3.5 py-2.5">
            Did you submit this to your internal system yet?
          </p>
          <div className="flex gap-3">
            <Button
              variant="primary"
              onClick={handleConfirmSubmitted}
              isLoading={busy === 'confirm'}
              disabled={busy !== null}
              className="flex-1"
            >
              Submitted
            </Button>
            <Button
              variant="secondary"
              onClick={handleNotAFit}
              isLoading={busy === 'reject'}
              disabled={busy !== null}
              className="flex-1"
            >
              Not a fit
            </Button>
          </div>
        </div>
      ) : application.status === 'internally_submitted' ? (
        <div className="space-y-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-text-secondary">
            <CheckIcon /> Submitted internally.
          </p>
          <Button
            variant="secondary"
            onClick={handleNotAFit}
            isLoading={busy === 'reject'}
            disabled={busy !== null}
            className="w-full"
          >
            Not a fit after all
          </Button>
        </div>
      ) : isDecided ? (
        <p className="flex items-center gap-1.5 text-sm font-semibold text-text-secondary">
          <CheckIcon />
          {application.status === 'expired'
            ? "This application expired because the referrer didn't respond within 5 days."
            : application.status === 'withdrawn'
              ? 'Withdrawn by the seeker before you opened it.'
              : 'Marked not a fit.'}
        </p>
      ) : (
        <div className="flex gap-3">
          <Button
            variant="primary"
            onClick={handleDownload}
            isLoading={busy === 'download'}
            disabled={busy !== null}
            className="flex-1"
          >
            Download
          </Button>
          <Button
            variant="secondary"
            onClick={handleNotAFit}
            isLoading={busy === 'reject'}
            disabled={busy !== null}
            className="flex-1"
          >
            Not a fit
          </Button>
        </div>
      )}

      <MessageThread
        applicationId={application.id}
        otherPartyName={seeker?.fullName ?? 'Applicant'}
        open={msgOpen}
        onClose={() => setMsgOpen(false)}
        onRead={() => mutateMsgs()}
      />

      <Dialog open={cvOpen} onOpenChange={(v) => !v && setCvOpen(false)}>
        <DialogContent
          title={application.cvOriginalName}
          onClose={() => setCvOpen(false)}
          className="max-w-4xl w-[92vw] h-[88vh] flex flex-col"
        >
          <div className="flex-1 min-h-0 p-3">
            <iframe
              src={cvPreviewUrl}
              title={application.cvOriginalName}
              className="w-full h-full rounded-lg border border-border bg-white"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
