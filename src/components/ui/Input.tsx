import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leading?: ReactNode;
  trailing?: ReactNode;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, leading, trailing, wrapperClassName, ...props }, ref) => {
    if (leading || trailing) {
      return (
        <div className={cn(
          'group relative flex items-center gap-2 rounded-full bg-white/[0.035] border border-[color:var(--border-default)] backdrop-blur-md transition-all',
          'hover:bg-white/[0.05] hover:border-[color:var(--border-strong)]',
          'focus-within:border-[rgba(120,119,198,0.55)] focus-within:bg-[rgba(120,119,198,0.05)] focus-within:shadow-[0_0_0_3px_rgba(120,119,198,0.15)]',
          wrapperClassName,
        )}>
          {leading && <span className="pl-3.5 pr-1 flex items-center text-[color:var(--text-muted)]">{leading}</span>}
          <input
            ref={ref}
            className={cn(
              'flex-1 bg-transparent border-0 outline-none py-2.5 text-[0.85rem] text-[color:var(--text-primary)] placeholder:text-[color:var(--text-faint)]',
              !leading && 'pl-4',
              !trailing && 'pr-4',
              className,
            )}
            {...props}
          />
          {trailing && <span className="pr-2 flex items-center">{trailing}</span>}
        </div>
      );
    }
    return <input ref={ref} className={cn('input-field', className)} {...props} />;
  }
);
Input.displayName = 'Input';
