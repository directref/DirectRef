'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { FileDropzone } from '@/components/ui/FileDropzone';
import { Avatar } from '@/components/ui/Avatar';
import { applicationsApi } from '@/lib/api/applications';
import { usersApi } from '@/lib/api/users';
import { optimisticAddApplication } from '@/lib/hooks/useApplications';
import { useAuth } from '@/lib/context/AuthContext';
import { FileText } from 'lucide-react';
import { formatBytes, cn } from '@/lib/utils';
import { ApiError, ensureFreshSession } from '@/lib/api/client';
import type { Job, JobReferrer } from '@/lib/types';

interface SendCVModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (referrer: JobReferrer) => void;
  job: Job;
  referrers: JobReferrer[];
}

/** Two states in one shell: the form, then a success view — no separate
 *  modal to swap in, so nothing can unmount mid-transition when the parent's
 *  `alreadyApplied` flips true right after submit. */
export function SendCVModal({ open, onClose, onSuccess, job, referrers }: SendCVModalProps) {
  const router = useRouter();
  const { user } = useAuth();
  const hasProfileCv = !!user?.cvOriginalName;
  const [view, setView] = useState<'form' | 'success'>('form');
  const [selectedId, setSelectedId] = useState(referrers[0]?.id);
  const [sentTo, setSentTo] = useState<JobReferrer | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [useProfileCv, setUseProfileCv] = useState(hasProfileCv);
  const [coverNote, setCoverNote] = useState('');
  const [fileError, setFileError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cvPreviewOpen, setCvPreviewOpen] = useState(false);

  // Reset to a fresh form each time the modal opens
  useEffect(() => {
    if (open) {
      setView('form');
      setSelectedId(referrers[0]?.id);
      setUseProfileCv(hasProfileCv);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, referrers]);

  const reset = () => { setFile(null); setCoverNote(''); setFileError(''); };
  const handleClose = () => { reset(); onClose(); };

  const selected = referrers.find((r) => r.id === selectedId) ?? referrers[0];

  const handleFileSelect = (f: File) => {
    const maxBytes = 10 * 1024 * 1024;
    if (f.size > maxBytes) { toast.error(`File is too large (max ${formatBytes(maxBytes)})`); return; }
    setFileError('');
    setFile(f);
  };

  const handleViewProfileCv = async () => {
    // The iframe navigates straight to a cookie-authed URL — it can't retry on
    // a 401 the way apiFetch does, so make sure the token is fresh first.
    const ok = await ensureFreshSession();
    if (!ok) { toast.error('Your session expired — refresh the page and log in again.'); return; }
    setCvPreviewOpen(true);
  };

  const handleFileView = (f: File) => {
    const url = URL.createObjectURL(f);
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const handleSubmit = async () => {
    if (!selected) return;
    if (!useProfileCv && !file) { setFileError('Please select your CV'); return; }
    setIsSubmitting(true);
    try {
      const form = new FormData();
      form.append('jobId', selected.jobId);
      if (useProfileCv) {
        form.append('useProfileCv', 'true');
      } else {
        form.append('cv', file!);
      }
      if (coverNote.trim()) form.append('coverNote', coverNote.trim());
      await applicationsApi.submit(form);
      optimisticAddApplication(selected.jobId);

      reset();
      setSentTo(selected);
      setView('success');
      onSuccess?.(selected);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to send CV');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTrack = () => {
    handleClose();
    router.push('/applications?tab=sent');
  };

  if (!selected) return null;
  const referrerFirst = selected.fullName.split(' ')[0];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent
        title={view === 'form' ? 'Request a referral' : undefined}
        description={view === 'form' ? `for ${job.title} at ${job.companyName}` : undefined}
        onClose={handleClose}
        className="max-w-[520px]"
      >
        {view === 'success' && sentTo ? (
          <div className="px-6 pt-8 pb-6 text-center">
            <div className="w-12 h-12 mx-auto mb-5 rounded-full flex items-center justify-center motion-safe:animate-in motion-safe:zoom-in bg-jobs-status-fwd-bg">
              <Check className="w-6 h-6 text-jobs-status-fwd-text" strokeWidth={2.5} />
            </div>
            <h2 className="text-[20px] font-bold text-jobs-ink">CV sent!</h2>
            <p className="mt-2 text-[13.5px] text-jobs-ink-secondary max-w-[32ch] mx-auto">
              We&apos;ve sent your CV to <span className="font-semibold text-jobs-ink">{sentTo.fullName}</span> for the {job.title} role at {job.companyName}.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-[10px] border border-jobs-border-strong px-4 py-2.5 text-[13.5px] font-medium text-jobs-ink hover:bg-jobs-chip-bg transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleTrack}
                className="rounded-[10px] bg-gold-300 hover:bg-gold-400 px-4 py-2.5 text-[13.5px] font-semibold text-[#0A0A0A] transition-colors"
              >
                Track status
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="px-6 py-5 space-y-4">
              {referrers.length > 1 ? (
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.09em] text-jobs-ink-muted mb-2">Choose a referrer</p>
                  <div className="space-y-2">
                    {referrers.map((r) => {
                      const isSelected = r.id === selectedId;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setSelectedId(r.id)}
                          className={cn(
                            'w-full flex items-center gap-3 text-left border rounded-[12px] p-3 transition-colors',
                            isSelected ? 'border-gold-300 bg-jobs-highlight-wash' : 'border-jobs-border hover:bg-jobs-chip-bg',
                          )}
                        >
                          <Avatar src={r.avatarUrl} name={r.fullName} size="sm" />
                          <div className="min-w-0">
                            <p className="text-[13.5px] font-semibold text-jobs-ink truncate">{r.fullName}</p>
                            <p className="text-[12px] text-jobs-ink-muted truncate">{r.headline ?? r.companyName}</p>
                            {r.responseStats && (
                              <p className={cn('text-[12px] font-medium mt-0.5', r.responseStats.score >= 75 ? 'text-jobs-success' : 'text-jobs-ink-muted')}>
                                Responds {r.responseStats.score}% of the time
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-jobs-chip-bg rounded-[12px] p-3">
                  <Avatar src={selected.avatarUrl} name={selected.fullName} size="md" />
                  <div>
                    <p className="text-[13.5px] font-semibold text-jobs-ink">{selected.fullName}</p>
                    <p className="text-[12px] text-jobs-ink-secondary">{selected.companyName ?? job.companyName}</p>
                  </div>
                </div>
              )}

              {/* CV upload */}
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.09em] text-jobs-ink-muted mb-2">Your CV</p>
                {useProfileCv && hasProfileCv ? (
                  <div className="rounded-[10px] border border-jobs-border-strong p-3 flex items-center gap-3">
                    <FileText className="w-4 h-4 shrink-0 text-gold-500" strokeWidth={1.8} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-medium text-jobs-ink truncate">{user!.cvOriginalName}</p>
                      {user!.cvSizeBytes != null && (
                        <p className="text-[11.5px] text-jobs-ink-muted">{formatBytes(user!.cvSizeBytes)} · from your profile</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleViewProfileCv}
                      className="shrink-0 text-[12.5px] font-medium text-gold-500 hover:text-gold-400"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => setUseProfileCv(false)}
                      className="shrink-0 text-[12.5px] font-medium text-jobs-ink-secondary hover:text-jobs-ink"
                    >
                      Use a different file
                    </button>

                    <Dialog open={cvPreviewOpen} onOpenChange={setCvPreviewOpen}>
                      <DialogContent
                        title={user!.cvOriginalName ?? undefined}
                        onClose={() => setCvPreviewOpen(false)}
                        className="max-w-4xl w-[92vw] h-[88vh] flex flex-col"
                      >
                        <div className="flex-1 min-h-0 p-3">
                          <iframe
                            src={usersApi.cvPreviewUrl()}
                            title={user!.cvOriginalName ?? 'CV preview'}
                            className="w-full h-full rounded-lg border border-jobs-border bg-white"
                          />
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                ) : (
                  <>
                    <FileDropzone onFile={handleFileSelect} onView={handleFileView} file={file} error={fileError} />
                    {hasProfileCv && (
                      <button
                        type="button"
                        onClick={() => { setUseProfileCv(true); setFile(null); setFileError(''); }}
                        className="mt-1.5 text-[12.5px] font-medium text-gold-500 hover:text-gold-400"
                      >
                        Use the CV on your profile instead
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Cover note */}
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.09em] text-jobs-ink-muted mb-2">
                  Message to {referrerFirst} (optional)
                </p>
                <textarea
                  value={coverNote}
                  onChange={(e) => setCoverNote(e.target.value.slice(0, 400))}
                  maxLength={400}
                  rows={4}
                  placeholder={`Hi ${referrerFirst}, I saw this role and thought it would be a great fit…`}
                  className="w-full rounded-[10px] border border-jobs-border bg-jobs-surface p-3 text-[13.5px] text-jobs-ink placeholder:text-jobs-ink-muted resize-none focus:outline-none focus:border-gold-300 transition-colors"
                />
                <p className="text-right text-[11px] text-jobs-ink-muted mt-1">{coverNote.length}/400</p>
              </div>
            </div>

            <div className="px-6 pb-6">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full rounded-[10px] bg-gold-300 hover:bg-gold-400 disabled:opacity-50 py-3 text-[14px] font-semibold text-[#0A0A0A] transition-colors"
              >
                {isSubmitting ? 'Sending…' : `Send to ${referrerFirst}`}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
