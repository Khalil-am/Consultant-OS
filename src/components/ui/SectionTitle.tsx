import { type ReactNode } from 'react';
import { cn } from './cn';

interface SectionTitleProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function SectionTitle({ eyebrow, title, description, action, className }: SectionTitleProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4 flex-wrap', className)}>
      <div className="flex-1 min-w-0">
        {eyebrow && (
          <div className="text-[0.66rem] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-muted)] mb-2 flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#A78BFA] shadow-[0_0_6px_rgba(167,139,250,0.7)]" />
            {eyebrow}
          </div>
        )}
        <h2 className="display-lg text-[color:var(--text-primary)] font-semibold tracking-tight mb-1">
          {title}
        </h2>
        {description && (
          <p className="text-[0.85rem] text-[color:var(--text-muted)] max-w-2xl leading-relaxed">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
