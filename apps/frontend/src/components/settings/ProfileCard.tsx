'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { FileText } from 'lucide-react';
import { pfx } from '@/app/(app)/settings/tokens';
import { useAuth } from '@/lib/context/AuthContext';
import { usersApi } from '@/lib/api/users';
import { ApiError, ensureFreshSession } from '@/lib/api/client';
import { Field, SelectField, ComboboxField } from './fields';
import { PrimaryButton } from './buttons';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { getInitials, formatBytes, truncateMiddle, cn } from '@/lib/utils';
import type { User } from '@/lib/types';

type FormState = {
  fullName: string;
  headline: string;
  companyName: string;
  yearsOfExperience: string;
  desiredRole: string;
  preferredLocation: string;
  employmentType: string;
  seniority: string;
};

function fromUser(user: User | null): FormState {
  return {
    fullName: user?.fullName ?? '',
    headline: user?.headline ?? '',
    companyName: user?.companyName ?? '',
    yearsOfExperience: user?.yearsOfExperience != null ? String(user.yearsOfExperience) : '',
    desiredRole: user?.desiredRole ?? user?.headline ?? '',
    preferredLocation: user?.preferredLocation ?? '',
    employmentType: user?.employmentType ?? '',
    seniority: user?.seniority ?? '',
  };
}

function isDirty(a: FormState, b: FormState) {
  return (Object.keys(a) as (keyof FormState)[]).some((k) => a[k] !== b[k]);
}

function signInMethod(user: User | null): string {
  if (user?.googleId) return 'Google';
  if (user?.linkedinId) return 'LinkedIn';
  return 'email & password';
}

// Israel's standard tech-job regional split (the breakdown used across
// Israeli job boards like AllJobs/Drushim) rather than official CBS
// districts, since it's what job postings' free-text locations map to
// in practice for a tech audience.
const ISRAEL_REGIONS = [
  { value: 'Tel Aviv', label: 'Tel Aviv' },
  { value: 'Central', label: 'Central' },
  { value: 'Sharon', label: 'Sharon' },
  { value: 'Haifa', label: 'Haifa' },
  { value: 'North', label: 'North' },
  { value: 'Jerusalem', label: 'Jerusalem' },
  { value: 'South', label: 'South' },
];

// Trimmed from the Stack Overflow Developer Survey's published role
// taxonomy down to roles relevant to hiring/referrals (dropped
// academic-only categories like Student/Educator/Retired).
const TECH_ROLES = [
  { value: 'Full-Stack Developer', label: 'Full-Stack Developer' },
  { value: 'Back-End Developer', label: 'Back-End Developer' },
  { value: 'Front-End Developer', label: 'Front-End Developer' },
  { value: 'Mobile Developer', label: 'Mobile Developer' },
  { value: 'Desktop/Enterprise Developer', label: 'Desktop/Enterprise Developer' },
  { value: 'Embedded/Devices Developer', label: 'Embedded/Devices Developer' },
  { value: 'Game/Graphics Developer', label: 'Game/Graphics Developer' },
  { value: 'QA/Test Engineer', label: 'QA/Test Engineer' },
  { value: 'DevOps Engineer', label: 'DevOps Engineer' },
  { value: 'Site Reliability Engineer', label: 'Site Reliability Engineer' },
  { value: 'Cloud Infrastructure Engineer', label: 'Cloud Infrastructure Engineer' },
  { value: 'Cybersecurity/InfoSec Engineer', label: 'Cybersecurity/InfoSec Engineer' },
  { value: 'Software/Solutions Architect', label: 'Software/Solutions Architect' },
  { value: 'Database Administrator', label: 'Database Administrator' },
  { value: 'System Administrator', label: 'System Administrator' },
  { value: 'Engineering Manager', label: 'Engineering Manager' },
  { value: 'Data Engineer', label: 'Data Engineer' },
  { value: 'Data Scientist', label: 'Data Scientist' },
  { value: 'AI/ML Engineer', label: 'AI/ML Engineer' },
  { value: 'Data/Business Analyst', label: 'Data/Business Analyst' },
  { value: 'Product Manager', label: 'Product Manager' },
  { value: 'Project Manager', label: 'Project Manager' },
  { value: 'UX/UI Designer', label: 'UX/UI Designer' },
  { value: 'Support Engineer/Analyst', label: 'Support Engineer/Analyst' },
  { value: 'Financial Analyst/Engineer', label: 'Financial Analyst/Engineer' },
];

