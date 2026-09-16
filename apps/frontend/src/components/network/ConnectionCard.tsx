'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { connectionsApi } from '@/lib/api/connections';
import { ApiError } from '@/lib/api/client';
import type { Connection } from '@/lib/types';

interface ConnectionCardProps {
  connection: Connection;
  viewerId: string;
  onUpdate: () => void;
}

export function ConnectionCard({ connection, viewerId, onUpdate }: ConnectionCardProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const isRequester = connection.requesterId === viewerId;
  const other = connection.requester; // requester data joined from API
  const isPending = connection.status === 'pending';
  const isAccepted = connection.status === 'accepted';
  const isReceived = isPending && !isRequester;

  const handleAction = async (action: 'accepted' | 'rejected' | 'remove') => {
    setIsLoading(action);
    try {
      if (action === 'remove') {
        await connectionsApi.remove(connection.id);
        toast.success('Connection removed');
      } else {
        await connectionsApi.update(connection.id, action);
        toast.success(action === 'accepted' ? 'Connection accepted!' : 'Request declined');
      }
      onUpdate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <Card hover className="p-4 flex items-center gap-3">
      <Avatar src={other?.avatarUrl} name={other?.fullName ?? '?'} size="md" />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-text-primary text-sm">{other?.fullName}</p>
        <p className="text-xs text-text-secondary mt-0.5 truncate">
          {other?.headline ?? other?.companyName ?? ''}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {isAccepted && (
          <>
            <Badge variant="good">Connected</Badge>
            <Button
              variant="ghost"
              size="sm"
              isLoading={isLoading === 'remove'}
              onClick={() => handleAction('remove')}
            >
              Remove
            </Button>
          </>
        )}
        {isReceived && (
          <>
            <Button
              variant="primary"
              size="sm"
              isLoading={isLoading === 'accepted'}
              onClick={() => handleAction('accepted')}
            >
              Accept
            </Button>
            <Button
              variant="ghost"
              size="sm"
              isLoading={isLoading === 'rejected'}
              onClick={() => handleAction('rejected')}
            >
              Decline
            </Button>
          </>
        )}
        {isPending && isRequester && (
          <Badge variant="muted">Pending</Badge>
        )}
      </div>
    </Card>
  );
}
