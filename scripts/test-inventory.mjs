#!/usr/bin/env node
/**
 * Generates TESTS.md — every scenario in the suite and which CI group runs it.
 *
 * WHY GENERATED, not written: a hand-maintained list of tests is wrong the
 * first time someone adds one, and nothing tells you it has gone stale. This
 * reads the real suites (`playwright test --list`, `vitest list`) and the tag
 * mapping is kept beside the one in push-gate.yml, so the document can only
 * be as wrong as the tests themselves.
 *
 *   node scripts/test-inventory.mjs           writes TESTS.md
 *   node scripts/test-inventory.mjs --check   fails if TESTS.md is out of date
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'TESTS.md');

/** Mirrors the path→tag mapping in .github/workflows/push-gate.yml. If that
 *  file changes, change this too — they are two halves of one decision. */
const WHEN = {
  '@smoke': 'always',
  '@api': 'always',
  '@marketing': 'marketing pages change',
  '@auth': 'auth or invites change',
  '@apply': 'application or job code changes',
  '@refer': 'application or job code changes',
  '@messaging': 'application or job code changes',
  '@credits': 'credits change',
  '@jobs': 'the jobs module changes',
};

/** Playwright's JSON reports tags WITHOUT the leading "@" ("apply", not
 *  "@apply"), while every other place they appear — the specs, the workflow
 *  greps, this file's WHEN map — uses it. Normalise on the way in; without
 *  this the lookup silently misses and every non-smoke group is reported as
 *  "only on a full run", which is wrong and looks plausible. */
const tag = (t) => (t.startsWith('@') ? t : `@${t}`);

