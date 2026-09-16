'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Share2, Check, Copy, MessageCircle, Link2, Lightbulb } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { invitesApi } from '@/lib/api/invites';
import { usersApi } from '@/lib/api/users';
import { Button } from '@/components/ui/Button';
import { ApiError } from '@/lib/api/client';

export default function OnboardingInvitePage() {
  const { user, refresh } = useAuth();
  const router = useRouter();
  const [inviteUrl, setInviteUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invitesApi.getLink()
      .then((res) => setInviteUrl(res.data.url))
      .catch(() => setInviteUrl(''))
      .finally(() => setLoading(false));
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success('Link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — please copy manually');
    }
  };

  const handleWhatsApp = () => {
    const firstName = user?.fullName?.split(' ')[0] ?? 'me';
    const msg = encodeURIComponent(
      `Hey! I'm using DirectRef to share jobs at my company and help friends get hired directly.\n\nJoin via my link and we'll be connected automatically:\n${inviteUrl}`,
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  const handleDone = async () => {
    try {
      // Mark user as onboarded
      await usersApi.updateMe({ onboarded: true } as Parameters<typeof usersApi.updateMe>[0]);
      await refresh();
    } catch {
      // ignore
    }
    router.push('/feed');
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
          <Share2 className="w-9 h-9 mx-auto mb-2 text-gold-300" strokeWidth={1.5} />
          <h1 className="text-2xl font-bold text-text-primary">Invite your colleagues</h1>
          <p className="text-sm text-text-secondary">
            When they sign up via your link, you're automatically connected
          </p>
        </div>

        {/* Progress */}
        <div className="flex gap-1.5">
          <div className="flex-1 h-1 rounded-full bg-gold-300" />
          <div className="flex-1 h-1 rounded-full bg-gold-300" />
          <div className="flex-1 h-1 rounded-full bg-gold-300" />
        </div>

        {/* Invite link */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-text-secondary block">Your personal invite link</label>
          <div className="flex gap-2">
            <div className="flex-1 bg-input border border-border-strong rounded-lg px-3 py-2.5 text-sm text-text-secondary font-mono truncate">
              {loading ? '...' : inviteUrl}
            </div>
            <Button variant="secondary" size="sm" onClick={handleCopy} disabled={loading} className="gap-1.5">
              {copied ? <><Check className="w-3.5 h-3.5" strokeWidth={2} /> Copied</> : <><Copy className="w-3.5 h-3.5" strokeWidth={1.8} /> Copy</>}
            </Button>
          </div>
        </div>

        {/* Share options */}
        <div className="space-y-3">
          {/* WhatsApp */}
          <button
            onClick={handleWhatsApp}
            disabled={loading}
            className="w-full flex items-center gap-3 px-4 py-3.5 bg-[#25D366]/10 border border-[#25D366]/30 hover:bg-[#25D366]/20 rounded-xl transition-colors text-left"
          >
            <MessageCircle className="w-6 h-6 shrink-0 text-[#25D366]" strokeWidth={1.6} />
            <div>
              <p className="text-sm font-semibold text-text-primary">Share on WhatsApp</p>
              <p className="text-xs text-text-muted">Opens WhatsApp with a pre-written message</p>
            </div>
          </button>

          {/* Copy link */}
          <button
            onClick={handleCopy}
            disabled={loading}
            className="w-full flex items-center gap-3 px-4 py-3.5 bg-card border border-border hover:bg-card-hover rounded-xl transition-colors text-left"
          >
            <Link2 className="w-6 h-6 shrink-0 text-text-secondary" strokeWidth={1.6} />
            <div>
              <p className="text-sm font-semibold text-text-primary">Copy link</p>
              <p className="text-xs text-text-muted">Share anywhere — Slack, email, LinkedIn</p>
            </div>
          </button>
        </div>

        {/* Info */}
        <div className="flex items-start gap-2 bg-gold-300/10 border border-gold-300/20 rounded-xl px-4 py-3 text-sm text-text-secondary">
          <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-gold-300" strokeWidth={1.8} />
          <span>Every time someone signs up via your link, you'll be <strong className="text-gold-300">auto-connected</strong> — no need to search for them.</span>
        </div>

        {/* Done */}
        <Button variant="primary" size="lg" className="w-full" onClick={handleDone}>
          Go to my feed
        </Button>

        <div className="text-center">
          <button
            onClick={() => router.push('/onboarding/company')}
            className="text-sm text-text-muted hover:text-text-secondary transition-colors"
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
}
