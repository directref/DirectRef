// ── Core data types matching backend API responses ──────────────────────────

// The shared vocabulary is DECLARED ONCE, in apps/backend/src/shared/contracts.ts,
// and re-exported here so every existing `from '@/lib/types'` import keeps
// working. These used to be retyped by hand on this side; when 'withdrawn' was
// added to the database the frontend union silently disagreed with it, and
// nothing in either build would have said so.
export type {
  ApplicationStatus,
  ConnectionStatus,
  EmploymentType,
  ResponseBand,
  Seniority,
} from '@contracts';
import type {
  ApplicationStatus,
  ConnectionStatus,
  EmploymentType,
  ResponseBand,
  Seniority,
} from '@contracts';

export interface User {
  id: string;
  email: string;
  fullName: string;
  headline: string | null;
  avatarUrl: string | null;
  googleId: string | null;
  linkedinId: string | null;
  companyName: string | null;
  isReferrer: boolean;
  isSeeker: boolean;
  emailVerified: boolean;
  workEmail: string | null;
  workEmailVerified: boolean;
  onboarded: boolean;
  inviteCode: string | null;
  invitedById: string | null;
  desiredRole: string | null;
  preferredLocation: string | null;
  yearsOfExperience: number | null;
  employmentType: EmploymentType | null;
  seniority: Seniority | null;
  cvOriginalName: string | null;
  cvMimetype: string | null;
  cvSizeBytes: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Job {
  id: string;
  referrerId: string;
  sourceUrl: string;
  title: string;
  companyName: string;
  location: string | null;
  description: string | null;
  jobType: string | null;
  workMode: string | null;
  /** Derived server-side from the title (e.g. "Product Manager",
   *  "Back-End Developer") — null when the title doesn't match any
   *  canonical role. Powers the Browse Jobs "Role type" filter. */
  roleType: string | null;
  salaryRange: string | null;
  bonusAmount: string | null;
  bonusCurrency: string | null;
  bonusNotes: string | null;
  isActive: boolean;
  expiresAt: string | null;
  deactivatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResponseStats {
  /** 0-100, built from how often this referrer ANSWERS and how fast — not
   *  from how fast they open a C.V. See getResponseStatsForReferrers. */
  score: number;
  band: ResponseBand;
  /** Applications answered, and answered + timed out. Shown as "9 of 10" so
   *  the seeker can see how much evidence is behind the score. */
  decided: number;
  total: number;
  /** Median hours to an answer, among those answered. */
  medianHours: number;
}

export interface JobReferrer {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  companyName: string | null;
  headline: string | null;
  /** The specific underlying job row this referrer's posting is — submit
   *  applications against this id, not the grouped card's `job.id`. */
  jobId: string;
  responseStats?: ResponseStats;
}

export interface JobWithReferrer {
  job: Job;
  /** Back-compat: the top-scoring referrer in the group (or the lone one). */
  referrer: JobReferrer;
  /** Every referrer who's independently posted this same listing (same
   *  sourceUrl) — usually just one, occasionally more. */
  referrers: JobReferrer[];
}

export interface Application {
  id: string;
  jobId: string;
  seekerId: string;
  referrerId: string;
  cvOriginalName: string;
  cvSizeBytes: number;
  cvMimetype: string;
  coverNote: string | null;
  status: ApplicationStatus;
  forwardedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationWithDetails {
  application: Omit<Application, 'cvFilename'>;
  job: { id: string; title: string; companyName: string };
  seeker?: { id: string; fullName: string; avatarUrl: string | null; headline: string | null; yearsOfExperience?: number | null };
  referrer?: { id: string; fullName: string; avatarUrl: string | null };
}

export interface Connection {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: ConnectionStatus;
  createdAt: string;
  updatedAt: string;
  requester?: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
    companyName: string | null;
    headline: string | null;
  };
}

export interface PublicUser {
  id: string;
  fullName: string;
  headline: string | null;
  avatarUrl: string | null;
  companyName: string | null;
  isReferrer: boolean;
  createdAt: string;
}

export interface SavedJob {
  savedAt: string;
  job: Job;
  referrer: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
    companyName: string | null;
    headline: string | null;
  };
}

export interface ApiError {
  status: number;
  message: string;
  code?: string;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApplicationMessage {
  id: string;
  applicationId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export interface CreditBalance {
  total: number;
  // Legacy free/purchased split — the backend no longer distinguishes these
  // (see credits.service.ts), so it never sends them. Kept optional only so
  // the untouched, currently-unreachable /credits purchase page still
  // compiles; every live consumer reads `total`.
  freeAvailable?: number;
  freeTotal?: number;
  purchased?: number;
}

// Kept for the (currently disabled) purchase UI — see credits/page.tsx and
// lib/api/credits.ts.
export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  currency: string;
  featured?: boolean;
}
