import { sql } from 'drizzle-orm';
import { db } from '../../config/db';

/**
 * conversion.service
 *
 * WHY THIS EXISTS: after launch the questions are "is the marketing site
 * turning visits into signups, and is the product turning signups into job
 * posts and CVs sent?" This answers both from one query per section.
 *
 * CONNECTIONS:
 * - CALLED BY: admin.router (GET /api/admin/conversion) → frontend
 *   /admin/conversion.
 * - READS: marketing_events (views, CTA clicks), waitlist_signups, users,
 *   jobs, applications.
 *
 * DESIGN DECISIONS:
 * - WHY test accounts are excluded: the production smoke checks post jobs and
 *   send CVs from accounts flagged is_test_account. Counting them would make
 *   every deploy look like product usage.
 * - WHY days are cut in the viewer's time zone: same reason as the waitlist
 *   dashboard. tz is validated by the router and passed as a bound parameter.
 * - WHY CV counts can shrink for old periods: the retention sweep deletes
 *   closed applications after their window, so this reads what still exists.
 */
export type ConversionOptions = { days: number; tz: string };

type DailyRow = {
  date: string;
  pageViews: number;
  ctaClicks: number;
  waitlistSignups: number;
  accountSignups: number;
  jobsPosted: number;
  cvsSent: number;
};

export async function getConversionDashboard({ days, tz }: ConversionOptions) {
  const today = sql`(now() AT TIME ZONE ${tz})::date`;
  const firstDay = sql`(${today} - ${days - 1}::int)`;
  // The first local midnight of the range, as an absolute instant — lets each
  // table use its created_at index instead of converting every row.
  const since = sql`(${firstDay}::timestamp AT TIME ZONE ${tz})`;

  const daily = await db.execute<DailyRow>(sql`
    WITH d AS (
      SELECT generate_series(${firstDay}, ${today}, interval '1 day')::date AS day
    ),
    ev AS (
      SELECT (e.created_at AT TIME ZONE ${tz})::date AS day,
             count(*) FILTER (WHERE e.type = 'page_view') AS views,
             count(*) FILTER (WHERE e.type = 'cta_click') AS clicks
      FROM marketing_events e WHERE e.created_at >= ${since} GROUP BY 1
    ),
    wl AS (
      SELECT (w.created_at AT TIME ZONE ${tz})::date AS day, count(*) AS n
      FROM waitlist_signups w WHERE w.created_at >= ${since} GROUP BY 1
    ),
    us AS (
      SELECT (u.created_at AT TIME ZONE ${tz})::date AS day, count(*) AS n
      FROM users u WHERE u.created_at >= ${since} AND NOT u.is_test_account GROUP BY 1
    ),
    jb AS (
      SELECT (j.created_at AT TIME ZONE ${tz})::date AS day, count(*) AS n
      FROM jobs j JOIN users r ON r.id = j.referrer_id
      WHERE j.created_at >= ${since} AND NOT r.is_test_account GROUP BY 1
    ),
    cv AS (
      SELECT (a.created_at AT TIME ZONE ${tz})::date AS day, count(*) AS n
      FROM applications a JOIN users s ON s.id = a.seeker_id
      WHERE a.created_at >= ${since} AND NOT s.is_test_account GROUP BY 1
    )
    SELECT to_char(d.day, 'YYYY-MM-DD')        AS "date",
           coalesce(ev.views, 0)::int          AS "pageViews",
           coalesce(ev.clicks, 0)::int         AS "ctaClicks",
           coalesce(wl.n, 0)::int              AS "waitlistSignups",
           coalesce(us.n, 0)::int              AS "accountSignups",
           coalesce(jb.n, 0)::int              AS "jobsPosted",
           coalesce(cv.n, 0)::int              AS "cvsSent"
    FROM d
    LEFT JOIN ev ON ev.day = d.day
    LEFT JOIN wl ON wl.day = d.day
    LEFT JOIN us ON us.day = d.day
    LEFT JOIN jb ON jb.day = d.day
    LEFT JOIN cv ON cv.day = d.day
    ORDER BY d.day
  `);
  const rows = [...daily];
  const sum = (k: keyof Omit<DailyRow, 'date'>) => rows.reduce((n, r) => n + r[k], 0);

  // Every CTA that was clicked or that brought a signup in the range.
  const ctas = await db.execute<{ cta: string; clicks: number; signups: number }>(sql`
    WITH c AS (
      SELECT cta, count(*) AS n FROM marketing_events
      WHERE type = 'cta_click' AND cta IS NOT NULL AND created_at >= ${since} GROUP BY cta
    ),
    s AS (
      SELECT source_cta AS cta, count(*) AS n FROM waitlist_signups
      WHERE source_cta IS NOT NULL AND created_at >= ${since} GROUP BY source_cta
    )
    SELECT coalesce(c.cta, s.cta) AS cta,
           coalesce(c.n, 0)::int  AS clicks,
           coalesce(s.n, 0)::int  AS signups
    FROM c FULL OUTER JOIN s ON s.cta = c.cta
    ORDER BY coalesce(c.n, 0) DESC, coalesce(s.n, 0) DESC
  `);

  // What happened to the CVs sent in the range.
  const [cvFunnel] = await db.execute<{
    sent: number; opened: number; downloaded: number; submittedInternally: number;
    notAFit: number; expired: number; withdrawn: number; awaiting: number;
  }>(sql`
    SELECT count(*)::int                                                          AS "sent",
           (count(*) FILTER (WHERE a.viewed_at IS NOT NULL))::int                 AS "opened",
           (count(*) FILTER (WHERE a.forwarded_at IS NOT NULL))::int              AS "downloaded",
           (count(*) FILTER (WHERE a.status = 'internally_submitted'))::int       AS "submittedInternally",
           (count(*) FILTER (WHERE a.status = 'rejected'))::int                   AS "notAFit",
           (count(*) FILTER (WHERE a.status = 'expired'))::int                    AS "expired",
           (count(*) FILTER (WHERE a.status = 'withdrawn'))::int                  AS "withdrawn",
           (count(*) FILTER (WHERE a.status IN ('submitted', 'viewed')))::int     AS "awaiting"
    FROM applications a JOIN users s ON s.id = a.seeker_id
    WHERE a.created_at >= ${since} AND NOT s.is_test_account
  `);

  const [allTime] = await db.execute<{ jobs: number; activeJobs: number; cvs: number; accounts: number }>(sql`
    SELECT (SELECT count(*) FROM jobs j JOIN users r ON r.id = j.referrer_id WHERE NOT r.is_test_account)::int AS "jobs",
           (SELECT count(*) FROM jobs j JOIN users r ON r.id = j.referrer_id WHERE NOT r.is_test_account AND j.is_active)::int AS "activeJobs",
           (SELECT count(*) FROM applications a JOIN users s ON s.id = a.seeker_id WHERE NOT s.is_test_account)::int AS "cvs",
           (SELECT count(*) FROM users WHERE NOT is_test_account)::int AS "accounts"
  `);

  return {
    range: { days, tz },
    totals: {
      pageViews: sum('pageViews'),
      ctaClicks: sum('ctaClicks'),
      waitlistSignups: sum('waitlistSignups'),
      accountSignups: sum('accountSignups'),
      jobsPosted: sum('jobsPosted'),
      cvsSent: sum('cvsSent'),
    },
    allTime,
    daily: rows,
    ctas: [...ctas],
    cvFunnel,
  };
}
