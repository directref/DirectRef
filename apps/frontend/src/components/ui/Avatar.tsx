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
  const initials = name ? getInitials(name) : '?';

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center shrink-0 select-none overflow-hidden',
        sizeMap[size],
        ring && 'ring-2 ring-gold-300 ring-offset-2 ring-offset-page',
        !src && 'bg-gold-500/40 text-gold-300 font-bold',
        className,
      )}
    >
      {src ? (
        <Image src={src} alt={name ?? 'avatar'} width={72} height={72} className="w-full h-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );
}
