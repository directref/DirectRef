/** Mirrors getConversionDashboard() in apps/backend/src/modules/admin/conversion.service.ts. */
export type DailyMetric = 'pageViews' | 'ctaClicks' | 'waitlistSignups' | 'accountSignups' | 'jobsPosted' | 'cvsSent';

export interface ConversionDashboardData {
  range: { days: number; tz: string };
  totals: Record<DailyMetric, number>;
  allTime: { jobs: number; activeJobs: number; cvs: number; accounts: number };
  daily: ({ date: string } & Record<DailyMetric, number>)[];
  ctas: { cta: string; clicks: number; signups: number }[];
  cvFunnel: {
    sent: number;
    opened: number;
    downloaded: number;
    submittedInternally: number;
    notAFit: number;
    expired: number;
    withdrawn: number;
    awaiting: number;
  };
}
