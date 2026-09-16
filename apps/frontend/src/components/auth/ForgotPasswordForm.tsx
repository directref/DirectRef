'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { MailCheck } from 'lucide-react';
import { authApi } from '@/lib/api/auth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="text-center py-4">
        <MailCheck className="w-9 h-9 mx-auto mb-4 text-gold-300" strokeWidth={1.5} />
        <h2 className="text-lg font-bold text-text-primary mb-2">Check your inbox</h2>
        <p className="text-sm text-text-secondary mb-6">
          If <strong>{email}</strong> has a DirectRef account, we sent a reset link.
        </p>
        <Link href="/login" className="text-gold-300 text-sm font-medium hover:text-gold-400">
          ← Back to login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold text-text-primary mb-1">Reset your password</h1>
        <p className="text-sm text-text-secondary">We&apos;ll send a reset link to your email</p>
      </div>
      <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
      <Button type="submit" variant="primary" size="lg" isLoading={isLoading} className="w-full">
        Send reset link
      </Button>
      <Link href="/login" className="block text-center text-sm text-text-muted hover:text-text-secondary">
        ← Back to login
      </Link>
    </form>
  );
}