const EMPLOYMENT_TYPES = [
  { value: 'full-time', label: 'Full-time' },
  { value: 'part-time', label: 'Part-time' },
];

const SENIORITY_LEVELS = [
  { value: 'junior', label: 'Junior' },
  { value: 'mid', label: 'Mid' },
  { value: 'senior', label: 'Senior' },
  { value: 'lead', label: 'Lead' },
  { value: 'manager', label: 'Manager' },
];

export function ProfileCard() {
  const { user, refresh } = useAuth();

  const [savedForm, setSavedForm] = useState<FormState>(() => fromUser(user));
  const [form, setForm] = useState<FormState>(() => fromUser(user));
  const [isLoading, setIsLoading] = useState(false);
  const [cvUploading, setCvUploading] = useState(false);
  const [removeCvOpen, setRemoveCvOpen] = useState(false);
  const [removingCv, setRemovingCv] = useState(false);
  const [cvPreviewOpen, setCvPreviewOpen] = useState(false);
  const cvInputRef = useRef<HTMLInputElement>(null);

  const hasChanges = isDirty(form, savedForm);

  const set = <K extends keyof FormState>(key: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleSave = async () => {
    if (!hasChanges || isLoading) return;
    setIsLoading(true);
    try {
      await usersApi.updateMe({
        fullName: form.fullName || undefined,
        headline: form.headline || undefined,
        companyName: form.companyName || null,
        yearsOfExperience: form.yearsOfExperience !== '' ? Number(form.yearsOfExperience) : null,
        desiredRole: form.desiredRole || null,
        preferredLocation: form.preferredLocation || null,
        employmentType: (form.employmentType || null) as User['employmentType'],
        seniority: (form.seniority || null) as User['seniority'],
      });
      await refresh();
      setSavedForm(form);
      toast.success('Preferences saved.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCvInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same filename again later
    if (!file) return;
    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) { toast.error(`File is too large (max ${formatBytes(maxBytes)})`); return; }
    setCvUploading(true);
    try {
      await usersApi.uploadCv(file);
      await refresh();
      toast.success('CV updated.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Upload failed');
    } finally {
      setCvUploading(false);
    }
  };

  const handleViewCv = async () => {
    // The iframe navigates straight to a cookie-authed URL — it can't retry on
    // a 401 the way apiFetch does, so make sure the token is fresh first.
    const ok = await ensureFreshSession();
    if (!ok) { toast.error('Your session expired — refresh the page and log in again.'); return; }
    setCvPreviewOpen(true);
  };

  const handleRemoveCv = async () => {
    setRemovingCv(true);
    try {
      await usersApi.removeCv();
      await refresh();
      toast.success('CV removed.');
      setRemoveCvOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to remove CV');
    } finally {
      setRemovingCv(false);
    }
  };

  return (
    <div className="rounded-2xl p-4 sm:p-5" style={{ background: pfx.surface, border: `1px solid ${pfx.border}` }}>

      {/* Identity row */}
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 font-bold text-[15px]"
          style={{ background: pfx.goldSoft, color: pfx.gold }}
        >
          {getInitials(user?.fullName ?? '?')}
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold truncate" style={{ color: pfx.ink }}>{user?.fullName}</p>
          <p className="text-[13px] truncate" style={{ color: pfx.inkSecondary }}>
            {user?.email} · signed in with {signInMethod(user)}
          </p>
        </div>
      </div>

      {/* Group A — Who you are */}
      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.09em] mb-4" style={{ color: pfx.inkMuted }}>
          Who you are
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full name" value={form.fullName} onChange={set('fullName')} required />
          <ComboboxField
            label="Current role"
            value={form.headline}
            onChange={(v) => setForm((prev) => ({ ...prev, headline: v }))}
            options={TECH_ROLES}
            placeholder="e.g. Senior Engineer"
          />
          <Field label="Company" value={form.companyName} onChange={set('companyName')} placeholder="Where do you work?" />
          <Field
            label="Years of experience"
            type="number"
            min={0}
            max={60}
            value={form.yearsOfExperience}
            onChange={set('yearsOfExperience')}
            placeholder="e.g. 5"
          />
        </div>
      </div>

      {/* Group B — What you are looking for */}
      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.09em]" style={{ color: pfx.inkMuted }}>
          What you are looking for
        </p>
        <p className="text-xs mt-1 mb-4" style={{ color: pfx.inkMuted }}>
          Used to show matched jobs on your{' '}
          <Link href="/feed" className="font-semibold" style={{ color: pfx.gold }}>Home</Link> page.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ComboboxField
            label="Desired role"
            value={form.desiredRole}
            onChange={(v) => setForm((prev) => ({ ...prev, desiredRole: v }))}
            options={TECH_ROLES}
            placeholder="Type or pick a role…"
          />
          <SelectField
            label="Preferred location"
            value={form.preferredLocation}
            onChange={set('preferredLocation')}
            options={ISRAEL_REGIONS}
            placeholder="Select…"
          />
          <SelectField
            label="Employment type"
            value={form.employmentType}
            onChange={set('employmentType')}
            options={EMPLOYMENT_TYPES}
            placeholder="Select…"
          />
          <SelectField
            label="Seniority"
            value={form.seniority}
            onChange={set('seniority')}
            options={SENIORITY_LEVELS}
            placeholder="Select…"
          />
        </div>

        {/* CV of record — kept on the profile so applying can reuse it instead of a fresh upload every time */}
        <div className="mt-4">
          <p className="block text-[12.5px] font-medium" style={{ color: pfx.inkSecondary }}>CV / Resume</p>
          <p className="text-[11.5px] mb-1.5" style={{ color: pfx.inkMuted }}>PDF only (max 10MB)</p>
          {user?.cvOriginalName ? (
            <div
              onClick={handleViewCv}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleViewCv(); } }}
              className="flex items-center gap-3 rounded-[10px] border p-3 cursor-pointer hover:border-gold-300/50 transition-colors"
              style={{ borderColor: pfx.border, background: pfx.surface }}
            >
              <FileText className="w-4 h-4 shrink-0" style={{ color: pfx.gold }} strokeWidth={1.8} />
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-medium" style={{ color: pfx.ink }} title={user.cvOriginalName}>
                  {truncateMiddle(user.cvOriginalName)}
                </p>
                {user.cvSizeBytes != null && (
                  <p className="text-[11.5px]" style={{ color: pfx.inkMuted }}>{formatBytes(user.cvSizeBytes)}</p>
                )}
              </div>
              <span className="shrink-0 text-[12.5px] font-medium" style={{ color: pfx.gold }}>
                View
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); cvInputRef.current?.click(); }}
                disabled={cvUploading}
                className="shrink-0 text-[12.5px] font-medium disabled:opacity-50"
                style={{ color: pfx.inkSecondary }}
              >
                {cvUploading ? 'Uploading…' : 'Replace'}
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setRemoveCvOpen(true); }}
                className="shrink-0 text-[12.5px] font-medium text-crit"
              >
                Remove
              </button>
            </div>
          ) : (
            <div
              onClick={() => !cvUploading && cvInputRef.current?.click()}
              className={cn(
                'rounded-[10px] border border-dashed p-3 flex items-center gap-3',
                !cvUploading && 'cursor-pointer hover:border-gold-300/50',
              )}
              style={{ borderColor: pfx.border }}
            >
              <FileText className="w-4 h-4 shrink-0" style={{ color: pfx.inkMuted }} strokeWidth={1.8} />
              <p className="flex-1 text-[13.5px]" style={{ color: pfx.inkSecondary }}>
                {cvUploading ? 'Uploading…' : (
                  <>Drop your CV here, or <span className="font-semibold" style={{ color: pfx.gold }}>browse</span></>
                )}
              </p>
            </div>
          )}
          <input ref={cvInputRef} type="file" accept=".pdf" className="hidden" onChange={handleCvInputChange} />
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 flex justify-end">
        <PrimaryButton onClick={handleSave} disabled={!hasChanges || isLoading}>
          {isLoading ? 'Saving…' : 'Save changes'}
        </PrimaryButton>
      </div>

      <ConfirmDialog
        open={removeCvOpen}
        onOpenChange={setRemoveCvOpen}
        title="Remove CV?"
        description="Are you sure you want to remove your CV? You can upload a new one anytime."
        confirmLabel="Remove"
        onConfirm={handleRemoveCv}
        isLoading={removingCv}
      />

      <Dialog open={cvPreviewOpen} onOpenChange={setCvPreviewOpen}>
        <DialogContent
          title={user?.cvOriginalName ?? undefined}
          onClose={() => setCvPreviewOpen(false)}
          className="max-w-4xl w-[92vw] h-[88vh] flex flex-col"
        >
          <div className="flex-1 min-h-0 p-3">
            <iframe
              src={usersApi.cvPreviewUrl()}
              title={user?.cvOriginalName ?? 'CV preview'}
              className="w-full h-full rounded-lg border border-border bg-white"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
