'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { useUnreadCount } from '@/lib/hooks/useNotifications';
import { Avatar } from '@/components/ui/Avatar';

export function TopBar() {
  const { user } = useAuth();
  const { count: unreadCount } = useUnreadCount();

  return (
    <header className="sticky top-0 z-40 backdrop-blur border-b h-14 flex items-center px-4 gap-2 md:hidden" style={{ background: 'rgba(242,242,242,0.92)', borderColor: 'rgba(26,18,9,0.08)' }}>
      <span className="text-lg font-black tracking-tight flex-1">
        <span style={{ background: 'linear-gradient(160deg,#1A1209,#2A1A09)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Direct</span>
        <span style={{ background: 'linear-gradient(160deg,#C49A5A,#A87D3A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Ref</span>
      </span>

      {/* Bell — 44px touch target */}
      <Link
        href="/notifications"
        className="relative flex items-center justify-center w-11 h-11 rounded-xl text-text-muted hover:text-text-primary hover:bg-card-hover transition-colors"
      >
        <Bell className="w-5 h-5" strokeWidth={1.8} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-gold-300 text-[#0A0A0A] text-[9px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Link>

      {/* Avatar — 44px touch target */}
      <Link href="/settings" className="flex items-center justify-center w-11 h-11 rounded-xl hover:bg-card-hover transition-colors">
        <Avatar src={user?.avatarUrl} name={user?.fullName} size="sm" />
      </Link>
    </header>
  );
}
