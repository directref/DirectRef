import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { env } from '../config/env';
import { syncWaitlistContact, isSegmentSyncConfigured } from './waitlistSegments';

/**
 * WHY THIS FILE:
 *  - PROBLEM: the launch Broadcasts go to Resend Segments, not to our table.
 *    If the sync calls the wrong endpoint, or unsubscribes globally, the
 *    "we're live" email reaches the wrong list or silences someone's other one.
 *  - COST OF FAILURE: a referrer who never gets the invite to post, or a
 *    seeker who unsubscribed and gets mailed anyway.
 *  - SUCCESS: joining adds to exactly one Segment; leaving removes from
 *    exactly that one; failures report false instead of throwing.
 */

const fetchMock = vi.fn();
const ok = (status = 200) => new Response('{}', { status });

beforeEach(() => {
  Object.assign(env, {
    RESEND_CONTACTS_API_KEY: 're_test_full_access',
    RESEND_SEGMENT_SEEKERS_ID: 'seg-seekers',
    RESEND_SEGMENT_REFERRERS_ID: 'seg-referrers',
  });
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  Object.assign(env, { RESEND_CONTACTS_API_KEY: '', RESEND_SEGMENT_SEEKERS_ID: '', RESEND_SEGMENT_REFERRERS_ID: '' });
  vi.unstubAllGlobals();
});

const calls = () => fetchMock.mock.calls.map(([url, init]) => `${init.method} ${String(url).replace('https://api.resend.com', '')}`);

describe('syncWaitlistContact', () => {
  it('joining creates the contact, then adds it to that role’s Segment only', async () => {
    fetchMock.mockResolvedValue(ok());
    expect(await syncWaitlistContact('dana@example.com', 'referrer', false)).toBe(true);
    expect(calls()).toEqual(['POST /contacts', 'POST /contacts/dana%40example.com/segments/seg-referrers']);
  });

  it('still succeeds when the contact already exists from the other list', async () => {
    fetchMock.mockResolvedValueOnce(ok(409)).mockResolvedValueOnce(ok());
    expect(await syncWaitlistContact('dana@example.com', 'seeker', false)).toBe(true);
    expect(calls()[1]).toBe('POST /contacts/dana%40example.com/segments/seg-seekers');
  });

  it('leaving removes from that Segment, and never touches the global unsubscribe flag', async () => {
    fetchMock.mockResolvedValue(ok());
    expect(await syncWaitlistContact('dana@example.com', 'seeker', true)).toBe(true);
    expect(calls()).toEqual(['DELETE /contacts/dana%40example.com/segments/seg-seekers']);
  });

  it('treats "already not in the Segment" as done', async () => {
    fetchMock.mockResolvedValue(ok(404));
    expect(await syncWaitlistContact('dana@example.com', 'seeker', true)).toBe(true);
  });

  it('reports failure rather than throwing, so the signup is kept for the backfill', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce(ok()).mockResolvedValueOnce(ok(500));
    expect(await syncWaitlistContact('dana@example.com', 'seeker', false)).toBe(false);
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    expect(await syncWaitlistContact('dana@example.com', 'seeker', true)).toBe(false);
  });

  it('does nothing for .test accounts or when unconfigured', async () => {
    expect(await syncWaitlistContact('bot@example.test', 'seeker', false)).toBe(false);
    Object.assign(env, { RESEND_CONTACTS_API_KEY: '' });
    expect(isSegmentSyncConfigured()).toBe(false);
    expect(await syncWaitlistContact('dana@example.com', 'seeker', false)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
