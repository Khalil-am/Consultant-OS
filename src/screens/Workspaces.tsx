import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Grid3X3, List, FileText, Video, CheckSquare, ChevronRight } from 'lucide-react';
import { workspaces } from '../data/mockData';
import { useLayout } from '../hooks/useLayout';

const filterTabs = ['All', 'Client', 'Project', 'Internal', 'Procurement', 'Committee'];

const sectorColors: Record<string, string> = {
  Government: '#0EA5E9',
  Energy: '#F59E0B',
  Healthcare: '#10B981',
  Infrastructure: '#8B5CF6',
  'Financial Services': '#F59E0B',
  Internal: '#94A3B8',
  Retail: '#EC4899',
};

const langColors: Record<string, { bg: string; text: string; border: string }> = {
  EN: { bg: 'rgba(14,165,233,0.1)', text: '#38BDF8', border: 'rgba(14,165,233,0.2)' },
  AR: { bg: 'rgba(139,92,246,0.1)', text: '#A78BFA', border: 'rgba(139,92,246,0.2)' },
  Bilingual: { bg: 'rgba(16,185,129,0.1)', text: '#34D399', border: 'rgba(16,185,129,0.2)' },
};

const avatarColors = [
  'linear-gradient(135deg, #0EA5E9, #8B5CF6)',
  'linear-gradient(135deg, #10B981, #0EA5E9)',
  'linear-gradient(135deg, #F59E0B, #EF4444)',
  'linear-gradient(135deg, #8B5CF6, #EC4899)',
  'linear-gradient(135deg, #06B6D4, #10B981)',
];

