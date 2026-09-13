'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { authApi } from '@/lib/api/auth';
import { invitesApi } from '@/lib/api/invites';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { OAuthButton } from './OAuthButton';
import { ApiError } from '@/lib/api/client';

export function RegisterForm() {
  const [form, setForm] = useState({ email: '', password: '', fullName: '', companyName: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [inviterName, setInviterName] = useState('');
  const [inviterAvatar, setInviterAvatar] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite');

  // Load inviter info if token present
  useEffect(() => {
    if (!inviteToken) return;
    invitesApi.getInfo(inviteToken)
      .then((res) => {
        setInviterName(res.data.inviter.fullName);
        setInviterAvatar(res.data.inviter.avatarUrl);
      })
      .catch(() => {}); // ignore — just won't show inviter banner
  }, [inviteToken]);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.fullName.trim()) errs.fullName = 'Name is required';
    if (!form.email.includes('@')) errs.email = 'Valid email required';
    if (form.password.length < 8) errs.password = 'Min 8 characters';
    if (!/[A-Z]/.test(form.password)) errs.password = 'Must include an uppercase letter';
    if (!/[0-9]/.test(form.password)) errs.password = 'Must include a number';
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setIsLoading(true);
    try {
      // Everyone signs up as one kind of account. Referrer capability is a
      // consequence of verifying a work email at the company you post for —
      // never a self-declared checkbox at signup.
      await authApi.register(form);

      // Redeem invite token — auto-connects with inviter
      if (inviteToken) {
        await invitesApi.redeem(inviteToken).catch(() => {});
      }

      toast.success('Account created!');
      router.push('/onboarding/welcome');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Registration failed';
      toast.error(msg);
      setErrors({ form: msg });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center mb-6">
        {/* Inviter banner */}
        {inviterName ? (
          <div className="flex items-center gap-3 bg-gold-300/10 border border-gold-300/20 rounded-xl px-4 py-3 mb-4 text-left">
            <Avatar src={inviterAvatar} name={inviterName} size="sm" />
            <div>
              <p className="text-sm font-semibold text-text-primary">{inviterName} invited you!</p>
              <p className="text-xs text-text-secondary">You'll be auto-connected when you sign up</p>
            </div>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold text-text-primary mb-1">Create your account</h1>
            <p className="text-sm text-text-secondary">Skip the black hole — get referred by a friend inside the company</p>
          </>
        )}
      </div>

      <div className="space-y-2.5">
        <OAuthButton provider="google" />
        <OAuthButton provider="linkedin" />
      </div>

      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-text-muted">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <Input label="Full name" value={form.fullName} onChange={set('fullName')} placeholder="Sarah Alon" error={errors.fullName} />
      <Input label="Email" type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" error={errors.email} />
      <Input label="Password" type="password" value={form.password} onChange={set('password')} placeholder="Min 8 chars, 1 uppercase, 1 number" error={errors.password} />
      <Input label="Company (optional)" value={form.companyName} onChange={set('companyName')} placeholder="Where do you work?" />

      {errors.form && <p className="text-sm text-crit">{errors.form}</p>}

      <Button type="submit" variant="primary" size="lg" isLoading={isLoading} className="w-full">
        Create account
      </Button>

      <p className="text-center text-sm text-text-muted">
        Already have an account?{' '}
        <Link href="/login" className="text-gold-300 hover:text-gold-400 font-medium">Log in</Link>
      </p>
    </form>
  );
}
