#!/usr/bin/env node
/**
 * Prints every scenario the suite covers, grouped by area, with its tags.
 *
 * WHY: the HTML report is built for reading ONE run — what passed, what broke,
 * and the trace for the failure. It is a poor answer to "what does this suite
 * actually cover", which is a question you want to answer without running
 * anything, and which matters more as the inventory grows.
 *
 *   npm run scenarios              every scenario
 *   npm run scenarios -- @refer    only that tag
 */
import { execFileSync } from 'node:child_process';

const grep = process.argv.slice(2).filter((a) => a.startsWith('@')).join('|');
const args = ['playwright', 'test', '--list', '--reporter=json', ...(grep ? ['--grep', grep] : [])];

let raw;
try {
  raw = execFileSync('npx', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
} catch (err) {
  // --list still exits non-zero in some states but prints usable JSON first.
  raw = err.stdout?.toString() ?? '';
}

const start = raw.indexOf('{');
if (start < 0) { console.error('Could not read the test list. Try: npx playwright test --list'); process.exit(1); }
const report = JSON.parse(raw.slice(start));

const groups = new Map(); // describe title -> { tags, scenarios[] }

function walk(suite, inherited = []) {
  for (const spec of suite.specs ?? []) {
    const tags = [...new Set([...inherited, ...(spec.tags ?? [])])];
    const key = suite.title;
    if (!groups.has(key)) groups.set(key, { tags, scenarios: [] });
    groups.get(key).scenarios.push(spec.title);
  }
  for (const child of suite.suites ?? []) walk(child, [...inherited, ...(child.tags ?? [])]);
}
for (const s of report.suites ?? []) walk(s, s.tags ?? []);

let total = 0;
const pad = (t) => t.replace(/\s+/g, ' ').trim();

console.log('');
for (const [title, { tags, scenarios }] of groups) {
  console.log(`\x1b[1m${title}\x1b[0m  \x1b[2m${tags.join(' ')}\x1b[0m`);
  for (const s of scenarios) { console.log(`   · ${pad(s)}`); total += 1; }
  console.log('');
}
console.log(`\x1b[2m${total} scenarios${grep ? ` matching ${grep}` : ''}\x1b[0m\n`);
