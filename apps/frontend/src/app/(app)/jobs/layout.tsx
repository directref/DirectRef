import type { ReactNode } from 'react';
import type { CSSProperties } from 'react';
import { Rubik } from 'next/font/google';

const rubik = Rubik({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });

// Jobs Page Dev Spec color tokens — scoped to this subtree via CSS custom
// property overrides rather than the global theme, since the ask was to
// align the Jobs pages specifically, not re-skin the whole app. Tailwind's
// color utilities (text-text-primary, border-border, etc.) reference these
// as var(...) at runtime, so overriding them here cascades to every
// descendant that uses those utility classes.
//
// text-primary/text-secondary are intentionally NOT overridden here anymore
// — the app went to pure black body text globally, and this subtree should
// follow that rather than keep the spec's warm dark-gray tone.
//
// Known limitation: Radix Dialog portals (Send CV / success modals) render
// outside this subtree in the DOM, so they won't pick up these overrides.
const specTokens: CSSProperties = {
  ['--color-text-muted' as string]: 'oklch(0.62 0.008 60)',
  ['--color-border' as string]: 'oklch(0.93 0.004 70)',
  ['--color-border-strong' as string]: 'oklch(0.88 0.004 70)',
  ['--color-accent-silver' as string]: 'oklch(0.5 0.02 60)',
};

export default function JobsLayout({ children }: { children: ReactNode }) {
  return (
    <div className={rubik.className} style={specTokens}>
      {children}
    </div>
  );
}
