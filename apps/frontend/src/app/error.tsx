'use client';

import { AlertTriangle } from 'lucide-react';

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-crit" strokeWidth={1.5} />
        <h2 className="text-xl font-bold text-text-primary mb-2">Something went wrong</h2>
        <p className="text-sm text-text-secondary mb-6">An unexpected error occurred.</p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-gold-300 hover:bg-gold-400 text-[#0A0A0A] rounded-lg text-sm font-medium transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
