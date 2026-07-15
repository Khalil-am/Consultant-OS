import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Search, Bell, Sparkles, Plus, ChevronDown, Menu, X,
  FileText, Video, CheckSquare, BarChart3, Zap, Command,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLayout } from '../hooks/useLayout';
import { cn } from './ui/cn';

const pageMeta: Record<string, { title: string; sub: string }> = {
  '/':            { title: 'Command Center',    sub: "Good morning, Khalil — here's what needs your attention" },
  '/workspaces':  { title: 'Workspaces',         sub: '8 active workspaces across 6 clients' },
  '/automations': { title: 'Automations',        sub: '14 automations · 1,284 runs this month' },
  '/documents':   { title: 'Documents',          sub: 'All workspace documents in one place' },
  '/meetings':    { title: 'Meetings',           sub: '3 upcoming this week' },
  '/tasks':       { title: 'Tasks & Risks',      sub: '127 tasks · 19 risks tracked' },
  '/reports':     { title: 'Reports',            sub: '8 reports generated this month' },
  '/ask-ai':      { title: 'Ask AI',             sub: 'Powered by advanced AI models' },
  '/admin':       { title: 'Admin',              sub: 'System configuration and user management' },
};

const newMenuItems = [
  { icon: FileText,    label: 'New Document',   path: '/documents',  accent: 'from-[#7877C6] to-[#A78BFA]' },
  { icon: Video,       label: 'New Meeting',    path: '/meetings',   accent: 'from-[#38BDF8] to-[#7DD3FC]' },
  { icon: CheckSquare, label: 'New Task',       path: '/tasks',      accent: 'from-[#34D399] to-[#63E6BE]' },
  { icon: BarChart3,   label: 'New Report',     path: '/reports',    accent: 'from-[#F5B544] to-[#FDCE78]' },
  { icon: Zap,         label: 'Run Automation', path: '/automations',accent: 'from-[#A78BFA] to-[#63E6BE]' },
];

interface NotificationItem {
  id: number;
  title: string;
  detail: string;
  time: string;
  color: string;
  read: boolean;
}

const notifications: NotificationItem[] = [
  { id: 1, title: 'BRD Generator completed',    detail: 'NCA Digital Transformation · 3 outputs',    time: '2h ago', color: '#34D399', read: false },
  { id: 2, title: 'Risk Alert: Smart City PMO', detail: '2 unmitigated critical risks flagged',      time: '4h ago', color: '#FF6B6B', read: false },
  { id: 3, title: 'Approval needed',            detail: 'SC-10 Budget SAR 2.4M awaiting review',     time: '5h ago', color: '#F5B544', read: false },
  { id: 4, title: 'Meeting minutes ready',       detail: 'Banking Core Transformation · Generated',   time: '1d ago', color: '#A78BFA', read: true },
  { id: 5, title: 'Weekly digest ready',         detail: '4 workspaces · Executive summary',         time: '1d ago', color: '#63E6BE', read: true },
];

