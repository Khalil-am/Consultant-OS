import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Briefcase, Zap, FileText, Video,
  CheckSquare, BarChart3, Sparkles, Settings, X, Trello,
  ChevronsUpDown, Circle,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLayout } from '../hooks/useLayout';
import { cn } from './ui/cn';

interface NavItem {
  label: string;
  icon: typeof LayoutDashboard;
  path: string;
  count?: number;
}

const navSections: { section: string; items: NavItem[] }[] = [
  {
    section: 'MAIN',
    items: [
      { label: 'Home',         icon: LayoutDashboard, path: '/' },
      { label: 'Workspaces',   icon: Briefcase,       path: '/workspaces', count: 8 },
      { label: 'Automations',  icon: Zap,             path: '/automations', count: 14 },
    ],
  },
  {
    section: 'WORK',
    items: [
      { label: 'Documents',    icon: FileText,    path: '/documents' },
      { label: 'Meetings',     icon: Video,       path: '/meetings' },
      { label: 'Tasks & Risks',icon: CheckSquare, path: '/tasks', count: 12 },
      { label: 'Trello Cards', icon: Trello,      path: '/trello-cards' },
      { label: 'Reports',      icon: BarChart3,   path: '/reports' },
    ],
  },
  {
    section: 'AI',
    items: [
      { label: 'Ask AI', icon: Sparkles, path: '/ask-ai' },
    ],
  },
  {
    section: 'SYSTEM',
    items: [
      { label: 'Admin', icon: Settings, path: '/admin' },
    ],
  },
];

