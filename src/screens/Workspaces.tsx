import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Grid3X3, List, FileText, Video, CheckSquare, ChevronRight, TrendingUp, TrendingDown, DollarSign, RefreshCw, X, AlertCircle } from 'lucide-react';
import { useLayout } from '../hooks/useLayout';
import {
  getWorkspaces, getWorkspaceFinancials, getWorkspaceRagStatuses, createWorkspace,
  upsertWorkspaceFinancial,
  type WorkspaceRow, type WorkspaceFinancialRow, type WorkspaceRagStatusRow,
} from '../lib/db';

const filterTabs = ['All', 'Client', 'Project', 'Internal', 'Procurement', 'Committee'];

const sectorColors: Record<string, string> = {
  Government: '#0EA5E9', Energy: '#F59E0B', Healthcare: '#10B981',
  Infrastructure: '#8B5CF6', 'Financial Services': '#F59E0B', Internal: '#94A3B8', Retail: '#EC4899',
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

const RAG_COLORS: Record<string, string> = { Green: '#10B981', Amber: '#F59E0B', Red: '#EF4444' };

function fmtAED(val: number): string {
  if (val >= 1_000_000) return `AED ${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `AED ${(val / 1_000).toFixed(0)}K`;
  return `AED ${val.toLocaleString()}`;
}

function LoadingSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="section-card" style={{ padding: '1.25rem', overflow: 'hidden' }}>
          <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', marginBottom: '1rem', borderRadius: 2 }} />
          <div style={{ height: '16px', width: '70%', background: 'rgba(255,255,255,0.06)', borderRadius: 4, marginBottom: 8 }} />
          <div style={{ height: '12px', width: '45%', background: 'rgba(255,255,255,0.04)', borderRadius: 4, marginBottom: 16 }} />
          <div style={{ height: '60px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, marginBottom: 12 }} />
          <div style={{ height: '8px', background: 'rgba(255,255,255,0.04)', borderRadius: 9999 }} />
        </div>
      ))}
    </div>
  );
}

const SECTORS = ['Government', 'Energy', 'Healthcare', 'Infrastructure', 'Financial Services', 'Retail', 'Technology', 'Education', 'Internal'];
const TYPES = ['Client', 'Project', 'Internal', 'Procurement', 'Committee'] as const;
const LANGUAGES = ['EN', 'AR', 'Bilingual'] as const;

interface NewWorkspaceForm {
  name: string; client: string; sector: string; type: typeof TYPES[number];
  language: typeof LANGUAGES[number]; description: string;
}

const defaultForm: NewWorkspaceForm = {
  name: '', client: '', sector: 'Government', type: 'Client', language: 'EN', description: '',
};

export default function Workspaces() {
  const navigate = useNavigate();
  const { width, isMobile } = useLayout();

  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [financials, setFinancials] = useState<WorkspaceFinancialRow[]>([]);
  const [ragData, setRagData] = useState<WorkspaceRagStatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [activeFilter, setActiveFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [showNewModal, setShowNewModal] = useState(false);
  const [form, setForm] = useState<NewWorkspaceForm>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [ws, fin, rag] = await Promise.all([
        getWorkspaces(),
        getWorkspaceFinancials(),
        getWorkspaceRagStatuses(),
      ]);
      setWorkspaces(ws);
      setFinancials(fin);
      setRagData(rag);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Failed to load workspaces');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = workspaces.filter(ws => {
    const matchFilter = activeFilter === 'All' || ws.type === activeFilter;
    const matchSearch = ws.name.toLowerCase().includes(search.toLowerCase()) ||
      ws.client.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const gridCols = width >= 1200 ? 3 : width >= 768 ? 2 : 1;

  const totalContract = financials.reduce((s, f) => s + f.contract_value, 0);
  const totalSpent = financials.reduce((s, f) => s + f.spent, 0);
  const totalVariance = financials.reduce((s, f) => s + f.variance, 0);

  const handleCreateWorkspace = async () => {
    if (!form.name.trim() || !form.client.trim()) {
      setFormError('Name and client are required.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const id = `ws-${Date.now()}`;
      const sectorColor = sectorColors[form.sector] ?? '#0EA5E9';
      const newWs = await createWorkspace({
        id, name: form.name.trim(), client: form.client.trim(),
        sector: form.sector, sector_color: sectorColor, type: form.type,
        language: form.language, progress: 0, status: 'Active',
        docs_count: 0, meetings_count: 0, tasks_count: 0,
        contributors: [], last_activity: 'Just now',
        description: form.description.trim(),
      });
      // Create default financial record
      await upsertWorkspaceFinancial({
        id: `fin-${Date.now()}`, workspace_id: newWs.id,
        contract_value: 0, spent: 0, forecast: 0, variance: 0,
        currency: 'AED', billing_model: 'Fixed Fee', last_invoice: '', next_milestone_value: 0,
      });
      setShowNewModal(false);
      setForm(defaultForm);
      await loadData(true);
    } catch (e: unknown) {
      setFormError((e as Error).message ?? 'Failed to create workspace');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: isMobile ? '0.875rem' : '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <div style={{ width: 20, height: 20, border: '2px solid #0EA5E9', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: '0.85rem', color: '#475569' }}>Loading workspaces…</span>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: isMobile ? '0.875rem' : '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', paddingTop: '4rem' }}>
        <AlertCircle size={40} style={{ color: '#EF4444' }} />
        <div style={{ fontSize: '0.9rem', color: '#FCA5A5', fontWeight: 600 }}>Failed to load workspaces</div>
        <div style={{ fontSize: '0.78rem', color: '#475569', maxWidth: '400px', textAlign: 'center' }}>{error}</div>
        <button className="btn-primary" onClick={() => loadData()}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ padding: isMobile ? '0.875rem' : '1.5rem', display: 'flex', flexDirection: 'column', gap: isMobile ? '0.875rem' : '1.25rem' }}>

      {/* Banner */}
      <div className="portfolio-banner">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.65rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.375rem' }}>Client Engagement Overview</div>
            <div style={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 900, color: '#F1F5F9', lineHeight: 1, letterSpacing: '-0.02em' }}>{fmtAED(totalContract)}</div>
            <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.375rem' }}>
              {workspaces.filter(w => w.status === 'Active').length} active engagements · Health score{' '}
              <span style={{ color: '#10B981', fontWeight: 700 }}>
                {Math.round((ragData.filter(r => r.rag === 'Green').length / Math.max(ragData.length, 1)) * 100)}%
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {[
              { label: 'Revenue Recognized', value: fmtAED(totalSpent), color: '#10B981' },
              { label: 'Budget Variance', value: (totalVariance > 0 ? '+' : '') + fmtAED(Math.abs(totalVariance)), color: totalVariance > 0 ? '#EF4444' : '#10B981' },
              { label: 'Last Refreshed', value: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), color: '#94A3B8' },
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
          { label: 'Total Contract Value', value: fmtAED(totalContract), icon: <DollarSign size={16} />, color: '#00D4FF', trend: `${workspaces.length} engagements`, trendUp: true },
          { label: 'Revenue Recognized', value: fmtAED(totalSpent), icon: <TrendingUp size={16} />, color: '#10B981', trend: `${totalContract > 0 ? Math.round((totalSpent / totalContract) * 100) : 0}% collected`, trendUp: true },
          { label: 'Budget Variance', value: (totalVariance > 0 ? '+' : '') + fmtAED(Math.abs(totalVariance)), icon: <TrendingDown size={16} />, color: totalVariance > 0 ? '#EF4444' : '#10B981', trend: totalVariance > 0 ? 'Over Budget' : 'Under Budget', trendUp: totalVariance <= 0 },
          { label: 'Milestones Due (30d)', value: `${financials.reduce((s, f) => s + (f.next_milestone_value > 0 ? 1 : 0), 0)}`, icon: <CheckSquare size={16} />, color: '#F59E0B', trend: fmtAED(financials.reduce((s, f) => s + f.next_milestone_value, 0)) + ' gate value', trendUp: true },
        ].map(stat => (
          <div key={stat.label} className="metric-card" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${stat.color}, transparent)` }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div style={{ padding: '0.45rem', borderRadius: '8px', background: `${stat.color}15`, color: stat.color }}>{stat.icon}</div>
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
              {tab !== 'All' && <span style={{ marginLeft: '4px', fontSize: '0.65rem', color: '#475569' }}>({workspaces.filter(w => w.type === tab).length})</span>}
              {tab === 'All' && <span style={{ marginLeft: '4px', fontSize: '0.65rem', color: '#475569' }}>({workspaces.length})</span>}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 0.75rem', height: '36px', borderRadius: '0.5rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', width: isMobile ? '100%' : '220px' }}>
            <Search size={14} style={{ color: '#475569' }} />
            <input type="text" placeholder="Search workspaces…" value={search} onChange={e => setSearch(e.target.value)} style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '0.8rem', color: '#F1F5F9', width: '100%', fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button className={viewMode === 'grid' ? 'btn-primary' : 'btn-ghost'} style={{ padding: '0.375rem 0.625rem', width: '34px', height: '34px' }} onClick={() => setViewMode('grid')}><Grid3X3 size={14} /></button>
            <button className={viewMode === 'list' ? 'btn-primary' : 'btn-ghost'} style={{ padding: '0.375rem 0.625rem', width: '34px', height: '34px' }} onClick={() => setViewMode('list')}><List size={14} /></button>
          </div>
          <button className="btn-ghost" style={{ height: '36px', width: '36px', padding: '0.375rem' }} onClick={() => loadData(true)} title="Refresh">
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
          </button>
          <button className="btn-primary" style={{ height: '36px' }} onClick={() => setShowNewModal(true)}>
            <Plus size={15} /> New Workspace
          </button>
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && !loading && (
        <div style={{ padding: '4rem', textAlign: 'center', color: '#475569' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>No workspaces found</div>
          <div style={{ fontSize: '0.78rem' }}>{search ? `No results for "${search}"` : 'Create your first workspace to get started'}</div>
        </div>
      )}

      {/* Grid / List */}
      <div style={{
        display: viewMode === 'grid' ? 'grid' : 'flex',
        gridTemplateColumns: viewMode === 'grid' ? `repeat(${gridCols}, 1fr)` : undefined,
        flexDirection: viewMode === 'list' ? 'column' : undefined,
        gap: '1rem',
      }}>
        {filtered.map((ws) => {
          const fin = financials.find(f => f.workspace_id === ws.id);
          const rag = ragData.find(r => r.workspace_id === ws.id);
          const spentPct = fin && fin.contract_value > 0 ? Math.round((fin.spent / fin.contract_value) * 100) : null;
          const sectorColor = sectorColors[ws.sector] ?? '#0EA5E9';
          const spentBarColor = spentPct !== null ? (spentPct >= 95 ? '#EF4444' : spentPct >= 80 ? '#F59E0B' : '#10B981') : '#0EA5E9';

          if (viewMode === 'list') {
            return (
              <div key={ws.id} className="section-card" style={{ cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem' }}
                onClick={() => navigate(`/workspaces/${ws.id}`)}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${sectorColor}40`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'; }}
              >
                <div style={{ width: '4px', height: '44px', borderRadius: '9999px', background: sectorColor, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#F1F5F9', marginBottom: '2px' }}>{ws.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#475569' }}>{ws.client}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: '4px', background: `${sectorColor}18`, color: sectorColor, border: `1px solid ${sectorColor}30` }}>{ws.sector}</span>
                  <span style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: '4px', background: 'rgba(148,163,184,0.08)', color: '#94A3B8', border: '1px solid rgba(148,163,184,0.12)' }}>{ws.type}</span>
                </div>
                {fin && <div style={{ flexShrink: 0, textAlign: 'right' }}><div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#F59E0B' }}>{fmtAED(fin.contract_value)}</div><div style={{ fontSize: '0.68rem', color: '#475569' }}>{spentPct}% spent</div></div>}
                {rag && (
                  <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                    {(['rag', 'budget', 'schedule', 'risk'] as const).map(k => (
                      <div key={k} title={k.charAt(0).toUpperCase() + k.slice(1)} style={{ width: 8, height: 8, borderRadius: '50%', background: RAG_COLORS[rag[k]], boxShadow: `0 0 4px ${RAG_COLORS[rag[k]]}80` }} />
                    ))}
                  </div>
                )}
                <div style={{ flexShrink: 0 }}>
                  <div style={{ width: '80px', height: '4px', borderRadius: '9999px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${ws.progress}%`, background: ws.progress >= 80 ? 'linear-gradient(90deg, #059669, #10B981)' : ws.progress >= 50 ? 'linear-gradient(90deg, #0EA5E9, #00D4FF)' : 'linear-gradient(90deg, #F59E0B, #FCD34D)', borderRadius: '9999px' }} />
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#475569', marginTop: '2px', textAlign: 'right' }}>{ws.progress}%</div>
                </div>
                <ChevronRight size={16} style={{ color: '#334155', flexShrink: 0 }} />
              </div>
            );
          }

          return (
            <div key={ws.id} className="section-card" style={{ cursor: 'pointer', overflow: 'hidden', transition: 'all 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${sectorColor}40`; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
            >
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
                  <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '2px 7px', borderRadius: '4px', background: langColors[ws.language]?.bg ?? 'rgba(14,165,233,0.1)', color: langColors[ws.language]?.text ?? '#38BDF8', border: `1px solid ${langColors[ws.language]?.border ?? 'rgba(14,165,233,0.2)'}` }}>{ws.language}</span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '2px 7px', borderRadius: '4px', background: 'rgba(148,163,184,0.08)', color: '#94A3B8', border: '1px solid rgba(148,163,184,0.12)' }}>{ws.type}</span>
                </div>

                {/* Financial Row */}
                {fin && (
                  <div style={{ marginBottom: '0.875rem', padding: '0.625rem', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                      <span style={{ fontSize: '0.68rem', color: '#475569' }}>Contract Value</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#F59E0B' }}>{fmtAED(fin.contract_value)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                      <span style={{ fontSize: '0.65rem', color: '#475569' }}>Spent {spentPct}%</span>
                      <span style={{ fontSize: '0.65rem', color: fin.variance <= 0 ? '#34D399' : '#FCA5A5', fontWeight: 600 }}>
                        {fin.variance === 0 ? 'On Budget' : (fin.variance > 0 ? '+' : '') + fmtAED(Math.abs(fin.variance)) + ' variance'}
                      </span>
                    </div>
                    <div style={{ height: '4px', borderRadius: '9999px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${spentPct ?? 0}%`, background: `linear-gradient(90deg, ${spentBarColor}, ${spentBarColor}cc)`, borderRadius: '9999px', transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                )}

                {/* RAG Indicators */}
                {rag && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.875rem', flexWrap: 'wrap' }}>
                    {([['Overall', rag.rag], ['Budget', rag.budget], ['Schedule', rag.schedule], ['Risk', rag.risk]] as [string, string][]).map(([label, status]) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: RAG_COLORS[status], boxShadow: `0 0 4px ${RAG_COLORS[status]}80` }} />
                        <span style={{ fontSize: '0.62rem', color: '#475569' }}>{label}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Progress */}
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
                    <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{ws.docs_count}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Video size={12} style={{ color: '#475569' }} />
                    <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{ws.meetings_count}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <CheckSquare size={12} style={{ color: '#475569' }} />
                    <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{ws.tasks_count}</span>
                  </div>
                  <div style={{ marginLeft: 'auto' }}>
                    <span className={ws.status === 'Active' ? 'status-active' : 'status-pending'} style={{ fontSize: '0.62rem' }}>{ws.status}</span>
                  </div>
                </div>

                {/* Contributors */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
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
                  <span style={{ fontSize: '0.65rem', color: '#334155' }}>{ws.last_activity}</span>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.875rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
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

      {/* New Workspace Modal */}
      {showNewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowNewModal(false); }}>
          <div style={{ background: '#0D1527', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1rem', padding: '1.75rem', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#F1F5F9' }}>New Workspace</div>
                <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '2px' }}>Create a new client engagement workspace</div>
              </div>
              <button onClick={() => setShowNewModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '4px' }}><X size={18} /></button>
            </div>

            {formError && (
              <div style={{ padding: '0.75rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: '#FCA5A5', fontSize: '0.8rem', marginBottom: '1rem' }}>{formError}</div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[
                { label: 'Workspace Name *', key: 'name' as const, placeholder: 'e.g. ADNOC Digital Transformation' },
                { label: 'Client / Organization *', key: 'client' as const, placeholder: 'e.g. Abu Dhabi National Oil Company' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', display: 'block', marginBottom: '0.375rem' }}>{label}</label>
                  <input type="text" value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder}
                    style={{ width: '100%', padding: '0.625rem 0.75rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.5rem', color: '#F1F5F9', fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', display: 'block', marginBottom: '0.375rem' }}>Sector</label>
                  <select value={form.sector} onChange={e => setForm(f => ({ ...f, sector: e.target.value }))}
                    style={{ width: '100%', padding: '0.625rem 0.75rem', background: '#0A0F1E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.5rem', color: '#F1F5F9', fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none' }}>
                    {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', display: 'block', marginBottom: '0.375rem' }}>Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as typeof TYPES[number] }))}
                    style={{ width: '100%', padding: '0.625rem 0.75rem', background: '#0A0F1E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.5rem', color: '#F1F5F9', fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none' }}>
                    {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', display: 'block', marginBottom: '0.375rem' }}>Language</label>
                  <select value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value as typeof LANGUAGES[number] }))}
                    style={{ width: '100%', padding: '0.625rem 0.75rem', background: '#0A0F1E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.5rem', color: '#F1F5F9', fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none' }}>
                    {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', display: 'block', marginBottom: '0.375rem' }}>Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description of the engagement scope…" rows={3}
                  style={{ width: '100%', padding: '0.625rem 0.75rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.5rem', color: '#F1F5F9', fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
                <button className="btn-ghost" onClick={() => { setShowNewModal(false); setForm(defaultForm); setFormError(''); }}>Cancel</button>
                <button className="btn-primary" onClick={handleCreateWorkspace} disabled={saving}>
                  {saving ? 'Creating…' : 'Create Workspace'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
