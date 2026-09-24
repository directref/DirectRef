# Test inventory

**Generated — do not edit by hand.** Regenerate with `node scripts/test-inventory.mjs`.
It reads the real suites, so it cannot describe tests that do not exist.

**245 scenarios**: 219 backend (vitest) + 26 end-to-end (Playwright).

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

## End-to-end (Playwright) — 26 scenarios

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

### applying for a job actually works here

`@prodsafe` `@apply`

| | |
|---|---|
| Runs against | a throwaway database only — never production |
| Push gate | when application or job code changes |
| Nightly | yes |
| Production smoke | no — this group writes |

- a C.V. sent on this deployment reaches the referrer intact
- it cleans up after itself

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

## Backend integration (vitest) — 219 scenarios

Real Postgres, no browser. Covers everything time-based — the escalation clocks,
retention and the monthly credit grant — which no browser test can reach,
because nobody waits five days.

Runs on the nightly, and on any push touching `apps/backend/**`. Never runs
against production.

### `src/modules/applications/responseStats.test.ts`

**ignoring people must lower the score**

- the ghoster who opens instantly and never answers scores BADLY
- the slower referrer who answers EVERYONE scores better than the fast ghoster
- counts a turned-down application as a real answer
- counts internally_submitted too

**speed still matters, among those who answer**

- ranks a same-day answerer above a four-day answerer
- uses the median, so one outlier does not define a record

**the numbers behind the score are returned for display**

- reports decided, total and median so the UI can show "9 of 10"
- scores several referrers in one call

**thin records are kept modest rather than hidden**

- does not award a perfect score off a single application
- lets a strong record outrank a thin perfect one
- a referrer with no applications at all has no record
- a referrer whose only applications are still open has no record yet
- ignores withdrawn applications — the seeker pulled out, not the referrer

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

### `src/modules/jobs/testAccountIsolation.test.ts`

**a test account's postings are invisible to everyone else**

- never appear in the landing page sample
- never appear in search
- the posting still exists and works for its own owner

**recognising a test address**

- treats probe@direct-ref.test as a test account
- treats seeker@example.test as a test account
- treats x@sub.domain.test as a test account
- treats MIXED@Example.TEST as a test account
- treats rae@acme.com as a real person
- treats someone@gmail.com as a real person
- treats a@test.com as a real person
- treats b@testing.co.il as a real person
- is safe on nothing at all

**the flag is set without anyone remembering to set it**

- marks an account registered on a .test address
- leaves a real account alone

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

### `src/scheduler/creditGrantSweep.test.ts`

**the monthly credit grant sweep**

- gives a credit to a referrer who has not had one this month
- grants once a month however often it runs
- does nothing to a referrer already granted this month
- runs cleanly with no users at all

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

### `src/scheduler/index.test.ts`

**keeping them running**

- runs them again every 15 minutes
- keeps going over a full day
- does not fire early

**one broken sweep must not stop the others**

- carries on when a sweep rejects
- still runs on the next tick after a failure

**starting the app**

- runs the escalation sweep immediately, without waiting for the first tick
- runs the credit grant sweep immediately, without waiting for the first tick
- runs the retention sweep immediately, without waiting for the first tick
- runs the job cleanup sweep immediately, without waiting for the first tick
- runs the job liveness sweep immediately, without waiting for the first tick
- runs all five — none is quietly missing from the wiring

### `src/scheduler/jobCleanupSweep.test.ts`

**deleting a long-deactivated posting**

- deletes one that no longer has any applications
- keeps one deactivated only 29 days
- never touches an ACTIVE posting, however old

**the deletion warning**

- warns the referrer at day 27, three days before deletion
- does not warn at day 20
- warns once, not every tick
- does not warn about an active posting

**the rule that was broken before, and must not break again**

- HOLDS a posting that still has applications on it, however long ago it was deactivated
- holds it for a submitted application — the sweep does not judge status, only presence
- holds it for a viewed application — the sweep does not judge status, only presence
- holds it for a forwarded application — the sweep does not judge status, only presence
- holds it for a rejected application — the sweep does not judge status, only presence
- holds it for a expired application — the sweep does not judge status, only presence
- holds it for a withdrawn application — the sweep does not judge status, only presence
- deletes it once the last application has gone

### `src/scheduler/jobLivenessSweep.test.ts`

**a confirmed-dead link**

- deactivates the posting and starts its deletion clock
- tells the seekers whose applications are still pending

**anything short of confirmed dead**

- leaves the posting alone on "alive"
- leaves the posting alone on "unknown"
- leaves the posting alone when the check itself throws
- one failing check does not stop the rest of the batch

**which postings get checked at all**

