'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, XCircle } from 'lucide-react';
import { authApi } from '@/lib/api/auth';

function VerifyContent() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const params = useSearchParams();
  const token = params.get('token') ?? '';

  useEffect(() => {
    if (!token) { setStatus('error'); return; }
    authApi.verifyWorkEmail(token)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, [token]);

  if (status === 'loading') return <div className="text-center py-8 text-text-secondary">Verifying...</div>;

  if (status === 'success') return (
    <div className="text-center py-4">
      <CheckCircle2 className="w-10 h-10 mx-auto mb-4 text-good" strokeWidth={1.5} />
      <h2 className="text-lg font-bold text-text-primary mb-2">Work email verified!</h2>
      <p className="text-sm text-text-secondary mb-6">You can now post jobs for your company.</p>
      <Link href="/jobs/post" className="text-gold-300 font-medium hover:text-gold-400">Post a job →</Link>
    </div>
  );

  return (
    <div className="text-center py-4">
      <XCircle className="w-10 h-10 mx-auto mb-4 text-crit" strokeWidth={1.5} />
      <h2 className="text-lg font-bold text-text-primary mb-2">Invalid link</h2>
      <p className="text-sm text-text-secondary mb-6">This verification link is invalid or has expired.</p>
      <Link href="/settings" className="text-gold-300 font-medium hover:text-gold-400">Go to settings →</Link>
    </div>
  );
}

import { Suspense } from 'react';
export default function VerifyWorkEmailPage() {
  return <Suspense><VerifyContent /></Suspense>;
}
