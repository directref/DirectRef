'use client';

import { Laptop, Building2, FileEdit, Clock } from 'lucide-react';
import { Chip } from '@/components/ui/Chip';

const chipIcon = (Icon: typeof Laptop) => <Icon className="w-3.5 h-3.5" strokeWidth={1.8} />;

interface Filters {
  jobType?: string;
  remote?: boolean;
}

interface JobFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

export function JobFilters({ filters, onChange }: JobFiltersProps) {
  const toggle = (key: keyof Filters, value: string | boolean) => {
    onChange({ ...filters, [key]: filters[key as keyof Filters] === value ? undefined : value });
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Chip
        label="Remote"
        icon={chipIcon(Laptop)}
        active={!!filters.remote}
        onToggle={() => toggle('remote', true)}
      />
      <Chip
        label="Full-time"
        icon={chipIcon(Building2)}
        active={filters.jobType === 'full-time'}
        onToggle={() => toggle('jobType', 'full-time')}
      />
      <Chip
        label="Contract"
        icon={chipIcon(FileEdit)}
        active={filters.jobType === 'contract'}
        onToggle={() => toggle('jobType', 'contract')}
      />
      <Chip
        label="Part-time"
        icon={chipIcon(Clock)}
        active={filters.jobType === 'part-time'}
        onToggle={() => toggle('jobType', 'part-time')}
      />
    </div>
  );
}
