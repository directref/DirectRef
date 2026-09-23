import { useState } from 'react';
import { cn } from '@/lib/utils';
import { getInitials } from '@/lib/utils';
import Image from 'next/image';

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  ring?: boolean;
  className?: string;
}

const sizeMap = {
  xs:  'w-6 h-6 text-[10px]',
  sm:  'w-8 h-8 text-xs',
  md:  'w-10 h-10 text-sm',
  lg:  'w-14 h-14 text-lg',
  xl:  'w-18 h-18 text-xl',
};

export function Avatar({ src, name, size = 'md', ring, className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const initials = name ? getInitials(name) : '?';
  // A dead or blocked avatar URL (expired OAuth photo, disallowed remote
  // host, deleted file) should fall back to initials, not the browser's
  // broken-image glyph.
  const showImage = src && !failed;

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center shrink-0 select-none overflow-hidden',
        sizeMap[size],
        ring && 'ring-2 ring-gold-300 ring-offset-2 ring-offset-page',
        !showImage && 'bg-gold-500/40 text-gold-300 font-bold',
        className,
      )}
    >
      {showImage ? (
        <Image
          src={src}
          alt={name ?? 'avatar'}
          width={72}
          height={72}
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initials
      )}
    </div>
  );
}
