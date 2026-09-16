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
