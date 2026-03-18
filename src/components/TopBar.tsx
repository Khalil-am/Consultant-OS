import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Bell, Sparkles, Plus, ChevronDown, Menu, X, FileText, Video, CheckSquare, BarChart3, Zap } from 'lucide-react';
import { useLayout } from '../hooks/useLayout';

const pageMeta: Record<string, { title: string; sub: string }> = {
  '/':            { title: 'Command Center',    sub: 'Good morning, Khalil — here\'s what needs your attention' },
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
  { icon: FileText,    label: 'New Document',   path: '/documents' },
  { icon: Video,       label: 'New Meeting',    path: '/meetings' },
  { icon: CheckSquare, label: 'New Task',       path: '/tasks' },
  { icon: BarChart3,   label: 'New Report',     path: '/reports' },
  { icon: Zap,         label: 'Run Automation', path: '/automations' },
];

const notifications = [
  { id: 1, title: 'BRD Generator completed',     detail: 'NCA Digital Transformation · 3 outputs',         time: '2h ago',  color: '#10B981', read: false },
  { id: 2, title: 'Risk Alert: Smart City PMO',  detail: '2 unmitigated critical risks flagged',            time: '4h ago',  color: '#EF4444', read: false },
  { id: 3, title: 'Approval needed',             detail: 'SC-10 Budget SAR 2.4M awaiting review',          time: '5h ago',  color: '#F59E0B', read: false },
  { id: 4, title: 'Meeting minutes ready',        detail: 'Banking Core Transformation · Generated',         time: '1d ago',  color: '#8B5CF6', read: true },
  { id: 5, title: 'Weekly digest ready',          detail: '4 workspaces · Executive summary',               time: '1d ago',  color: '#0EA5E9', read: true },
];

