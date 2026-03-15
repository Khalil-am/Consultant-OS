import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, Bell, Sparkles, Plus, ChevronDown } from 'lucide-react';

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
  '/automations': '14 automations running • 1,284 runs this month',
  '/documents': '847 documents processed • 12 pending review',
  '/meetings': '3 upcoming this week',
  '/tasks': '127 total tasks • 12 overdue • 19 risks tracked',
  '/reports': '8 reports generated this month',
  '/knowledge': 'Semantic search across all workspace knowledge',
  '/templates': '12 templates available',
  '/admin': 'System configuration and user management',
};

export default function TopBar() {
  const location = useLocation();
  const [searchFocused, setSearchFocused] = useState(false);

  const getTitle = () => {
    const path = location.pathname;
    // Check for sub-routes
    if (path.startsWith('/workspaces/')) return 'Workspace Detail';
    if (path.startsWith('/automations/')) return 'Automation Builder';
    if (path.startsWith('/documents/')) return 'Document Detail';
    if (path.startsWith('/meetings/')) return 'Meeting Detail';
    return pageTitles[path] || 'Consultant OS';
  };

  const getSubtitle = () => {
    const path = location.pathname;
    if (path.startsWith('/workspaces/') || path.startsWith('/automations/') || path.startsWith('/documents/') || path.startsWith('/meetings/')) {
      return null;
    }
    return pageSubtitles[path] || null;
  };

  return (
    <header
      style={{
        height: '64px',
        background: '#0A0F1E',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.5rem',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        flexShrink: 0,
      }}
    >
      {/* Left: Page Title */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
        <h1 style={{ fontSize: '1rem', fontWeight: 700, color: '#F1F5F9', margin: 0, lineHeight: 1.2 }}>
          {getTitle()}
        </h1>
        {getSubtitle() && (
          <p style={{ fontSize: '0.72rem', color: '#475569', margin: 0 }}>{getSubtitle()}</p>
        )}
      </div>

      {/* Center: Search */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0 0.75rem',
          borderRadius: '0.5rem',
          background: searchFocused ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)',
          border: searchFocused ? '1px solid rgba(0, 212, 255, 0.3)' : '1px solid rgba(255,255,255,0.06)',
          transition: 'all 0.2s',
          width: '320px',
          height: '36px',
        }}
      >
        <Search size={14} style={{ color: '#475569', flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Search documents, meetings, tasks..."
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: '0.8rem',
            color: '#F1F5F9',
            width: '100%',
            fontFamily: 'inherit',
          }}
        />
        <div
          style={{
            fontSize: '0.65rem',
            color: '#334155',
            background: 'rgba(255,255,255,0.05)',
            padding: '1px 5px',
            borderRadius: '3px',
            flexShrink: 0,
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          ⌘K
        </div>
      </div>

      {/* Right: Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {/* New Button */}
        <button
          className="btn-ghost"
          style={{ height: '34px', padding: '0 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
        >
          <Plus size={14} />
          <span>New</span>
          <ChevronDown size={12} />
        </button>

        {/* Ask AI */}
        <button
          className="btn-ai"
          style={{ height: '34px', padding: '0 0.875rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
        >
          <Sparkles size={14} />
          <span>Ask AI</span>
        </button>

        {/* Notifications */}
        <button
          style={{
            position: 'relative',
            width: '34px',
            height: '34px',
            borderRadius: '0.5rem',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
        >
          <Bell size={15} style={{ color: '#94A3B8' }} />
          <div
            style={{
              position: 'absolute',
              top: '6px',
              right: '6px',
              width: '8px',
              height: '8px',
              borderRadius: '9999px',
              background: '#EF4444',
              border: '2px solid #0A0F1E',
            }}
          />
        </button>

        {/* User Avatar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.25rem 0.5rem',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <div
            className="avatar"
            style={{ width: '28px', height: '28px', fontSize: '0.65rem' }}
          >
            AM
          </div>
          <ChevronDown size={12} style={{ color: '#475569' }} />
        </div>
      </div>
    </header>
  );
}
