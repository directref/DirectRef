export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export const ROUTES = {
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  verifyEmail: '/verify-email',
  feed: '/feed',
  jobs: '/jobs',
  jobsMine: '/jobs/mine',
  jobsPost: '/jobs/post',
  jobDetail: (id: string) => `/jobs/${id}`,
  applications: '/applications',
  applicationsInbox: '/applications/inbox',
  network: '/network',
  notifications: '/notifications',
  settings: '/settings',
} as const;

export const API_ROUTES = {
  // Auth
  login: '/api/auth/login',
  register: '/api/auth/register',
  logout: '/api/auth/logout',
  me: '/api/auth/me',
  meProfile: '/api/users/me',
  refresh: '/api/auth/refresh',
  forgotPassword: '/api/auth/forgot-password',
  resetPassword: '/api/auth/reset-password',
  verifyEmail: (token: string) => `/api/auth/verify-email/${token}`,
  google: '/api/auth/google',
  // Users
  userSearch: '/api/users/search',
  userById: (id: string) => `/api/users/${id}`,
  // Connections
  connections: '/api/connections',
  connectionById: (id: string) => `/api/connections/${id}`,
  mutualConnection: (userId: string) => `/api/connections/mutual/${userId}`,
  // Jobs
  jobs: '/api/jobs',
  jobFeed: '/api/jobs/feed',
  jobsMine: '/api/jobs/mine',
  jobById: (id: string) => `/api/jobs/${id}`,
  jobScrape: '/api/jobs/scrape',
  // Applications
  applications: '/api/applications',
  applicationsInbox: '/api/applications/inbox',
  applicationsMine: '/api/applications/mine',
  applicationById: (id: string) => `/api/applications/${id}`,
  applicationStatus: (id: string) => `/api/applications/${id}/status`,
  applicationForward: (id: string) => `/api/applications/${id}/forward`,
  applicationCV: (id: string) => `/${API_BASE}/api/applications/${id}/cv`,
} as const;

export const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
];