export default function Workspaces() {
  const navigate = useNavigate();
  const { width, isMobile } = useLayout();
  const [activeFilter, setActiveFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filtered = workspaces.filter(ws => {
    const matchFilter = activeFilter === 'All' || ws.type === activeFilter;
    const matchSearch = ws.name.toLowerCase().includes(search.toLowerCase()) ||
      ws.client.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const statCols = width >= 768 ? 4 : 2;
  const gridCols = width >= 1100 ? 3 : width >= 700 ? 2 : 1;

  return (
    <div style={{ padding: isMobile ? '0.875rem' : '1.5rem', display: 'flex', flexDirection: 'column', gap: isMobile ? '0.875rem' : '1.25rem' }}>
      {/* Header Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${statCols}, 1fr)`, gap: '0.875rem' }}>
        {[
          { label: 'Total Workspaces', value: '8', color: '#0EA5E9' },
          { label: 'Active Clients', value: '6', color: '#10B981' },
          { label: 'Total Documents', value: '1,040', color: '#8B5CF6' },
          { label: 'Open Tasks', value: '127', color: '#F59E0B' },
        ].map(stat => (
          <div key={stat.label} className="metric-card" style={{ padding: '1rem' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '2px' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        {/* Filter Tabs */}
        <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(255,255,255,0.03)', padding: '0.25rem', borderRadius: '0.625rem', border: '1px solid rgba(255,255,255,0.06)' }}>
          {filterTabs.map(tab => (
            <button
              key={tab}
              className={`tab-item ${activeFilter === tab ? 'active' : ''}`}
              onClick={() => setActiveFilter(tab)}
              style={{ padding: '0.375rem 0.875rem', fontSize: '0.8rem' }}
            >
              {tab}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {/* Search */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0 0.75rem',
              height: '36px',
              borderRadius: '0.5rem',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              width: '240px',
            }}
          >
            <Search size={14} style={{ color: '#475569' }} />
            <input
              type="text"
              placeholder="Search workspaces..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '0.8rem', color: '#F1F5F9', width: '100%', fontFamily: 'inherit' }}
            />
          </div>

          {/* View toggle */}
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button
              className={viewMode === 'grid' ? 'btn-primary' : 'btn-ghost'}
              style={{ padding: '0.375rem 0.625rem', width: '34px', height: '34px' }}
              onClick={() => setViewMode('grid')}
            >
              <Grid3X3 size={14} />
            </button>
            <button
              className={viewMode === 'list' ? 'btn-primary' : 'btn-ghost'}
              style={{ padding: '0.375rem 0.625rem', width: '34px', height: '34px' }}
              onClick={() => setViewMode('list')}
            >
              <List size={14} />
            </button>
          </div>

          <button className="btn-primary" style={{ height: '36px' }}>
            <Plus size={15} />
            New Workspace
          </button>
        </div>
      </div>

      {/* Grid */}
      <div style={{
        display: viewMode === 'grid' ? 'grid' : 'flex',
        gridTemplateColumns: viewMode === 'grid' ? `repeat(${gridCols}, 1fr)` : undefined,
        flexDirection: viewMode === 'list' ? 'column' : undefined,
        gap: '1rem',
      }}>
        {filtered.map((ws) => (
          <div
            key={ws.id}
            className="section-card"
            style={{ cursor: 'pointer', overflow: 'hidden' }}
            onClick={() => navigate(`/workspaces/${ws.id}`)}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'}
          >
            {/* Card Top Strip */}
            <div style={{
              height: '4px',
              background: `linear-gradient(90deg, ${sectorColors[ws.sector] || '#0EA5E9'}, transparent)`,
            }} />

            <div style={{ padding: '1.125rem' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div style={{ flex: 1, minWidth: 0, paddingRight: '0.5rem' }}>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#F1F5F9', margin: 0, marginBottom: '3px', lineHeight: 1.3 }}>
                    {ws.name}
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: '#475569', margin: 0 }}>{ws.client}</p>
                </div>
                <ChevronRight size={14} style={{ color: '#334155', flexShrink: 0, marginTop: '3px' }} />
              </div>

              {/* Tags Row */}
              <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '0.875rem' }}>
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  padding: '2px 7px',
                  borderRadius: '4px',
                  background: `${sectorColors[ws.sector]}18`,
                  color: sectorColors[ws.sector],
                  border: `1px solid ${sectorColors[ws.sector]}30`,
                }}>
                  {ws.sector}
                </span>
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  padding: '2px 7px',
                  borderRadius: '4px',
                  background: langColors[ws.language].bg,
                  color: langColors[ws.language].text,
                  border: `1px solid ${langColors[ws.language].border}`,
                }}>
                  {ws.language}
                </span>
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  padding: '2px 7px',
                  borderRadius: '4px',
                  background: 'rgba(148,163,184,0.08)',
                  color: '#94A3B8',
                  border: '1px solid rgba(148,163,184,0.12)',
                }}>
                  {ws.type}
                </span>
              </div>

              {/* Progress */}
              <div style={{ marginBottom: '0.875rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                  <span style={{ fontSize: '0.72rem', color: '#475569' }}>Progress</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#F1F5F9' }}>{ws.progress}%</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${ws.progress}%`,
                      background: ws.progress >= 80 ? 'linear-gradient(90deg, #059669, #10B981)' :
                        ws.progress >= 50 ? 'linear-gradient(90deg, #0EA5E9, #00D4FF)' :
                          'linear-gradient(90deg, #F59E0B, #FCD34D)',
                    }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.875rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <FileText size={12} style={{ color: '#475569' }} />
                  <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{ws.docsCount}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Video size={12} style={{ color: '#475569' }} />
                  <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{ws.meetingsCount}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <CheckSquare size={12} style={{ color: '#475569' }} />
                  <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{ws.tasksCount}</span>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <span className={ws.status === 'Active' ? 'status-active' : 'status-pending'} style={{ fontSize: '0.65rem' }}>
                    {ws.status}
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {/* Avatar Stack */}
                <div style={{ display: 'flex' }}>
                  {ws.contributors.slice(0, 4).map((c, i) => (
                    <div
                      key={i}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '9999px',
                        background: avatarColors[i % avatarColors.length],
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        color: 'white',
                        border: '2px solid #0D1527',
                        marginLeft: i > 0 ? '-6px' : 0,
                      }}
                    >
                      {c}
                    </div>
                  ))}
                  {ws.contributors.length > 4 && (
                    <div style={{
                      width: '24px', height: '24px', borderRadius: '9999px',
                      background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: '#94A3B8',
                      border: '2px solid #0D1527', marginLeft: '-6px',
                    }}>
                      +{ws.contributors.length - 4}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: '0.68rem', color: '#334155' }}>{ws.lastActivity}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
