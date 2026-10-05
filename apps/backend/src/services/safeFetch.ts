import dns from 'dns';
import http from 'http';
import https from 'https';
import net from 'net';
import fetch, { RequestInit, Response } from 'node-fetch';

/**
 * safeFetch
 *
 * WHY THIS EXISTS:
 * Autofill (POST /api/jobs/scrape) and the daily liveness sweep open URLs a
 * user typed or a page pointed at. Without a check, a referrer could paste
 * http://169.254.169.254/… (cloud metadata), http://localhost:3000/… or any
 * private address and have OUR server fetch it, with parts of the response
 * coming back as the scraped title and description — server-side request
 * forgery (SSRF).
 *
 * WHAT IT DOES:
 * Fetches like node-fetch, but only http/https, never to a loopback, private,
 * link-local, carrier-grade-NAT, multicast or reserved address. Checked three
 * times over, because each check alone can be dodged:
 *  1. the URL's literal host (an IP typed into the URL never hits DNS);
 *  2. every redirect hop, followed by hand (a public page can 302 inward);
 *  3. the address actually connected to, via the agent's DNS lookup — so a
 *     public-looking name that resolves to 10.0.0.5 is refused at connect
 *     time, with no gap for the answer to change between check and use.
 *
 * CONNECTION:
 *  - CALLED BY: services/jobScraper.ts — scrapeJobUrl, the Comeet hosted-page
 *    fetch and checkJobLiveness (page-derived URLs), and the fixed ATS APIs.
 *  - Throws BlockedDestinationError; every caller already catches and returns
 *    its "found nothing" value, so a blocked URL behaves like an unreadable one.
 *
 * DESIGN DECISIONS:
 *  - WHY an escape hatch: the E2E suite serves its fake job page from
 *    127.0.0.1. SCRAPE_ALLOW_PRIVATE_HOSTS=true allows that, and is ignored
 *    whenever NODE_ENV is 'production', so it cannot be switched on there.
 */

export class BlockedDestinationError extends Error {
  constructor(public readonly target: string, reason: string) {
    super(`Refusing to fetch ${target}: ${reason}`);
    this.name = 'BlockedDestinationError';
  }
}

const MAX_REDIRECTS = 5;

const blocked = new net.BlockList();
for (const [net4, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blocked.addSubnet(net4, prefix, 'ipv4');
for (const [net6, prefix] of [
  ['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8], ['64:ff9b::', 96], ['2001:db8::', 32],
] as const) blocked.addSubnet(net6, prefix, 'ipv6');

/** WHY exported: tested directly — the address list is the whole policy. */
export function isBlockedAddress(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, '');
  const kind = net.isIP(ip);
  if (kind === 4) return blocked.check(ip, 'ipv4');
  if (kind === 6) {
    // ::ffff:10.0.0.5 is IPv4 wearing an IPv6 coat.
    const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
    if (mapped) return blocked.check(mapped, 'ipv4');
    return blocked.check(ip, 'ipv6');
  }
  return false; // not an IP — a hostname, checked at connect time instead
}

function privateHostsAllowed(): boolean {
  return process.env.SCRAPE_ALLOW_PRIVATE_HOSTS === 'true' && process.env.NODE_ENV !== 'production';
}

function assertAllowedUrl(target: string): URL {
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    throw new BlockedDestinationError(target, 'not a valid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BlockedDestinationError(target, `protocol ${url.protocol} is not allowed`);
  }
  if (!privateHostsAllowed()) {
    if (url.hostname === 'localhost' || url.hostname.endsWith('.localhost')) {
      throw new BlockedDestinationError(target, 'localhost is not allowed');
    }
    if (isBlockedAddress(url.hostname)) {
      throw new BlockedDestinationError(target, 'private or reserved address');
    }
  }
  return url;
}

/** DNS lookup that refuses private answers — the connect-time check.
 *  Handles both callback shapes: Node asks for `all: true` when it races
 *  IPv4/IPv6 (autoSelectFamily), and a single address otherwise. */
export const guardedLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return (callback as (e: Error) => void)(err);
    const list = addresses as dns.LookupAddress[];
    if (!privateHostsAllowed() && list.some((a) => isBlockedAddress(a.address))) {
      return (callback as (e: Error) => void)(new BlockedDestinationError(hostname, 'resolves to a private or reserved address'));
    }
    if ((options as dns.LookupOptions).all) return (callback as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    const [first] = list;
    return (callback as (e: null, a: string, f: number) => void)(null, first.address, first.family);
  });
};

const httpAgent = new http.Agent({ lookup: guardedLookup });
const httpsAgent = new https.Agent({ lookup: guardedLookup });

/**
 * WHY: drop-in for node-fetch on any URL we did not write ourselves.
 * WHY init: same options as node-fetch; `redirect` is always handled here.
 */
export async function safeFetch(target: string, init: RequestInit = {}): Promise<Response> {
  let current = assertAllowedUrl(target);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(current.toString(), {
      ...init,
      redirect: 'manual',
      agent: (u: URL) => (u.protocol === 'http:' ? httpAgent : httpsAgent),
    });
    const location = res.status >= 300 && res.status < 400 ? res.headers?.get('location') : null;
    if (!location) return res;
    current = assertAllowedUrl(new URL(location, current).toString());
  }
  throw new BlockedDestinationError(target, `more than ${MAX_REDIRECTS} redirects`);
}
