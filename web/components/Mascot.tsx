import Image from 'next/image';
import { MASCOT_PALETTE, MASCOT_IMAGE, mascotEmoji } from '@/lib/mascots';
import type { Mascot as MascotName } from '@/lib/types';
import { cn } from '@/lib/utils';
import { asset } from '@/lib/asset';

const SIZE = {
  sm: { box: 'h-8 w-8',   text: 'text-xs',  px: 32 },
  md: { box: 'h-12 w-12', text: 'text-sm',  px: 48 },
  lg: { box: 'h-16 w-16', text: 'text-lg',  px: 64 },
  xl: { box: 'h-24 w-24', text: 'text-2xl', px: 96 },
};

export function Mascot({
  name,
  size = 'md',
  selected = false,
  className,
}: {
  name: MascotName;
  size?: keyof typeof SIZE;
  selected?: boolean;
  className?: string;
}) {
  const palette = MASCOT_PALETTE[name];
  const image = MASCOT_IMAGE[name];
  const s = SIZE[size];

  return (
    <span
      className={cn(
        'relative inline-flex items-center justify-center rounded-full font-semibold transition-transform overflow-hidden',
        s.box,
        s.text,
        selected && 'scale-105',
        className,
      )}
      style={{
        background: palette.bg,
        color: palette.fg,
        boxShadow: selected
          ? `0 0 0 4px ${palette.accent}, 0 4px 12px -4px rgba(107, 79, 63, 0.18)`
          : '0 2px 6px -2px rgba(107, 79, 63, 0.12)',
      }}
      aria-label={name}
    >
      {image ? (
        <Image
          src={asset(image.src)}
          alt={name}
          width={s.px}
          height={s.px}
          className="absolute inset-0 h-full w-full object-contain"
          style={{
            transform: `translateY(${image.translateY}) scale(${image.scale})`,
            transformOrigin: 'center',
          }}
          priority={size === 'xl'}
        />
      ) : (
        <span>{mascotEmoji[name]}</span>
      )}
    </span>
  );
}
