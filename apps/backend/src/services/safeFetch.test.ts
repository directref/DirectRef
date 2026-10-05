import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * WHY THIS FILE:
 *  - PROBLEM: Autofill and the daily liveness check fetch URLs a user pasted
 *    or a page pointed at. Before safeFetch, any URL was fetched — including
 *    http://169.254.169.254 (cloud metadata), localhost and private network
 *    addresses — with parts of the response returned as the scraped job.
 *  - COST OF FAILURE: any referrer account can read internal services from
 *    inside our network (SSRF). On some hosts that includes credentials.
 *  - SUCCESS: every private destination is refused before a connection is
 *    made — typed directly, disguised, reached by redirect, or behind a
 *    public-looking name — and refused URLs read as "found nothing".
 *  - METHOD: node-fetch is mocked, so "refused" is proven by fetch never
 *    being called. The DNS check is exercised for real against `localhost`,
 *    which every machine resolves locally.
 */

const fetchMock = vi.fn();
vi.mock('node-fetch', () => ({ default: (...args: unknown[]) => fetchMock(...args) }));

import { safeFetch, isBlockedAddress, guardedLookup, BlockedDestinationError } from './safeFetch';
import { scrapeJobUrl, checkJobLiveness } from './jobScraper';

const page = (status: number, html = '', location?: string) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: { get: (h: string) => (h.toLowerCase() === 'location' ? location ?? null : null) },
  text: async () => html,
});

beforeEach(() => {
  fetchMock.mockReset();
  delete process.env.SCRAPE_ALLOW_PRIVATE_HOSTS;
});
afterEach(() => {
  delete process.env.SCRAPE_ALLOW_PRIVATE_HOSTS;
});

describe('which addresses are private', () => {
  it.each([
    '127.0.0.1', '127.8.8.8', '10.0.0.5', '172.16.0.1', '172.31.255.255', '192.168.1.1',
    '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1',
    '::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', '::ffff:10.0.0.5', '::ffff:127.0.0.1', '[::1]',
  ])('blocks %s', (ip) => {
    expect(isBlockedAddress(ip)).toBe(true);
  });

  it.each(['8.8.8.8', '104.16.0.1', '172.32.0.1', '2606:4700::1111'])('allows the public address %s', (ip) => {
    expect(isBlockedAddress(ip)).toBe(false);
  });
});

describe('refused before any connection is made', () => {
  it.each([
    ['cloud metadata', 'http://169.254.169.254/latest/meta-data/'],
    ['loopback', 'http://127.0.0.1:3000/api/admin'],
    ['localhost by name', 'http://localhost:5432/'],
    ['a private network host', 'http://10.0.0.5/internal'],
    ['IPv6 loopback', 'http://[::1]/'],
    ['loopback written as one hex number', 'http://0x7f000001/'],
    ['loopback written in decimal', 'http://2130706433/'],
    ['a file on disk', 'file:///etc/passwd'],
    ['another protocol', 'ftp://example.com/x'],
    ['not a URL at all', 'not a url'],
  ])('%s', async (_label, url) => {
    await expect(safeFetch(url)).rejects.toBeInstanceOf(BlockedDestinationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('redirects are checked hop by hop', () => {
  it('follows a redirect between public pages', async () => {
    fetchMock
      .mockResolvedValueOnce(page(302, '', 'https://jobs.acme.com/123'))
      .mockResolvedValueOnce(page(200, 'the job'));

    const res = await safeFetch('https://acme.com/careers/123');

    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls.map(([u]) => u)).toEqual(['https://acme.com/careers/123', 'https://jobs.acme.com/123']);
  });

  it('refuses a public page that redirects to a private address', async () => {
    fetchMock.mockResolvedValueOnce(page(302, '', 'http://169.254.169.254/latest/meta-data/'));

    await expect(safeFetch('https://evil.example/job')).rejects.toBeInstanceOf(BlockedDestinationError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives up after too many redirects', async () => {
    fetchMock.mockResolvedValue(page(302, '', 'https://acme.com/loop'));
    await expect(safeFetch('https://acme.com/loop')).rejects.toThrow(/redirects/);
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(6);
  });

  it('never lets node-fetch follow redirects on its own', async () => {
    fetchMock.mockResolvedValueOnce(page(200));
    await safeFetch('https://acme.com/job');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: 'manual' });
  });
});

describe('a public-looking name that resolves to a private address', () => {
  it('is refused at connect time by the DNS check', async () => {
    const err = await new Promise<Error | null>((resolve) =>
      guardedLookup('localhost', {}, (e) => resolve(e)),
    );
    expect(err).toBeInstanceOf(BlockedDestinationError);
  });

  it('passes the DNS answer through when it is public', async () => {
    // A literal public IP resolves to itself without touching the network.
    const address = await new Promise<string>((resolve, reject) =>
      guardedLookup('8.8.8.8', {}, (e, a) => (e ? reject(e) : resolve(a as string))),
    );
    expect(address).toBe('8.8.8.8');
  });
});

describe('what the user sees', () => {
  it('Autofill on a private address finds nothing, the same as an unreadable page', async () => {
    expect(await scrapeJobUrl('http://169.254.169.254/latest/meta-data/')).toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('the liveness check treats a private address as unknown, never dead', async () => {
    expect(await checkJobLiveness('http://10.0.0.5/job')).toBe('unknown');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('the test-only switch', () => {
  it('lets a local test page through when SCRAPE_ALLOW_PRIVATE_HOSTS=true', async () => {
    process.env.SCRAPE_ALLOW_PRIVATE_HOSTS = 'true';
    fetchMock.mockResolvedValueOnce(page(200));
    await expect(safeFetch('http://127.0.0.1:4321/careers/x')).resolves.toBeDefined();
  });

  it('is ignored in production, whatever it is set to', async () => {
    process.env.SCRAPE_ALLOW_PRIVATE_HOSTS = 'true';
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await expect(safeFetch('http://127.0.0.1:4321/careers/x')).rejects.toBeInstanceOf(BlockedDestinationError);
    } finally {
      process.env.NODE_ENV = original;
    }
  });
});
