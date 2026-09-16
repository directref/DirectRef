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

This repo is the 2026-09-16 merge of `directref/backend` and `directref/frontend`.
Both histories are preserved — `git log -- apps/backend` and `git log -- apps/frontend`
reach back before the merge.
