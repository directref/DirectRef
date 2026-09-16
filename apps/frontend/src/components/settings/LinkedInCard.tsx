'use client';

import { CheckCircle2 } from 'lucide-react';
import { pfx } from '@/app/(app)/settings/tokens';
import { useAuth } from '@/lib/context/AuthContext';
import { SecondaryButton } from './buttons';
import { API_BASE } from '@/lib/constants';

function LinkedInGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={pfx.linkedinBlue}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

/** Shows a "Connect" CTA until the profile is linked, then switches to a
 *  persistent "Connected" badge — stays visible either way, unlike before
 *  when the card just disappeared with no ongoing confirmation that the
 *  connection was actually still in place. */
export function LinkedInCard() {
  const { user } = useAuth();
  const isConnected = !!user?.linkedinId;

  const handleConnect = () => {
    window.location.href = `${API_BASE}/api/auth/linkedin/connect`;
  };

  return (
    <div
      className="relative rounded-2xl p-4 sm:p-5 sm:pr-[128px]"
      style={{ background: pfx.surface, border: `1px solid ${pfx.border}` }}
    >
      <div className="flex items-start gap-3.5">
        <div
          className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0"
          style={{ background: pfx.secondary }}
        >
          <LinkedInGlyph />
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold" style={{ color: pfx.ink }}>LinkedIn</p>
          {isConnected ? (
            <div className="mt-2 flex items-center gap-2 text-[13.5px] font-medium" style={{ color: pfx.ink }}>
              <CheckCircle2 className="w-4 h-4 text-good shrink-0" strokeWidth={1.8} />
              Connected
            </div>
          ) : (
            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: pfx.inkSecondary }}>
              Connect your profile so we know you better and focus your matches.
            </p>
          )}
        </div>
      </div>

      {!isConnected && (
        <SecondaryButton
          onClick={handleConnect}
          className="mt-4 w-full sm:mt-0 sm:w-auto sm:absolute sm:top-5 sm:right-5 inline-flex items-center gap-2"
        >
          <LinkedInGlyph size={16} />
          Connect
        </SecondaryButton>
      )}
    </div>
  );
}
