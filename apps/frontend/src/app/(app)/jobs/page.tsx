'use client';

import { useState, useMemo, useEffect } from 'react';
import useSWR from 'swr';
import { useSearchParams } from 'next/navigation';
import { Search, ChevronDown, AlertTriangle, Star, Check } from 'lucide-react';
import { jobsApi } from '@/lib/api/jobs';
import { JobCard } from '@/components/job/JobCard';
import { JobCardSkeleton } from '@/components/ui/Skeleton';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useAuth } from '@/lib/context/AuthContext';
import { cn } from '@/lib/utils';

function useAllJobs() {
  return useSWR('jobs/browse/v2', () =>
    jobsApi.search({}).then((r) => r.data),
    { revalidateOnMount: true },
  );
}

// ── Reusable filter group: collapsible header + optional mini-search + checkbox list ──
function FilterGroup({ title, items, selected, onToggle, searchPlaceholder, showSearch = false }: {
  title: string;
  items: [string, number][];
  selected: Set<string>;
  onToggle: (value: string) => void;
  searchPlaceholder: string;
  showSearch?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(true);

  const visible = useMemo(() => {
    if (!search) return items;
    return items.filter(([label]) => label.toLowerCase().includes(search.toLowerCase()));
  }, [items, search]);

  if (items.length === 0) return null;

  return (
    <div className="border-b border-jobs-border pb-4 last:border-0 last:pb-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-2 mb-2"
      >
        <span className="flex items-center gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.09em] text-jobs-ink-muted">{title}</span>
          {selected.size > 0 && (
            <span className="rounded-full bg-jobs-gold-soft text-gold-500 text-[10.5px] font-semibold px-1.5 py-0.5 normal-case">
              {selected.size}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn('w-4 h-4 text-jobs-ink-muted transition-transform', !expanded && '-rotate-90')}
          strokeWidth={1.8}
        />
      </button>

      {expanded && (
        <>
          {showSearch && (
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-jobs-ink-muted" strokeWidth={1.8} />
              <input
                className="w-full rounded-[8px] border border-jobs-border bg-jobs-surface py-1.5 pl-8 pr-2.5 text-[12.5px] text-jobs-ink placeholder:text-jobs-ink-muted focus:outline-none focus:border-gold-300 transition-colors"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}
          {visible.length === 0 ? (
            <p className="text-[12px] text-jobs-ink-muted">No matches</p>
          ) : (
            <div className="max-h-56 overflow-y-auto pr-1 space-y-1">
              {visible.map(([label, count]) => {
                const active = selected.has(label);
                return (
                  <label key={label} className="flex items-center gap-2 cursor-pointer group">
                    <span
                      onClick={() => onToggle(label)}
                      className={cn(
                        'w-3.5 h-3.5 rounded-[4px] border flex items-center justify-center shrink-0 transition-colors',
                        active ? 'bg-gold-300 border-gold-300' : 'border-jobs-border-strong group-hover:border-gold-300/50',
                      )}
                    >
                      {active && <Check className="w-2.5 h-2.5 text-gold-500" strokeWidth={3} />}
                    </span>
                    <span
                      onClick={() => onToggle(label)}
                      className="flex-1 min-w-0 truncate text-[13px] text-jobs-ink-secondary"
                      title={label}
                    >
                      {label}
                    </span>
                    <span className="text-[11px] text-jobs-ink-muted shrink-0">{count}</span>
                  </label>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function JobsPage() {
  const searchParams = useSearchParams();
  const [search, setSearch]                             = useState('');
  const [selectedCompanies, setSelectedCompanies]         = useState<Set<string>>(new Set());
  const [selectedRoleTypes, setSelectedRoleTypes]         = useState<Set<string>>(new Set());
  const [selectedEmploymentTypes, setSelectedEmploymentTypes] = useState<Set<string>>(new Set());
  const [selectedWorkModes, setSelectedWorkModes]         = useState<Set<string>>(new Set());
  const [selectedLocations, setSelectedLocations]         = useState<Set<string>>(new Set());
  const [selectedContact, setSelectedContact]             = useState<string | null>(searchParams.get('contact') ?? null);
  const [selectedContactName, setSelectedContactName]     = useState<string>(searchParams.get('name') ?? '');
  const debounced = useDebounce(search, 300);

  useEffect(() => {
    setSelectedContact(searchParams.get('contact') ?? null);
    setSelectedContactName(searchParams.get('name') ?? '');
  }, [searchParams]);

  const { user } = useAuth();
  const { data: rawJobs = [], isLoading, error: jobsError } = useAllJobs();

  // Exclude jobs the current user posted themselves — Browse Jobs is for other people's postings
  const allJobs = useMemo(
    () => rawJobs.filter((item) => item.referrer.id !== user?.id),
    [rawJobs, user?.id],
  );

  const facets = useMemo(() => {
    const companies       = new Map<string, number>();
    const roleTypes       = new Map<string, number>();
    const employmentTypes = new Map<string, number>();
    const workModes       = new Map<string, number>();
    const locations        = new Map<string, number>();

    allJobs.forEach((item) => {
      companies.set(item.job.companyName, (companies.get(item.job.companyName) ?? 0) + 1);
      if (item.job.roleType) roleTypes.set(item.job.roleType, (roleTypes.get(item.job.roleType) ?? 0) + 1);
      if (item.job.jobType) employmentTypes.set(item.job.jobType, (employmentTypes.get(item.job.jobType) ?? 0) + 1);
      if (item.job.workMode) workModes.set(item.job.workMode, (workModes.get(item.job.workMode) ?? 0) + 1);
      if (item.job.location) locations.set(item.job.location, (locations.get(item.job.location) ?? 0) + 1);
    });

    return {
      companies:       [...companies.entries()].sort((a, b) => b[1] - a[1]),
      roleTypes:       [...roleTypes.entries()].sort((a, b) => b[1] - a[1]),
      employmentTypes: [...employmentTypes.entries()].sort((a, b) => b[1] - a[1]),
      workModes:       [...workModes.entries()].sort((a, b) => b[1] - a[1]),
      locations:       [...locations.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [allJobs]);

  const filtered = useMemo(() => {
    return allJobs.filter((item) => {
      if (selectedCompanies.size > 0 && !selectedCompanies.has(item.job.companyName)) return false;
      if (selectedRoleTypes.size > 0 && (!item.job.roleType || !selectedRoleTypes.has(item.job.roleType))) return false;
      if (selectedEmploymentTypes.size > 0 && (!item.job.jobType || !selectedEmploymentTypes.has(item.job.jobType))) return false;
      if (selectedWorkModes.size > 0 && (!item.job.workMode || !selectedWorkModes.has(item.job.workMode))) return false;
      if (selectedLocations.size > 0 && (!item.job.location || !selectedLocations.has(item.job.location))) return false;
      if (selectedContact && item.referrer.id !== selectedContact) return false;
      if (debounced) {
        const q = debounced.toLowerCase();
        return (
          item.job.title.toLowerCase().includes(q) ||
          item.job.companyName.toLowerCase().includes(q) ||
          item.referrer.fullName.toLowerCase().includes(q) ||
          (item.job.location ?? '').toLowerCase().includes(q) ||
          (item.job.jobType ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allJobs, selectedCompanies, selectedRoleTypes, selectedEmploymentTypes, selectedWorkModes, selectedLocations, selectedContact, debounced]);

  const hasFilters = selectedCompanies.size > 0 || selectedRoleTypes.size > 0 || selectedEmploymentTypes.size > 0 || selectedWorkModes.size > 0 || selectedLocations.size > 0 || !!selectedContact || !!debounced;

  const toggleCompany = (name: string) =>
    setSelectedCompanies((prev) => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
  const toggleRoleType = (role: string) =>
    setSelectedRoleTypes((prev) => { const n = new Set(prev); n.has(role) ? n.delete(role) : n.add(role); return n; });
  const toggleEmploymentType = (type: string) =>
    setSelectedEmploymentTypes((prev) => { const n = new Set(prev); n.has(type) ? n.delete(type) : n.add(type); return n; });
  const toggleWorkMode = (mode: string) =>
    setSelectedWorkModes((prev) => { const n = new Set(prev); n.has(mode) ? n.delete(mode) : n.add(mode); return n; });
  const toggleLocation = (location: string) =>
    setSelectedLocations((prev) => { const n = new Set(prev); n.has(location) ? n.delete(location) : n.add(location); return n; });

  const clearAll = () => {
    setSelectedCompanies(new Set()); setSelectedRoleTypes(new Set()); setSelectedEmploymentTypes(new Set());
    setSelectedWorkModes(new Set()); setSelectedLocations(new Set());
    setSelectedContact(null); setSelectedContactName(''); setSearch('');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[26px] font-bold text-jobs-ink">Jobs</h1>
          <p className="mt-0.5 text-[14px] text-jobs-ink-secondary">
            {isLoading ? 'Loading…' : `${filtered.length} open role${filtered.length !== 1 ? 's' : ''}${hasFilters ? '' : ' from your network'}`}
            {selectedContact && (
              <>
                {' · '}Filtering by {selectedContactName || 'contact'}{' '}
                <button onClick={() => { setSelectedContact(null); setSelectedContactName(''); }} className="text-gold-500 hover:text-gold-400 font-medium">
                  Clear
                </button>
              </>
            )}
          </p>
        </div>
        <div data-tour="jobs-search" className="relative sm:w-[300px] shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-jobs-ink-muted" strokeWidth={1.8} />
          <input
            className="w-full rounded-[10px] border border-jobs-border bg-jobs-surface py-2.5 pl-9 pr-3 text-[13.5px] text-jobs-ink placeholder:text-jobs-ink-muted focus:outline-none focus:border-gold-300 transition-colors"
            placeholder="Search jobs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Filter rail */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13.5px] font-semibold text-jobs-ink">Filters</span>
            {hasFilters && (
              <button onClick={clearAll} className="text-[12.5px] text-jobs-silver hover:text-jobs-ink underline underline-offset-4">
                Clear all
              </button>
            )}
          </div>
          <div className="space-y-4">
            <FilterGroup title="Company" items={facets.companies} selected={selectedCompanies} onToggle={toggleCompany} searchPlaceholder="Search companies…" showSearch />
            <FilterGroup title="Role type" items={facets.roleTypes} selected={selectedRoleTypes} onToggle={toggleRoleType} searchPlaceholder="Search roles…" showSearch />
            <FilterGroup title="Employment type" items={facets.employmentTypes} selected={selectedEmploymentTypes} onToggle={toggleEmploymentType} searchPlaceholder="" />
            <FilterGroup title="Work mode" items={facets.workModes} selected={selectedWorkModes} onToggle={toggleWorkMode} searchPlaceholder="" />
            <FilterGroup title="Location" items={facets.locations} selected={selectedLocations} onToggle={toggleLocation} searchPlaceholder="Search locations…" showSearch />
          </div>
        </aside>

        {/* Results */}
        <div className="space-y-4 min-w-0">
          {isLoading ? (
            [...Array(5)].map((_, i) => <JobCardSkeleton key={i} />)
          ) : jobsError ? (
            <div className="bg-jobs-surface border border-jobs-border rounded-lg px-6 py-14 text-center">
              <AlertTriangle className="w-6 h-6 mx-auto mb-3 text-jobs-ink-muted" strokeWidth={1.5} />
              <p className="text-[16.5px] font-semibold text-jobs-ink mb-1">Couldn&apos;t load jobs</p>
              <p className="text-[13.5px] text-jobs-ink-secondary">Check your connection and try refreshing</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-jobs-surface border border-jobs-border rounded-lg px-6 py-14 text-center">
              <Star className="w-6 h-6 mx-auto mb-3 text-jobs-ink-muted" strokeWidth={1.5} />
              <p className="text-[16.5px] font-semibold text-jobs-ink mb-1">
                {allJobs.length === 0 ? 'No open roles yet' : 'No jobs match'}
              </p>
              <p className="text-[13.5px] text-jobs-ink-secondary mb-4">
                {allJobs.length === 0 ? 'Check back soon — new roles are added all the time' : 'Try adjusting or clearing your filters'}
              </p>
              {hasFilters && (
                <button onClick={clearAll} className="rounded-[10px] bg-gold-300 hover:bg-gold-400 text-[#0A0A0A] text-[13.5px] font-semibold px-4 py-2 transition-colors">
                  Reset filters
                </button>
              )}
            </div>
          ) : (
            filtered.map((j) => <JobCard key={j.job.id} data={j} />)
          )}
        </div>
      </div>
    </div>
  );
}
