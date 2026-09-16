'use client';

import { useState } from 'react';
import { Send, CheckCircle2, XCircle, Bookmark, type LucideIcon } from 'lucide-react';
import { CompanyIcon } from '@/components/job/CompanyIcon';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { SendCVModal } from '@/components/application/SendCVModal';
import { useAuth } from '@/lib/context/AuthContext';
import { useMyApplicationsMap } from '@/lib/hooks/useApplications';
import { savedJobsApi } from '@/lib/api/savedJobs';
import { timeAgo, jobSlug, cn } from '@/lib/utils';
import type { JobWithReferrer } from '@/lib/types';
import Link from 'next/link';
import useSWR from 'swr';

interface JobCardProps {
  data: JobWithReferrer;
}

// Status → icon + tooltip text (no icon for "viewed" — reviewed status shows via the CTA label only)
const STATUS_INDICATORS: Record<string, { icon: LucideIcon; label: string; color: string }> = {
  submitted:  { icon: Send,         label: 'CV sent — awaiting review',          color: 'text-jobs-ink-muted' },
  forwarded:  { icon: CheckCircle2, label: 'Forwarded to HR',                    color: 'text-jobs-success'   },
  rejected:   { icon: XCircle,      label: 'Not a fit — referrer passed on this', color: 'text-crit'          },
};

