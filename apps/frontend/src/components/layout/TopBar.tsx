'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Menu, X, Bell } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { useUnreadCount } from '@/lib/hooks/useNotifications';
import { Avatar } from '@/components/ui/Avatar';
import { SidebarContent } from './Sidebar';

/** Mobile header: brand + hamburger trigger for the nav drawer, plus quick
 *  links to notifications and the profile that don't belong buried in the
 *  drawer. The drawer itself renders SidebarContent -- the same nav the
 *  desktop Sidebar shows, so mobile never has fewer destinations than
 *  desktop (it used to: no Post a job, no CV inbox, no way to log out). */
export function TopBar() {
  const { user } = useAuth();
  const { count: unreadCount } = useUnreadCount();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Belt-and-suspenders close: a Link's onClick and Next's router
  // transition can race, so the drawer isn't reliably guaranteed to close
  // from onClick alone. Closing on every route change is unconditional.
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <header className="sticky top-0 z-40 backdrop-blur border-b h-14 flex items-center px-2 gap-1 md:hidden" style={{ background: 'rgba(242,242,242,0.92)', borderColor: 'rgba(26,18,9,0.08)' }}>
        <DialogPrimitive.Trigger
          aria-label="Open menu"
          className="flex items-center justify-center w-11 h-11 rounded-xl text-text-muted hover:text-text-primary hover:bg-card-hover transition-colors"
        >
          <Menu className="w-5 h-5" strokeWidth={1.8} />
        </DialogPrimitive.Trigger>

        <span className="text-lg font-black tracking-tight flex-1 text-center">
          <span style={{ background: 'linear-gradient(160deg,#1A1209,#2A1A09)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Direct</span>
          <span style={{ background: 'linear-gradient(160deg,#C49A5A,#A87D3A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Ref</span>
        </span>

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

        <Link href="/settings" className="flex items-center justify-center w-11 h-11 rounded-xl hover:bg-card-hover transition-colors">
          <Avatar src={user?.avatarUrl} name={user?.fullName} size="sm" />
        </Link>
      </header>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 md:hidden" />
        <DialogPrimitive.Content
          className="fixed inset-y-0 left-0 z-50 w-[85vw] max-w-80 flex flex-col bg-sidebar focus:outline-none md:hidden"
        >
          <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Navigation menu</DialogPrimitive.Description>
          <DialogPrimitive.Close
            aria-label="Close menu"
            className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-sidebar-muted hover:text-sidebar-foreground hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </DialogPrimitive.Close>
          <SidebarContent onNavigate={() => setOpen(false)} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