export default function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setSidebarOpen, isMobile, isTablet } = useLayout();
  const [searchFocused, setSearchFocused] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [readIds, setReadIds] = useState<number[]>([4, 5]);
  const [showSearch, setShowSearch] = useState(false);

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
    <header style={{
      height: isMobile ? '56px' : '60px',
      background: 'rgba(8,12,24,0.95)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: isMobile ? '0 0.875rem' : '0 1.375rem',
      position: 'sticky', top: 0, zIndex: 40, flexShrink: 0, gap: '0.75rem',
    }}>

      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
        {isTablet && (
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '9px', width: '34px', height: '34px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#94A3B8',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}
          >
            <Menu size={16} />
          </button>
        )}
        {(!isMobile || !showSearch) && (
          <div style={{ minWidth: 0 }}>
            <h1 style={{
              fontSize: isMobile ? '0.9rem' : '0.975rem', fontWeight: 700, color: '#F1F5F9',
              margin: 0, lineHeight: 1.2, letterSpacing: '-0.01em',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {getTitle()}
            </h1>
            {!isTablet && getSubtitle() && (
              <p style={{ fontSize: '0.7rem', color: '#334155', margin: 0, marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {getSubtitle()}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Center search */}
      {!isMobile ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0 0.75rem', borderRadius: '10px',
          background: searchFocused ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
          border: searchFocused ? '1px solid rgba(0,212,255,0.3)' : '1px solid rgba(255,255,255,0.06)',
          transition: 'all 0.2s',
          width: isTablet ? '180px' : '280px', height: '34px', flexShrink: 0,
          boxShadow: searchFocused ? '0 0 0 3px rgba(0,212,255,0.07)' : 'none',
        }}>
          <Search size={13} style={{ color: searchFocused ? '#64748B' : '#334155', flexShrink: 0, transition: 'color 0.2s' }} />
          <input
            type="text" placeholder="Search workspaces, docs, tasks…"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '0.78rem', color: '#F1F5F9', width: '100%', fontFamily: 'inherit' }}
          />
          {!isTablet && (
            <kbd style={{
              fontSize: '0.6rem', color: '#334155',
              background: 'rgba(255,255,255,0.04)', padding: '1px 5px', borderRadius: '4px',
              flexShrink: 0, border: '1px solid rgba(255,255,255,0.06)',
              fontFamily: 'inherit', letterSpacing: '0.02em',
            }}>⌘K</kbd>
          )}
        </div>
      ) : showSearch ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0 0.75rem', borderRadius: '10px', flex: 1,
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,212,255,0.3)', height: '34px',
        }}>
          <Search size={13} style={{ color: '#64748B' }} />
          <input autoFocus type="text" placeholder="Search…"
            onBlur={() => setShowSearch(false)}
            style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '0.78rem', color: '#F1F5F9', width: '100%', fontFamily: 'inherit' }}
          />
          <button onClick={() => setShowSearch(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 0 }}>
            <X size={14} />
          </button>
        </div>
      ) : null}

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
        {isMobile && !showSearch && (
          <button onClick={() => setShowSearch(true)} style={{
            width: '34px', height: '34px', borderRadius: '9px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8',
          }}>
            <Search size={14} />
          </button>
        )}

        {/* New menu */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => { setShowNewMenu(v => !v); setShowNotifications(false); }}
            style={{
              height: '34px', padding: isMobile ? '0 0.5rem' : '0 0.75rem',
              fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer',
              background: showNewMenu ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
              color: '#94A3B8', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '9px', display: 'flex', alignItems: 'center', gap: '0.375rem',
              transition: 'all 0.15s', fontFamily: 'inherit',
            }}
            onMouseEnter={e => { if (!showNewMenu) { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#F1F5F9'; } }}
            onMouseLeave={e => { if (!showNewMenu) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#94A3B8'; } }}
          >
            <Plus size={14} />
            {!isMobile && <><span>New</span><ChevronDown size={11} style={{ opacity: 0.6 }} /></>}
          </button>
          {showNewMenu && (
            <div style={{
              position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: '196px',
              background: '#0C1220', border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: '12px', padding: '0.375rem', zIndex: 100,
              boxShadow: '0 16px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.1)',
              animation: 'scaleIn 0.15s ease-out forwards',
            }}>
              {newMenuItems.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    onClick={() => { navigate(item.path); setShowNewMenu(false); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '0.625rem',
                      padding: '0.5rem 0.75rem', borderRadius: '8px',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#64748B', fontSize: '0.8rem', fontFamily: 'inherit',
                      transition: 'all 0.12s', textAlign: 'left',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#F1F5F9'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#64748B'; }}
                  >
                    <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={12} />
                    </div>
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Ask AI */}
        <button
          onClick={() => navigate('/ask-ai')}
          style={{
            height: '34px', padding: isMobile ? '0 0.625rem' : '0 0.875rem',
            fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', border: 'none',
            background: 'linear-gradient(135deg, #7C3AED, #8B5CF6)',
            color: '#F5F3FF', borderRadius: '9px',
            display: 'flex', alignItems: 'center', gap: '0.375rem',
            boxShadow: '0 0 16px rgba(139,92,246,0.25)',
            transition: 'all 0.15s', fontFamily: 'inherit',
          }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 24px rgba(139,92,246,0.4)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 0 16px rgba(139,92,246,0.25)'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          <Sparkles size={13} />
          {!isMobile && <span>Ask AI</span>}
        </button>

        {/* Notifications */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => { setShowNotifications(v => !v); setShowNewMenu(false); }}
            style={{
              width: '34px', height: '34px', borderRadius: '9px',
              background: showNotifications ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s', position: 'relative',
            }}
            onMouseEnter={e => { if (!showNotifications) e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
            onMouseLeave={e => { if (!showNotifications) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
          >
            <Bell size={14} style={{ color: '#94A3B8' }} />
            {unread > 0 && (
              <div style={{
                position: 'absolute', top: '6px', right: '6px',
                width: '7px', height: '7px', borderRadius: '9999px',
                background: '#EF4444', border: '2px solid #080C18',
                boxShadow: '0 0 6px rgba(239,68,68,0.6)',
              }} />
            )}
          </button>

          {showNotifications && (
            <div style={{
              position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: '340px',
              background: '#0C1220', border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: '14px', zIndex: 100,
              boxShadow: '0 20px 56px rgba(0,0,0,0.65)',
              overflow: 'hidden', maxWidth: 'calc(100vw - 1rem)',
              animation: 'scaleIn 0.15s ease-out forwards',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#F1F5F9' }}>Notifications</span>
                  {unread > 0 && (
                    <span style={{ fontSize: '0.62rem', padding: '1px 6px', borderRadius: '9999px', background: 'rgba(239,68,68,0.15)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.25)', fontWeight: 600 }}>
                      {unread} new
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setReadIds(notifications.map(n => n.id))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.72rem', color: '#0EA5E9', fontFamily: 'inherit', fontWeight: 500 }}
                >
                  Mark all read
                </button>
              </div>
              <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                {notifications.map((n, i) => (
                  <div
                    key={n.id}
                    onClick={() => setReadIds(prev => [...prev, n.id])}
                    style={{
                      display: 'flex', gap: '0.875rem', padding: '0.8125rem 1rem', cursor: 'pointer',
                      borderBottom: i < notifications.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      background: readIds.includes(n.id) ? 'transparent' : 'rgba(14,165,233,0.03)',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = readIds.includes(n.id) ? 'transparent' : 'rgba(14,165,233,0.03)')}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', paddingTop: '3px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '9999px', background: n.color, flexShrink: 0, boxShadow: `0 0 6px ${n.color}60` }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: readIds.includes(n.id) ? 400 : 600, color: '#F1F5F9', marginBottom: '2px', lineHeight: 1.3 }}>{n.title}</div>
                      <div style={{ fontSize: '0.72rem', color: '#475569', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.detail}</div>
                      <div style={{ fontSize: '0.67rem', color: '#2D3B55', fontWeight: 500 }}>{n.time}</div>
                    </div>
                    {!readIds.includes(n.id) && (
                      <div style={{ width: '6px', height: '6px', borderRadius: '9999px', background: '#0EA5E9', flexShrink: 0, marginTop: '4px' }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User avatar */}
        {!isMobile && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.25rem 0.4375rem 0.25rem 0.25rem',
            borderRadius: '9999px', cursor: 'pointer', transition: 'all 0.15s',
            border: '1px solid transparent',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
          >
            <div style={{
              width: '27px', height: '27px', borderRadius: '9999px', flexShrink: 0,
              background: 'linear-gradient(135deg, #0EA5E9, #8B5CF6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.6rem', fontWeight: 800, color: 'white',
              boxShadow: '0 0 0 2px rgba(14,165,233,0.2)',
            }}>
              KA
            </div>
            <ChevronDown size={11} style={{ color: '#334155' }} />
          </div>
        )}
      </div>
    </header>
  );
}
