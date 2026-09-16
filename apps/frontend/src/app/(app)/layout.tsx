import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/api/auth';
import { AuthProvider } from '@/lib/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { safeNextPath } from '@/lib/utils';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const user = await getServerUser(cookieHeader);

  if (!user) {
    // proxy.ts forwards the requested path via this header (see its
    // NextResponse.next({ request: { headers } }) call) so a session that
    // looked valid to proxy.ts but is rejected here still returns the user
    // to where they were headed after they log back in.
    const requestedPath = (await headers()).get('x-pathname');
    const next = safeNextPath(requestedPath, '/feed');
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  // Redirect new users to onboarding (but not if they're already there)
  // Note: headers() gives us the pathname in Next.js 15 via the request context
  // We check via a simpler approach — the onboarding pages handle their own routing

  return (
    <AuthProvider initialUser={user}>
      <AppShell>
        {children}
      </AppShell>
    </AuthProvider>
  );
}
