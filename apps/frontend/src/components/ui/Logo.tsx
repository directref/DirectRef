// Signal-person mark: a head made of concentric broadcast rings above
// arched shoulder bands — one person's referral "signal" reaching others.
export function LogoMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* head — concentric rings */}
      <circle cx="24" cy="10.5" r="7" stroke="#F0D9A8" strokeWidth="1.4" />
      <circle cx="24" cy="10.5" r="4.4" stroke="#E4C48F" strokeWidth="1.4" />
      <circle cx="24" cy="10.5" r="1.8" fill="#D4AF7A" />
      {/* shoulders — broadcast-wave arcs, outer to inner */}
      <path d="M3.5 37 A20.5 20.5 0 0 1 44.5 37" stroke="#F0D9A8" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M9 37 A15 15 0 0 1 39 37" stroke="#E4C48F" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M14.5 37 A9.5 9.5 0 0 1 33.5 37" stroke="#D4AF7A" strokeWidth="1.9" strokeLinecap="round" />
      {/* base notch */}
      <line x1="24" y1="30" x2="24" y2="34.5" stroke="#C49A5A" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