export default function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setSidebarOpen, isMobile, isTablet } = useLayout();
  const [searchFocused, setSearchFocused] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [readIds, setReadIds] = useState<number[]>([4, 5]);
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Cmd-K to focus search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isMobile) setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') {
        setShowNotifications(false);
        setShowNewMenu(false);
        setShowUserMenu(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobile]);

  const getTitle = () => {
    const p = location.pathname;
    if (p.startsWith('/workspaces/'))  return 'Workspace Detail';
    if (p.startsWith('/automations/')) return 'Automation Builder';
    if (p.startsWith('/documents/'))   return 'Document Detail';
    if (p.startsWith('/meetings/'))    return 'Meeting Detail';
    return pageMeta[p]?.title ?? 'Consultant OS';
  };

  const getSubtitle = () => {
    const p = location.pathname;
    if (p !== '/' && p.split('/').length > 2) return null;
    return pageMeta[p]?.sub ?? null;
  };

  const unread = notifications.filter(n => !readIds.includes(n.id)).length;

  return (
    <header
      className={cn(
        'sticky top-0 z-40 flex items-center justify-between gap-3 flex-shrink-0',
        'h-[68px] px-4 md:px-6',
        'bg-[rgba(7,8,15,0.72)] backdrop-blur-xl backdrop-saturate-[140%]',
        'border-b border-white/[0.06]',
        isMobile && 'h-[58px]',
      )}
    >
      {/* Left */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {isTablet && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center flex-shrink-0 text-[color:var(--text-muted)] hover:bg-white/[0.08] hover:text-[color:var(--text-primary)] transition-colors"
          >
            <Menu size={16} />
          </button>
        )}
        {(!isMobile || !showSearch) && (
          <div className="min-w-0">
            <h1 className={cn('font-bold text-[color:var(--text-primary)] tracking-tight leading-tight truncate', isMobile ? 'text-[0.95rem]' : 'text-[1.05rem]')}>
              {getTitle()}
            </h1>
            {!isTablet && getSubtitle() && (
              <p className="text-[0.72rem] text-[color:var(--text-muted)] truncate mt-0.5">{getSubtitle()}</p>
            )}
          </div>
        )}
      </div>

      {/* Center search */}
      {!isMobile ? (
        <div
          className={cn(
            'relative flex items-center gap-2 rounded-full transition-all flex-shrink-0 backdrop-blur-md',
            'w-[300px] md:w-[360px] h-[38px] px-3.5',
            searchFocused
              ? 'bg-[rgba(120,119,198,0.07)] border border-[rgba(120,119,198,0.4)] shadow-[0_0_0_3px_rgba(120,119,198,0.12),0_8px_24px_rgba(120,119,198,0.12)]'
              : 'bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.055]',
          )}
        >
          <Search size={14} className={cn('flex-shrink-0 transition-colors', searchFocused ? 'text-[#A78BFA]' : 'text-[color:var(--text-muted)]')} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search workspaces, docs, tasks…"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="flex-1 bg-transparent border-0 outline-none text-[0.83rem] text-[color:var(--text-primary)] placeholder:text-[color:var(--text-faint)] min-w-0"
          />
          <kbd className="flex items-center gap-1 text-[0.62rem] font-semibold text-[color:var(--text-muted)] bg-white/[0.05] px-1.5 py-0.5 rounded border border-white/[0.08] flex-shrink-0">
            <Command size={9} />K
          </kbd>
        </div>
      ) : showSearch ? (
        <div className="flex items-center gap-2 rounded-full flex-1 bg-[rgba(120,119,198,0.07)] border border-[rgba(120,119,198,0.4)] h-[38px] px-3.5">
          <Search size={14} className="text-[#A78BFA]" />
          <input
            autoFocus ref={searchInputRef}
            type="text" placeholder="Search…"
            onBlur={() => setShowSearch(false)}
            className="flex-1 bg-transparent border-0 outline-none text-[0.83rem] text-[color:var(--text-primary)] placeholder:text-[color:var(--text-faint)]"
          />
          <button onClick={() => setShowSearch(false)} className="text-[color:var(--text-muted)]">
            <X size={15} />
          </button>
        </div>
      ) : null}

      {/* Right actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {isMobile && !showSearch && (
          <button
            onClick={() => setShowSearch(true)}
            className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[color:var(--text-muted)]"
          >
            <Search size={15} />
          </button>
        )}

        {/* New menu */}
        <div className="relative">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => { setShowNewMenu(v => !v); setShowNotifications(false); setShowUserMenu(false); }}
            className={cn(
              'h-[38px] flex items-center gap-1.5 px-3 md:px-4 rounded-full border text-[0.81rem] font-medium transition-colors',
              showNewMenu
                ? 'bg-white/[0.09] border-white/[0.15] text-[color:var(--text-primary)]'
                : 'bg-white/[0.04] border-white/[0.08] text-[color:var(--text-secondary)] hover:bg-white/[0.07] hover:text-[color:var(--text-primary)]',
            )}
          >
            <Plus size={14} />
            {!isMobile && <>New<ChevronDown size={11} className={cn('opacity-60 transition-transform', showNewMenu && 'rotate-180')} /></>}
          </motion.button>
          <AnimatePresence>
            {showNewMenu && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="absolute right-0 top-[calc(100%+10px)] w-[240px] rounded-2xl p-2 z-[100] glass-elevated shadow-[var(--shadow-lg)]"
              >
                {newMenuItems.map(item => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      onClick={() => { navigate(item.path); setShowNewMenu(false); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[0.82rem] text-[color:var(--text-secondary)] hover:bg-white/[0.05] hover:text-white transition-colors group"
                    >
                      <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br text-white shadow-sm', item.accent)}>
                        <Icon size={13} strokeWidth={2.4} />
                      </div>
                      <span className="flex-1 text-left font-medium">{item.label}</span>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Ask AI */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          whileHover={{ y: -1 }}
          onClick={() => navigate('/ask-ai')}
          className="h-[38px] flex items-center gap-1.5 px-3 md:px-4 rounded-full font-semibold text-[0.82rem] text-white relative overflow-hidden bg-gradient-to-br from-[#7877C6] via-[#A78BFA] to-[#63E6BE] shadow-[0_4px_16px_rgba(120,119,198,0.4),inset_0_1px_0_rgba(255,255,255,0.25)] ring-1 ring-white/20 hover:shadow-[0_8px_28px_rgba(120,119,198,0.55),inset_0_1px_0_rgba(255,255,255,0.35)] transition-shadow"
        >
          <Sparkles size={13} className="drop-shadow-sm" />
          {!isMobile && <span className="relative">Ask AI</span>}
        </motion.button>

        {/* Notifications */}
        <div className="relative">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => { setShowNotifications(v => !v); setShowNewMenu(false); setShowUserMenu(false); }}
            className={cn(
              'w-[38px] h-[38px] rounded-full border flex items-center justify-center transition-colors relative',
              showNotifications
                ? 'bg-white/[0.09] border-white/[0.15]'
                : 'bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.07]',
            )}
          >
            <Bell size={15} className="text-[color:var(--text-muted)]" />
            {unread > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-[7px] right-[7px] w-2 h-2 rounded-full bg-[#FF6B6B] ring-2 ring-[#07080F] shadow-[0_0_8px_rgba(255,107,107,0.8)]"
              />
            )}
          </motion.button>
          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="absolute right-0 top-[calc(100%+10px)] w-[380px] max-w-[calc(100vw-1rem)] rounded-2xl z-[100] glass-elevated overflow-hidden shadow-[var(--shadow-xl)]"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <span className="text-[0.9rem] font-bold text-[color:var(--text-primary)]">Notifications</span>
                    {unread > 0 && (
                      <span className="text-[0.62rem] font-bold px-1.5 py-0.5 rounded-full bg-[rgba(255,107,107,0.15)] text-[#FCA5A5] border border-[rgba(255,107,107,0.25)]">
                        {unread} new
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setReadIds(notifications.map(n => n.id))}
                    className="text-[0.72rem] font-semibold text-[#A78BFA] hover:text-[#C4B5FD] transition-colors"
                  >
                    Mark all read
                  </button>
                </div>
                <div className="max-h-[400px] overflow-y-auto">
                  {notifications.map((n, i) => {
                    const isRead = readIds.includes(n.id);
                    return (
                      <motion.button
                        key={n.id}
                        onClick={() => setReadIds(prev => [...prev, n.id])}
                        whileHover={{ backgroundColor: 'rgba(120,119,198,0.06)' }}
                        className={cn(
                          'w-full flex gap-3 px-4 py-3 text-left transition-colors',
                          i < notifications.length - 1 && 'border-b border-white/[0.04]',
                          !isRead && 'bg-[rgba(120,119,198,0.04)]',
                        )}
                      >
                        <div className="pt-1 flex-shrink-0">
                          <div className="w-2 h-2 rounded-full" style={{ background: n.color, boxShadow: `0 0 8px ${n.color}80` }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={cn('text-[0.82rem] text-[color:var(--text-primary)] leading-snug mb-0.5', !isRead ? 'font-semibold' : 'font-normal')}>{n.title}</div>
                          <div className="text-[0.72rem] text-[color:var(--text-muted)] truncate mb-0.5">{n.detail}</div>
                          <div className="text-[0.65rem] text-[color:var(--text-faint)] font-medium">{n.time}</div>
                        </div>
                        {!isRead && <div className="w-1.5 h-1.5 rounded-full bg-[#A78BFA] flex-shrink-0 mt-1.5" />}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User avatar */}
        {!isMobile && (
          <div className="relative">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => { setShowUserMenu(v => !v); setShowNotifications(false); setShowNewMenu(false); }}
              className={cn(
                'flex items-center gap-2 pl-1 pr-3 py-1 rounded-full transition-colors border',
                showUserMenu
                  ? 'bg-white/[0.08] border-white/[0.12]'
                  : 'border-transparent hover:bg-white/[0.04] hover:border-white/[0.08]',
              )}
            >
              <div className="w-[30px] h-[30px] rounded-full bg-gradient-to-br from-[#7877C6] to-[#63E6BE] flex items-center justify-center text-[0.66rem] font-bold text-white ring-2 ring-[rgba(120,119,198,0.35)] shadow-[0_2px_8px_rgba(120,119,198,0.4)]">KA</div>
              <ChevronDown size={12} className={cn('text-[color:var(--text-muted)] transition-transform', showUserMenu && 'rotate-180')} />
            </motion.button>
            <AnimatePresence>
              {showUserMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute right-0 top-[calc(100%+10px)] w-[260px] rounded-2xl z-[100] glass-elevated overflow-hidden shadow-[var(--shadow-lg)]"
                >
                  <div className="p-4 border-b border-white/[0.06] flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#7877C6] to-[#63E6BE] flex items-center justify-center text-[0.82rem] font-bold text-white ring-2 ring-[rgba(120,119,198,0.35)]">KA</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[0.85rem] font-bold text-[color:var(--text-primary)] truncate">Khalil Abu Mushref</div>
                      <div className="text-[0.7rem] text-[color:var(--text-muted)] truncate">Sr. Business Analyst</div>
                    </div>
                  </div>
                  <div className="p-1.5">
                    {[
                      { label: 'Settings', path: '/admin' },
                      { label: 'Keyboard shortcuts', path: '#' },
                      { label: 'Help & support', path: '#' },
                    ].map(item => (
                      <button
                        key={item.label}
                        onClick={() => { if (item.path !== '#') navigate(item.path); setShowUserMenu(false); }}
                        className="w-full text-left px-3 py-2 rounded-xl text-[0.82rem] text-[color:var(--text-secondary)] hover:bg-white/[0.05] hover:text-white transition-colors"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </header>
  );
}
