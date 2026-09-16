'use client';

import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { useSearchParams } from 'next/navigation';
import { Sparkles, Search, Building2, MailQuestion, Send, Handshake, Hourglass } from 'lucide-react';
import { useConnections } from '@/lib/hooks/useConnections';
import { connectionsApi } from '@/lib/api/connections';
import { usersApi } from '@/lib/api/users';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/lib/context/AuthContext';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { cn } from '@/lib/utils';
import useSWR from 'swr';
import { ApiError } from '@/lib/api/client';
import type { PublicUser, Connection } from '@/lib/types';
import Link from 'next/link';

type Tab = 'all' | 'pending' | 'sent';

export default function NetworkPage() {
  const { user }      = useAuth();
  const searchParams  = useSearchParams();
  // Read ?tab= from URL so notification "View →" can deep-link to Requests
  const [tab, setTab]               = useState<Tab>((searchParams.get('tab') as Tab) ?? 'all');
  const [search, setSearch]         = useState('');
  const [removing, setRemoving]     = useState<string | null>(null);
  const [sentIds, setSentIds]       = useState<Set<string>>(new Set());
  const [connecting, setConnecting] = useState<string | null>(null);
  const debouncedSearch             = useDebounce(search, 300);

  const { connections, mutate } = useConnections();

  // All users on the platform (for "People you may know")
  const { data: allUsers = [] } = useSWR(
    'users/discover',
    () => usersApi.search('', 1, 50).then((r) => r.data),
  );

  // Searched users (when typing)
  const { data: searchResults = [] } = useSWR(
    debouncedSearch.length >= 1 ? ['users/search', debouncedSearch] : null,
    ([, q]) => usersApi.search(q as string).then((r) => r.data),
  );

  const connectedIds = useMemo(() => new Set(
    connections.map((c) => c.requesterId === user?.id ? c.addresseeId : c.requesterId),
  ), [connections, user?.id]);

  // People not yet connected — "pending" people are in connectedIds but show differently
  const suggestions = useMemo(() => {
    const source = debouncedSearch.length >= 1 ? searchResults : allUsers;
    // Exclude already-connected (accepted) but keep people with pending requests visible
    const acceptedIds = new Set(
      connections.filter(c => c.status === 'accepted')
        .map(c => c.requesterId === user?.id ? c.addresseeId : c.requesterId)
    );
    return source.filter((u: PublicUser) => u.id !== user?.id && !acceptedIds.has(u.id));
  }, [allUsers, searchResults, debouncedSearch, connections, user?.id]);

  // Track which IDs have a pending sent request (from DB, not just local state)
  const pendingSentIds = useMemo(() => new Set(
    connections
      .filter(c => c.status === 'pending' && c.requesterId === user?.id)
      .map(c => c.addresseeId)
  ), [connections, user?.id]);

  // Group suggestions by company
  const suggestionsByCompany = useMemo(() => {
    const map = new Map<string, PublicUser[]>();
    suggestions.forEach((u: PublicUser) => {
      const key = u.companyName ?? '—';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(u);
    });
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [suggestions]);

  // Categorise connections
  const pending  = useMemo(() => connections.filter((c) => c.status === 'pending' && c.addresseeId === user?.id), [connections, user?.id]);
  const sent     = useMemo(() => connections.filter((c) => c.status === 'pending' && c.requesterId === user?.id), [connections, user?.id]);
  const accepted = useMemo(() => connections.filter((c) => c.status === 'accepted'), [connections]);

  const filtered = useMemo(() => {
    let list = tab === 'pending' ? pending : tab === 'sent' ? sent : accepted;
    return list;
  }, [tab, pending, sent, accepted]);

  const handleConnect = async (addresseeId: string) => {
    setConnecting(addresseeId);
    try {
      await connectionsApi.send(addresseeId);
      setSentIds((prev) => new Set([...prev, addresseeId]));
      toast.success('Connection request sent!');
      mutate();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CONNECTION_EXISTS') {
        setSentIds((prev) => new Set([...prev, addresseeId]));
        mutate();
      } else {
        toast.error(err instanceof ApiError ? err.message : 'Failed to send request');
      }
    } finally {
      setConnecting(null);
    }
  };

  const handleAccept = async (id: string) => {
    await connectionsApi.update(id, 'accepted');
    toast.success('Connected!');
    mutate();
  };

  const handleDecline = async (id: string) => {
    await connectionsApi.update(id, 'rejected');
    mutate();
  };

  const handleRemove = async (id: string) => {
    setRemoving(id);
    try {
      await connectionsApi.remove(id);
      toast.success('Connection removed');
      mutate();
    } catch {
      toast.error('Failed to remove');
    } finally {
      setRemoving(null);
    }
  };

  const TABS = [
    { id: 'all',     label: 'All',      count: accepted.length },
    { id: 'pending', label: 'Requests', count: pending.length,  highlight: pending.length > 0 },
    { id: 'sent',    label: 'Sent',     count: sent.length },
  ] as const;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-0.5">My Network</h1>
          <p className="text-sm text-text-secondary">
            {accepted.length} connection{accepted.length !== 1 ? 's' : ''}
            {pending.length > 0 && (
              <button
                onClick={() => setTab('pending')}
                className="ml-2 text-warn font-medium hover:text-warn/80 transition-colors"
              >
                · {pending.length} pending request{pending.length > 1 ? 's' : ''} →
              </button>
            )}
          </p>
        </div>
      </div>

      {/* ── PEOPLE YOU MAY KNOW ─────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-text-primary">
            <Sparkles className="w-4 h-4 text-gold-300" strokeWidth={1.8} /> People on DirectRef
          </h2>
          <span className="text-xs text-text-muted">{suggestions.length} people</span>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 bg-input border border-border-strong rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-gold-300/40 transition-all">
          <Search className="w-4 h-4 text-text-muted" strokeWidth={1.8} />
          <input
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
            placeholder="Search by name or company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-text-muted hover:text-text-primary text-sm">×</button>
          )}
        </div>

        {/* Suggestions grouped by company */}
        {suggestions.length === 0 ? (
          <div className="text-center py-6 text-sm text-text-muted">
            {debouncedSearch ? `No results for "${debouncedSearch}"` : 'Everyone is already connected!'}
          </div>
        ) : (
          <div className="space-y-4">
            {suggestionsByCompany.map(([company, people]) => (
              <div key={company}>
                {company !== '—' && (
                  <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-text-muted mb-2 px-1">
                    <Building2 className="w-3 h-3" strokeWidth={2} /> {company}
                  </p>
                )}
                <div className="space-y-2">
                  {people.map((person) => {
                    const isPendingSent = sentIds.has(person.id) || pendingSentIds.has(person.id);
                    return (
                      <div
                        key={person.id}
                        className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 hover:bg-card-hover transition-colors"
                      >
                        <Avatar src={person.avatarUrl} name={person.fullName} size="md" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-text-primary">{person.fullName}</p>
                          <p className="text-xs text-text-secondary truncate">
                            {person.headline ?? person.companyName ?? '—'}
                          </p>
                        </div>
                        {person.companyName && !person.headline && (
                          <Badge variant="muted" className="hidden sm:inline-flex shrink-0">
                            {person.companyName}
                          </Badge>
                        )}
                        {isPendingSent ? (
                          /* Show pending badge — row stays visible */
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-warn/10 text-warn border border-warn/20 shrink-0">
                            <Hourglass className="w-3 h-3" strokeWidth={2} /> Pending
                          </span>
                        ) : (
                          <Button
                            variant="primary"
                            size="sm"
                            isLoading={connecting === person.id}
                            onClick={() => handleConnect(person.id)}
                            className="shrink-0"
                          >
                            Connect
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── MY CONNECTIONS ──────────────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-text-primary">Your connections</h2>

        {/* Tabs */}
        <div className="flex gap-1 bg-input border border-border rounded-xl p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as Tab)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 rounded-lg transition-all',
                tab === t.id
                  ? 'bg-card text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-secondary',
              )}
            >
              {t.label}
              {t.count > 0 && (
                <span className={cn(
                  'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                  'highlight' in t && t.highlight
                    ? 'bg-warn/20 text-warn'
                    : tab === t.id ? 'bg-gold-300/20 text-gold-300' : 'bg-border text-text-muted',
                )}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Connection list */}
        {filtered.length === 0 ? (
          tab === 'pending' ? (
            <EmptyState icon={<MailQuestion className="w-9 h-9" strokeWidth={1.5} />} title="No pending requests" description="When someone sends you a connection request, it will appear here." />
          ) : tab === 'sent' ? (
            <EmptyState icon={<Send className="w-9 h-9" strokeWidth={1.5} />} title="No sent requests" description="Requests you've sent that haven't been accepted yet." />
          ) : (
            <EmptyState
              icon={<Handshake className="w-9 h-9" strokeWidth={1.5} />}
              title="No connections yet"
              description="Connect with people above to start building your network."
            />
          )
        ) : (
          <div className="space-y-2">
            {filtered.map((c) => (
              <ConnectionRow
                key={c.id}
                connection={c}
                viewerId={user?.id ?? ''}
                tab={tab}
                isRemoving={removing === c.id}
                onAccept={() => handleAccept(c.id)}
                onDecline={() => handleDecline(c.id)}
                onRemove={() => handleRemove(c.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Connection row ────────────────────────────────────────────────────────────
function ConnectionRow({ connection, viewerId, tab, isRemoving, onAccept, onDecline, onRemove }: {
  connection: Connection;
  viewerId: string;
  tab: Tab;
  isRemoving: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onRemove: () => void;
}) {
  const person = connection.requester;
  if (!person) return null;

  return (
    <div className="flex items-center gap-3 bg-card hover:bg-card-hover border border-border rounded-xl px-4 py-3 transition-colors group">
      <Avatar src={person.avatarUrl} name={person.fullName} size="md" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text-primary leading-tight">{person.fullName}</p>
        <p className="text-xs text-text-secondary truncate mt-0.5">
          {person.headline ?? person.companyName ?? '—'}
        </p>
      </div>
      {person.companyName && (
        <Badge variant="muted" className="hidden sm:inline-flex shrink-0">{person.companyName}</Badge>
      )}
      <div className="flex gap-2 shrink-0">
        {tab === 'pending' ? (
          <>
            <Button variant="primary" size="sm" onClick={onAccept} className="min-h-[44px] px-4">Accept</Button>
            <Button variant="ghost" size="sm" onClick={onDecline} className="min-h-[44px]">Decline</Button>
          </>
        ) : tab === 'sent' ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-2 rounded-full bg-warn/10 text-warn border border-warn/20">
            <Hourglass className="w-3 h-3" strokeWidth={2} /> Pending
          </span>
        ) : (
          <>
            <Link href={`/jobs?contact=${person.id}&name=${encodeURIComponent(person.fullName.split(' ')[0])}`} className="hidden sm:block">
              <Button variant="ghost" size="sm" className="min-h-[44px]">See jobs</Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              isLoading={isRemoving}
              className="text-text-muted hover:text-crit min-h-[44px] sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
            >
              Remove
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
