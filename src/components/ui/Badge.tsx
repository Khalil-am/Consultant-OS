import { type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';

const badgeVariants = cva('badge-base', {
  variants: {
    tone: {
      neutral: 'status-draft',
      success: 'status-active',
      pending: 'status-pending',
      review: 'status-review',
      critical: 'status-risk-critical',
      high: 'status-risk-high',
      medium: 'status-risk-medium',
      low: 'status-risk-low',
      brand: 'bg-[rgba(120,119,198,0.14)] text-[#C4B5FD] border border-[rgba(120,119,198,0.30)]',
      mint: 'bg-[rgba(99,230,190,0.10)] text-[#63E6BE] border border-[rgba(99,230,190,0.24)]',
      gold: 'bg-[rgba(240,168,117,0.10)] text-[#F0A875] border border-[rgba(240,168,117,0.22)]',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: ReactNode;
  className?: string;
  dot?: boolean;
}

export function Badge({ tone, className, children, dot }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
}
