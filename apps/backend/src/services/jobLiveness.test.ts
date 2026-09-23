import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * WHY THIS FILE:
 *  - PROBLEM: jobLivenessSweep is well covered, but it only acts on a verdict
 *    it is handed. This is the function that PRODUCES the verdict — it fetches
 *    someone else's careers page and decides alive, dead or unknown. A wrong
 *    'dead' here means the well-tested sweep faithfully deactivates a live
 *    posting and closes every pending application on it.
 *  - COST OF FAILURE: asymmetric and deliberate. 'dead' is destructive;
 *    'unknown' costs nothing but a stale listing. So nearly every test here
 *    asserts the CONSERVATIVE direction — that an ambiguous page is not read
 *    as evidence of closure.
 *  - METHOD: node-fetch is mocked and fed real page shapes. No network, so
 *    these cannot flake on someone else's uptime.
 */

const fetchMock = vi.fn();
vi.mock('node-fetch', () => ({ default: (...args: unknown[]) => fetchMock(...args) }));

// Static import: vi.mock above is hoisted over every import in the file, so
// this already sees the mocked node-fetch. A top-level `await import` would
// also work at runtime but breaks `tsc` under this tsconfig — and tsc is the
// production build, so it takes the deploy down with it.
import { checkJobLiveness } from './jobScraper';

/** A page as the checker sees it. */
const page = (status: number, html = '') => ({
  status,
  ok: status >= 200 && status < 300,
  text: async () => html,
});

/** The JSON-LD block Google for Jobs asks employers to publish. Many ATS
 *  platforms emit it, and its validThrough is the one closure signal that can
 *  be trusted without reading prose. */
const jsonLd = (obj: unknown) =>
  `<html><head><script type="application/ld+json">${JSON.stringify(obj)}</script></head><body>a job</body></html>`;

const jobPosting = (validThrough?: string) => ({
  '@context': 'https://schema.org/',
  '@type': 'JobPosting',
  title: 'Senior Engineer',
  ...(validThrough ? { validThrough } : {}),
});

const past = new Date(Date.now() - 30 * 864e5).toISOString();
const future = new Date(Date.now() + 30 * 864e5).toISOString();

beforeEach(() => fetchMock.mockReset());

describe('signals that genuinely mean the posting is gone', () => {
  it.each([404, 410])('treats %s as dead — the resource is confirmed gone', async (status) => {
    fetchMock.mockResolvedValue(page(status));
    expect(await checkJobLiveness('https://acme.test/careers/1')).toBe('dead');
  });

  it('treats an expired validThrough as dead', async () => {
    fetchMock.mockResolvedValue(page(200, jsonLd(jobPosting(past))));
    expect(await checkJobLiveness('https://acme.test/careers/1')).toBe('dead');
  });

  it('finds the posting inside an @graph wrapper', async () => {
    // Common on ATS platforms that publish several schema.org entities at once.
    fetchMock.mockResolvedValue(page(200, jsonLd({ '@graph': [{ '@type': 'Organization' }, jobPosting(past)] })));
    expect(await checkJobLiveness('https://acme.test/careers/1')).toBe('dead');
  });

  it('finds it in a top-level array', async () => {
    fetchMock.mockResolvedValue(page(200, jsonLd([{ '@type': 'WebPage' }, jobPosting(past)])));
    expect(await checkJobLiveness('https://acme.test/careers/1')).toBe('dead');
  });

  it('handles @type given as an array', async () => {
    fetchMock.mockResolvedValue(page(200, jsonLd({ ...jobPosting(past), '@type': ['JobPosting', 'Thing'] })));
    expect(await checkJobLiveness('https://acme.test/careers/1')).toBe('dead');
  });

  it('recovers from trailing commas, which real pages ship', async () => {
    const html = `<script type="application/ld+json">{"@type":"JobPosting","validThrough":"${past}",}</script>`;
    fetchMock.mockResolvedValue(page(200, html));
    expect(await checkJobLiveness('https://acme.test/careers/1')).toBe('dead');
  });
});