function run(cmd, args, cwd) {
  try {
    return execFileSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (err) {
    return err.stdout?.toString() ?? '';
  }
}

// ── Playwright ────────────────────────────────────────────────────────────────
const pwRaw = run('npx', ['playwright', 'test', '--list', '--reporter=json'], path.join(root, 'e2e'));
const pwJson = JSON.parse(pwRaw.slice(pwRaw.indexOf('{')));
const e2e = new Map(); // describe -> { tags, scenarios[] }

(function walk(suites, inherited = []) {
  for (const suite of suites ?? []) {
    const tags = [...new Set([...inherited, ...(suite.tags ?? []).map(tag)])];
    for (const spec of suite.specs ?? []) {
      const key = suite.title;
      if (!e2e.has(key)) e2e.set(key, { tags: [...new Set([...tags, ...(spec.tags ?? []).map(tag)])], scenarios: [] });
      e2e.get(key).scenarios.push(spec.title);
    }
    walk(suite.suites, tags);
  }
})(pwJson.suites);

// ── vitest ────────────────────────────────────────────────────────────────────
const vtRaw = run('npx', ['vitest', 'list'], path.join(root, 'apps/backend'));
const backend = new Map(); // file -> Map(describe -> scenarios[])
for (const line of vtRaw.split('\n')) {
  const parts = line.split(' > ').map((p) => p.trim());
  if (parts.length < 2 || !parts[0].endsWith('.test.ts')) continue;
  const [file, ...rest] = parts;
  const scenario = rest.pop();
  const group = rest.join(' › ') || '(top level)';
  if (!backend.has(file)) backend.set(file, new Map());
  if (!backend.get(file).has(group)) backend.get(file).set(group, []);
  backend.get(file).get(group).push(scenario);
}

// Playwright and vitest hand back files in filesystem order, which differs
// between macOS and Linux — so the same suites generated a different document
// locally and in CI, and the drift check failed on a doc that was not actually
// stale. Sort everything; the order must depend on the tests, not the machine.
const sortMap = (m) => new Map([...m.entries()].sort(([a], [b]) => a.localeCompare(b)));
const e2eSorted = sortMap(e2e);
const backendSorted = new Map([...sortMap(backend)].map(([f, g]) => [f, sortMap(g)]));

// ── Render ────────────────────────────────────────────────────────────────────
const e2eCount = [...e2eSorted.values()].reduce((n, g) => n + g.scenarios.length, 0);
const beCount = [...backendSorted.values()].reduce((n, f) => n + [...f.values()].reduce((m, s) => m + s.length, 0), 0);

// `vitest list` executes globalSetup, which connects to the test database and
// migrates it — so with no database it lists NOTHING and exits cleanly. Without
// this guard the generator cheerfully wrote "0 backend scenarios" and the doc
// claimed the backend was untested. A generator that silently drops a whole
// suite is worse than one that refuses to run.
if (beCount === 0 || e2eCount === 0) {
  console.error(
    `Refusing to write: listed ${beCount} backend and ${e2eCount} e2e scenarios.\n` +
    'A zero here means a runner could not enumerate its tests, not that they do not exist.\n' +
    'The backend list needs the throwaway database:  cd apps/backend && npm run test:db:up',
  );
  process.exit(1);
}

const pushGateFor = (tags) => {
  if (tags.includes('@smoke') || tags.includes('@api')) return 'always';
  const reasons = [...new Set(tags.map((t) => WHEN[t]).filter(Boolean))];
  return reasons.length ? `when ${reasons.join(', or ')}` : 'only on a full run';
};

let md = `# Test inventory

**Generated — do not edit by hand.** Regenerate with \`node scripts/test-inventory.mjs\`.
It reads the real suites, so it cannot describe tests that do not exist.

**${beCount + e2eCount} scenarios**: ${beCount} backend (vitest) + ${e2eCount} end-to-end (Playwright).

## The three groups

| Group | Runs | Scope | Watch |
|---|---|---|---|
| **Push gate** | every push and PR | \`@smoke\` + \`@api\`, plus tags matched from the changed paths. \`@known-issue\` excluded. Backend suite is all-or-nothing — it has no tag filter, and runs in ~12s. | [link](https://github.com/directref/DirectRef/actions/workflows/push-gate.yml) |
| **Nightly** | 02:00 UTC | **Everything below**, quarantine included | [link](https://github.com/directref/DirectRef/actions/workflows/nightly.yml) |
| **Production smoke** | after a deploy touching \`apps/\` | \`@readonly\` only — never writes to the live database or sends mail | [link](https://github.com/directref/DirectRef/actions/workflows/prod-smoke.yml) |

Last nightly report: **https://directref.github.io/DirectRef/**

---

## End-to-end (Playwright) — ${e2eCount} scenarios

Drives the real frontend against the real backend on a throwaway Postgres.

`;

for (const [title, { tags, scenarios }] of e2eSorted) {
  const readonly = tags.includes('@readonly');
  md += `### ${title}\n\n`;
  md += `\`${tags.join('` `')}\`\n\n`;
  md += `| | |\n|---|---|\n`;
  md += `| Push gate | ${pushGateFor(tags)} |\n`;
  md += `| Nightly | yes |\n`;
  md += `| Production smoke | ${readonly ? 'yes — safe against production' : 'no — this group writes'} |\n\n`;
  for (const s of scenarios) md += `- ${s}\n`;
  md += `\n`;
}

md += `---

## Backend integration (vitest) — ${beCount} scenarios

Real Postgres, no browser. Covers everything time-based — the escalation clocks,
retention and the monthly credit grant — which no browser test can reach,
because nobody waits five days.

Runs on the nightly, and on any push touching \`apps/backend/**\`. Never runs
against production.

`;

for (const [file, groups] of backendSorted) {
  md += `### \`${file}\`\n\n`;
  for (const [group, scenarios] of groups) {
    md += `**${group}**\n\n`;
    for (const s of scenarios) md += `- ${s}\n`;
    md += `\n`;
  }
}

md += `---

*Strategy and the decisions behind it: \`initiatives/directref/03-design/test-strategy-2026-09-16.md\` in the vault.*
`;

if (process.argv.includes('--check')) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (current !== md) {
    console.error('TESTS.md is out of date. Run: node scripts/test-inventory.mjs\n');
    // Show the difference — "out of date" alone tells whoever hits this in CI
    // nothing about whether a test was added, renamed, or the script changed.
    const a = current.split('\n'), b = md.split('\n');
    let shown = 0;
    for (let i = 0; i < Math.max(a.length, b.length) && shown < 20; i += 1) {
      if (a[i] !== b[i]) {
        if (a[i] !== undefined) console.error(`  - ${a[i]}`);
        if (b[i] !== undefined) console.error(`  + ${b[i]}`);
        shown += 1;
      }
    }
    process.exit(1);
  }
  console.log('TESTS.md is up to date.');
} else {
  writeFileSync(OUT, md);
  console.log(`TESTS.md written — ${beCount + e2eCount} scenarios (${beCount} backend, ${e2eCount} e2e)`);
}
