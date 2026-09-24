/**
 * The vocabulary both halves of the product have to agree on.
 *
 * WHY THIS FILE EXISTS: the application status list used to live in three
 * places that nothing forced to agree — the SQL CHECK constraint, the
 * CLOSED_STATUSES array in the retention sweep, and a retyped union in the
 * frontend. Add a status in one and the others carried on unaware. Doc/reality
 * drift is this project's recurring failure, and that was the same disease one
 * layer down, with no rule against it.
 *
 * Everything here is declared ONCE and consumed everywhere:
 *   · the Drizzle schema builds its CHECK constraint from these arrays,
 *     so the database and the types cannot disagree;
 *   · backend code imports the types and the arrays;
 *   · the frontend imports the types through its `@contracts` path alias.
 *
 * DEPENDENCY-FREE ON PURPOSE. No drizzle, no zod, no node built-ins — the
 * frontend compiles this file too, and anything imported here would be dragged
 * into the browser bundle. Keep it to plain arrays and types.
 */

// ── Applications ──────────────────────────────────────────────────────────────

/** Every state an application can be in. The database CHECK constraint is
 *  generated from this array (see db/schema/applications.ts), so adding a
 *  value here and forgetting the migration is a visible failure rather than a
 *  silent divergence. */
export const APPLICATION_STATUSES = [
  'submitted',
  'viewed',
  'forwarded',
  'rejected',
  'expired',
  'internally_submitted',
  'withdrawn',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** Finished, one way or another. Nothing in this list is still in play, which
 *  is what makes it safe for the retention sweep to erase them after their
 *  window — and what makes everything NOT in it untouchable however old. */
export const CLOSED_APPLICATION_STATUSES = [
  'rejected',
  'expired',
  'internally_submitted',
  'withdrawn',
] as const satisfies readonly ApplicationStatus[];
export type ClosedApplicationStatus = (typeof CLOSED_APPLICATION_STATUSES)[number];

/** Still awaiting a decision — what the escalation clocks chase. Viewed counts:
 *  opening a C.V. is not responding to it. */
export const PENDING_APPLICATION_STATUSES = ['submitted', 'viewed'] as const satisfies readonly ApplicationStatus[];
export type PendingApplicationStatus = (typeof PENDING_APPLICATION_STATUSES)[number];

/** A real answer, of any kind. "Not a fit" is a response — the seeker knows
 *  where they stand. Drives the responsiveness score. */
export const DECIDED_APPLICATION_STATUSES = [
  'forwarded',
  'internally_submitted',
  'rejected',
] as const satisfies readonly ApplicationStatus[];

/** The statuses a referrer may set directly. 'expired' is absent deliberately:
 *  only the Day-5 sweep sets it, never a user. */
export const REFERRER_SETTABLE_STATUSES = [
  'viewed',
  'forwarded',
  'rejected',
  'internally_submitted',
] as const satisfies readonly ApplicationStatus[];
export type ReferrerSettableStatus = (typeof REFERRER_SETTABLE_STATUSES)[number];

// ── Connections ───────────────────────────────────────────────────────────────

export const CONNECTION_STATUSES = ['pending', 'accepted', 'rejected'] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

// ── Profile vocabulary ────────────────────────────────────────────────────────

export const EMPLOYMENT_TYPES = ['full-time', 'part-time'] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const SENIORITIES = ['junior', 'mid', 'senior', 'lead', 'manager'] as const;
export type Seniority = (typeof SENIORITIES)[number];

// ── Responsiveness ────────────────────────────────────────────────────────────

export const RESPONSE_BANDS = ['green', 'orange', 'red'] as const;
export type ResponseBand = (typeof RESPONSE_BANDS)[number];
