'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { Home, Search, Send, Bookmark, PlusSquare, Inbox, Bell, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/context/AuthContext';
import { useUnreadCount } from '@/lib/hooks/useNotifications';
import { applicationsApi } from '@/lib/api/applications';
import { LogoMark } from '@/components/ui/Logo';
import { CreditsCard } from '@/components/credits/CreditsCard';
import { LogoutDialog } from './LogoutDialog';

type Item = {
  href: string;
  icon: typeof Home;
  label: string;
  badge?: number;
  tourAnchor?: string;
};

const SEEKER_ITEMS: Item[] = [
  { href: '/jobs', icon: Search, label: 'Browse jobs', tourAnchor: 'nav-jobs' },
  { href: '/applications?tab=sent', icon: Send, label: 'Sent CVs' },
  { href: '/applications?tab=saved', icon: Bookmark, label: 'Saved jobs' },
];

const REFERRER_ITEMS: Item[] = [
  { href: '/jobs/post', icon: PlusSquare, label: 'Post a job' },
  { href: '/applications/inbox', icon: Inbox, label: 'CV inbox' },
];

const GENERAL_ITEMS: Item[] = [
  { href: '/notifications', icon: Bell, label: 'Notifications' },
];

const EXACT_ROUTES = ['/applications', '/jobs'];

function isActive(pathname: string, search: string, href: string) {
  const [path, query] = href.split('?');
  if (!EXACT_ROUTES.includes(path) && pathname.startsWith(path + '/')) return true;
  if (pathname !== path) return false;
  if (!query) return true;
  const wantedTab = new URLSearchParams(query).get('tab');
  const currentTab = new URLSearchParams(search).get('tab');
  return wantedTab === null || wantedTab === currentTab;
}

function NavLink({ item, active, onNavigate }: { item: Item; active: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      data-tour={item.tourAnchor}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 text-[14.5px] font-medium transition-colors duration-150',
        active ? 'bg-gold-glow text-gold-300' : 'text-sidebar-muted hover:bg-white/5 hover:text-sidebar-foreground',
      )}
    >
      <Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={1.7} />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.badge ? (
        <span className="shrink-0 rounded-full bg-gold-300 px-1.5 py-0.5 text-[10px] font-bold text-[#0A0A0A] min-w-[18px] text-center">
          {item.badge > 9 ? '9+' : item.badge}
        </span>
      ) : null}
    </Link>
  );
}

/** The nav column's actual content: logo, links, credits, profile, logout.
 *  Shared between the desktop Sidebar and the mobile hamburger drawer
 *  (TopBar's Radix Dialog) so the two can never drift into showing
 *  different items. onNavigate closes the mobile drawer after a link is
 *  clicked; the desktop Sidebar leaves it undefined since there's nothing
 *  to close. */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const { user, logout } = useAuth();
  const { count: unreadCount } = useUnreadCount();
  const { data: inbox } = useSWR('sidebar/inbox', () => applicationsApi.inbox().then(r => r.data));
  const pendingCVs = (inbox ?? []).filter(a => a.application.status === 'submitted').length;

  const [logoutOpen, setLogoutOpen] = useState(false);

  return (
    <>
      <Link href="/feed" onClick={onNavigate} className="px-4 h-14 flex items-center gap-3 border-b border-sidebar-border shrink-0">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-gold-glow border border-gold-300/30">
          <LogoMark size={20} />
        </div>
        <span className="flex flex-col gap-0.5 leading-none">
          <span className="flex items-center gap-1.5">
            <span className="text-lg font-black tracking-tight leading-none">
              <span style={{ background: 'linear-gradient(160deg,#FAFAFA,#E8E8E8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Direct</span>
              <span style={{ background: 'linear-gradient(160deg,#F0D9A8,#D4AF7A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Ref</span>
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wide text-gold-300 bg-gold-300/15 border border-gold-300/30 rounded-full px-1.5 py-0.5 leading-none">
              Beta
            </span>
          </span>
          <span className="text-[9px] font-medium text-sidebar-muted leading-none">Refer. Get hired.</span>
        </span>
      </Link>

      <nav className="flex-1 py-2.5 px-2.5 overflow-y-auto">
        <div className="mb-2.5">
          <NavLink
            item={{ href: '/feed', icon: Home, label: 'Home', tourAnchor: 'nav-home' }}
            active={isActive(pathname, search, '/feed')}
            onNavigate={onNavigate}
          />
        </div>

        <p className="text-[10.5px] font-extrabold uppercase tracking-widest text-sidebar-muted/60 px-2.5 pb-1">
          Finding work
        </p>
        <div className="space-y-0.5 mb-2.5">
          {SEEKER_ITEMS.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, search, item.href)} onNavigate={onNavigate} />
          ))}
        </div>

        <p className="text-[10.5px] font-extrabold uppercase tracking-widest text-sidebar-muted/60 px-2.5 pb-1">
          Referring
        </p>
        <div className="space-y-0.5 mb-2.5">
          {REFERRER_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              item={item.href === '/applications/inbox' && pendingCVs > 0 ? { ...item, badge: pendingCVs } : item}
              active={isActive(pathname, search, item.href)}
              onNavigate={onNavigate}
            />
          ))}
        </div>

        <p className="text-[10.5px] font-extrabold uppercase tracking-widest text-sidebar-muted/60 px-2.5 pb-1">
          General
        </p>
        <div className="space-y-0.5">
          {GENERAL_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              item={item.href === '/notifications' && unreadCount > 0 ? { ...item, badge: unreadCount } : item}
              active={isActive(pathname, search, item.href)}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </nav>

      <div className="p-2 space-y-0.5 border-t border-sidebar-border shrink-0">
        <div data-tour="credits" className="mb-0.5">
          <CreditsCard />
        </div>
        {user && (
          <Link
            href="/settings"
            data-tour="profile"
            onClick={onNavigate}
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-[10px] hover:bg-white/5 transition-colors"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar-card text-[11px] font-semibold text-sidebar-foreground">
              {user.fullName.trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase()}
            </span>
            <span className="min-w-0 text-[13px] leading-tight">
              <span className="block truncate font-semibold text-sidebar-foreground">{user.fullName}</span>
              <span className="block text-sidebar-muted">Profile &amp; preferences</span>
            </span>
          </Link>
        )}
        <button
          onClick={() => setLogoutOpen(true)}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-[10px] text-[13.5px] font-semibold text-sidebar-muted hover:bg-white/5 hover:text-sidebar-foreground transition-colors"
        >
          <LogOut className="h-[17px] w-[17px]" strokeWidth={1.7} />
          Log out
        </button>
      </div>

      <LogoutDialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={() => { setLogoutOpen(false); onNavigate?.(); logout(); }}
      />
    </>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden md:flex flex-col w-72 shrink-0 h-screen sticky top-0 bg-sidebar border-r border-sidebar-border">
      <SidebarContent />
    </aside>
  );
}
