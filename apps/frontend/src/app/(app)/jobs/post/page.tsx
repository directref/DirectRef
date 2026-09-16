'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CheckCircle2, ClipboardList, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { WORK_EMAIL_ANCHOR } from '@/components/settings/WorkEmailCard';
import { jobsApi } from '@/lib/api/jobs';
import { useMyJobs } from '@/lib/hooks/useJobs';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { Tooltip } from '@/components/ui/Tooltip';
import { JobCardSkeleton } from '@/components/ui/Skeleton';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { OutOfCreditsModal } from '@/components/credits/OutOfCreditsModal';
import { WorkEmailRequiredModal } from '@/components/job/WorkEmailRequiredModal';
import { ApiError } from '@/lib/api/client';
import { timeAgo, jobSlug, creditHintText, jobDeletionTooltip } from '@/lib/utils';
import { useCreditBalance, refreshCreditBalance } from '@/lib/hooks/useCredits';
import Link from 'next/link';

export default function PostJobPage() {
  const router = useRouter();
  const { user } = useAuth();
  const workEmailVerified = !!user?.workEmailVerified;
  const { jobs, isLoading: jobsLoading, mutate } = useMyJobs();
  const { balance } = useCreditBalance();
  const [outOfCreditsOpen, setOutOfCreditsOpen] = useState(false);
  const [workEmailReason, setWorkEmailReason] = useState<'WORK_EMAIL_REQUIRED' | 'COMPANY_MISMATCH' | null>(null);

  // Post form state
  const [url, setUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [scraped, setScraped] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    sourceUrl: '', title: '', companyName: '',
    location: '', description: '', jobType: '', workMode: '',
  });

  const set = (key: string) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleScrape = async () => {
    if (!url.startsWith('http')) { toast.error('Enter a valid URL starting with http'); return; }
    setIsScraping(true);
    try {
      const res = await jobsApi.scrape(url);
      const data = res.data;
      setForm((prev) => ({
        ...prev,
        sourceUrl: url,
        title:       data.title       ?? prev.title,
        companyName: data.companyName ?? prev.companyName,
        location:    data.location    ?? prev.location,
        description: data.description ?? prev.description,
        jobType:     data.jobType     ?? prev.jobType,
        workMode:    data.workMode    ?? prev.workMode,
      }));
      setScraped(true);
      toast.success('Details filled in! Review and publish.');
    } catch {
      toast.error('Could not read that URL automatically. Fill in the details below.');
      setForm((prev) => ({ ...prev, sourceUrl: url }));
      setScraped(true);
    } finally {
      setIsScraping(false);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim())       { toast.error('Job title is required'); return; }
    if (!form.companyName.trim()) { toast.error('Company name is required'); return; }
    if (balance && balance.total <= 0) { setOutOfCreditsOpen(true); return; }
    setIsSubmitting(true);
    try {
      await jobsApi.create({
        sourceUrl:   form.sourceUrl || url,
        title:       form.title,
        companyName: form.companyName,
        location:    form.location    || undefined,
        description: form.description || undefined,
        jobType:     form.jobType     || undefined,
        workMode:    form.workMode    || undefined,
        salaryRange: undefined,
      });
      toast.success('Job posted!');
      mutate();
      refreshCreditBalance();
      // Reset form
      setUrl(''); setScraped(false);
      setForm({ sourceUrl: '', title: '', companyName: '', location: '', description: '', jobType: '', workMode: '' });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'OUT_OF_CREDITS') setOutOfCreditsOpen(true);
      else if (err instanceof ApiError && (err.code === 'WORK_EMAIL_REQUIRED' || err.code === 'COMPANY_MISMATCH')) {
        setWorkEmailReason(err.code);
      } else toast.error(err instanceof ApiError ? err.message : 'Failed to post job');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const handleToggleActive = async (id: string, isActive: boolean) => {
    setTogglingId(id);
    try {
      await jobsApi.update(id, { isActive: !isActive });
      toast.success(isActive ? 'Job deactivated' : 'Job reactivated');
      mutate();
    } catch {
      toast.error('Failed to update job');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="px-10 py-8 space-y-10">

      {/* ── POST A JOB ── */}
      <div className="max-w-xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-1">Post a Job</h1>
          <p className="text-sm text-text-secondary">
            Roles at your company you&apos;re offering to refer for. Costs 1 credit.
          </p>
        </div>

        {!workEmailVerified ? (
          <div className="flex items-start gap-3 bg-warn/10 border border-warn/20 rounded-xl px-4 py-3.5">
            <ShieldAlert className="w-5 h-5 shrink-0 text-warn mt-0.5" strokeWidth={1.8} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-text-primary">Verify your work email to post a job</p>
              <p className="text-xs text-text-secondary mt-0.5">
                We need to confirm you actually work at the company before you can post on its behalf.
              </p>
              <Button variant="primary" size="sm" className="mt-3" onClick={() => router.push(`/settings#${WORK_EMAIL_ANCHOR}`)}>
                Verify work email
              </Button>
            </div>
          </div>
        ) : !scraped ? (
          <div data-tour="post-form" className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-secondary block">
                Paste the job listing URL
              </label>
              <div className="flex gap-2">
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://careers.company.com/jobs/..."
                  className="flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && handleScrape()}
                />
                <Button variant="primary" onClick={handleScrape} disabled={isScraping || !url} className="h-[42px] px-6 shrink-0">
                  {isScraping ? <LoadingSpinner size="sm" /> : 'Autofill'}
                </Button>
              </div>
              <p className="text-xs text-text-muted">
                We&apos;ll pull the title, company, and description automatically
              </p>
            </div>
            <div className="text-center">
              <button
                type="button"
                onClick={() => setScraped(true)}
                className="text-sm text-text-muted hover:text-gold-300 transition-colors underline underline-offset-2"
              >
                Enter manually instead
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handlePublish} className="space-y-4">
            {form.title && (
              <div className="flex items-center gap-2 bg-good/10 border border-good/20 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-good" strokeWidth={1.8} />
                <span className="text-xs text-good font-medium">Details filled in — review and edit if needed</span>
              </div>
            )}
            <Input label="Job title *" value={form.title} onChange={set('title')} placeholder="Senior Software Engineer" required />
            <Input label="Company name *" value={form.companyName} onChange={set('companyName')} placeholder="Microsoft" required autoComplete="off" />
            <Input label="Location" value={form.location} onChange={set('location')} placeholder="Tel Aviv / Remote" />
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Job type</label>
              <select value={form.jobType} onChange={set('jobType')} className="w-full bg-input border border-border-strong rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-gold-300/40">
                <option value="">— Select type —</option>
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="internship">Internship</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Work mode</label>
              <select value={form.workMode} onChange={set('workMode')} className="w-full bg-input border border-border-strong rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-gold-300/40">
                <option value="">— Select mode —</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">On-site</option>
              </select>
            </div>
            <Textarea label="Description" value={form.description} onChange={set('description')} placeholder="What does this role involve?" rows={5} />
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setScraped(false)} className="flex-1">← Back</Button>
              <Button type="submit" variant="primary" size="lg" isLoading={isSubmitting} className="flex-1">Post Job</Button>
            </div>
            <p className="text-xs text-text-muted text-center">{creditHintText(balance)}</p>
          </form>
        )}
      </div>

      {/* ── JOBS I POSTED ── */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-text-primary mb-0.5">Jobs I Posted</h2>
            <p className="text-sm text-text-secondary">Jobs you&apos;ve shared with your network</p>
          </div>
        </div>

        {jobsLoading ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <JobCardSkeleton key={i} />)}</div>
        ) : jobs.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-10 text-center">
            <ClipboardList className="w-9 h-9 mx-auto mb-3 text-text-muted" strokeWidth={1.5} />
            <p className="text-sm font-semibold text-text-primary mb-1">No jobs posted yet</p>
            <p className="text-xs text-text-muted">Post a job above to let people apply through you.</p>
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl">
            {jobs.map((job) => {
              const href = `/jobs/${jobSlug(job.title, job.id)}`;
              return (
                <Card key={job.id} hover className="p-4" onClick={() => router.push(href)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <Link href={href} className="font-bold text-text-primary text-sm hover:text-gold-300" onClick={(e) => e.stopPropagation()}>
                        {job.title}
                      </Link>
                      <p className="text-xs text-text-secondary mt-0.5">{job.companyName} · {job.location ?? 'Remote'}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {job.isActive ? (
                          <Badge variant="good">Active</Badge>
                        ) : (
                          <Tooltip content={jobDeletionTooltip(job.deactivatedAt)}>
                            {/* Badge doesn't forward props, so the Tooltip trigger (asChild)
                                needs a plain element to attach its handlers to — same
                                muted-badge styling, just not the shared component. */}
                            <span
                              tabIndex={0}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border bg-border text-text-secondary border-border-strong cursor-help"
                            >
                              Inactive
                            </span>
                          </Tooltip>
                        )}
                        <span className="text-xs text-text-muted">{timeAgo(job.createdAt)}</span>
                      </div>
                    </div>
                    <Tooltip content={jobDeletionTooltip(job.deactivatedAt)}>
                      <div onClick={(e) => e.stopPropagation()} className="shrink-0 pt-1">
                        <Switch
                          checked={job.isActive}
                          onChange={() => handleToggleActive(job.id, job.isActive)}
                          disabled={togglingId === job.id}
                          label={job.isActive ? 'Deactivate job' : 'Reactivate job'}
                        />
                      </div>
                    </Tooltip>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <OutOfCreditsModal open={outOfCreditsOpen} onClose={() => setOutOfCreditsOpen(false)} />
      <WorkEmailRequiredModal
        open={workEmailReason !== null}
        onClose={() => setWorkEmailReason(null)}
        reason={workEmailReason}
        companyName={form.companyName}
      />
    </div>
  );
}
