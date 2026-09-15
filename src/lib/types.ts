// ── Core data types matching backend API responses ──────────────────────────

export type EmploymentType = 'full-time' | 'part-time';
export type Seniority = 'junior' | 'mid' | 'senior' | 'lead' | 'manager';

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
  score: number;
  band: 'green' | 'orange' | 'red';
  avgHours: number;
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
  status: 'submitted' | 'viewed' | 'forwarded' | 'internally_submitted' | 'rejected' | 'expired' | 'withdrawn';
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
  status: 'pending' | 'accepted' | 'rejected';
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
