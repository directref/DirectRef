import { Suspense } from 'react';
import CallbackClient from './callback-client';

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-text-secondary">
          <div className="w-6 h-6 rounded-full border-2 border-gold-300 border-t-transparent animate-spin" />
          <p className="text-sm">Signing you in…</p>
        </div>
      }
    >
      <CallbackClient />
    </Suspense>
  );
}
