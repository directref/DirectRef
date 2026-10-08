'use client';

import { useState } from 'react';

export function SecretGate({ onSubmit, error }: { onSubmit: (secret: string) => void; error?: string }) {
  const [value, setValue] = useState('');
  return (
    <form
      className="mx-auto mt-16 max-w-sm rounded-xl border border-border bg-card p-6"
      onSubmit={(e) => { e.preventDefault(); if (value.trim()) onSubmit(value.trim()); }}
    >
      <h1 className="mb-1 text-lg font-bold">Admin access</h1>
      <p className="mb-4 text-sm text-text-muted">Enter the ADMIN_SECRET. It is kept for this tab only.</p>
      <input
        type="password"
        autoFocus
        autoComplete="current-password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="mb-3 w-full rounded-lg border border-border-strong bg-input px-3 py-2 text-sm outline-none focus:border-text-primary"
        placeholder="Admin secret"
        aria-label="Admin secret"
      />
      {error && <p className="mb-3 text-sm text-crit" role="alert">{error}</p>}
      <button type="submit" className="w-full rounded-lg bg-text-primary px-3 py-2 text-sm font-semibold text-white">
        Open dashboard
      </button>
    </form>
  );
}
