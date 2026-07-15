import { forwardRef, type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-medium tracking-tight transition-all outline-none select-none whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary: 'btn-primary',
        ghost: 'btn-ghost',
        ai: 'btn-ai',
        danger: 'btn-danger',
        subtle:
          'bg-white/[0.04] text-[color:var(--text-secondary)] border border-[color:var(--border-default)] rounded-full hover:bg-white/[0.08] hover:text-[color:var(--text-primary)] hover:border-[color:var(--border-strong)]',
        link: 'text-[color:var(--violet-bright)] hover:text-[color:var(--text-primary)] underline-offset-4 hover:underline rounded',
      },
      size: {
        sm: 'h-8 px-3 text-[0.76rem] rounded-full',
        md: '',
        lg: 'h-11 px-5 text-[0.9rem] rounded-full',
        icon: 'h-9 w-9 p-0 rounded-full',
      },
    },
    defaultVariants: { variant: 'ghost', size: 'md' },
  }
);

export interface ButtonProps
  extends Omit<HTMLMotionProps<'button'>, 'size'>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, leading, trailing, children, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.97 }}
        whileHover={{ y: -1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 30 }}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {leading as ReactNode}
        {children as ReactNode}
        {trailing as ReactNode}
      </motion.button>
    );
  }
);
Button.displayName = 'Button';
