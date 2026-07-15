import { type ReactNode } from 'react';
import { motion } from 'motion/react';
import { cn } from './cn';

interface TabsProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  items: readonly { value: T; label: ReactNode; icon?: ReactNode }[];
  variant?: 'pill' | 'underline';
  className?: string;
}

export function Tabs<T extends string>({ value, onChange, items, variant = 'pill', className }: TabsProps<T>) {
  if (variant === 'underline') {
    return (
      <div className={cn('flex items-center gap-5 border-b border-[color:var(--border-subtle)]', className)}>
        {items.map((item) => (
          <button
            key={item.value}
            onClick={() => onChange(item.value)}
            className={cn('tab-underline', item.value === value && 'active')}
          >
            <span className="flex items-center gap-2">
              {item.icon}
              {item.label}
            </span>
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className={cn('relative inline-flex items-center gap-1 p-1 rounded-full bg-white/[0.04] border border-[color:var(--border-subtle)] backdrop-blur-md', className)}>
      {items.map((item) => {
        const isActive = item.value === value;
        return (
          <button
            key={item.value}
            onClick={() => onChange(item.value)}
            className={cn(
              'relative z-10 px-3.5 py-1.5 text-[0.78rem] font-medium rounded-full transition-colors',
              isActive ? 'text-white' : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-secondary)]',
            )}
          >
            {isActive && (
              <motion.span
                layoutId="tab-pill"
                className="absolute inset-0 rounded-full bg-gradient-to-br from-[rgba(120,119,198,0.3)] to-[rgba(99,91,255,0.22)] border border-[rgba(120,119,198,0.35)] shadow-[0_2px_10px_rgba(120,119,198,0.25)]"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {item.icon}
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
