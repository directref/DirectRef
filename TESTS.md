# Test inventory

**Generated — do not edit by hand.** Regenerate with `node scripts/test-inventory.mjs`.
It reads the real suites, so it cannot describe tests that do not exist.

**94 scenarios**: 70 backend (vitest) + 24 end-to-end (Playwright).

## The three groups

| Group | Runs | Scope | Watch |
|---|---|---|---|
| **Push gate** | every push and PR | `@smoke` + `@api`, plus tags matched from the changed paths. `@known-issue` excluded. Backend suite is all-or-nothing — it has no tag filter, and runs in ~12s. | [link](https://github.com/directref/DirectRef/actions/workflows/push-gate.yml) |
| **Nightly** | 02:00 UTC | **Everything below**, quarantine included | [link](https://github.com/directref/DirectRef/actions/workflows/nightly.yml) |
| **Production smoke** | after a deploy touching `apps/` | `@readonly` only — never writes to the live database or sends mail | [link](https://github.com/directref/DirectRef/actions/workflows/prod-smoke.yml) |

### Which environment a test touches

Almost everything runs against a **throwaway Postgres** that is created, used and
destroyed — locally via `npm run test:db:up`, in CI as a service container. Those
tests register users, post jobs, upload C.V.s and send mail freely, because none
of it is real.

Only the **`@readonly`** group is ever pointed at **live production**, and only by
the production smoke job. It reads and asserts; it never writes a row and never
sends mail. A test posting would appear in the feed real seekers are browsing,
and mail to invented addresses erodes the sending domain — so the split is
enforced by tag, not by convention.

Every group below says which of the two it touches.

Last nightly report: **https://directref.github.io/DirectRef/**

---

## End-to-end (Playwright) — 24 scenarios

Drives the real frontend against the real backend on a throwaway Postgres.

### API contract

`@api` `@smoke` `@readonly`

| | |
|---|---|
| Runs against | **a throwaway database AND live production** |
| Push gate | always |
| Nightly | yes |
| Production smoke | yes |

- /health reports ok with database and uploads both usable
- /health identifies which build is serving
- the frontend identifies its build too
- the public jobs sample is reachable and well-shaped
- an unauthenticated request cannot reach another user's data

### in-app messaging

`@messaging`

| | |
|---|---|
| Runs against | a throwaway database only — never production |
| Push gate | when application or job code changes |
| Nightly | yes |
| Production smoke | no — this group writes |

- both sides can talk on an application, and each sees the thread
- an empty message is rejected
- an outsider can neither read nor post to the thread

### marketing pages

`@marketing` `@smoke` `@readonly`

| | |
|---|---|
| Runs against | **a throwaway database AND live production** |
| Push gate | always |
| Nightly | yes |
| Production smoke | yes |

- landing page renders its hero and both audience CTAs
- /our-story renders
- /terms renders
- /privacy renders
- the site is not indexable while the beta is closed

### referrer declines

`@refer`

| | |
|---|---|
| Runs against | a throwaway database only — never production |
| Push gate | when application or job code changes |
| Nightly | yes |
| Production smoke | no — this group writes |

- "Not a fit" closes the application, and the seeker keeps their credits
- a stranger cannot decline someone else's application

### registration and login

`@auth` `@smoke`

| | |
|---|---|
| Runs against | a throwaway database only — never production |
| Push gate | always |
| Nightly | yes |
| Production smoke | no — this group writes |

- a new seeker can register and lands in the app
- an existing user can log in, stays logged in across a reload, and can log out
- a wrong password is rejected and does not let anyone in
- an anonymous visitor is sent to login when reaching for the app

### seeker withdraws

`@apply`

| | |
|---|---|
| Runs against | a throwaway database only — never production |
| Push gate | when application or job code changes |
| Nightly | yes |
| Production smoke | no — this group writes |

- can pull a C.V. back before it has been opened
- cannot withdraw once the referrer has downloaded it
- one seeker cannot withdraw another seeker's application

### the referral flow

`@apply` `@refer` `@smoke`

| | |
|---|---|
| Runs against | a throwaway database only — never production |
| Push gate | always |
| Nightly | yes |
| Production smoke | no — this group writes |

- a seeker sends a C.V., and the referrer receives it and marks it submitted
- a seeker cannot read another seeker's application

---

## Backend integration (vitest) — 70 scenarios

Real Postgres, no browser. Covers everything time-based — the escalation clocks,
retention and the monthly credit grant — which no browser test can reach,
because nobody waits five days.

Runs on the nightly, and on any push touching `apps/backend/**`. Never runs
against production.

### `src/modules/credits/credits.test.ts`

**credits — spending**

- a posting costs exactly one
- spends the OLDEST grant first
- refuses at zero rather than going negative

**credits — the monthly grant**

- gives +1 to a user who has not been granted this month
- is idempotent — running the sweep repeatedly grants once per month
- credits accumulate and never expire

**credits — the posting gate**

- a referrer can post five times and is blocked on the sixth

**credits — what a new account gets**

- grants 5 at signup
- stamps the signup month so the monthly sweep does not also grant

### `src/modules/invites/inviteCode.test.ts`

**generateInviteCode — the column will not accept anything longer**

- Shai (a short name) fits varchar(16)
- Christopher (exactly the old breaking point) fits varchar(16)
- Konstantinos (the name that used to 500) fits varchar(16)
- Aleksandrina (another that used to 500) fits varchar(16)
- Bartholomew (long but previously ok) fits varchar(16)
- Wolfeschlegelsteinhausenbergerdorff (absurd, still must not overflow) fits varchar(16)
- יוסי כהן (Hebrew) gets a real code, not a bare suffix
- נועה לוי (Hebrew) gets a real code, not a bare suffix
- أحمد حسن (Arabic) gets a real code, not a bare suffix
- Владимир Петров (Cyrillic) gets a real code, not a bare suffix
- 王 伟 (Chinese) gets a real code, not a bare suffix
- keeps the name readable when it fits
- truncates rather than overflowing
- draws from a keyspace large enough that clashes are rare

**generateUniqueInviteCode — checks the table, does not just hope**

- avoids a code that is already taken
- always returns something the column accepts

**registration actually succeeds for these names**

- Konstantinos Papadopoulos can create an account
- יוסי כהן can create an account
- Aleksandrina Petrova can create an account
- two people sharing a first name both get in
- two people with Hebrew names both get in

### `src/modules/users/deleteAccount.test.ts`

**deleting a referrer**

- removes the account, its postings, and the applications on them
- tells each affected seeker BEFORE their application disappears
- unlinks every C.V. file the account touched
- takes the message threads with it

**deleting a seeker**

- removes their applications and C.V. copies but leaves the posting standing
- removes the profile C.V. too, not just application copies

**deleting an account — edge cases**

- works for an account with nothing attached
- completes even when a C.V. file is already gone
- rejects an account that does not exist

### `src/scheduler/applicationRetentionSweep.test.ts`

**retention — erasing closed, inactive applications**

- erases a rejected application after 30 days of inactivity
- erases a expired application after 30 days of inactivity
- erases a internally_submitted application after 30 days of inactivity
- erases a withdrawn application after 30 days of inactivity
- takes the message thread with it
- tells the seeker before the record disappears
- survives a C.V. file that is already gone

**retention — what must never be erased**

- never erases a LIVE submitted application, however old it is
- never erases a LIVE viewed application, however old it is
- never erases a LIVE forwarded application, however old it is
- keeps a closed application that is inactive for 29 days
- a recent message resets the clock even when the row itself is stale
- an OLD message does not save it
- erases only what is due, leaving everything else untouched

### `src/scheduler/escalationSweep.test.ts`

**Clock A — from CV sent, while awaiting a decision**

- Day 1: nudges the referrer and stamps reminderSentAt
- leaves an application younger than a day completely alone
- Day 2: sends the stronger reminder and stamps escalatedAt
- a 3-day-old application skips Day 1 rather than getting both nudges at once
- Day 5: auto-closes, tells both sides, and marks the application expired
- an expired application never also receives a "please respond" in the same tick
- an active conversation pauses auto-cancel — a talking pair is never cut off
- only the SEEKER messaging pauses it — a referrer reply does not
- is idempotent — running the sweep repeatedly never double-sends
- chases a viewed application too — opening a CV is not responding to it
- never touches an application the referrer already decided on

**Clock B — from download, awaiting confirmation of internal submission**

- Day 2: asks the referrer whether they submitted it internally
- measures from the download, not from when the CV was sent
- Day 5: auto-closes when the referrer never confirms
- an active conversation pauses Clock B too
- stops entirely once the referrer confirms internal submission
- the day-3 follow-up is gone — one reminder per download, not two

---

*Strategy and the decisions behind it: `initiatives/directref/03-design/test-strategy-2026-09-16.md` in the vault.*
