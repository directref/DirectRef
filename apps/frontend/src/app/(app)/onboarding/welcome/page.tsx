'use client';

import Link from 'next/link';
import { Hand, Users, Search, FileText } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';

export default function OnboardingWelcomePage() {
  const { user } = useAuth();
  const firstName = user?.fullName?.split(' ')[0] ?? 'there';

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{
        background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(212,175,122,0.12) 0%, transparent 70%), var(--color-page)',
      }}
    >
      <div className="max-w-md w-full text-center space-y-8">
        {/* Logo */}
        <div
          className="text-3xl font-black tracking-tight"
          style={{
            background: 'linear-gradient(160deg,#FAFAFA,#D4AF7A)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          DirectRef
        </div>

        {/* Wave + greeting */}
        <div className="space-y-4">
          <Hand className="w-12 h-12 mx-auto text-gold-300" strokeWidth={1.5} />
          <h1 className="text-3xl font-bold text-text-primary">
            Welcome, {firstName}!
          </h1>
          <p className="text-text-secondary leading-relaxed">
            DirectRef connects you with friends inside companies you want to work at.
            Your CV goes straight to a real person — not an ATS black hole.
          </p>
        </div>

        {/* How it works */}
        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            { icon: Users, label: 'Connect with colleagues' },
            { icon: Search, label: 'Find their open roles' },
            { icon: FileText, label: 'Send CV directly' },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-3 space-y-2">
              <s.icon className="w-6 h-6 mx-auto text-gold-300" strokeWidth={1.6} />
              <div className="text-xs text-text-secondary leading-snug">{s.label}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <Link
          href="/onboarding/company"
          className="block w-full py-3 px-6 bg-gold-300 hover:bg-gold-400 text-[#0A0A0A] font-semibold rounded-xl transition-colors text-center"
        >
          Let's set up your network →
        </Link>

        <Link href="/feed" className="block text-sm text-text-muted hover:text-text-secondary transition-colors">
          Skip for now
        </Link>
      </div>
    </div>
  );
}
