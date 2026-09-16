/** Design tokens for the Profile & preferences page, per the design spec.
 *  Deliberately separate from the app's own theme in globals.css — same
 *  warm-cream identity as the marketing site's tokens.ts. */
export const pfx = {
  background: 'oklch(0.985 0.003 75)',
  surface: 'oklch(1 0 0)',
  border: 'oklch(0.93 0.004 70)',
  borderStrong: 'oklch(0.88 0.006 65)',
  ink: 'oklch(0.24 0.008 60)',
  inkSecondary: 'oklch(0.47 0.008 60)',
  inkMuted: 'oklch(0.62 0.008 60)',
  gold: 'oklch(0.72 0.13 85)',
  goldSoft: 'oklch(0.94 0.05 85)',
  primaryForeground: 'oklch(0.2 0.03 60)',
  secondary: 'oklch(0.96 0.004 70)',
  linkedinBlue: '#0A66C2',
  danger: 'oklch(0.52 0.19 27)',
} as const;
