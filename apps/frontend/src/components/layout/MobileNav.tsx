'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Users, ClipboardList, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

const MOBILE_ITEMS = [
  { href: '/feed',               icon: Home,          label: 'Home'    },
  { href: '/jobs',               icon: Search,        label: 'Browse'  },
  { href: '/network',            icon: Users,         label: 'Network' },
  { href: '/applications',       icon: ClipboardList, label: 'Applied' },
  { href: '/applications/inbox', icon: Inbox,         label: 'Inbox'   },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur border-t border-border">
      <div className="flex justify-around py-2">
        {MOBILE_ITEMS.map((item) => {
          const active = pathname === item.href || (item.href !== '/feed' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1 text-xs font-medium transition-colors',
                active ? 'text-gold-300' : 'text-text-muted',
              )}
            >
              <item.icon className="w-5 h-5" strokeWidth={1.8} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