describe('everything ambiguous must NOT be read as closure', () => {
  // The half that protects real postings. Most ATS platforms return 200 for a
  // filled role and simply change the page text, so "no closure signal" is the
  // normal reply for a job that IS closed — acting on it would deactivate
  // healthy postings constantly.
  it('a 200 with no JSON-LD at all is alive, not dead', async () => {
    fetchMock.mockResolvedValue(page(200, '<html><body>This role has been filled.</body></html>'));
    expect(await checkJobLiveness('https://acme.test/careers/1')).toBe('alive');
  });

  it('a future validThrough is alive', async () => {
    fetchMock.mockResolvedValue(page(200, jsonLd(jobPosting(future))));
    expect(await checkJobLiveness('https://acme.test/careers/1')).toBe('alive');
  });

  it('a JobPosting with no validThrough is alive', async () => {
    fetchMock.mockResolvedValue(page(200, jsonLd(jobPosting())));
    expect(await checkJobLiveness('https://acme.test/careers/1')).toBe('alive');
  });

  it.each([500, 502, 503, 429, 403, 401])('treats %s as unknown — the site is unwell, the job may be fine', async (status) => {
    fetchMock.mockResolvedValue(page(status));
    expect(await checkJobLiveness('https://acme.test/careers/1')).toBe('unknown');
  });

  it('treats a network failure as unknown', async () => {
    // mockImplementationOnce, and a SYNCHRONOUS throw. A resident throwing
    // implementation left on the mock gets surfaced by vitest as a test
    // failure even though the code under test catches it correctly — verified
    // by reducing it to a two-test file. Once-only and synchronous leaves
    // nothing behind, and `await fetch(...)` inside the try still catches it.
    fetchMock.mockImplementationOnce(() => { throw new Error('ECONNREFUSED'); });
    expect(await checkJobLiveness('https://acme.test/careers/1')).toBe('unknown');
  });

  it('treats a timeout as unknown', async () => {
    fetchMock.mockImplementationOnce(() => {
      throw Object.assign(new Error('network timeout'), { type: 'request-timeout' });
    });
    expect(await checkJobLiveness('https://acme.test/careers/1')).toBe('unknown');
  });

  it('survives unparseable JSON-LD rather than guessing', async () => {
    fetchMock.mockResolvedValue(page(200, '<script type="application/ld+json">{not json at all</script>'));
    expect(await checkJobLiveness('https://acme.test/careers/1')).toBe('alive');
  });

  it('survives a malformed validThrough date', async () => {
    fetchMock.mockResolvedValue(page(200, jsonLd(jobPosting('not-a-date'))));
    expect(await checkJobLiveness('https://acme.test/careers/1')).toBe('alive');
  });

  it('ignores a validThrough on a non-JobPosting entity', async () => {
    // An Event or Offer on the same page expiring says nothing about the role.
    fetchMock.mockResolvedValue(page(200, jsonLd({ '@type': 'Event', validThrough: past })));
    expect(await checkJobLiveness('https://acme.test/careers/1')).toBe('alive');
  });

  it('keeps reading later blocks when an earlier one is broken', async () => {
    const html =
      '<script type="application/ld+json">{broken</script>' +
      `<script type="application/ld+json">${JSON.stringify(jobPosting(past))}</script>`;
    fetchMock.mockResolvedValue(page(200, html));
    expect(await checkJobLiveness('https://acme.test/careers/1')).toBe('dead');
  });
});

describe('how it asks', () => {
  it('follows redirects and identifies as a browser', async () => {
    // Plenty of careers pages redirect, and a bare fetch user-agent is widely
    // blocked — which would return 403 and, correctly, 'unknown' forever,
    // quietly making the whole sweep useless.
    fetchMock.mockResolvedValue(page(200, ''));
    await checkJobLiveness('https://acme.test/careers/1');

    const [, options] = fetchMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(options.redirect).toBe('follow');
    expect(String((options.headers as Record<string, string>)['User-Agent'])).toMatch(/Mozilla/);
  });

  it('gives up rather than hanging', async () => {
    fetchMock.mockResolvedValue(page(200, ''));
    await checkJobLiveness('https://acme.test/careers/1');
    const [, options] = fetchMock.mock.calls[0] as [string, Record<string, number>];
    expect(options.timeout).toBeGreaterThan(0);
    expect(options.timeout).toBeLessThanOrEqual(30_000);
  });
});
