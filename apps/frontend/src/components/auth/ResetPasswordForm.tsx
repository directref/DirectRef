'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { authApi } from '@/lib/api/auth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ApiError } from '@/lib/api/client';

export function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { toast.error('Passwords do not match'); return; }
    if (!token) { toast.error('Invalid reset link'); return; }
    setIsLoading(true);
    try {
      await authApi.resetPassword(token, password);
      toast.success('Password reset! You can now log in.');
      router.push('/login');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Reset failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold text-text-primary mb-1">Set a new password</h1>
        <p className="text-sm text-text-secondary">Min 8 chars, 1 uppercase, 1 number</p>
      </div>
      <Input label="New password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
      <Input label="Confirm password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" required />
      <Button type="submit" variant="primary" size="lg" isLoading={isLoading} className="w-full">
        Reset password
      </Button>
    </form>
  );
}
