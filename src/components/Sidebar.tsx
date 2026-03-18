import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Briefcase, Zap, FileText, Video,
  CheckSquare, BarChart3, Sparkles, Settings, X,
} from 'lucide-react';
import { useLayout } from '../hooks/useLayout';

const navSections = [
  {
    section: 'MAIN',
    items: [
      { label: 'Home', icon: LayoutDashboard, path: '/' },
      { label: 'Workspaces', icon: Briefcase, path: '/workspaces' },
      { label: 'Automations', icon: Zap, path: '/automations' },
    ],
  },
  {
    section: 'WORK',
    items: [
      { label: 'Documents', icon: FileText, path: '/documents' },
      { label: 'Meetings', icon: Video, path: '/meetings' },
      { label: 'Tasks & Risks', icon: CheckSquare, path: '/tasks' },
      { label: 'Reports', icon: BarChart3, path: '/reports' },
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

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleNavClick = () => { if (isTablet) setSidebarOpen(false); };

  const sidebarStyle: React.CSSProperties = isTablet
    ? {
        position: 'fixed', top: 0, left: 0, height: '100dvh',
        width: '248px', zIndex: 50,
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column',
        background: '#0A0F1C',
        borderRight: '1px solid rgba(255,255,255,0.05)',
      }
    : {
        width: '240px', minWidth: '240px',
        display: 'flex', flexDirection: 'column',
        height: '100vh', position: 'sticky', top: 0, overflow: 'hidden',
        background: '#0A0F1C',
        borderRight: '1px solid rgba(255,255,255,0.05)',
      };

  return (
    <aside style={sidebarStyle}>
      {/* Logo area */}
      <div style={{
        padding: '1.125rem 1rem',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
            background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 0 1px rgba(0,212,255,0.15), 0 0 16px rgba(0,212,255,0.2)',
          }}>
            <img src="/favicon.png" alt="logo" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.875rem', color: '#F1F5F9', lineHeight: 1.2, letterSpacing: '-0.01em' }}>
              Consultant OS
            </div>
            <div style={{ fontSize: '0.62rem', color: '#334155', marginTop: '2px', letterSpacing: '0.03em' }}>
              AI-Powered Platform
            </div>
          </div>
        </div>
        {isTablet && (
          <button
            onClick={() => setSidebarOpen(false)}
            style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '8px', width: '30px', height: '30px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569',
            }}
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 0.625rem' }}>
        {navSections.map((section, si) => (
          <div key={section.section} style={{ marginBottom: si < navSections.length - 1 ? '1.25rem' : 0 }}>
            <div style={{
              padding: '0 0.625rem', marginBottom: '0.375rem',
              fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.1em', color: '#2D3B55',
            }}>
              {section.section}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              {section.items.map((item) => {
                const active = isActive(item.path);
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    onClick={handleNavClick}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.625rem',
                      padding: '0.4375rem 0.75rem',
                      borderRadius: '9px',
                      fontSize: '0.82rem',
                      fontWeight: active ? 600 : 500,
                      textDecoration: 'none',
                      transition: 'all 0.15s cubic-bezier(0.4,0,0.2,1)',
                      position: 'relative',
                      color: active ? '#00D4FF' : '#4A5568',
                      background: active
                        ? 'linear-gradient(135deg, rgba(0,212,255,0.1) 0%, rgba(14,165,233,0.05) 100%)'
                        : 'transparent',
                      border: active
                        ? '1px solid rgba(0,212,255,0.13)'
                        : '1px solid transparent',
                      boxShadow: active ? '0 1px 0 rgba(0,212,255,0.05) inset' : 'none',
                    }}
                    onMouseEnter={e => {
                      if (!active) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                        e.currentTarget.style.color = '#94A3B8';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!active) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#4A5568';
                        e.currentTarget.style.borderColor = 'transparent';
                      }
                    }}
                  >
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '7px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      background: active ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.04)',
                      transition: 'all 0.15s',
                    }}>
                      <Icon size={14} style={{ color: active ? '#00D4FF' : '#4A5568' }} />
                    </div>
                    <span>{item.label}</span>
                    {active && (
                      <div style={{
                        marginLeft: 'auto', width: '5px', height: '5px', borderRadius: '9999px',
                        background: '#00D4FF', boxShadow: '0 0 8px rgba(0,212,255,0.7)',
                        flexShrink: 0,
                      }} />
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom — user + workspace */}
      <div style={{ padding: '0.625rem', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        {/* Workspace chip */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.5rem 0.625rem', borderRadius: '9px',
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
          cursor: 'pointer', marginBottom: '0.375rem', transition: 'all 0.15s',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
        >
          <div style={{
            width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
            background: 'linear-gradient(135deg, #0EA5E9, #8B5CF6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: '0.58rem', fontWeight: 800, color: 'white', letterSpacing: '0.02em' }}>MT</span>
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Master Team
          </span>
          <svg width="10" height="10" viewBox="0 0 10 10" style={{ color: '#334155', flexShrink: 0 }}>
            <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </div>

        {/* User row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.625rem',
          padding: '0.5rem 0.625rem', borderRadius: '9px', cursor: 'pointer', transition: 'all 0.15s',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <div style={{
            width: '30px', height: '30px', borderRadius: '9999px', flexShrink: 0,
            background: 'linear-gradient(135deg, #0EA5E9, #8B5CF6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.65rem', fontWeight: 800, color: 'white', letterSpacing: '0.03em',
            boxShadow: '0 0 0 2px rgba(0,212,255,0.2)',
          }}>
            KA
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#94A3B8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Khalil Abu Mushref
            </div>
            <div style={{ fontSize: '0.62rem', color: '#334155', marginTop: '1px' }}>Sr. Business Analyst</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '9999px', background: '#10B981', boxShadow: '0 0 6px rgba(16,185,129,0.6)' }} />
          </div>
        </div>

        {/* Footer */}
        <a
          href="https://khalil-am.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block', textAlign: 'center', padding: '0.5rem 0', marginTop: '0.5rem',
            fontSize: '0.6rem', color: '#334155', textDecoration: 'none',
            letterSpacing: '0.04em', transition: 'color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#64748B')}
          onMouseLeave={e => (e.currentTarget.style.color = '#334155')}
        >
          Powered by <span style={{ fontWeight: 700, color: '#475569' }}>Khalil-am</span>
        </a>
      </div>
    </aside>
  );
}
