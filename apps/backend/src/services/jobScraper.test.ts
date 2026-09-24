import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * WHY THIS FILE:
 *  - PROBLEM: scrapeJobUrl gave up completely the moment the source page
 *    itself couldn't be fetched — but plenty of careers pages sit behind bot
 *    protection (Akamai, Cloudflare) that 403s a plain server-side fetch even
 *    though the URL carries a gh_jid or a jobs.lever.co id that Greenhouse's
 *    or Lever's own public API can resolve without ever loading the page.
 *    "Autofill" would silently hand back an empty object and the referrer
 *    saw a blank manual-entry form with no explanation (e.g.
 *    zoominfo.com/careers/...?gh_jid=8813850002, a real posting Greenhouse's
 *    API has in full, that 403s a bare fetch).
 *  - COST OF FAILURE: every bot-protected ATS-embedded posting — common,
 *    not exotic — autofilled to nothing, silently, with no signal to fix it.
 *  - METHOD: node-fetch is mocked so both the page fetch and the ATS API
 *    calls it triggers afterward are controlled — no network, no flake.
 */

const fetchMock = vi.fn();
vi.mock('node-fetch', () => ({ default: (...args: unknown[]) => fetchMock(...args) }));

// Static import: vi.mock above is hoisted over every import in the file, so
// this already sees the mocked node-fetch. See jobLiveness.test.ts for why
// this must stay a static import rather than `await import`.
import { scrapeJobUrl } from './jobScraper';

/** A page as the scraper sees it. */
const page = (status: number, html = '') => ({
  status,
  ok: status >= 200 && status < 300,
  text: async () => html,
});

/** An ATS's JSON API response. */
const apiJson = (status: number, body: unknown) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => body,
});

beforeEach(() => fetchMock.mockReset());

describe('the page fetch itself is blocked, but the URL still identifies the ATS posting', () => {
  it('falls back to the Greenhouse API when a gh_jid embed page 403s', async () => {
    fetchMock
      .mockResolvedValueOnce(page(403)) // the ZoomInfo page itself
      .mockResolvedValueOnce(apiJson(200, {
        title: 'Principal Applications Security Architect',
        company_name: 'ZoomInfo Technologies LLC',
        location: { name: 'Bengaluru, Karnataka, India' },
        content: '&lt;p&gt;Do great security work.&lt;/p&gt;',
      })); // Greenhouse's public API

    const result = await scrapeJobUrl(
      'https://www.zoominfo.com/careers/jr108129/principal-applications-security-architect?gh_jid=8813850002',
    );

    expect(result.title).toBe('Principal Applications Security Architect');
    expect(result.companyName).toBe('ZoomInfo Technologies LLC');
    expect(result.location).toBe('Bengaluru, Karnataka, India');
    expect(result.description).toContain('Do great security work.');

    // Board token guessed from the hostname ("zoominfo.com" -> "zoominfo") —
    // the real board token for this real posting, confirmed against the
    // live API while fixing this.
    const [greenhouseUrl] = fetchMock.mock.calls[1] as [string];
    expect(greenhouseUrl).toBe('https://boards-api.greenhouse.io/v1/boards/zoominfo/jobs/8813850002?content=true');
  });

  it('falls back to the Lever API when a jobs.lever.co page 403s', async () => {
    const postingId = '123e4567-e89b-12d3-a456-426614174000';
    fetchMock
      .mockResolvedValueOnce(page(403)) // the lever-hosted page itself
      .mockResolvedValueOnce(apiJson(200, {
        text: 'Staff Engineer',
        categories: { location: 'Remote', commitment: 'Full-time' },
        workplaceType: 'remote',
        description: '<p>Build things.</p>',
      })); // Lever's public API

    const result = await scrapeJobUrl(`https://jobs.lever.co/acme/${postingId}`);

    expect(result.title).toBe('Staff Engineer');
    expect(result.location).toBe('Remote');
    expect(result.jobType).toBe('full-time');
    expect(result.workMode).toBe('remote');

    const [leverUrl] = fetchMock.mock.calls[1] as [string];
    expect(leverUrl).toBe(`https://api.lever.co/v0/postings/acme/${postingId}?mode=json`);
  });

  it('falls back the same way when the page fetch throws outright (timeout, DNS, etc.)', async () => {
    fetchMock
      .mockImplementationOnce(() => { throw Object.assign(new Error('network timeout'), { type: 'request-timeout' }); })
      .mockResolvedValueOnce(apiJson(200, { title: 'Support Engineer', company_name: 'Acme', content: '<p>x</p>' }));

    const result = await scrapeJobUrl('https://acme.test/careers/1?gh_jid=999');

    expect(result.title).toBe('Support Engineer');
  });

  it('still returns nothing — never throws — when a blocked page carries no ATS id to fall back on', async () => {
    fetchMock.mockResolvedValue(page(403));
    const result = await scrapeJobUrl('https://acme.test/careers/1');
    expect(result).toEqual({});
  });

  it('still returns nothing when the Greenhouse fallback itself has no match either', async () => {
    fetchMock
      .mockResolvedValueOnce(page(403)) // the page itself
      .mockResolvedValueOnce(page(404)); // Greenhouse's API, wrong guessed token
    const result = await scrapeJobUrl('https://acme.test/careers/1?gh_jid=999');
    expect(result).toEqual({});
  });
});
