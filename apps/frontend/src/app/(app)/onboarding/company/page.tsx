'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Building2, Check } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { invitesApi, type Colleague } from '@/lib/api/invites';
import { connectionsApi } from '@/lib/api/connections';
import { usersApi } from '@/lib/api/users';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ApiError } from '@/lib/api/client';

export default function OnboardingCompanyPage() {
  const { user, refresh } = useAuth();
  const router = useRouter();
  const [company, setCompany] = useState(user?.companyName ?? '');
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState<Set<string>>(new Set());
  const [connecting, setConnecting] = useState<string | null>(null);

  // Load colleagues when company changes
  useEffect(() => {
    if (company.length < 2) { setColleagues([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await invitesApi.getColleagues(company);
        setColleagues(res.data ?? []);
      } catch {
        setColleagues([]);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [company]);

  // Pre-load on mount with user's company
  useEffect(() => {
    if (user?.companyName) setCompany(user.companyName);
  }, [user?.companyName]);

  const handleConnect = async (colleagueId: string) => {
    setConnecting(colleagueId);
    try {
      await connectionsApi.send(colleagueId);
      setConnected((prev) => new Set([...prev, colleagueId]));
      toast.success('Connection request sent!');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CONNECTION_EXISTS') {
        setConnected((prev) => new Set([...prev, colleagueId]));
      } else {
        toast.error('Failed to connect');
      }
    } finally {
      setConnecting(null);
    }
  };

  const handleContinue = async () => {
    // Save company if changed
    if (company !== user?.companyName) {
      await usersApi.updateMe({ companyName: company });
      await refresh();
    }
    router.push('/onboarding/invite');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{
        background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(212,175,122,0.10) 0%, transparent 70%), var(--color-page)',
      }}
    >
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <Building2 className="w-9 h-9 mx-auto mb-2 text-gold-300" strokeWidth={1.5} />
          <h1 className="text-2xl font-bold text-text-primary">Where do you work?</h1>
          <p className="text-sm text-text-secondary">
            We'll show you colleagues already on DirectRef
          </p>
        </div>

        {/* Progress */}
        <div className="flex gap-1.5">
          <div className="flex-1 h-1 rounded-full bg-gold-300" />
          <div className="flex-1 h-1 rounded-full bg-gold-300" />
          <div className="flex-1 h-1 rounded-full bg-border" />
        </div>

        {/* Company input */}
        <Input
          label="Company name"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="e.g. Google, Wix, Monday.com"
          autoFocus
        />

        {/* Colleagues */}
        {loading && (
          <div className="flex justify-center py-4">
            <LoadingSpinner size="md" />
          </div>
        )}

        {!loading && colleagues.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-text-primary">
              {colleagues.length} {colleagues.length === 1 ? 'person' : 'people'} at {company} already on DirectRef
            </p>
            <div className="space-y-2">
              {colleagues.map((c) => (
                <div key={c.id} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
                  <Avatar src={c.avatarUrl} name={c.fullName} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary">{c.fullName}</p>
                    <p className="text-xs text-text-secondary truncate">{c.headline ?? c.companyName ?? ''}</p>
                  </div>
                  {connected.has(c.id) ? (
                    <span className="inline-flex items-center gap-1 text-xs text-good font-semibold">
                      <Check className="w-3.5 h-3.5" strokeWidth={2} /> Sent
                    </span>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      isLoading={connecting === c.id}
                      onClick={() => handleConnect(c.id)}
                    >
                      Connect
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && company.length >= 2 && colleagues.length === 0 && (
          <div className="text-center py-4 text-sm text-text-muted">
            No one from {company} yet — invite them in the next step!
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="ghost" onClick={() => router.push('/onboarding/welcome')} className="flex-1">
            ← Back
          </Button>
          <Button variant="primary" onClick={handleContinue} className="flex-1">
            Continue →
          </Button>
        </div>

        <div className="text-center">
          <button
            onClick={() => router.push('/feed')}
            className="text-sm text-text-muted hover:text-text-secondary transition-colors"
          >
            Skip onboarding
          </button>
        </div>
      </div>
    </div>
  );
}