- checks a job that has never been checked
- skips a job checked within the last day
- never checks an already-deactivated posting
- stamps lastLivenessCheckAt even when the posting stays alive
- caps how many it checks in one tick
- is idempotent — a second run in the same day re-checks nothing

### `src/services/companyMatch.test.ts`

**auto-verifying a work email from the account email**

- accepts a company address — verifying the account already proved the mailbox
- refuses a personal address
- refuses a missing address
- normalises case on the way in

**Israeli company domains — the case that was entirely blocked**

- lets a .co.il referrer post on their own careers page
- lets a .co.il referrer post an ATS-hosted role for their company
- handles a careers subdomain on a .co.il domain
- handles co.uk the same way
- handles com.au the same way
- handles co.jp the same way
- handles com.br the same way
- still refuses a .co.il referrer posting for a different company

**matching a work email to a posting — the permissive cases**

- matches when the posting is on the company's own careers site
- matches a careers subdomain
- ignores a www prefix
- falls back to the company name when the posting is on an ATS (https://boards.greenhouse.io/acme/jobs/1)
- falls back to the company name when the posting is on an ATS (https://jobs.lever.co/acme/1)
- falls back to the company name when the posting is on an ATS (https://acme.comeet.com/jobs/1)
- falls back to the company name when the posting is on an ATS (https://apply.workable.com/acme/j/1)
- falls back to the company name when the posting is on an ATS (https://acme.bamboohr.com/careers/1)
- matches through common company suffixes
- matches when the company name carries punctuation or spacing
- still matches when the sourceUrl is malformed

**matching a work email to a posting — what it refuses**

- refuses an unrelated company
- refuses an ATS-hosted posting for a different company
- does not let an ATS domain itself count as a match
- refuses a short email label that would otherwise match almost anything
- refuses an empty company name
- refuses when the company name is only a generic suffix

**recognising a personal mailbox**

- treats gmail.com as personal
- treats outlook.com as personal
- treats hotmail.com as personal
- treats icloud.com as personal
- treats proton.me as personal
- treats yahoo.com as personal
- treats the Israeli consumer provider walla.co.il as personal
- treats the Israeli consumer provider walla.com as personal
- treats the Israeli consumer provider nana10.co.il as personal
- treats the Israeli consumer provider 012.net.il as personal
- treats the Israeli consumer provider bezeqint.net as personal
- treats the Israeli consumer provider netvision.net.il as personal
- treats acme.test as a company domain
- treats monday.com as a company domain
- treats wix.com as a company domain
- treats fiverr.com as a company domain
- is case-insensitive — nobody types their address consistently
- pulls the domain off an address, trimmed and lowercased

### `src/services/jobLiveness.test.ts`

**everything ambiguous must NOT be read as closure**

- a 200 with no JSON-LD at all is alive, not dead
- a future validThrough is alive
- a JobPosting with no validThrough is alive
- treats 500 as unknown — the site is unwell, the job may be fine
- treats 502 as unknown — the site is unwell, the job may be fine
- treats 503 as unknown — the site is unwell, the job may be fine
- treats 429 as unknown — the site is unwell, the job may be fine
- treats 403 as unknown — the site is unwell, the job may be fine
- treats 401 as unknown — the site is unwell, the job may be fine
- treats a network failure as unknown
- treats a timeout as unknown
- survives unparseable JSON-LD rather than guessing
- survives a malformed validThrough date
- ignores a validThrough on a non-JobPosting entity
- keeps reading later blocks when an earlier one is broken

**how it asks**

- follows redirects and identifies as a browser
- gives up rather than hanging

**signals that genuinely mean the posting is gone**

- treats 404 as dead — the resource is confirmed gone
- treats 410 as dead — the resource is confirmed gone
- treats an expired validThrough as dead
- finds the posting inside an @graph wrapper
- finds it in a top-level array
- handles @type given as an array
- recovers from trailing commas, which real pages ship

### `src/services/jobScraper.test.ts`

**the page fetch itself is blocked, but the URL still identifies the ATS posting**

- falls back to the Greenhouse API when a gh_jid embed page 403s
- falls back to the Lever API when a jobs.lever.co page 403s
- falls back the same way when the page fetch throws outright (timeout, DNS, etc.)
- still returns nothing — never throws — when a blocked page carries no ATS id to fall back on
- still returns nothing when the Greenhouse fallback itself has no match either

### `src/shared/contracts.test.ts`

**the shared contract and the database agree**

- the live CHECK constraint allows exactly APPLICATION_STATUSES
- every subset list is drawn from APPLICATION_STATUSES
- closed and pending never overlap
- a referrer cannot set 'expired' — only the sweep may

---

*Strategy and the decisions behind it: `initiatives/directref/03-design/test-strategy-2026-09-16.md` in the vault.*
