import { cn } from './cn';

interface AvatarProps {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  status?: 'online' | 'away' | 'offline';
  className?: string;
  gradient?: string;
}

const sizeMap = {
  xs: 'w-6 h-6 text-[0.6rem]',
  sm: 'w-7 h-7 text-[0.66rem]',
  md: 'w-9 h-9 text-[0.75rem]',
  lg: 'w-12 h-12 text-[0.95rem]',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, size = 'md', status, className, gradient }: AvatarProps) {
  return (
    <div className="relative inline-block">
      <div
        className={cn('avatar font-bold ring-2 ring-white/10', sizeMap[size], className)}
        style={gradient ? { background: gradient } : undefined}
      >
        {initials(name)}
      </div>
      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full ring-2 ring-[color:var(--bg-base)]',
            size === 'xs' || size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5',
            status === 'online' && 'bg-[#34D399] shadow-[0_0_8px_rgba(52,211,153,0.7)]',
            status === 'away' && 'bg-[#F5B544]',
            status === 'offline' && 'bg-[color:var(--text-faint)]',
          )}
        />
      )}
    </div>
  );
}
