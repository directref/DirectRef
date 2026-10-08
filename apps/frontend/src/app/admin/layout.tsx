import type { Metadata } from 'next';
import { AdminNav } from './AdminNav';

/** Internal dashboards. Not linked from anywhere, never indexed; every number
 *  behind them is guarded by ADMIN_SECRET on the backend, so this layout
 *  holds no data of its own. */
export const metadata: Metadata = {
  title: 'DirectRef — Admin',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-page text-text-primary">
      <AdminNav />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
