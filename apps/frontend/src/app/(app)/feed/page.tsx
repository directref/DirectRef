import { cookies } from 'next/headers';
import { getServerJobFeed } from '@/lib/api/jobs';
import FeedClient from './FeedClient';

export default async function FeedPage() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const initialJobs = await getServerJobFeed(cookieHeader);
  return <FeedClient initialJobs={initialJobs} />;
}
