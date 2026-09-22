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
