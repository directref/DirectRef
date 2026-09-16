'use client';

import { FileText } from 'lucide-react';
import { useMyApplications } from '@/lib/hooks/useApplications';
import { ApplicationCard } from '@/components/application/ApplicationCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { JobCardSkeleton } from '@/components/ui/Skeleton';
import { useRouter } from 'next/navigation';
import type { ApplicationWithDetails } from '@/lib/types';

export default function MyApplicationsClient({ initialData }: { initialData: ApplicationWithDetails[] }) {
  const { applications, isLoading } = useMyApplications(initialData);
  const router = useRouter();

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-text-primary mb-1">My Applications</h1>
        <p className="text-sm text-text-secondary">CVs you&apos;ve sent to friends</p>
      </div>

      {isLoading && applications.length === 0 ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <JobCardSkeleton key={i} />)}</div>
      ) : applications.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-9 h-9" strokeWidth={1.5} />}
          title="No applications yet"
          description="When you send your CV to a friend's job posting, it will appear here."
          action={{ label: 'Browse jobs', onClick: () => router.push('/jobs') }}
        />
      ) : (
        <div className="space-y-3">
          {applications.map((a) => <ApplicationCard key={a.application.id} data={a} />)}
        </div>
      )}
    </div>
  );
}
