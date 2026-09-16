'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useAuth } from '@/lib/context/AuthContext';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { OAuthButton } from './OAuthButton';
import { ApiError } from '@/lib/api/client';

interface LoginFormProps {
  /** Where to send the user after a successful login, e.g. the page they
   *  were redirected from. Validated in AuthContext before use. */
  next?: string;
}

export function LoginForm({ next }: LoginFormProps) {
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState('');
  const { login, isLoading }            = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password, next);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Something went wrong';
      setError(msg);
      toast.error(msg);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold text-text-primary mb-1">Welcome back</h1>
        <p className="text-sm text-text-secondary">Good to have you back</p>
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

      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        required
      />

      {/* Password with show/hide toggle */}
      <div className="w-full">
        <label className="block text-xs font-semibold text-text-secondary mb-1.5">
          Password
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            className="w-full bg-input border border-border-strong rounded-lg px-3 py-2.5 pr-10 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-gold-300/40 focus:border-gold-300 transition-colors"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.42 20.42 0 0 1 5.06-6.06" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a20.42 20.42 0 0 1-3.22 4.44" />
                <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-crit">{error}</p>}

      <Button type="submit" variant="primary" size="lg" isLoading={isLoading} className="w-full">
        Log in
      </Button>

      <div className="text-center space-y-2 pt-2">
        <Link href="/forgot-password" className="block text-sm text-text-secondary hover:text-gold-300 transition-colors">
          Forgot your password?
        </Link>
        <p className="text-sm text-text-muted">
          No account?{' '}
          <Link href="/register" className="text-gold-300 hover:text-gold-400 font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </form>
  );
}
