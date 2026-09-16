'use client';

import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { applicationsApi } from '@/lib/api/applications';
import { useAuth } from '@/lib/context/AuthContext';
import { timeAgo } from '@/lib/utils';
import { ApiError } from '@/lib/api/client';
import type { ApplicationMessage } from '@/lib/types';

interface MessageThreadProps {
  applicationId: string;
  /** Display name of the other party — shown in the dialog title */
  otherPartyName: string;
  open: boolean;
  onClose: () => void;
  /** Called after messages load so parent can clear the unread badge */
  onRead?: () => void;
}

function fetcher(id: string) {
  return applicationsApi.getMessages(id).then((r) => r.data);
}

export function MessageThread({
  applicationId,
  otherPartyName,
  open,
  onClose,
  onRead,
}: MessageThreadProps) {
  const { user } = useAuth();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const {
    data,
    mutate,
    isLoading,
  } = useSWR(
    open ? `messages-${applicationId}` : null,
    () => fetcher(applicationId),
    { refreshInterval: 15_000 },
  );

  const messages: ApplicationMessage[] = data?.messages ?? [];

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Fire onRead once after first load
  useEffect(() => {
    if (data && onRead) onRead();
  }, [data, onRead]);

  const handleSend = async () => {
    const content = draft.trim();
    if (!content) return;
    setSending(true);
    try {
      await applicationsApi.sendMessage(applicationId, content);
      setDraft('');
      await mutate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        title={`Chat with ${otherPartyName}`}
        description="Messages are private between you and this person."
        onClose={onClose}
        className="flex flex-col max-h-[80vh]"
      >
        {/* Message list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
          {isLoading && (
            <p className="text-center text-sm text-text-muted py-8">Loading…</p>
          )}

          {!isLoading && messages.length === 0 && (
            <div className="text-center py-10">
              <p className="text-sm font-semibold text-text-primary">No messages yet</p>
              <p className="text-xs text-text-muted mt-1">Send the first message to start the conversation.</p>
            </div>
          )}

          {messages.map((msg) => {
            const isOwn = msg.senderId === user?.id;
            return (
              <div
                key={msg.id}
                className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <Avatar
                  src={msg.senderAvatarUrl}
                  name={msg.senderName}
                  size="xs"
                  className="shrink-0 mb-0.5"
                />
                <div className={`flex flex-col gap-1 max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                      isOwn
                        ? 'bg-gold-500/20 text-text-primary rounded-br-sm'
                        : 'bg-input text-text-primary rounded-bl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-text-muted px-1">
                    {timeAgo(msg.createdAt)}
                  </span>
                </div>
              </div>
            );
          })}

          <div ref={bottomRef} />
        </div>

        {/* Compose area */}
        <div className="border-t border-border px-6 py-4 flex gap-3 items-end shrink-0">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (⌘↵ to send)"
            maxLength={2000}
            charCount
            rows={2}
            className="resize-none"
          />
          <Button
            variant="primary"
            size="sm"
            onClick={handleSend}
            isLoading={sending}
            disabled={!draft.trim()}
            className="shrink-0"
          >
            Send
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
