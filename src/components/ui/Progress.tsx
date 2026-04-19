import { motion } from 'motion/react';
import { cn } from './cn';

interface ProgressProps {
  value: number;
  max?: number;
  tone?: 'brand' | 'mint' | 'amber' | 'red' | 'blue';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const fillClasses: Record<NonNullable<ProgressProps['tone']>, string> = {
  brand: 'bg-gradient-to-r from-[#7877C6] to-[#A78BFA] shadow-[0_0_12px_rgba(167,139,250,0.4)]',
  mint: 'bg-gradient-to-r from-[#34D399] to-[#63E6BE] shadow-[0_0_12px_rgba(99,230,190,0.4)]',
  amber: 'bg-gradient-to-r from-[#F5B544] to-[#FDCE78] shadow-[0_0_12px_rgba(245,181,68,0.4)]',
  red: 'bg-gradient-to-r from-[#FF6B6B] to-[#FCA5A5] shadow-[0_0_12px_rgba(255,107,107,0.4)]',
  blue: 'bg-gradient-to-r from-[#38BDF8] to-[#7DD3FC] shadow-[0_0_12px_rgba(56,189,248,0.4)]',
};

const sizeClasses: Record<NonNullable<ProgressProps['size']>, string> = {
  sm: 'h-1',
  md: 'h-1.5',
  lg: 'h-2.5',
};

export function Progress({ value, max = 100, tone = 'brand', size = 'md', showLabel = false, className }: ProgressProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="flex items-center justify-between mb-1.5 text-[0.72rem] font-semibold text-[color:var(--text-secondary)]">
          <span>{Math.round(pct)}%</span>
        </div>
      )}
      <div className={cn('progress-bar overflow-hidden', sizeClasses[size])}>
        <motion.div
          className={cn('h-full rounded-full', fillClasses[tone])}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}
