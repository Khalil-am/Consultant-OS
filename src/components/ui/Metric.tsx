import { type ReactNode } from 'react';
import { motion } from 'motion/react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from './cn';
import { fadeUp, spring } from './motion';

interface MetricProps {
  label: string;
  value: ReactNode;
  sublabel?: ReactNode;
  icon?: ReactNode;
  trend?: number | null;
  trendLabel?: string;
  tone?: 'brand' | 'mint' | 'gold' | 'danger' | 'neutral';
  interactive?: boolean;
  onClick?: () => void;
  className?: string;
}

const toneBg: Record<NonNullable<MetricProps['tone']>, string> = {
  brand: 'from-[rgba(120,119,198,0.18)] to-transparent',
  mint: 'from-[rgba(99,230,190,0.16)] to-transparent',
  gold: 'from-[rgba(240,168,117,0.16)] to-transparent',
  danger: 'from-[rgba(255,107,107,0.16)] to-transparent',
  neutral: 'from-white/[0.04] to-transparent',
};

const toneIconBg: Record<NonNullable<MetricProps['tone']>, string> = {
  brand: 'bg-[rgba(120,119,198,0.18)] text-[#C4B5FD] ring-[rgba(120,119,198,0.35)]',
  mint: 'bg-[rgba(99,230,190,0.16)] text-[#63E6BE] ring-[rgba(99,230,190,0.30)]',
  gold: 'bg-[rgba(240,168,117,0.16)] text-[#F0A875] ring-[rgba(240,168,117,0.30)]',
  danger: 'bg-[rgba(255,107,107,0.16)] text-[#FCA5A5] ring-[rgba(255,107,107,0.30)]',
  neutral: 'bg-white/[0.06] text-[color:var(--text-secondary)] ring-white/10',
};

export function Metric({
  label,
  value,
  sublabel,
  icon,
  trend,
  trendLabel,
  tone = 'neutral',
  interactive = false,
  onClick,
  className,
}: MetricProps) {
  const TrendIcon = trend == null ? Minus : trend >= 0 ? ArrowUpRight : ArrowDownRight;
  const trendColor = trend == null ? 'text-[color:var(--text-muted)]' : trend >= 0 ? 'text-[#6EE7B7]' : 'text-[#FCA5A5]';

  return (
    <motion.div
      variants={fadeUp}
      whileHover={interactive ? { y: -3, transition: spring } : undefined}
      onClick={onClick}
      className={cn(
        'metric-card group',
        interactive && 'cursor-pointer',
        className,
      )}
    >
      <div className={cn('absolute inset-0 bg-gradient-to-br pointer-events-none opacity-80', toneBg[tone])} />
      <div className="relative flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          {icon && (
            <div className={cn('w-9 h-9 rounded-[10px] flex items-center justify-center ring-1', toneIconBg[tone])}>
              {icon}
            </div>
          )}
          <div className="text-[0.66rem] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
            {label}
          </div>
        </div>
        {trend != null && (
          <div className={cn('flex items-center gap-1 text-[0.72rem] font-semibold', trendColor)}>
            <TrendIcon size={13} />
            {trendLabel ?? `${trend > 0 ? '+' : ''}${trend}%`}
          </div>
        )}
      </div>
      <div className="relative">
        <div className="hero-number text-[color:var(--text-primary)] mb-1">{value}</div>
        {sublabel && <div className="text-[0.78rem] text-[color:var(--text-muted)] font-medium">{sublabel}</div>}
      </div>
    </motion.div>
  );
}
