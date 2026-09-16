'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { FileText, MessageCircle, Bookmark } from 'lucide-react';
import { applicationsApi } from '@/lib/api/applications';
import { savedJobsApi } from '@/lib/api/savedJobs';
import { useAuth } from '@/lib/context/AuthContext';
import { ReceivedInbox } from '@/components/application/ReceivedInbox';
import { MessageThread } from '@/components/application/MessageThread';
import { Tooltip } from '@/components/ui/Tooltip';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { timeAgo, jobSlug, STATUS_LABELS, STATUS_TOOLTIPS } from '@/lib/utils';
import type { ApplicationWithDetails, SavedJob } from '@/lib/types';
import Link from 'next/link';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';

// ─── Design tokens ────────────────────────────────────────────────────────────
const GOLD   = 'oklch(0.72 0.13 85)';
const DARK   = '#1a1206';
const MUTED  = 'oklch(0.62 0.008 60)';
const BORDER = 'oklch(0.93 0.004 70)';
const BG     = '#fff';

// ─── Building icon (matches design) ──────────────────────────────────────────
function BuildingIcon() {
  return (
    <div style={{ width: 38, height: 38, borderRadius: 10, background: 'oklch(0.94 0.004 70)', color: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="4" y="3" width="16" height="18" rx="1" />
        <rect x="8"   y="7"  width="2.5" height="2.5" fill="currentColor" stroke="none" />
        <rect x="13.5" y="7"  width="2.5" height="2.5" fill="currentColor" stroke="none" />
        <rect x="8"   y="12" width="2.5" height="2.5" fill="currentColor" stroke="none" />
        <rect x="13.5" y="12" width="2.5" height="2.5" fill="currentColor" stroke="none" />
        <rect x="9.5" y="17" width="5"   height="4"   fill="currentColor" stroke="none" />
      </svg>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] ?? status;

  let badge: React.ReactNode;
  if (status === 'forwarded' || status === 'internally_submitted') {
    badge = (
      <span tabIndex={0} className="bg-good/15 text-good border border-good/25 rounded-full whitespace-nowrap cursor-help" style={{ fontSize: 12.5, fontWeight: 600, padding: '6px 14px' }}>
        {label}
      </span>
    );
  } else {
    const colors: Record<string, { bg: string; color: string }> = {
      submitted: { bg: 'oklch(0.88 0.09 85)',  color: 'oklch(0.3 0.06 85)' },
      viewed:    { bg: 'oklch(0.88 0.05 240)', color: 'oklch(0.3 0.05 240)' },
      rejected:  { bg: 'oklch(0.93 0.004 70)', color: 'oklch(0.47 0.008 60)' },
      expired:   { bg: 'oklch(0.93 0.004 70)', color: 'oklch(0.47 0.008 60)' },
      withdrawn: { bg: 'oklch(0.93 0.004 70)', color: 'oklch(0.47 0.008 60)' },
    };
    const c = colors[status] ?? { bg: 'oklch(0.93 0.004 70)', color: MUTED };
    badge = (
      <span tabIndex={0} className="cursor-help" style={{ fontSize: 12.5, fontWeight: 600, padding: '6px 14px', borderRadius: 100, background: c.bg, color: c.color, whiteSpace: 'nowrap' }}>
        {label}
      </span>
    );
  }

  const tooltip = STATUS_TOOLTIPS[status];
  return tooltip ? <Tooltip content={tooltip}>{badge}</Tooltip> : badge;
}

// ─── One "Sent CV" card — its own component (not just a .map() body) so it
// can poll its own unread-message count via useSWR; hooks can't be called
// per-iteration inside a loop. ───────────────────────────────────────────────
function SentAppRow({
  a,
  replacingId,
  msgOpenId,
  onReplaceClick,
  onWithdrawClick,
  onMessageOpen,
  onMessageClose,
}: {
  a: ApplicationWithDetails;
  replacingId: string | null;
  msgOpenId: string | null;
  onReplaceClick: (id: string) => void;
  onWithdrawClick: (id: string) => void;
  onMessageOpen: (id: string) => void;
  onMessageClose: () => void;
}) {
  const { data: msgData } = useSWR(
    `messages-${a.application.id}`,
    () => applicationsApi.getMessages(a.application.id).then(r => r.data),
    { refreshInterval: 30_000, revalidateOnFocus: false },
  );
  const unreadCount = msgData?.unreadCount ?? 0;

  return (
    <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header: icon + company/title + status badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <BuildingIcon />
          <div>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{a.job.companyName}</span>
            <h3 style={{ fontSize: 16.5, fontWeight: 600, margin: '4px 0 0', color: '#000000' }}>{a.job.title}</h3>
          </div>
        </div>
        <StatusBadge status={a.application.status} />
      </div>

      {/* Meta */}
      <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
        {`${a.job.companyName} · Applied ${timeAgo(a.application.createdAt)}`}
      </p>

      {/* Footer: via referrer + message/CV actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${BORDER}`, paddingTop: 14, flexWrap: 'wrap', gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: GOLD }}>via {a.referrer?.fullName}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {a.application.status === 'submitted' && (
            <>
              <button
                onClick={() => onReplaceClick(a.application.id)}
                disabled={replacingId === a.application.id}
                style={{ border: `1px solid ${BORDER}`, background: 'transparent', color: 'oklch(0.47 0.008 60)', fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 9, cursor: 'pointer', opacity: replacingId === a.application.id ? 0.5 : 1 }}
              >
                {replacingId === a.application.id ? 'Replacing…' : 'Replace CV'}
              </button>
              <button
                onClick={() => onWithdrawClick(a.application.id)}
                style={{ border: `1px solid ${BORDER}`, background: 'transparent', color: 'oklch(0.55 0.15 30)', fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 9, cursor: 'pointer' }}
              >
                Withdraw
              </button>
            </>
          )}
          <button
            onClick={() => onMessageOpen(a.application.id)}
            style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${BORDER}`, background: 'transparent', color: 'oklch(0.47 0.008 60)', fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 9, cursor: 'pointer' }}
          >
            <MessageCircle size={14} strokeWidth={1.8} /> Message
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute', top: -6, right: -6, minWidth: 16, height: 16, padding: '0 4px',
                  background: GOLD, color: DARK, fontSize: 10, fontWeight: 700, borderRadius: 999,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {msgOpenId === a.application.id && (
        <MessageThread
          applicationId={a.application.id}
          otherPartyName={a.referrer?.fullName ?? 'Referrer'}
          open
          onClose={onMessageClose}
          onRead={() => {}}
        />
      )}
    </div>
  );
}

// ─── TAB: Requests you sent ───────────────────────────────────────────────────
function SentTab({
  apps,
  onUpdate,
  initialOpenMessageId,
}: {
  apps: ApplicationWithDetails[];
  onUpdate: () => void;
  initialOpenMessageId?: string | null;
}) {
  const [msgOpen, setMsgOpen] = useState<string | null>(initialOpenMessageId ?? null);

  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const handleReplaceInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const applicationId = replaceTargetId;
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!applicationId || !file) return;
    await handleReplaceFile(applicationId, file);
  };

  const handleReplaceFile = async (applicationId: string, file: File) => {
    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) { toast.error('File is too large (max 10MB)'); return; }
    setReplacingId(applicationId);
    try {
      await applicationsApi.replaceCv(applicationId, file);
      toast.success('CV replaced.');
      onUpdate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to replace CV');
    } finally {
      setReplacingId(null);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawTarget) return;
    setWithdrawingId(withdrawTarget);
    try {
      await applicationsApi.withdraw(withdrawTarget);
      toast.success('Application withdrawn.');
      onUpdate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to withdraw');
    } finally {
      setWithdrawingId(null);
      setWithdrawTarget(null);
    }
  };

  if (apps.length === 0) {
    return (
      <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '48px 22px', textAlign: 'center' }}>
        <FileText size={36} strokeWidth={1.4} style={{ margin: '0 auto 12px', color: MUTED }} />
        <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>No applications yet</p>
        <p style={{ fontSize: 13, color: MUTED, margin: '0 0 16px' }}>When you send your CV to a referrer, it'll appear here.</p>
        <Link href="/jobs" style={{ fontSize: 13, fontWeight: 600, color: GOLD, textDecoration: 'none' }}>Browse jobs →</Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {apps.map(a => (
        <SentAppRow
          key={a.application.id}
          a={a}
          replacingId={replacingId}
          msgOpenId={msgOpen}
          onReplaceClick={(id) => { setReplaceTargetId(id); replaceInputRef.current?.click(); }}
          onWithdrawClick={setWithdrawTarget}
          onMessageOpen={setMsgOpen}
          onMessageClose={() => setMsgOpen(null)}
        />
      ))}

      <input ref={replaceInputRef} type="file" accept=".pdf" className="hidden" onChange={handleReplaceInputChange} />

      <ConfirmDialog
        open={withdrawTarget !== null}
        onOpenChange={(open) => !open && setWithdrawTarget(null)}
        title="Withdraw this application?"
        description="The referrer will be notified and your CV will be removed. You can always apply again later."
        confirmLabel="Withdraw"
        onConfirm={handleWithdraw}
        isLoading={withdrawingId !== null}
      />
    </div>
  );
}

// ─── TAB: Saved ───────────────────────────────────────────────────────────────
function SavedTab() {
  const { data, mutate } = useSWR('saved-jobs', () => savedJobsApi.getAll().then(r => r.data));
  const saved = data ?? [];

  const handleRemove = async (jobId: string) => {
    try {
      await savedJobsApi.unsave(jobId);
      mutate(saved.filter(s => s.job.id !== jobId), false);
    } catch {
      toast.error('Failed to remove');
    }
  };

  if (!data) return <p style={{ fontSize: 13, color: MUTED }}>Loading…</p>;

  if (saved.length === 0) {
    return (
      <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '48px 22px', textAlign: 'center' }}>
        <Bookmark size={36} strokeWidth={1.4} style={{ margin: '0 auto 12px', color: MUTED }} />
        <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>No saved jobs</p>
        <p style={{ fontSize: 13, color: MUTED, margin: '0 0 16px' }}>Tap "Save" on any job to bookmark it here.</p>
        <Link href="/jobs" style={{ fontSize: 13, fontWeight: 600, color: GOLD, textDecoration: 'none' }}>Browse jobs →</Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {saved.map((s: SavedJob) => (
        <div
          key={s.job.id}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: BG, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '18px 20px', gap: 16 }}
        >
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px' }}>{s.job.title}</p>
            <p style={{ fontSize: 13.5, color: '#000000', margin: 0 }}>
              {s.job.companyName}{s.job.location ? ` · ${s.job.location}` : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
            <Link
              href={`/jobs/${jobSlug(s.job.title, s.job.id)}`}
              style={{ fontSize: 13, fontWeight: 600, color: GOLD, textDecoration: 'none' }}
            >
              View →
            </Link>
            <button
              onClick={() => handleRemove(s.job.id)}
              style={{ border: `1px solid ${BORDER}`, background: 'transparent', color: 'oklch(0.47 0.008 60)', fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 9, cursor: 'pointer' }}
            >
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
type Tab = 'sent' | 'received' | 'saved';

export default function ApplicationsClient({
  initialSent,
  initialReceived,
}: {
  initialSent:     ApplicationWithDetails[];
  initialReceived: ApplicationWithDetails[];
}) {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => {
    const p = searchParams.get('tab');
    return (p === 'received' || p === 'saved') ? p : 'sent';
  });
  // Set only when arriving from a message notification's deep link — opens
  // straight into that application's thread instead of the bare list.
  const openMessageId = searchParams.get('openMessage');

  // Keep tab in sync if the URL param changes (e.g. back/forward navigation)
  useEffect(() => {
    const p = searchParams.get('tab');
    if (p === 'received' || p === 'saved' || p === 'sent') setTab(p);
  }, [searchParams]);

  const { data: sentApps, mutate: mutateSent } = useSWR(
    'apps/mine',
    () => applicationsApi.mine().then(r => r.data),
    { fallbackData: initialSent },
  );
  const { data: receivedApps, mutate: mutateReceived } = useSWR(
    'apps/inbox',
    () => applicationsApi.inbox().then(r => r.data),
    { fallbackData: initialReceived },
  );

  const titles: Record<Tab, string> = {
    sent:     'Sent CV',
    received: 'CV Inbox',
    saved:    'Saved Jobs',
  };

  const subtitles: Record<Tab, string> = {
    sent:     "CVs you've sent to referrers.",
    received: `Friends who want to work at ${user?.companyName ?? 'your company'}.`,
    saved:    "Jobs you've bookmarked for later.",
  };

  return (
    <div style={{ padding: '32px 40px 60px' }}>
      {/* Header */}
      <h1 data-tour="sent-header" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 4px' }}>{titles[tab]}</h1>
      <p style={{ fontSize: 14.5, color: '#000000', margin: '0 0 24px' }}>
        {subtitles[tab]}
      </p>

      {/* Content — one view per tab; which view shows is decided by the ?tab= route from the sidebar */}
      {tab === 'sent'     && <SentTab apps={sentApps ?? []} onUpdate={() => mutateSent()} initialOpenMessageId={openMessageId} />}
      {tab === 'received' && <ReceivedInbox apps={receivedApps ?? []} onUpdate={() => mutateReceived()} initialOpenMessageId={openMessageId} />}
      {tab === 'saved'    && <SavedTab />}
    </div>
  );
}
