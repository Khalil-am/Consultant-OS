import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Bell, Sparkles, Plus, ChevronDown, Menu, X, FileText, Video, CheckSquare, BarChart3, Zap } from 'lucide-react';
import { useLayout } from '../hooks/useLayout';

const pageTitles: Record<string, string> = {
  '/': 'Command Center',
  '/workspaces': 'Workspaces',
  '/automations': 'Automations',
  '/documents': 'Documents',
  '/meetings': 'Meetings',
  '/tasks': 'Tasks & Risks',
  '/reports': 'Reports',
  '/knowledge': 'Knowledge Base',
  '/templates': 'Templates',
  '/admin': 'Admin',
};

const pageSubtitles: Record<string, string> = {
  '/': 'Good morning, Ahmed — here\'s what needs your attention',
  '/workspaces': '8 active workspaces across 6 clients',
  '/automations': '14 automations • 1,284 runs this month',
  '/documents': '847 documents processed • 12 pending review',
  '/meetings': '3 upcoming this week',
  '/tasks': '127 tasks • 12 overdue • 19 risks tracked',
  '/reports': '8 reports generated this month',
  '/knowledge': 'Semantic search across all workspace knowledge',
  '/templates': '12 templates available',
  '/admin': 'System configuration and user management',
};

const newMenuItems = [
  { icon: <FileText size={14} />, label: 'New Document', path: '/documents' },
  { icon: <Video size={14} />, label: 'New Meeting', path: '/meetings' },
  { icon: <CheckSquare size={14} />, label: 'New Task', path: '/tasks' },
  { icon: <BarChart3 size={14} />, label: 'New Report', path: '/reports' },
  { icon: <Zap size={14} />, label: 'Run Automation', path: '/automations' },
];