export function JobCard({ data }: JobCardProps) {
  const { job, referrer, referrers } = data;
  const { user } = useAuth();
  const { appMap } = useMyApplicationsMap();
  const [sendCVOpen, setSendCVOpen] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);

  const href = `/jobs/${jobSlug(job.title, job.id)}`;
  const isNew = Date.now() - new Date(job.createdAt).getTime() < 48 * 3600 * 1000;

  const isOwnPosting   = referrers.some((r) => r.id === user?.id) || user?.id === job.referrerId;
  const appStatus      = referrers.map((r) => appMap.get(r.jobId)).find(Boolean);
  const alreadyApplied = !!appStatus;
  const indicator      = appStatus ? STATUS_INDICATORS[appStatus] : null;

  // Save/unsave — use same SWR key as ApplicationsClient Saved tab
  const { data: savedData, mutate: mutateSaved } = useSWR(
    'saved-jobs',
    () => savedJobsApi.getAll().then(r => r.data),
    { revalidateOnFocus: false },
  );
  const isSaved = (savedData ?? []).some(s => s.job.id === job.id);
  const toggleSave = async () => {
    try {
      if (isSaved) {
        await savedJobsApi.unsave(job.id);
        mutateSaved((savedData ?? []).filter(s => s.job.id !== job.id), false);
      } else {
        await savedJobsApi.save(job.id);
        mutateSaved();
      }
    } catch {
      mutateSaved();
    }
  };

  return (
    <>
      <div className="relative bg-jobs-surface border border-jobs-border rounded-lg p-4 flex flex-col gap-3 transition-colors hover:border-jobs-border-strong">
        {/* Full-bleed card link — whole card navigates; interactive bits opt back in below */}
        <Link href={href} aria-label={`${job.title} at ${job.companyName}`} className="absolute inset-0 z-0 rounded-lg" />

        <div className="relative pointer-events-none flex flex-col gap-3">
          {/* Header */}
          <div className="flex gap-3 items-start">
            <CompanyIcon sourceUrl={job.sourceUrl} size={38} className="rounded-md bg-jobs-chip-bg border-jobs-border" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-bold text-jobs-ink truncate">{job.companyName}</span>
                {isNew && (
                  <span className="shrink-0 rounded-full border border-gold-300 text-gold-500 px-2 py-0.5 text-[11px] font-semibold">
                    New
                  </span>
                )}
              </div>
              <h3 className="text-[16.5px] font-semibold leading-snug text-jobs-ink truncate">
                {job.title}
              </h3>
              <p className="text-[13px] text-jobs-ink-muted mt-0.5">
                {job.location ?? 'Remote'}{job.jobType ? ` · ${job.jobType}` : ''} · {timeAgo(job.createdAt)}
              </p>
            </div>

            {/* Top-right CTA slot */}
            <div className="pointer-events-auto shrink-0">
              {isOwnPosting ? (
                <Link href="/jobs/mine">
                  <Button variant="secondary" size="sm">Manage</Button>
                </Link>
              ) : alreadyApplied ? (
                <div className="relative">
                  {indicator && (
                    <button
                      type="button"
                      onMouseEnter={() => setTooltipVisible(true)}
                      onMouseLeave={() => setTooltipVisible(false)}
                      onFocus={() => setTooltipVisible(true)}
                      onBlur={() => setTooltipVisible(false)}
                      className={cn('flex items-center gap-1.5 rounded-md bg-jobs-chip-bg px-2.5 py-1.5 text-[12px] font-semibold cursor-default', indicator.color)}
                      aria-label={indicator.label}
                    >
                      <indicator.icon className="w-[15px] h-[15px]" strokeWidth={1.8} />
                      {appStatus === 'forwarded' ? 'Forwarded' : appStatus === 'rejected' ? 'Not a fit' : 'CV sent'}
                    </button>
                  )}
                  {tooltipVisible && (
                    <div className="absolute right-0 top-9 z-50 whitespace-nowrap bg-jobs-ink text-jobs-bg text-xs px-2.5 py-1.5 rounded-md shadow-lg pointer-events-none">
                      {indicator?.label}
                    </div>
                  )}
                </div>
              ) : job.isActive ? (
                <button
                  type="button"
                  onClick={() => setSendCVOpen(true)}
                  className="rounded-md bg-gold-300 hover:bg-gold-400 text-[13px] font-semibold text-[#0A0A0A] px-3.5 py-2 transition-colors"
                >
                  Send my C.V.
                </button>
              ) : (
                <span className="rounded-md bg-jobs-chip-bg text-jobs-ink-muted text-[12.5px] font-semibold px-3 py-2 cursor-not-allowed">
                  Closed
                </span>
              )}
            </div>
          </div>

          {/* Chips */}
          <div className="flex flex-wrap gap-1.5">
            {job.jobType && (
              <span className="rounded-full bg-jobs-chip-bg text-jobs-chip-text px-2.5 py-1 text-[12px]">{job.jobType}</span>
            )}
            {job.workMode && (
              <span className="rounded-full bg-jobs-chip-bg text-jobs-chip-text px-2.5 py-1 text-[12px]">{job.workMode}</span>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-jobs-border">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex items-center -space-x-2 shrink-0">
                {referrers.slice(0, 3).map((r) => (
                  <Avatar key={r.id} src={r.avatarUrl} name={r.fullName} size="xs" className="ring-2 ring-jobs-surface" />
                ))}
              </div>
              <span className="text-[12.5px] text-gold-500 font-semibold truncate">
                {referrers.length > 1 ? `${referrers.length} referrers at this company` : `${referrer.fullName} works here`}
              </span>
            </div>
            {!isOwnPosting && (
              <button
                type="button"
                onClick={toggleSave}
                className="pointer-events-auto shrink-0 rounded-full p-1.5 hover:bg-jobs-chip-bg transition-colors"
                title={isSaved ? 'Remove from saved' : 'Save job'}
                aria-label={isSaved ? 'Remove from saved' : 'Save job'}
              >
                <Bookmark className={cn('w-[18px] h-[18px]', isSaved ? 'text-gold-300 fill-gold-300' : 'text-jobs-ink-muted fill-none')} strokeWidth={1.8} />
              </button>
            )}
          </div>
        </div>
      </div>

      {!isOwnPosting && (
        <SendCVModal
          open={sendCVOpen}
          onClose={() => setSendCVOpen(false)}
          job={job}
          referrers={referrers}
        />
      )}
    </>
  );
}
