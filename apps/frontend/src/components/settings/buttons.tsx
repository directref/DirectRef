'use client';

import { pfx } from '@/app/(app)/settings/tokens';

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export function PrimaryButton({ className, style, ...props }: BtnProps) {
  return (
    <button
      type="button"
      className={`rounded-[10px] px-5 py-2.5 text-[13.5px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed ${className ?? ''}`}
      style={{ background: pfx.gold, color: pfx.primaryForeground, ...style }}
      {...props}
    />
  );
}

export function SecondaryButton({ className, style, ...props }: BtnProps) {
  return (
    <button
      type="button"
      className={`rounded-[10px] px-5 py-2.5 text-[13.5px] font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className ?? ''}`}
      style={{ background: pfx.surface, borderColor: pfx.borderStrong, color: pfx.ink, ...style }}
      {...props}
    />
  );
}