const notifications = [
  { id: 1, title: 'BRD Generator completed', detail: 'NCA Digital Transformation • 3 outputs', time: '2h ago', color: '#10B981', read: false },
  { id: 2, title: 'Risk Alert: Smart City PMO', detail: '2 unmitigated critical risks flagged', time: '4h ago', color: '#EF4444', read: false },
  { id: 3, title: 'Approval needed', detail: 'SC-10 Budget AED 2.4M awaiting review', time: '5h ago', color: '#F59E0B', read: false },
  { id: 4, title: 'Meeting minutes ready', detail: 'Banking Core Transformation • Generated', time: '1d ago', color: '#8B5CF6', read: true },
  { id: 5, title: 'Weekly digest ready', detail: '4 workspaces • Executive summary', time: '1d ago', color: '#0EA5E9', read: true },
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
    const path = location.pathname;
    if (path.startsWith('/workspaces/')) return 'Workspace Detail';
    if (path.startsWith('/automations/')) return 'Automation Builder';
    if (path.startsWith('/documents/')) return 'Document Detail';
    if (path.startsWith('/meetings/')) return 'Meeting Detail';
    return pageTitles[path] || 'Consultant OS';
  };

  const getSubtitle = () => {
    const path = location.pathname;
    if (path !== '/' && (path.includes('/') && path.split('/').length > 2)) return null;
    return pageSubtitles[path] || null;
  };

  const unreadCount = notifications.filter(n => !readIds.includes(n.id)).length;

  const markAllRead = () => setReadIds(notifications.map(n => n.id));

  return (
    <header style={{
      height: isMobile ? '56px' : '64px',
      background: '#0A0F1E',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: isMobile ? '0 0.875rem' : '0 1.5rem',
      position: 'sticky', top: 0, zIndex: 40, flexShrink: 0, gap: '0.75rem',
    }}>

      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
        {isTablet && (
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px', width: '34px', height: '34px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#94A3B8',
            }}
          >
            <Menu size={17} />
          </button>
        )}
        {(!isMobile || !showSearch) && (
          <div style={{ minWidth: 0, flex: isTablet ? 1 : 'unset' }}>
            <h1 style={{ fontSize: isMobile ? '0.9rem' : '1rem', fontWeight: 700, color: '#F1F5F9', margin: 0, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {getTitle()}
            </h1>
            {!isTablet && getSubtitle() && (
              <p style={{ fontSize: '0.72rem', color: '#475569', margin: 0 }}>{getSubtitle()}</p>
            )}
          </div>
        )}
      </div>

      {/* Center: Search — hidden on mobile unless expanded */}
      {!isMobile ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0 0.75rem', borderRadius: '0.5rem',
          background: searchFocused ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)',
          border: searchFocused ? '1px solid rgba(0,212,255,0.3)' : '1px solid rgba(255,255,255,0.06)',
          transition: 'all 0.2s',
          width: isTablet ? '200px' : '300px', height: '36px', flexShrink: 0,
        }}>
          <Search size={14} style={{ color: '#475569', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search..."
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              fontSize: '0.8rem', color: '#F1F5F9', width: '100%', fontFamily: 'inherit',
            }}
          />
          {!isTablet && (
            <div style={{
              fontSize: '0.65rem', color: '#334155', background: 'rgba(255,255,255,0.05)',
              padding: '1px 5px', borderRadius: '3px', flexShrink: 0, border: '1px solid rgba(255,255,255,0.06)',
            }}>⌘K</div>
          )}
        </div>
      ) : showSearch ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0 0.75rem', borderRadius: '0.5rem', flex: 1,
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,212,255,0.3)', height: '36px',
        }}>
          <Search size={14} style={{ color: '#475569' }} />
          <input
            autoFocus
            type="text"
            placeholder="Search..."
            onBlur={() => setShowSearch(false)}
            style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '0.8rem', color: '#F1F5F9', width: '100%', fontFamily: 'inherit' }}
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
            width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8',
          }}>
            <Search size={15} />
          </button>
        )}

        {/* New button — hide label on mobile */}
        <div style={{ position: 'relative' }}>
          <button
            className="btn-ghost"
            onClick={() => { setShowNewMenu(v => !v); setShowNotifications(false); }}
            style={{ height: '34px', padding: isMobile ? '0 0.5rem' : '0 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
          >
            <Plus size={14} />
            {!isMobile && <><span>New</span><ChevronDown size={12} /></>}
          </button>
          {showNewMenu && (
            <div style={{
              position: 'absolute', right: 0, top: 'calc(100% + 6px)', width: '190px',
              background: '#0D1527', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
              padding: '0.375rem', zIndex: 100, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}>
              {newMenuItems.map(item => (
                <button
                  key={item.label}
                  onClick={() => { navigate(item.path); setShowNewMenu(false); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '0.625rem',
                    padding: '0.5rem 0.75rem', borderRadius: '6px', background: 'none',
                    border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '0.8rem',
                    fontFamily: 'inherit', transition: 'all 0.15s', textAlign: 'left',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#F1F5F9'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#94A3B8'; }}
                >
                  <span style={{ color: '#475569' }}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Ask AI */}
        <button
          className="btn-ai"
          onClick={() => navigate('/knowledge')}
          style={{ height: '34px', padding: isMobile ? '0 0.625rem' : '0 0.875rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
        >
          <Sparkles size={14} />
          {!isMobile && <span>Ask AI</span>}
        </button>

        {/* Notifications */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => { setShowNotifications(v => !v); setShowNewMenu(false); }}
            style={{
              position: 'relative', width: '34px', height: '34px', borderRadius: '0.5rem',
              background: showNotifications ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
            }}
          >
            <Bell size={15} style={{ color: '#94A3B8' }} />
            {unreadCount > 0 && (
              <div style={{
                position: 'absolute', top: '5px', right: '5px', width: '8px', height: '8px',
                borderRadius: '9999px', background: '#EF4444', border: '2px solid #0A0F1E',
              }} />
            )}
          </button>

          {showNotifications && (
            <div style={{
              position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: '340px',
              background: '#0D1527', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
              zIndex: 100, boxShadow: '0 16px 48px rgba(0,0,0,0.6)', overflow: 'hidden',
              maxWidth: 'calc(100vw - 1rem)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Notifications</span>
                  {unreadCount > 0 && (
                    <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '9999px', background: 'rgba(239,68,68,0.2)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.3)' }}>
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <button onClick={markAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.72rem', color: '#0EA5E9', fontFamily: 'inherit' }}>
                  Mark all read
                </button>
              </div>
              <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                {notifications.map((n, i) => (
                  <div
                    key={n.id}
                    onClick={() => setReadIds(prev => [...prev, n.id])}
                    style={{
                      display: 'flex', gap: '0.75rem', padding: '0.75rem 1rem', cursor: 'pointer',
                      borderBottom: i < notifications.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      background: readIds.includes(n.id) ? 'transparent' : 'rgba(14,165,233,0.04)',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = readIds.includes(n.id) ? 'transparent' : 'rgba(14,165,233,0.04)')}
                  >
                    <div style={{ width: '8px', height: '8px', borderRadius: '9999px', background: n.color, marginTop: '5px', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: readIds.includes(n.id) ? 400 : 600, color: '#F1F5F9', marginBottom: '2px' }}>{n.title}</div>
                      <div style={{ fontSize: '0.72rem', color: '#475569', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.detail}</div>
                      <div style={{ fontSize: '0.68rem', color: '#334155' }}>{n.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User avatar — desktop only */}
        {!isMobile && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0.5rem',
            borderRadius: '0.5rem', cursor: 'pointer', transition: 'all 0.2s',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <div className="avatar" style={{ width: '28px', height: '28px', fontSize: '0.65rem' }}>AM</div>
            <ChevronDown size={12} style={{ color: '#475569' }} />
          </div>
        )}
      </div>
    </header>
  );
}
