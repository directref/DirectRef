import Link from 'next/link';
import { mkt } from '@/app/(marketing)/tokens';

interface TocItem {
  id: string;
  label: string;
}

interface LegalLayoutProps {
  title: string;
  effectiveDate: string;
  toc: TocItem[];
  children: React.ReactNode;
}

export function LegalLayout({ title, effectiveDate, toc, children }: LegalLayoutProps) {
  return (
    <div className="max-w-6xl mx-auto px-5 py-14 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-12 items-start">
      <aside className="hidden lg:block">
        <nav className="sticky top-24">
          <p className="text-xs font-semibold uppercase tracking-[0.09em] mb-3" style={{ color: mkt.textMuted }}>
            On this page
          </p>
          <div className="flex flex-col gap-2 max-h-[calc(100vh-140px)] overflow-y-auto pr-2">
            {toc.map((item) => (
              <Link
                key={item.id}
                href={`#${item.id}`}
                className="block text-[13px] leading-tight"
                style={{ color: mkt.textSecondary }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </aside>

      <article className="min-w-0">
        <h1 className="text-[32px] leading-tight font-bold tracking-tight">{title}</h1>
        <p className="mt-2 mb-8 text-[13px]" style={{ color: mkt.textMuted }}>{effectiveDate}</p>
        {children}
      </article>
    </div>
  );
}

export function LegalH2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="text-[19px] font-semibold mt-9 mb-3 pt-6 scroll-mt-24"
      style={{ borderTop: `1px solid ${mkt.border}` }}
    >
      {children}
    </h2>
  );
}

export function LegalH3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-base font-bold mt-6 mb-2" style={{ color: mkt.accentSeeker }}>
      {children}
    </h3>
  );
}

export function LegalP({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[15px] leading-relaxed mb-4" style={{ color: mkt.textSecondary }}>
      {children}
    </p>
  );
}

export function LegalUl({ children }: { children: React.ReactNode }) {
  return <ul className="mb-4 pl-5 flex flex-col gap-2">{children}</ul>;
}

export function LegalLi({ children }: { children: React.ReactNode }) {
  return (
    <li className="text-[15px] leading-relaxed" style={{ color: mkt.textSecondary }}>
      {children}
    </li>
  );
}

export function LegalStrong({ children }: { children: React.ReactNode }) {
  return <strong style={{ color: mkt.textPrimary }}>{children}</strong>;
}

export function LegalCallout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="my-5 px-5 py-4 rounded-r-xl"
      style={{ background: mkt.cardBg, borderLeft: `3px solid ${mkt.accentSeeker}` }}
    >
      <p className="text-[15px] leading-relaxed" style={{ color: mkt.textSecondary }}>{children}</p>
    </div>
  );
}
