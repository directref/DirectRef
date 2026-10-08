/** Mirrors getWaitlistDashboard() in apps/backend/src/modules/waitlist/waitlist.service.ts. */
export type Role = 'seeker' | 'referrer';

export interface WaitlistDashboardData {
  range: { days: number; tz: string };
  totals: {
    seekers: number;
    referrers: number;
    total: number;
    joinedToday: number;
    unsubscribed: number;
    notSyncedToResend: number;
  };
  daily: { date: string; seekers: number; referrers: number }[];
  bySource: { source: string | null; seekers: number; referrers: number; total: number }[];
  byCampaign: {
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    seekers: number;
    referrers: number;
    total: number;
  }[];
  recent: {
    email: string;
    role: Role;
    source: string | null;
    utmSource: string | null;
    utmCampaign: string | null;
    unsubscribed: boolean;
    createdAt: string;
  }[];
}
