import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, Grid3X3, List, FileText, Video, CheckSquare,
  ChevronRight, TrendingUp, TrendingDown, DollarSign, RefreshCw,
  X, AlertCircle, Briefcase, CalendarDays, MoreVertical,
  AlertTriangle,
} from 'lucide-react';
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
const RAG_GLOW: Record<string, string> = { Green: 'rgba(16,185,129,0.55)', Amber: 'rgba(245,158,11,0.55)', Red: 'rgba(239,68,68,0.55)' };

function fmtSAR(val: number): string {
  if (val >= 1_000_000) return `SAR ${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `SAR ${(val / 1_000).toFixed(0)}K`;
  return `SAR ${val.toLocaleString()}`;
}

function LoadingSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} style={{
          background: '#0C1220', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '14px', overflow: 'hidden',
        }}>
          <div style={{ height: '3px', background: 'rgba(255,255,255,0.07)' }} />
          <div style={{ padding: '1.25rem' }}>
            <div style={{ height: '14px', width: '65%', background: 'rgba(255,255,255,0.06)', borderRadius: '6px', marginBottom: '8px' }} />
            <div style={{ height: '11px', width: '40%', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', marginBottom: '18px' }} />
            <div style={{ height: '56px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', marginBottom: '14px' }} />
            <div style={{ height: '6px', background: 'rgba(255,255,255,0.04)', borderRadius: '9999px' }} />
          </div>
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

// ── Label component for form fields ──────────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.625rem 0.875rem',
  background: '#080C18', border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: '8px', color: '#F1F5F9', fontSize: '0.85rem',
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.15s',
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
        getWorkspaceFinancials().catch(() => [] as WorkspaceFinancialRow[]),
        getWorkspaceRagStatuses().catch(() => [] as WorkspaceRagStatusRow[]),
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
  const healthScore = Math.round((ragData.filter(r => r.rag === 'Green').length / Math.max(ragData.length, 1)) * 100);

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
      await upsertWorkspaceFinancial({
        id: `fin-${Date.now()}`, workspace_id: newWs.id, workspace_name: newWs.name,
        contract_value: 0, spent: 0, forecast: 0, variance: 0,
        currency: 'SAR', billing_model: 'Fixed Fee', last_invoice: '', next_milestone_value: 0,
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

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: isMobile ? '0.875rem' : '1.5rem', background: '#080C18', minHeight: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1.75rem' }}>
          <div style={{ width: 18, height: 18, border: '2px solid #00D4FF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
          <span style={{ fontSize: '0.82rem', color: '#475569', fontWeight: 500 }}>Loading workspaces…</span>
        </div>
        <LoadingSkeleton />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ padding: isMobile ? '0.875rem' : '1.5rem', background: '#080C18', minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', paddingTop: '5rem' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.25rem' }}>
          <AlertCircle size={28} style={{ color: '#EF4444' }} />
        </div>
        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#FCA5A5' }}>Failed to load workspaces</div>
        <div style={{ fontSize: '0.8rem', color: '#475569', maxWidth: '400px', textAlign: 'center', lineHeight: 1.6 }}>{error}</div>
        <button className="btn-primary" onClick={() => loadData()}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ padding: isMobile ? '0.875rem' : '1.5rem', display: 'flex', flexDirection: 'column', gap: isMobile ? '0.875rem' : '1.25rem', background: '#080C18', minHeight: '100%' }}>

      {/* ── Portfolio Banner ────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #0C1628 0%, #080C18 55%, #0D0C20 100%)',
        border: '1px solid rgba(0,212,255,0.12)',
        borderRadius: '14px',
        padding: isMobile ? '1.25rem' : '1.75rem',
        position: 'relative', overflow: 'hidden',
        boxShadow: '0 4px 32px rgba(0,0,0,0.45)',
      }}>
        {/* Ambient glows */}
        <div style={{ position: 'absolute', top: -60, right: -40, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,212,255,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -50, left: 60, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px)', backgroundSize: '48px 48px', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px rgba(16,185,129,0.8)' }} />
              <span style={{ fontSize: '0.65rem', color: '#64748B', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>Client Engagement Overview</span>
            </div>
            <div style={{
              fontSize: isMobile ? '1.75rem' : '2.5rem', fontWeight: 900, lineHeight: 1,
              letterSpacing: '-0.03em',
              background: 'linear-gradient(135deg, #00D4FF 0%, #0EA5E9 60%, #F1F5F9 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              {fmtSAR(totalContract)}
            </div>
            <div style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ color: '#00D4FF', fontWeight: 700 }}>{workspaces.filter(w => w.status === 'Active').length}</span>
              <span>active engagements</span>
              <span style={{ color: '#1E3A5F' }}>·</span>
              <span>Portfolio health</span>
              <span style={{ color: healthScore >= 80 ? '#10B981' : healthScore >= 60 ? '#F59E0B' : '#EF4444', fontWeight: 800 }}>
                {healthScore}%
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: isMobile ? '1rem' : '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {[
              { label: 'Revenue Recognized', value: fmtSAR(totalSpent), color: '#10B981' },
              { label: 'Budget Variance', value: (totalVariance > 0 ? '+' : '') + fmtSAR(Math.abs(totalVariance)), color: totalVariance > 0 ? '#EF4444' : '#10B981' },
              { label: 'Refreshed', value: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), color: '#64748B' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.65rem', color: '#334155', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{s.label}</div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: s.color, textShadow: `0 0 18px ${s.color}40` }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Financial Stats Row ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${width >= 768 ? 4 : 2}, 1fr)`, gap: '0.875rem' }}>
        {[
          { label: 'Total Contract Value', value: fmtSAR(totalContract), icon: <DollarSign size={15} />, color: '#00D4FF', trend: `${workspaces.length} engagements`, trendUp: true },
          { label: 'Revenue Recognized', value: fmtSAR(totalSpent), icon: <TrendingUp size={15} />, color: '#10B981', trend: `${totalContract > 0 ? Math.round((totalSpent / totalContract) * 100) : 0}% collected`, trendUp: true },
          { label: 'Budget Variance', value: (totalVariance > 0 ? '+' : '') + fmtSAR(Math.abs(totalVariance)), icon: <TrendingDown size={15} />, color: totalVariance > 0 ? '#EF4444' : '#10B981', trend: totalVariance > 0 ? 'Over Budget' : 'Under Budget', trendUp: totalVariance <= 0 },
          { label: 'Milestones Due (30d)', value: `${financials.reduce((s, f) => s + (f.next_milestone_value > 0 ? 1 : 0), 0)}`, icon: <CheckSquare size={15} />, color: '#F59E0B', trend: fmtSAR(financials.reduce((s, f) => s + f.next_milestone_value, 0)) + ' gate value', trendUp: true },
        ].map(stat => (
          <div key={stat.label} style={{
            background: '#0C1220', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '12px', padding: '1.125rem',
            position: 'relative', overflow: 'hidden',
            transition: 'all 0.2s',
          }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = stat.color + '30'; el.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(255,255,255,0.07)'; el.style.transform = 'translateY(0)'; }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${stat.color}, ${stat.color}30)` }} />
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '50%', background: `linear-gradient(180deg, ${stat.color}07 0%, transparent 100%)`, pointerEvents: 'none' }} />
            <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ padding: '0.5rem', borderRadius: '8px', background: `${stat.color}15`, color: stat.color, display: 'flex' }}>{stat.icon}</div>
              <span style={{
                fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: '5px',
                background: stat.trendUp ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                color: stat.trendUp ? '#34D399' : '#FCA5A5',
                border: `1px solid ${stat.trendUp ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
              }}>{stat.trend}</span>
            </div>
            <div style={{ position: 'relative' }}>
              <div style={{
                fontSize: isMobile ? '1.3rem' : '1.6rem', fontWeight: 900, lineHeight: 1,
                letterSpacing: '-0.025em',
                background: `linear-gradient(135deg, #F1F5F9 0%, ${stat.color} 200%)`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>
                {stat.value}
              </div>
              <div style={{ position: 'absolute', top: '50%', left: 0, transform: 'translateY(-50%)', width: '50px', height: '24px', background: `radial-gradient(ellipse, ${stat.color}1A 0%, transparent 70%)`, pointerEvents: 'none', filter: 'blur(4px)' }} />
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '0.375rem', fontWeight: 500 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.875rem', flexWrap: 'wrap' }}>
        {/* Filter tabs */}
        <div style={{
          display: 'flex', gap: '2px',
          background: 'rgba(255,255,255,0.03)', padding: '3px',
          borderRadius: '10px', border: '1px solid rgba(255,255,255,0.07)',
          overflowX: 'auto',
        }}>
          {filterTabs.map(tab => {
            const count = tab === 'All' ? workspaces.length : workspaces.filter(w => w.type === tab).length;
            const active = activeFilter === tab;
            return (
              <button key={tab} onClick={() => setActiveFilter(tab)} style={{
                padding: '0.3rem 0.875rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontSize: '0.78rem', fontFamily: 'inherit', fontWeight: 600, transition: 'all 0.15s',
                background: active ? 'rgba(0,212,255,0.12)' : 'transparent',
                color: active ? '#00D4FF' : '#64748B',
                whiteSpace: 'nowrap',
                boxShadow: active ? '0 0 12px rgba(0,212,255,0.1)' : 'none',
              }}>
                {tab}
                <span style={{ marginLeft: '5px', fontSize: '0.65rem', opacity: 0.7, color: active ? '#00D4FF' : '#475569' }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0 0.875rem', height: '36px', borderRadius: '9px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
            width: isMobile ? '100%' : '220px', transition: 'border-color 0.15s',
          }}
            onFocusCapture={e => { e.currentTarget.style.borderColor = 'rgba(0,212,255,0.3)'; }}
            onBlurCapture={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; }}
          >
            <Search size={13} style={{ color: '#475569', flexShrink: 0 }} />
            <input type="text" placeholder="Search workspaces…" value={search} onChange={e => setSearch(e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '0.8rem', color: '#F1F5F9', width: '100%', fontFamily: 'inherit' }} />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 0, display: 'flex', lineHeight: 1, transition: 'color 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#94A3B8'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#475569'; }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* View mode toggle */}
          <div style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.04)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
            {([['grid', <Grid3X3 size={13} />], ['list', <List size={13} />]] as const).map(([mode, icon]) => (
              <button key={mode} onClick={() => setViewMode(mode as 'grid' | 'list')} style={{
                width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: viewMode === mode ? 'rgba(0,212,255,0.12)' : 'transparent',
                color: viewMode === mode ? '#00D4FF' : '#475569',
                transition: 'all 0.15s', fontFamily: 'inherit',
              }}>
                {icon}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button style={{
            width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '9px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
            color: '#64748B', cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
          }}
            onClick={() => loadData(true)}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'; e.currentTarget.style.color = '#94A3B8'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.color = '#64748B'; }}
            title="Refresh"
          >
            <RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
          </button>

          {/* New workspace */}
          <button className="btn-primary" onClick={() => setShowNewModal(true)}>
            <Plus size={14} /> New Workspace
          </button>
        </div>
      </div>

      {/* ── Empty State ─────────────────────────────────────────────────── */}
      {filtered.length === 0 && !loading && (
        <div style={{
          padding: '5rem 2rem', textAlign: 'center',
          background: '#0C1220', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '14px',
        }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(0,212,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', border: '1px solid rgba(0,212,255,0.12)' }}>
            <Briefcase size={26} style={{ color: '#00D4FF' }} />
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#94A3B8', marginBottom: '0.5rem' }}>
            {search ? `No results for "${search}"` : 'No workspaces found'}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#475569', marginBottom: '1.5rem', maxWidth: '320px', margin: '0 auto 1.5rem', lineHeight: 1.7 }}>
            {search
              ? 'Try adjusting your search or changing the active filter.'
              : 'Create your first workspace to start managing client engagements, documents, and milestones.'}
          </div>
          {!search && (
            <button className="btn-primary" onClick={() => setShowNewModal(true)}>
              <Plus size={14} /> Create Workspace
            </button>
          )}
        </div>
      )}

      {/* ── Grid / List view ────────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div style={{
          display: viewMode === 'grid' ? 'grid' : 'flex',
          gridTemplateColumns: viewMode === 'grid' ? `repeat(${gridCols}, 1fr)` : undefined,
          flexDirection: viewMode === 'list' ? 'column' : undefined,
          gap: viewMode === 'grid' ? '1rem' : '0.5rem',
        }}>
          {filtered.map((ws) => {
            const fin = financials.find(f => f.workspace_id === ws.id);
            const rag = ragData.find(r => r.workspace_id === ws.id);
            const spentPct = fin && fin.contract_value > 0 ? Math.round((fin.spent / fin.contract_value) * 100) : null;
            const sectorColor = sectorColors[ws.sector] ?? '#0EA5E9';
            const spentBarColor = spentPct !== null ? (spentPct >= 95 ? '#EF4444' : spentPct >= 80 ? '#F59E0B' : '#10B981') : '#0EA5E9';
            const progressGradient = ws.progress >= 80
              ? 'linear-gradient(90deg, #059669, #10B981)'
              : ws.progress >= 50
              ? 'linear-gradient(90deg, #0EA5E9, #00D4FF)'
              : 'linear-gradient(90deg, #F59E0B, #FCD34D)';

            // ── List row ────────────────────────────────────────────────
            if (viewMode === 'list') {
              return (
                <div key={ws.id} style={{
                  background: '#0C1220', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '10px', cursor: 'pointer', overflow: 'hidden',
                  display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.875rem 1.25rem',
                  transition: 'all 0.2s',
                }}
                  onClick={() => navigate(`/workspaces/${ws.id}`)}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = `${sectorColor}35`; el.style.background = '#0E1628'; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(255,255,255,0.07)'; el.style.background = '#0C1220'; }}
                >
                  <div style={{ width: '3px', height: '42px', borderRadius: '9999px', background: sectorColor, flexShrink: 0, boxShadow: `0 0 8px ${sectorColor}50` }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#E2E8F0', marginBottom: '2px' }}>{ws.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#475569' }}>{ws.client}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '5px', background: `${sectorColor}18`, color: sectorColor, border: `1px solid ${sectorColor}28`, fontWeight: 600 }}>{ws.sector}</span>
                    <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '5px', background: 'rgba(148,163,184,0.08)', color: '#94A3B8', border: '1px solid rgba(148,163,184,0.12)', fontWeight: 600 }}>{ws.type}</span>
                  </div>
                  {fin && <div style={{ flexShrink: 0, textAlign: 'right' }}><div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#F59E0B' }}>{fmtSAR(fin.contract_value)}</div><div style={{ fontSize: '0.68rem', color: '#475569' }}>{spentPct}% spent</div></div>}
                  {rag && (
                    <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0, alignItems: 'center' }}>
                      {([['Overall', rag.rag], ['Budget', rag.budget], ['Schedule', rag.schedule], ['Risk', rag.risk]] as [string, string][]).map(([label, status]) => (
                        <div key={label} title={label} style={{ width: 8, height: 8, borderRadius: '50%', background: RAG_COLORS[status] ?? '#475569', boxShadow: `0 0 6px ${RAG_GLOW[status] ?? 'transparent'}` }} />
                      ))}
                    </div>
                  )}
                  <div style={{ flexShrink: 0 }}>
                    <div style={{ width: '80px', height: '4px', borderRadius: '9999px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${ws.progress}%`, background: progressGradient, borderRadius: '9999px' }} />
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#475569', marginTop: '3px', textAlign: 'right', fontWeight: 600 }}>{ws.progress}%</div>
                  </div>
                  <ChevronRight size={15} style={{ color: '#334155', flexShrink: 0 }} />
                </div>
              );
            }

            // ── Grid card ───────────────────────────────────────────────
            const cardStatus = rag?.rag === 'Red' ? 'At Risk' : rag?.rag === 'Amber' ? 'On Hold' : ws.status;
            const statusColor = cardStatus === 'Active' ? '#10B981' : cardStatus === 'At Risk' ? '#EF4444' : '#F59E0B';
            const statusBg = cardStatus === 'Active' ? 'rgba(16,185,129,0.1)' : cardStatus === 'At Risk' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)';

            return (
              <div key={ws.id}
                onClick={() => navigate(`/workspaces/${ws.id}`)}
                style={{
                  background: '#0C1220',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderLeft: `4px solid ${sectorColor}`,
                  borderRadius: '14px', cursor: 'pointer', overflow: 'hidden',
                  transition: 'all 0.22s', position: 'relative',
                  display: 'flex', flexDirection: 'column',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = `rgba(255,255,255,0.12)`;
                  el.style.borderLeftColor = sectorColor;
                  el.style.transform = 'translateY(-2px)';
                  el.style.boxShadow = `0 10px 30px rgba(0,0,0,0.3), 0 0 0 1px ${sectorColor}18`;
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = 'rgba(255,255,255,0.07)';
                  el.style.borderLeftColor = sectorColor;
                  el.style.transform = 'translateY(0)';
                  el.style.boxShadow = 'none';
                }}
              >
                {/* Left border glow overlay */}
                <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '60px', background: `linear-gradient(90deg, ${sectorColor}08 0%, transparent 100%)`, pointerEvents: 'none', borderRadius: '0 0 0 0' }} />

                <div style={{ padding: '1.125rem 1.125rem 1rem', position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.625rem' }}>
                    <div style={{ flex: 1, minWidth: 0, paddingRight: '0.5rem' }}>
                      <h3 style={{ fontSize: '0.925rem', fontWeight: 800, color: '#F1F5F9', margin: '0 0 3px', lineHeight: 1.25, letterSpacing: '-0.01em' }}>{ws.name}</h3>
                      <p style={{ fontSize: '0.75rem', color: '#64748B', margin: 0 }}>{ws.client}</p>
                    </div>
                    <span style={{
                      fontSize: '0.62rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px',
                      background: statusBg, color: statusColor,
                      border: `1px solid ${statusColor}30`, whiteSpace: 'nowrap', flexShrink: 0,
                    }}>{cardStatus}</span>
                  </div>

                  {/* Tags */}
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.875rem' }}>
                    <span style={{ fontSize: '0.63rem', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: `${sectorColor}18`, color: sectorColor, border: `1px solid ${sectorColor}25` }}>{ws.sector}</span>
                    <span style={{ fontSize: '0.63rem', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: langColors[ws.language]?.bg ?? 'rgba(14,165,233,0.1)', color: langColors[ws.language]?.text ?? '#38BDF8', border: `1px solid ${langColors[ws.language]?.border ?? 'rgba(14,165,233,0.2)'}` }}>{ws.language}</span>
                    <span style={{ fontSize: '0.63rem', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: 'rgba(148,163,184,0.08)', color: '#94A3B8', border: '1px solid rgba(148,163,184,0.12)' }}>{ws.type}</span>
                  </div>

                  {/* Financial Block */}
                  {fin ? (
                    <div style={{ marginBottom: '0.875rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.7rem', color: '#475569' }}>Contract Value</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#00D4FF' }}>{fmtSAR(fin.contract_value)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.68rem', color: '#475569' }}>Spent {spentPct ?? 0}%</span>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: fin.variance > 0 ? '#FCA5A5' : '#34D399' }}>
                          {fin.variance === 0 ? 'On track' : (fin.variance > 0 ? 'SAR ' + (Math.abs(fin.variance) / 1000).toFixed(0) + 'K over' : 'SAR ' + (Math.abs(fin.variance) / 1000).toFixed(0) + 'K under')}
                        </span>
                      </div>
                      <div style={{ height: '4px', borderRadius: '9999px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(spentPct ?? 0, 100)}%`, background: `linear-gradient(90deg, ${spentBarColor}, ${spentBarColor}cc)`, borderRadius: '9999px', transition: 'width 0.7s ease' }} />
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginBottom: '0.875rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.7rem', color: '#475569' }}>Delivery Progress</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#E2E8F0' }}>{ws.progress}%</span>
                      </div>
                      <div style={{ height: '4px', borderRadius: '9999px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${ws.progress}%`, background: progressGradient, borderRadius: '9999px', transition: 'width 0.7s ease' }} />
                      </div>
                    </div>
                  )}

                  {/* Stats dots row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
                    {[
                      { dot: '#00D4FF', icon: <CheckSquare size={11} />, count: ws.tasks_count, label: 'tasks' },
                      { dot: '#F59E0B', icon: <FileText size={11} />, count: ws.docs_count, label: 'docs' },
                      { dot: '#8B5CF6', icon: <Video size={11} />, count: ws.meetings_count, label: 'meetings' },
                    ].map((s, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        {i > 0 && <span style={{ color: '#1E293B', fontSize: '0.7rem', marginRight: '1px' }}>•</span>}
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, boxShadow: `0 0 5px ${s.dot}80`, flexShrink: 0 }} />
                        <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{s.count} {s.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Date range */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.875rem' }}>
                    <CalendarDays size={11} style={{ color: '#475569', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.7rem', color: '#475569' }}>{ws.last_activity || 'No date set'}</span>
                  </div>

                  {/* Footer: avatars + three-dot */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    {/* Avatar stack */}
                    <div style={{ display: 'flex' }}>
                      {ws.contributors.slice(0, 4).map((c, i) => (
                        <div key={i} title={c} style={{
                          width: 26, height: 26, borderRadius: '50%',
                          background: avatarColors[i % avatarColors.length],
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.58rem', fontWeight: 800, color: 'white',
                          border: '2px solid #0C1220', marginLeft: i > 0 ? '-8px' : 0,
                          zIndex: 5 - i, position: 'relative',
                        }}>{c}</div>
                      ))}
                      {ws.contributors.length > 4 && (
                        <div style={{
                          width: 26, height: 26, borderRadius: '50%',
                          background: 'rgba(255,255,255,0.08)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.58rem', fontWeight: 700, color: '#94A3B8',
                          border: '2px solid #0C1220', marginLeft: '-8px', position: 'relative',
                        }}>+{ws.contributors.length - 4}</div>
                      )}
                      {ws.contributors.length === 0 && (
                        <span style={{ fontSize: '0.68rem', color: '#334155' }}>No contributors</span>
                      )}
                    </div>

                    {/* Three-dot menu */}
                    <button
                      onClick={e => { e.stopPropagation(); navigate(`/workspaces/${ws.id}`); }}
                      style={{
                        width: 28, height: 28, borderRadius: '6px', border: 'none',
                        background: 'transparent', cursor: 'pointer', color: '#475569',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s', fontFamily: 'inherit',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#94A3B8'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#475569'; }}
                    >
                      <MoreVertical size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── New Workspace Modal ──────────────────────────────────────────── */}
      {showNewModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)',
          zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem', backdropFilter: 'blur(8px)',
        }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowNewModal(false); }}
        >
          <div style={{
            background: '#0C1220', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '540px',
            maxHeight: '90vh', overflowY: 'auto', position: 'relative', overflow: 'hidden',
            boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
          }}>
            {/* Modal ambient glow */}
            <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,212,255,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

            {/* Modal header */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.75rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.375rem' }}>
                  <div style={{ padding: '0.5rem', borderRadius: '8px', background: 'rgba(0,212,255,0.1)', color: '#00D4FF' }}>
                    <Briefcase size={15} />
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#F1F5F9', letterSpacing: '-0.01em' }}>New Workspace</div>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748B' }}>Create a new client engagement workspace</div>
              </div>
              <button onClick={() => { setShowNewModal(false); setForm(defaultForm); setFormError(''); }} style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px', cursor: 'pointer', color: '#64748B', padding: '6px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.color = '#94A3B8'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#64748B'; }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Error */}
            {formError && (
              <div style={{
                padding: '0.875rem 1rem', background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px',
                color: '#FCA5A5', fontSize: '0.82rem', marginBottom: '1.25rem',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}>
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                {formError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem', overflowY: 'auto', maxHeight: 'calc(90vh - 180px)', paddingRight: '2px' }}>
              {/* Name */}
              <div>
                <FieldLabel>Workspace Name *</FieldLabel>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. ADNOC Digital Transformation"
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(0,212,255,0.35)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; }}
                />
              </div>

              {/* Client */}
              <div>
                <FieldLabel>Client / Organization *</FieldLabel>
                <input type="text" value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))}
                  placeholder="e.g. Abu Dhabi National Oil Company"
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(0,212,255,0.35)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; }}
                />
              </div>

              {/* Sector + Type */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                <div>
                  <FieldLabel>Sector</FieldLabel>
                  <select value={form.sector} onChange={e => setForm(f => ({ ...f, sector: e.target.value }))}
                    style={{ ...inputStyle }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(0,212,255,0.35)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; }}
                  >
                    {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <FieldLabel>Type</FieldLabel>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as typeof TYPES[number] }))}
                    style={{ ...inputStyle }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(0,212,255,0.35)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; }}
                  >
                    {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* Language */}
              <div style={{ maxWidth: '50%' }}>
                <FieldLabel>Language</FieldLabel>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {LANGUAGES.map(l => {
                    const lc = langColors[l];
                    const active = form.language === l;
                    return (
                      <button key={l} onClick={() => setForm(f => ({ ...f, language: l }))} style={{
                        flex: 1, padding: '0.5rem', borderRadius: '8px', border: `1px solid ${active ? lc.border : 'rgba(255,255,255,0.09)'}`,
                        background: active ? lc.bg : 'rgba(255,255,255,0.03)',
                        color: active ? lc.text : '#64748B', cursor: 'pointer',
                        fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 700,
                        transition: 'all 0.15s',
                      }}>
                        {l}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description */}
              <div>
                <FieldLabel>Description</FieldLabel>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description of the engagement scope and key objectives…" rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(0,212,255,0.35)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; }}
                />
              </div>

              {/* Footer buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.25rem' }}>
                <button className="btn-ghost" onClick={() => { setShowNewModal(false); setForm(defaultForm); setFormError(''); }}>
                  Cancel
                </button>
                <button className="btn-primary" onClick={handleCreateWorkspace} disabled={saving} style={{ minWidth: '140px', justifyContent: 'center' }}>
                  {saving ? (
                    <>
                      <span style={{ width: 13, height: 13, border: '2px solid rgba(5,8,15,0.4)', borderTopColor: '#05080F', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                      Creating…
                    </>
                  ) : (
                    <><Plus size={14} /> Create Workspace</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
