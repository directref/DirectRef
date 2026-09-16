// Step shape follows the design spec's model (anchor/route/title/body/next/cta),
// extended with fields the spec doesn't cover: routeMatch (the job detail
// page is a dynamic /jobs/[id] route — no fixed string can describe every
// match), resolveNext (the specific job to click into has to be discovered
// at click time, since it depends on which jobs are currently send-able),
// and resolveElement (same idea for the target element itself — the "which
// job card" step can't point at a static data-tour id since it must be the
// SAME card resolveNext is about to navigate into, not just any card).
export type TourStep = {
  anchor: string; // data-tour value; documentation-only when resolveElement is set
  route: string; // path where this step is valid (human-readable label when routeMatch is set)
  routeMatch?: (pathname: string) => boolean;
  resolveElement?: () => Element | null;
  title: string;
  body: string;
  next?: string; // route to navigate to on advance
  resolveNext?: () => string | null; // dynamic version of `next`, takes priority
  cta?: string; // button label, default "Next"
};

const isJobDetailRoute = (pathname: string) => pathname.startsWith('/jobs/') && pathname !== '/jobs/post';

// The eligible-card lookup (has a visible "Send my C.V." button — i.e. not
// already applied to, not the user's own posting, not closed) is shared by
// the two steps that need it: one to point at the card, one to navigate
// into it. Kept as one function so they can never disagree on which card.
const findEligibleJobCard = (): Element | null => {
  const sendButton = Array.from(document.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === 'Send my C.V.',
  );
  return sendButton?.closest('[class*="bg-jobs-surface"]') ?? null;
};

export const tourSteps: TourStep[] = [
  {
    anchor: 'nav-home',
    route: '/feed',
    title: 'Home',
    body: 'Keep track of your recent job posts, sent applications, and current activity all in one place.',
  },
  {
    anchor: 'credits',
    route: '/feed',
    title: 'Your credits',
    body: 'View your available credit balance. Each job post costs 1 credit. You received 5 credits when you joined, plus 1 free credit every month.',
  },
  {
    anchor: 'profile',
    route: '/feed',
    title: 'Profile & preferences',
    body: 'Manage your profile details and job preferences.',
  },
  {
    anchor: 'nav-jobs',
    route: '/feed',
    next: '/jobs',
    title: 'Browse jobs',
    body: "Browse open roles you can refer candidates into, or apply to yourself. Let's take a look.",
  },
  {
    anchor: 'jobs-search',
    route: '/jobs',
    title: 'Search jobs',
    body: 'Search and filter open roles to find what fits.',
  },
  {
    anchor: 'job-card',
    route: '/jobs',
    resolveElement: findEligibleJobCard,
    resolveNext: () => {
      const card = findEligibleJobCard();
      const link = card?.querySelector('a[href^="/jobs/"]');
      return link?.getAttribute('href') ?? null;
    },
    title: 'View a role',
    body: 'Click on a job card to see the full listing and how referrals work.',
  },
  {
    anchor: 'send-cv',
    route: '/jobs/:id',
    routeMatch: isJobDetailRoute,
    next: '/applications?tab=sent',
    title: 'Send your CV',
    body: 'Send your application directly to the contact listing the role.',
  },
  {
    anchor: 'sent-header',
    route: '/applications',
    next: '/jobs/post',
    title: 'Sent CV',
    body: "Track the status of every CV you've submitted.",
  },
  {
    anchor: 'post-form',
    route: '/jobs/post',
    title: 'Post a job',
    body: 'Paste a job listing link to autofill the details and share a new role.',
    cta: 'Got it',
  },
];
