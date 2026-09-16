/** Design tokens for the marketing site (landing, about, terms, privacy).
 *  Deliberately separate from the app's own theme in globals.css — the
 *  marketing site has its own warm-cream identity per the design handoff. */
export const mkt = {
  bg: 'oklch(0.985 0.003 75)',
  cardBg: 'oklch(1 0 0)',
  textPrimary: 'oklch(0.24 0.008 60)',
  textSecondary: 'oklch(0.47 0.008 60)',
  textMuted: 'oklch(0.62 0.008 60)',
  border: 'oklch(0.93 0.004 70)',
  borderStrong: 'oklch(0.88 0.006 65)',
  accentSeeker: 'oklch(0.72 0.13 85)',
  accentReferral: 'oklch(0.72 0.01 260)',
  // Matches the real app's --color-warn / --color-good (globals.css) — the
  // "schematic" application-status card should read as the same product as
  // the actual status pills in Sent CV / CV Inbox, not an independently
  // invented palette.
  statusWarnBg: '#b0801019',
  statusWarnText: '#b08010',
  statusGoodBg: '#0a7a0a19',
  statusGoodText: '#0a7a0a',
} as const;
