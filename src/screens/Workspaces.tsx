import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Grid3X3, List, FileText, Video, CheckSquare, ChevronRight, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { workspaces, workspaceFinancials, ragStatusData } from '../data/mockData';
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

const RAG_COLORS: Record<string, string> = {
  Green: '#10B981',
  Amber: '#F59E0B',
  Red: '#EF4444',
};

function fmtAED(val: number): string {
  if (val >= 1000000) return `AED ${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `AED ${(val / 1000).toFixed(0)}K`;
  return `AED ${val.toLocaleString()}`;
}

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

  const gridCols = width >= 1200 ? 3 : width >= 768 ? 2 : 1;

  // Totals
  const totalContract = workspaceFinancials.reduce((s, w) => s + w.contractValue, 0);
  const totalSpent = workspaceFinancials.reduce((s, w) => s + w.spent, 0);
  const totalVariance = workspaceFinancials.reduce((s, w) => s + w.variance, 0);
  const milestoneDue = 6;

  return (
    <div style={{ padding: isMobile ? '0.875rem' : '1.5rem', display: 'flex', flexDirection: 'column', gap: isMobile ? '0.875rem' : '1.25rem' }}>

      {/* Portfolio Summary Banner */}
      <div className="portfolio-banner">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.65rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.375rem' }}>
              Portfolio Overview
            </div>
            <div style={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 900, color: '#F1F5F9', lineHeight: 1, letterSpacing: '-0.02em' }}>
              {fmtAED(totalContract)}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.375rem' }}>
              8 active engagements · Portfolio health score <span style={{ color: '#10B981', fontWeight: 700 }}>87%</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            {[
              { label: 'Revenue Recognized', value: fmtAED(totalSpent), color: '#10B981' },
              { label: 'Budget Variance', value: (totalVariance > 0 ? '+' : '') + fmtAED(totalVariance), color: totalVariance > 0 ? '#EF4444' : '#10B981' },
              { label: 'Last Updated', value: '13 Mar 2026', color: '#94A3B8' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.65rem', color: '#475569', marginBottom: '2px' }}>{s.label}</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Financial Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${width >= 768 ? 4 : 2}, 1fr)`, gap: '0.875rem' }}>
        {[
          { label: 'Total Contract Value', value: fmtAED(totalContract), icon: <DollarSign size={16} />, color: '#00D4FF', trend: '+12%', trendUp: true },
          { label: 'Revenue Recognized', value: fmtAED(totalSpent), icon: <TrendingUp size={16} />, color: '#10B981', trend: '+8%', trendUp: true },
          { label: 'Budget Variance', value: (totalVariance > 0 ? '+' : '') + fmtAED(totalVariance), icon: <TrendingDown size={16} />, color: totalVariance > 0 ? '#EF4444' : '#10B981', trend: totalVariance > 0 ? 'Over Budget' : 'Under Budget', trendUp: totalVariance <= 0 },
          { label: 'Milestones Due (30d)', value: `AED 3.5M`, icon: <CheckSquare size={16} />, color: '#F59E0B', trend: `${milestoneDue} milestones`, trendUp: true },
        ].map(stat => (
          <div key={stat.label} className="metric-card" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${stat.color}, transparent)` }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div style={{ padding: '0.45rem', borderRadius: '8px', background: `${stat.color}15`, color: stat.color }}>
                {stat.icon}
              </div>
              <span style={{ fontSize: '0.65rem', fontWeight: 600, color: stat.trendUp ? '#34D399' : '#FCA5A5' }}>{stat.trend}</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#F1F5F9', lineHeight: 1, letterSpacing: '-0.02em' }}>{stat.value}</div>
            <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '0.25rem' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(255,255,255,0.03)', padding: '0.25rem', borderRadius: '0.625rem', border: '1px solid rgba(255,255,255,0.06)', overflowX: 'auto' }}>
          {filterTabs.map(tab => (
            <button key={tab} className={`tab-item ${activeFilter === tab ? 'active' : ''}`} onClick={() => setActiveFilter(tab)} style={{ padding: '0.375rem 0.875rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
              {tab}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 0.75rem', height: '36px', borderRadius: '0.5rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', width: '220px' }}>
            <Search size={14} style={{ color: '#475569' }} />
            <input type="text" placeholder="Search workspaces..." value={search} onChange={e => setSearch(e.target.value)} style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '0.8rem', color: '#F1F5F9', width: '100%', fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button className={viewMode === 'grid' ? 'btn-primary' : 'btn-ghost'} style={{ padding: '0.375rem 0.625rem', width: '34px', height: '34px' }} onClick={() => setViewMode('grid')}>
              <Grid3X3 size={14} />
            </button>
            <button className={viewMode === 'list' ? 'btn-primary' : 'btn-ghost'} style={{ padding: '0.375rem 0.625rem', width: '34px', height: '34px' }} onClick={() => setViewMode('list')}>
              <List size={14} />
            </button>
          </div>
          <button className="btn-primary" style={{ height: '36px' }}>
            <Plus size={15} /> New Workspace
          </button>
        </div>
      </div>

      {/* Grid / List */}
      <div style={{ display: viewMode === 'grid' ? 'grid' : 'flex', gridTemplateColumns: viewMode === 'grid' ? `repeat(${gridCols}, 1fr)` : undefined, flexDirection: viewMode === 'list' ? 'column' : undefined, gap: '1rem' }}>
        {filtered.map((ws) => {
          const fin = workspaceFinancials.find(f => f.workspaceId === ws.id);
          const rag = ragStatusData.find(r => r.workspace === ws.name);
          const spentPct = fin ? Math.round((fin.spent / fin.contractValue) * 100) : null;
          const sectorColor = sectorColors[ws.sector] || '#0EA5E9';
          const spentBarColor = spentPct !== null ? (spentPct >= 95 ? '#EF4444' : spentPct >= 80 ? '#F59E0B' : '#10B981') : '#0EA5E9';

          return (
            <div key={ws.id} className="section-card" style={{ cursor: 'pointer', overflow: 'hidden' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${sectorColor}40`; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
            >
              {/* Colored accent strip */}
              <div style={{ height: '4px', background: `linear-gradient(90deg, ${sectorColor}, ${sectorColor}40)` }} />

              <div style={{ padding: '1.125rem' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.625rem' }}>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: '0.5rem' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#F1F5F9', margin: 0, marginBottom: '3px', lineHeight: 1.3 }}>{ws.name}</h3>
                    <p style={{ fontSize: '0.75rem', color: '#475569', margin: 0 }}>{ws.client}</p>
                  </div>
                  <ChevronRight size={14} style={{ color: '#334155', flexShrink: 0, marginTop: '3px' }} />
                </div>

                {/* Tags */}
                <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '0.875rem' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '2px 7px', borderRadius: '4px', background: `${sectorColor}18`, color: sectorColor, border: `1px solid ${sectorColor}30` }}>{ws.sector}</span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '2px 7px', borderRadius: '4px', background: langColors[ws.language].bg, color: langColors[ws.language].text, border: `1px solid ${langColors[ws.language].border}` }}>{ws.language}</span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '2px 7px', borderRadius: '4px', background: 'rgba(148,163,184,0.08)', color: '#94A3B8', border: '1px solid rgba(148,163,184,0.12)' }}>{ws.type}</span>
                </div>

                {/* Financial Row */}
                {fin && (
                  <div style={{ marginBottom: '0.875rem', padding: '0.625rem', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                      <span style={{ fontSize: '0.68rem', color: '#475569' }}>Contract Value</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#F59E0B' }}>{fmtAED(fin.contractValue)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                      <span style={{ fontSize: '0.65rem', color: '#475569' }}>Spent {spentPct}%</span>
                      <span style={{ fontSize: '0.65rem', color: fin.variance <= 0 ? '#34D399' : '#FCA5A5', fontWeight: 600 }}>
                        {fin.variance === 0 ? 'On Budget' : (fin.variance > 0 ? '+' : '') + fmtAED(fin.variance) + ' variance'}
                      </span>
                    </div>
                    <div style={{ height: '4px', borderRadius: '9999px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${spentPct}%`, background: `linear-gradient(90deg, ${spentBarColor}, ${spentBarColor}cc)`, borderRadius: '9999px', transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                )}

                {/* RAG Indicators */}
                {rag && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.875rem', flexWrap: 'wrap' }}>
                    {[['Overall', rag.rag], ['Budget', rag.budget], ['Schedule', rag.schedule], ['Risk', rag.risk]].map(([label, status]) => (
                      <div key={label as string} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: RAG_COLORS[status as string], boxShadow: `0 0 4px ${RAG_COLORS[status as string]}80` }} />
                        <span style={{ fontSize: '0.62rem', color: '#475569' }}>{label as string}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Progress Bar */}
                <div style={{ marginBottom: '0.875rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                    <span style={{ fontSize: '0.72rem', color: '#475569' }}>Delivery Progress</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#F1F5F9' }}>{ws.progress}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${ws.progress}%`, background: ws.progress >= 80 ? 'linear-gradient(90deg, #059669, #10B981)' : ws.progress >= 50 ? 'linear-gradient(90deg, #0EA5E9, #00D4FF)' : 'linear-gradient(90deg, #F59E0B, #FCD34D)' }} />
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
                    <span className={ws.status === 'Active' ? 'status-active' : 'status-pending'} style={{ fontSize: '0.62rem' }}>{ws.status}</span>
                  </div>
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex' }}>
                    {ws.contributors.slice(0, 4).map((c, i) => (
                      <div key={i} style={{ width: '24px', height: '24px', borderRadius: '9999px', background: avatarColors[i % avatarColors.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: 'white', border: '2px solid #0D1527', marginLeft: i > 0 ? '-6px' : 0 }}>
                        {c}
                      </div>
                    ))}
                    {ws.contributors.length > 4 && (
                      <div style={{ width: '24px', height: '24px', borderRadius: '9999px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: '#94A3B8', border: '2px solid #0D1527', marginLeft: '-6px' }}>
                        +{ws.contributors.length - 4}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: '0.65rem', color: '#334155' }}>{ws.lastActivity}</span>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.875rem', paddingTop: '0.875rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <button className="btn-primary" style={{ flex: 2, height: '30px', fontSize: '0.72rem', justifyContent: 'center' }} onClick={(e) => { e.stopPropagation(); navigate(`/workspaces/${ws.id}`); }}>
                    Open Workspace
                  </button>
                  <button className="btn-ghost" style={{ flex: 1, height: '30px', fontSize: '0.72rem', justifyContent: 'center' }} onClick={(e) => { e.stopPropagation(); navigate(`/workspaces/${ws.id}`); }}>
                    Financials
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
