import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Briefcase, Zap, FileText, Video,
  CheckSquare, BarChart3, Brain, Layout, Settings,
  ChevronDown, X,
} from 'lucide-react';
import { useLayout } from '../hooks/useLayout';

const navSections = [
  {
    section: 'MAIN',
    items: [
      { label: 'Home', icon: <LayoutDashboard size={16} />, path: '/' },
      { label: 'Workspaces', icon: <Briefcase size={16} />, path: '/workspaces' },
      { label: 'Automations', icon: <Zap size={16} />, path: '/automations' },
    ],
  },
  {
    section: 'WORK',
    items: [
      { label: 'Documents', icon: <FileText size={16} />, path: '/documents' },
      { label: 'Meetings', icon: <Video size={16} />, path: '/meetings' },
      { label: 'Tasks & Risks', icon: <CheckSquare size={16} />, path: '/tasks' },
      { label: 'Reports', icon: <BarChart3 size={16} />, path: '/reports' },
    ],
  },
  {
    section: 'KNOWLEDGE',
    items: [
      { label: 'Knowledge Base', icon: <Brain size={16} />, path: '/knowledge' },
      { label: 'Templates', icon: <Layout size={16} />, path: '/templates' },
    ],
  },
  {
    section: 'SYSTEM',
    items: [
      { label: 'Admin', icon: <Settings size={16} />, path: '/admin' },
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

  const handleNavClick = () => {
    if (isTablet) setSidebarOpen(false);
  };

  const sidebarStyle: React.CSSProperties = isTablet
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100dvh',
        width: '260px',
        zIndex: 50,
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
        background: '#0D1527',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
      }
    : {
        width: '260px',
        minWidth: '260px',
        background: '#0D1527',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
        overflow: 'hidden',
      };

  return (
    <aside style={sidebarStyle}>
      {/* Logo */}
      <div style={{ padding: '1.25rem 1rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0, overflow: 'hidden',
            background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 14px rgba(0,212,255,0.25)',
          }}>
            <img
              src="/favicon.png"
              alt="Consultant OS icon"
              style={{ width: '34px', height: '34px', objectFit: 'contain' }}
            />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#F1F5F9', lineHeight: 1.2 }}>Consultant OS</div>
            <div style={{ fontSize: '0.65rem', color: '#475569', marginTop: '1px' }}>AI-Powered Workspace</div>
          </div>
        </div>
        {isTablet && (
          <button
            onClick={() => setSidebarOpen(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '4px', borderRadius: '6px' }}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
        {navSections.map((section) => (
          <div key={section.section} style={{ marginBottom: '1rem' }}>
            <div className="sidebar-section-label">{section.section}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              {section.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={handleNavClick}
                  className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                  end={item.path === '/'}
                >
                  <span style={{ opacity: isActive(item.path) ? 1 : 0.6 }}>{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Panel */}
      <div style={{ padding: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.5rem 0.625rem', borderRadius: '0.5rem',
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
          cursor: 'pointer', marginBottom: '0.5rem', transition: 'all 0.2s',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '20px', height: '20px', borderRadius: '4px', flexShrink: 0,
              background: 'linear-gradient(135deg, #0EA5E9, #8B5CF6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'white' }}>AC</span>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#94A3B8' }}>Accel Consulting</span>
          </div>
          <ChevronDown size={12} style={{ color: '#475569' }} />
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.625rem',
          padding: '0.5rem 0.625rem', borderRadius: '0.5rem', cursor: 'pointer', transition: 'all 0.2s',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <div className="avatar" style={{ width: '30px', height: '30px', flexShrink: 0 }}>AM</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#F1F5F9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Ahmed Al-Mahmoud
            </div>
            <div style={{ fontSize: '0.65rem', color: '#475569' }}>Senior Manager</div>
          </div>
          <div style={{ width: '8px', height: '8px', borderRadius: '9999px', background: '#10B981', flexShrink: 0 }} />
        </div>
      </div>
    </aside>
  );
}
