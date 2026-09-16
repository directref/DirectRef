'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { CompanyIcon } from '@/components/job/CompanyIcon';
import { JobDescription } from '@/components/job/JobDescription';
import { Avatar } from '@/components/ui/Avatar';
import { SendCVModal } from '@/components/application/SendCVModal';
import { useAuth } from '@/lib/context/AuthContext';
import { useAppliedJobIds } from '@/lib/hooks/useApplications';
import { cn } from '@/lib/utils';
import type { JobWithReferrer } from '@/lib/types';
import Link from 'next/link';

export default function JobDetailClient({ data }: { data: JobWithReferrer }) {
  const { job, referrers } = data;
  const router = useRouter();
  const { user } = useAuth();
  const appliedJobIds = useAppliedJobIds();
  const [sendCVOpen, setSendCVOpen] = useState(false);

  const isOwnPosting  = referrers.some((r) => r.id === user?.id) || user?.id === job.referrerId;
  const alreadyApplied = referrers.some((r) => appliedJobIds.has(r.jobId));

  return (
    <>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? router.back() : router.push('/jobs'))}
          className="text-[13px] text-jobs-silver hover:text-jobs-ink transition-colors"
        >
          ← Back to jobs
        </button>

        <div className="mt-5 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          {/* Left column */}
          <article className="min-w-0">
            <div className="flex items-start gap-4">
              <CompanyIcon sourceUrl={job.sourceUrl} size={48} className="rounded-md bg-jobs-chip-bg border-jobs-border" />
              <div className="flex-1 min-w-0">
                <h1 className="text-[26px] font-bold text-jobs-ink leading-tight">{job.title}</h1>
                <p className="mt-1.5 text-[14px] text-jobs-ink-secondary">
                  {job.companyName}
                  {job.location && <> · {job.location}</>}
                  {job.jobType && <> · {job.jobType}</>}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 mt-4">
              {job.jobType && <span className="rounded-full bg-jobs-chip-bg text-jobs-chip-text px-2.5 py-1 text-[12px]">{job.jobType}</span>}
              {job.workMode && <span className="rounded-full bg-jobs-chip-bg text-jobs-chip-text px-2.5 py-1 text-[12px]">{job.workMode}</span>}
              {!job.isActive && <span className="rounded-full bg-crit/10 text-crit px-2.5 py-1 text-[12px] font-medium">Closed</span>}
              {isOwnPosting && <span className="rounded-full border border-gold-300 text-gold-500 px-2.5 py-1 text-[12px] font-medium">Your posting</span>}
            </div>

            {job.description && (
              <div className="mt-6">
                <JobDescription description={job.description} />
              </div>
            )}

            <a
              href={job.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-6 text-[13px] font-medium text-gold-500 hover:text-gold-400"
            >
              View original posting ↗
            </a>

            {/* People inside */}
            {referrers.length > 0 && (
              <div className="mt-8">
                <h2 className="text-[17px] font-semibold text-jobs-ink mb-3">
                  {referrers.length > 1 ? 'People inside' : 'Person inside'}
                </h2>
                <div className="bg-jobs-surface border border-jobs-border rounded-lg p-4 space-y-4">
                  {referrers.map((r) => {
                    const score = r.responseStats?.score;
                    return (
                      <div key={r.id} className="flex items-center gap-3">
                        <Avatar src={r.avatarUrl} name={r.fullName} size="sm" className="w-9 h-9" />
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-jobs-ink">{r.fullName}</p>
                          <p className="text-[13px] text-jobs-ink-muted truncate">
                            {r.headline ?? (r.companyName ? `Works at ${r.companyName}` : '')}
                          </p>
                          {score != null && (
                            <p className={cn('text-[12px] font-medium mt-0.5', score >= 75 ? 'text-jobs-success' : 'text-jobs-ink-muted')}>
                              Responds {score}% of the time
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </article>

          {/* Sticky action card */}
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div data-tour="send-cv" className="bg-jobs-surface border border-jobs-border rounded-lg p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.09em] text-jobs-ink-muted mb-3">Apply</p>

              {isOwnPosting ? (
                <>
                  <Link href="/jobs/mine" className="text-[14px] font-semibold text-gold-500 hover:text-gold-400">
                    Manage this job →
                  </Link>
                  <p className="mt-2 text-[12.5px] text-jobs-ink-muted">This is one of your own postings.</p>
                </>
              ) : alreadyApplied ? (
                <>
                  <div className="rounded-md bg-jobs-highlight-wash border border-gold-300/30 px-4 py-3 flex items-center gap-2">
                    <Check className="w-4 h-4 text-jobs-success shrink-0" strokeWidth={2.5} />
                    <span className="text-[14px] font-semibold text-jobs-ink">CV sent</span>
                  </div>
                  <p className="mt-2 text-[12.5px] text-jobs-ink-muted">
                    You&apos;ll be notified as soon as there&apos;s an update.
                  </p>
                </>
              ) : job.isActive ? (
                <>
                  <button
                    type="button"
                    onClick={() => setSendCVOpen(true)}
                    className="w-full rounded-md bg-gold-300 hover:bg-gold-400 text-[#0A0A0A] text-[14px] font-semibold px-4 py-3 transition-colors"
                  >
                    Send my C.V.
                  </button>
                  <p className="mt-2 text-[12.5px] text-jobs-ink-muted text-center">
                    {referrers.length > 1
                      ? `${referrers.length} people at ${job.companyName} can refer you`
                      : `Goes straight to ${referrers[0]?.fullName.split(' ')[0]} at ${job.companyName}`}
                  </p>
                </>
              ) : (
                <button type="button" disabled className="w-full rounded-md bg-jobs-chip-bg text-jobs-ink-muted text-[13.5px] font-semibold py-3 cursor-not-allowed">
                  Job closed
                </button>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Not gated on alreadyApplied — submitting flips that to true immediately
          (optimisticAddApplication), which would otherwise unmount this modal
          mid-transition, before its own internal success view ever shows. */}
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
