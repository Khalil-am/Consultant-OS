import { forwardRef, type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';
import { fadeUp, spring } from './motion';

const cardVariants = cva('relative overflow-hidden transition-colors', {
  variants: {
    variant: {
      glass: 'glass rounded-[var(--radius-lg)]',
      elevated: 'elevated-card',
      section: 'section-card',
      metric: 'metric-card',
      hero: 'hero-surface px-7 py-7 md:px-10 md:py-9',
      board: 'board-pack-card',
    },
  },
  defaultVariants: { variant: 'glass' },
});

export interface CardProps
  extends HTMLMotionProps<'div'>,
    VariantProps<typeof cardVariants> {
  interactive?: boolean;
  children?: ReactNode;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, interactive = false, children, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        variants={fadeUp}
        whileHover={interactive ? { y: -3, transition: spring } : undefined}
        className={cn(cardVariants({ variant }), interactive && 'cursor-pointer', className)}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
Card.displayName = 'Card';

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('section-card-header', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center gap-2 text-[0.95rem] font-semibold text-[color:var(--text-primary)] tracking-tight', className)} {...props}>
      {children}
    </div>
  );
}

export function CardBody({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-5 md:p-6', className)} {...props}>
      {children}
    </div>
  );
}
