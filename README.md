# DirectRef

Referral-first job network. Insiders post the roles they can refer into, seekers apply
free, the insider forwards the CV, and the platform guarantees the seeker hears back.

## Layout

| Path | What | Deploys to |
|------|------|------------|
| `apps/backend` | Express + Drizzle + Postgres API | Railway |
| `apps/frontend` | Next.js app and marketing site | Vercel |
| `e2e` | Playwright end-to-end suite | CI only |

Each app keeps its own `package.json`, lockfile and `node_modules` — deliberately not
npm workspaces, so the deploy platforms build exactly as they did before the repos were
merged. See `initiatives/directref/03-design/test-strategy-2026-09-16.md` in the vault.

## Working on it

```bash
cd apps/backend  && npm install && npm run dev     # API    :3000
cd apps/frontend && npm install && npm run dev     # web    :5173
```

## Tests

94 tests: 70 backend (vitest) and 24 end-to-end (Playwright).

| When | What runs | Where to watch |
|------|-----------|----------------|
| Every push and PR | `@smoke` + `@api` + tags matched from the changed paths; `@known-issue` excluded | [Push gate](https://github.com/directref/DirectRef/actions/workflows/push-gate.yml) |
| Nightly, 02:00 UTC | **Everything**, quarantine included | [Nightly regression](https://github.com/directref/DirectRef/actions/workflows/nightly.yml) |
| After each deploy | `@readonly` only, against production | [Production smoke](https://github.com/directref/DirectRef/actions/workflows/prod-smoke.yml) |

Last night's full report: **https://directref.github.io/DirectRef/** — click any
test for its steps; click a failure for the trace viewer, with the DOM at each
step, the network log and a video.

Only the nightly publishes to Pages. The other two attach their report to their
own run as an artifact, so a tag-filtered push-gate run can never overwrite the
full nightly report.

### A failed check blocks the release

`scripts/deploy-gate.mjs` asks GitHub whether the **push gate** passed for the
commit being built, and cancels the deploy if it did not. Without it a red
check changes nothing — Vercel and Railway build straight from `main`, so a
broken commit simply fails to build, quietly, and production silently falls
behind. That happened on 2026-09-22 and cost a day.

**To ship anyway**, put `[force-deploy]` in the commit message:

```bash
git commit -m "Ship the copy fix [force-deploy]"
```

The gate then deploys without asking GitHub anything. Use it when the failure
is already understood and the fix is the next commit. It lives in the commit
rather than in a settings page on purpose: it applies to one release, it is
visible in the history, and it cannot be left switched on by accident.

If the checks never report at all, the gate **blocks after 15 minutes** rather
than assuming the best — shipping something unverified is what it exists to
prevent.

**Wiring it up** (once, in each platform):

| | |
|---|---|
| **Vercel** | Settings → Git → **Ignored Build Step** → Custom → `node scripts/deploy-gate.mjs` |
| **Railway** | Settings → Source → enable **Wait for CI** if your plan offers it. Otherwise Railway keeps deploying on push, and the gate covers the frontend only — the push gate still goes red either way |

### Running them yourself

```bash
# Backend — needs Docker for the throwaway Postgres on 5433
cd apps/backend && npm run test:db:up && npm test

# End-to-end; starts both apps itself
cd e2e && npx playwright test
cd e2e && npx playwright test --headed     # watch it drive a real browser
cd e2e && npx playwright show-report        # the HTML report for your last run

# What does the suite cover? Runs nothing, prints in a second
cd e2e && npm run scenarios
cd e2e && npm run scenarios -- @refer
```

Strategy, decisions and the full flow inventory:
`initiatives/directref/03-design/test-strategy-2026-09-16.md` in the vault.

## History

This repo is the 2026-09-16 `git subtree` merge of `directref/backend` and
`directref/frontend`. **All 201 commits from both repos are preserved** — nothing was
squashed.

One wrinkle worth knowing: the grafted commits recorded their files at the *old* paths
(`src/...`, not `apps/backend/src/...`), so a plain path-limited log stops at the merge.

| Want | Use |
|------|-----|
| Who wrote this line, and when | `git blame apps/backend/src/...` — **works normally**, reaches back through the merge |
| A file's full history | `git log --full-history --all -- src/scheduler/escalationSweep.ts` — note the **old** path, and `--full-history` is required |
| Just the pre-merge backend history | `git log f234b579` (old `master` tip, 67 commits) |
| Just the pre-merge frontend history | `git log 161e2e2d` (old `main` tip, 131 commits) |

`git log --follow` does **not** work across the graft — use `blame` or the old-path form
above instead.
