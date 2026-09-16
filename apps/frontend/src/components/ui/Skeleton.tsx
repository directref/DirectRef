import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn('animate-pulse bg-card-hover rounded-lg', className)} />
  );
}

export function JobCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      <div className="flex gap-3">
        <Skeleton className="w-11 h-11 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-10 rounded-lg" />
      <Skeleton className="h-9 rounded-lg" />
    </div>
  );
}
