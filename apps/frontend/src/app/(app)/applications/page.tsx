import { cookies } from 'next/headers';
import { getServerMyApplications, getServerInbox } from '@/lib/api/applications';
import ApplicationsClient from './ApplicationsClient';

export default async function ApplicationsPage() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const [initialSent, initialReceived] = await Promise.all([
    getServerMyApplications(cookieHeader),
    getServerInbox(cookieHeader),
  ]);
  return <ApplicationsClient initialSent={initialSent} initialReceived={initialReceived} />;
}
