import { cookies } from 'next/headers';
import { getServerJob } from '@/lib/api/jobs';
import { notFound } from 'next/navigation';
import JobDetailClient from './JobDetailClient';

interface Props { params: Promise<{ id: string }> }

export default async function JobDetailPage({ params }: Props) {
  const { id } = await params;
  const cookieStore = await cookies();
  try {
    const { data } = await getServerJob(id, cookieStore.toString());
    return <JobDetailClient data={data} />;
  } catch {
    notFound();
  }
}
