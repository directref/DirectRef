#!/usr/bin/env node
/**
 * Should this commit be deployed?
 *
 * WHY THIS EXISTS: the push gate already catches broken code — it went red
 * within a minute both times a typecheck break was pushed on 2026-09-22. But
 * nothing acted on it, because Vercel and Railway build straight from main and
 * do not wait for it. A red light did not stop the release; it just meant the
 * release failed on its own, more quietly, and production sat two commits
 * behind for a day. This makes the light mean something.
 *
 * VERCEL'S CALLING CONVENTION IS INVERTED, and easy to get backwards:
 *   exit 0 → CANCEL the build   (so: checks failed)
 *   exit 1 → PROCEED with build (so: checks passed)
 *
 * THE OVERRIDE: put [force-deploy] anywhere in the commit message and this
 * waves the commit through without asking GitHub anything — for when the
 * failure is already known and understood and the fix is the next commit. An
 * override that lives in the commit is better than one that lives in a
 * settings page, because it is per-release, visible in the history, and cannot
 * be left switched on by accident.
 *
 *   git commit -m "Ship the copy fix [force-deploy]"
 *
 * Node rather than bash: node is guaranteed in Vercel's build image, JSON
 * parsing is reliable, and an empty bash array under `set -u` is a real trap.
 *
 * WIRE IT UP — Vercel → Settings → Git → Ignored Build Step → Custom:
 *   node scripts/deploy-gate.mjs
 */

const REPO = process.env.GATE_REPO ?? 'directref/DirectRef';
const WORKFLOW = process.env.GATE_WORKFLOW ?? 'Push gate';
const MAX_WAIT_MS = Number(process.env.GATE_MAX_WAIT_MS ?? 15 * 60 * 1000);
const POLL_MS = Number(process.env.GATE_POLL_MS ?? 20_000);

const DEPLOY = 1; // Vercel: build
const BLOCK = 0;  // Vercel: cancel

const say = (m) => console.log(`[deploy-gate] ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const sha =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.GITHUB_SHA ??
  process.env.GATE_SHA ??
  '';

if (!sha) {
  // Better to deploy than to block everything because this script could not
  // work out which commit it is looking at.
  say('No commit SHA available — allowing the build rather than blocking on my own confusion.');
  process.exit(DEPLOY);
}
const short = sha.slice(0, 7);

// GitHub's head_sha filter needs the FULL 40 characters — a short SHA matches
// nothing and the gate then blocks every deploy for the wrong reason. Vercel
// supplies the full one; this catches a hand-run invocation.
if (sha.length !== 40) {
  say(`SHA "${sha}" is ${sha.length} characters, not 40. GitHub needs the full SHA; a short one silently matches no runs.`);
  say('Allowing the build rather than blocking on a malformed input.');
  process.exit(DEPLOY);
}

// ── The override ──────────────────────────────────────────────────────────────
const message = process.env.VERCEL_GIT_COMMIT_MESSAGE ?? process.env.GATE_MESSAGE ?? '';
if (/\[(force-deploy|skip-gate)\]/i.test(message)) {
  say(`${short} carries [force-deploy] — deploying without waiting for checks.`);
  process.exit(DEPLOY);
}

// ── Ask GitHub how the push gate went ─────────────────────────────────────────
// Unauthenticated is fine: the repo is public and this needs no write access.
// A token is used only if one happens to be present, for the rate limit.
const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'directref-deploy-gate' };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

async function pushGateRun() {
  const url = `https://api.github.com/repos/${REPO}/actions/runs?head_sha=${sha}&per_page=30`;
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const { workflow_runs: runs = [] } = await res.json();
  return runs.find((r) => r.name === WORKFLOW) ?? null;
}

const deadline = Date.now() + MAX_WAIT_MS;

while (true) {
  let run = null;
  try {
    run = await pushGateRun();
  } catch (err) {
    // A flaky API call must not decide a release on its own — keep polling and
    // let the deadline handle a sustained outage.
    say(`Could not reach GitHub (${err.message}); will retry.`);
  }

  if (run?.status === 'completed') {
    if (run.conclusion === 'success' || run.conclusion === 'skipped') {
      say(`${short} passed the push gate (${run.conclusion}) — deploying.`);
      process.exit(DEPLOY);
    }
    say(`BLOCKED: ${short} failed the push gate (${run.conclusion}). Not deploying.`);
    say(`  ${run.html_url}`);
    say('Fix it and push again, or add [force-deploy] to the commit message to override.');
    process.exit(BLOCK);
  }

  if (Date.now() >= deadline) {
    say(`BLOCKED: no push-gate result for ${short} after ${Math.round(MAX_WAIT_MS / 1000)}s (last status: ${run?.status ?? 'no run found'}).`);
    say('Failing closed — shipping something unverified is exactly what this exists to prevent.');
    say('Add [force-deploy] to the commit message if this is expected.');
    process.exit(BLOCK);
  }

  say(`Waiting for the push gate on ${short} (status: ${run?.status ?? 'not started yet'})...`);
  await sleep(POLL_MS);
}