export default function Sidebar() {
  const location = useLocation();
  const { sidebarOpen, setSidebarOpen, isTablet } = useLayout();

  const isActive = (path: string) => (path === '/' ? location.pathname === '/' : location.pathname.startsWith(path));
  const handleNavClick = () => { if (isTablet) setSidebarOpen(false); };

  return (
    <aside
      className={cn(
        'flex flex-col flex-shrink-0 relative isolate',
        'bg-[rgba(7,8,15,0.72)] backdrop-blur-2xl backdrop-saturate-[140%]',
        'border-r border-white/[0.06]',
        isTablet
          ? 'fixed left-0 top-0 h-[100dvh] w-[264px] z-50 transition-transform duration-300 ease-out'
          : 'w-[260px] min-w-[260px] sticky top-0 h-screen overflow-hidden',
      )}
      style={{
        transform: isTablet ? `translateX(${sidebarOpen ? '0' : '-100%'})` : undefined,
      }}
    >
      {/* Ambient halo behind sidebar */}
      <div aria-hidden className="absolute -top-32 -left-32 w-64 h-64 rounded-full bg-[radial-gradient(circle,rgba(120,119,198,0.28)_0%,transparent_70%)] pointer-events-none -z-10" />
      <div aria-hidden className="absolute bottom-0 -left-24 w-56 h-56 rounded-full bg-[radial-gradient(circle,rgba(99,230,190,0.15)_0%,transparent_70%)] pointer-events-none -z-10" />

      {/* Brand */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/[0.05] flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22 }}
            className="w-9 h-9 rounded-[12px] bg-gradient-to-br from-[#7877C6] via-[#A78BFA] to-[#63E6BE] flex items-center justify-center shadow-[0_4px_16px_rgba(120,119,198,0.45)] ring-1 ring-white/20"
          >
            <img src="/favicon.png" alt="logo" className="w-5 h-5 object-contain" />
          </motion.div>
          <div className="leading-tight">
            <div className="text-[0.88rem] font-bold text-[color:var(--text-primary)] tracking-tight">Consultant OS</div>
            <div className="text-[0.6rem] font-medium tracking-[0.08em] text-[color:var(--text-muted)]">AI-Powered Platform</div>
          </div>
        </div>
        {isTablet && (
          <button
            onClick={() => setSidebarOpen(false)}
            className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[color:var(--text-muted)] hover:bg-white/[0.08] hover:text-[color:var(--text-primary)] transition-colors"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2.5">
        {navSections.map((section, si) => (
          <div key={section.section} className={cn(si < navSections.length - 1 && 'mb-4')}>
            <div className="sidebar-section-label">{section.section}</div>
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = isActive(item.path);
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    onClick={handleNavClick}
                    className="relative block"
                  >
                    {active && (
                      <motion.div
                        layoutId="sidebar-active"
                        className="absolute inset-0 rounded-[12px] bg-gradient-to-br from-[rgba(120,119,198,0.22)] to-[rgba(99,91,255,0.10)] border border-[rgba(120,119,198,0.35)] shadow-[inset_0_1px_0_rgba(167,139,250,0.18),0_4px_16px_rgba(120,119,198,0.18)]"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                    <div
                      className={cn(
                        'relative flex items-center gap-2.5 px-2.5 py-2 rounded-[12px] text-[0.83rem] transition-colors',
                        active
                          ? 'text-white font-semibold'
                          : 'text-[color:var(--text-muted)] font-medium hover:text-[color:var(--text-secondary)] hover:bg-white/[0.035]',
                      )}
                    >
                      <div className={cn(
                        'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
                        active
                          ? 'bg-gradient-to-br from-[#A78BFA] to-[#7877C6] text-white shadow-[0_2px_8px_rgba(120,119,198,0.5)]'
                          : 'bg-white/[0.04] text-[color:var(--text-muted)] group-hover:bg-white/[0.08]',
                      )}>
                        <Icon size={13.5} strokeWidth={2.2} />
                      </div>
                      <span className="flex-1 tracking-tight">{item.label}</span>
                      {item.count != null && (
                        <span className={cn(
                          'text-[0.62rem] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center tabular-nums',
                          active
                            ? 'bg-white/20 text-white'
                            : 'bg-white/[0.06] text-[color:var(--text-muted)]',
                        )}>
                          {item.count}
                        </span>
                      )}
                    </div>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom: workspace + user */}
      <div className="p-2.5 border-t border-white/[0.05] flex-shrink-0 space-y-1.5">
        <button className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[12px] bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.1] transition-colors group">
          <div className="w-[22px] h-[22px] rounded-md flex-shrink-0 bg-gradient-to-br from-[#7877C6] to-[#63E6BE] flex items-center justify-center ring-1 ring-white/20 shadow-sm">
            <span className="text-[0.56rem] font-bold text-white tracking-wider">MT</span>
          </div>
          <span className="text-[0.78rem] font-semibold text-[color:var(--text-secondary)] flex-1 text-left truncate">Master Team</span>
          <ChevronsUpDown size={12} className="text-[color:var(--text-faint)] group-hover:text-[color:var(--text-muted)]" />
        </button>

        <button className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[12px] hover:bg-white/[0.04] transition-colors">
          <div className="relative flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7877C6] to-[#63E6BE] flex items-center justify-center text-[0.66rem] font-bold text-white ring-2 ring-white/10 shadow-[0_2px_8px_rgba(120,119,198,0.35)]">KA</div>
            <Circle size={9} fill="#34D399" className="absolute bottom-0 right-0 text-[#34D399] ring-2 ring-[#07080F] rounded-full" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-[0.78rem] font-semibold text-[color:var(--text-secondary)] truncate leading-tight">Khalil Abu Mushref</div>
            <div className="text-[0.62rem] text-[color:var(--text-faint)] mt-0.5 truncate">Sr. Business Analyst</div>
          </div>
        </button>

        <a
          href="https://khalil-am.com"
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center pt-2 pb-1 text-[0.6rem] text-[color:var(--text-faint)] hover:text-[color:var(--text-muted)] transition-colors tracking-wide"
        >
          Powered by <span className="font-bold text-[color:var(--text-muted)]">Khalil-am</span>
        </a>
      </div>
    </aside>
  );
}
