import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase, FileText, Zap, CheckSquare, Clock, AlertTriangle,
  TrendingUp, TrendingDown, Upload, Video, Sparkles, ArrowRight,
  Bot, Check, X, RefreshCw, Eye,
  Calendar, BarChart3, DollarSign, Target, Activity,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import {
  automationRunsData, documentsByTypeData,
  portfolioKPIs, ragStatusData, deliveryTrendData, boardDecisions,
  type PortfolioKPI, type BoardDecision,
} from '../data/mockData';
import { getActivities, getMilestones, getWorkspaceFinancials } from '../lib/db';
import type { ActivityRow, MilestoneRow, WorkspaceFinancialRow } from '../lib/db';
import { useLayout } from '../hooks/useLayout';

type Period = 'today' | 'week' | 'month';

const RAG_COLORS: Record<string, string> = {
  Green: '#10B981',
  Amber: '#F59E0B',
  Red: '#EF4444',
};

const RAG_GLOW: Record<string, string> = {
  Green: 'rgba(16,185,129,0.5)',
  Amber: 'rgba(245,158,11,0.5)',
  Red: 'rgba(239,68,68,0.5)',
};

function RagDot({ status }: { status: 'Green' | 'Amber' | 'Red' }) {
  return (
    <div style={{
      width: 10, height: 10, borderRadius: '50%',
      background: RAG_COLORS[status],
      boxShadow: `0 0 8px ${RAG_GLOW[status]}, 0 0 2px ${RAG_COLORS[status]}`,
      flexShrink: 0,
    }} />
  );
}

function fmtSAR(val: number): string {
  if (val >= 1000000) return `\u20C1${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `\u20C1${(val / 1000).toFixed(0)}K`;
  return `\u20C1${val.toLocaleString()}`;
}

type ApprovalStatus = 'pending' | 'approved' | 'rejected';
interface Approval { id: number; title: string; requester: string; type: string; urgency: string; status: ApprovalStatus; }

const initialApprovals: Approval[] = [
  { id: 1, title: 'NCA BRD v2.3', requester: 'AM', type: 'Document Approval', urgency: 'High', status: 'pending' },
  { id: 2, title: 'SC-10 Budget \u20C12.4M', requester: 'RT', type: 'Budget Approval', urgency: 'High', status: 'pending' },
  { id: 3, title: 'MOCI Vendor Shortlist', requester: 'FH', type: 'Procurement Decision', urgency: 'Medium', status: 'pending' },
  { id: 4, title: 'Healthcare Strategy Report', requester: 'SK', type: 'Report Sign-off', urgency: 'Low', status: 'pending' },
];

const initialRecommendations = [
  { id: 1, icon: 'zap', title: 'Generate SC-10 Committee Pack', detail: 'Meeting in 5 days — 3 pending decisions need packaging', action: 'Generate Now', color: '#8B5CF6', path: '/automations' },
  { id: 2, icon: 'alert', title: 'Review 3 Critical Risks', detail: 'Smart City & NCA have unmitigated critical risks', action: 'View Risks', color: '#EF4444', path: '/tasks' },
  { id: 3, icon: 'clock', title: 'ADNOC Contract Overdue', detail: 'Contract review task 3 days overdue — assign or escalate', action: 'View Task', color: '#F59E0B', path: '/tasks' },
];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (active && payload?.length) {
    return (
      <div style={{ background: '#101828', border: '1px solid rgba(0,212,255,0.15)', borderRadius: '8px', padding: '8px 12px', fontSize: '0.75rem', color: '#F1F5F9', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
        <p style={{ margin: 0, color: '#64748B', marginBottom: '2px' }}>{label}</p>
        <p style={{ margin: 0, color: '#00D4FF', fontWeight: 700 }}>{payload[0].value} runs</p>
      </div>
    );
  }
  return null;
};

const DeliveryTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) => {
  if (active && payload?.length) {
    return (
      <div style={{ background: '#101828', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px 14px', fontSize: '0.75rem', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
        <p style={{ margin: '0 0 6px', color: '#94A3B8', fontWeight: 600 }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ margin: '2px 0', color: p.color, fontWeight: 500 }}>{p.name}: {p.value}</p>
        ))}
      </div>
    );
  }
  return null;
};

const milestoneStatusColor: Record<string, string> = {
  Completed: '#10B981',
  'On Track': '#0EA5E9',
  'At Risk': '#F59E0B',
  Delayed: '#EF4444',
  Upcoming: '#475569',
};

// Activity type icon/color map
const activityMeta: Record<string, { color: string; bg: string }> = {
  document: { color: '#0EA5E9', bg: 'rgba(14,165,233,0.12)' },
  meeting: { color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  automation: { color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
  task: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  default: { color: '#64748B', bg: 'rgba(100,116,139,0.12)' },
};

function ActivityIcon({ type }: { type: string }) {
  const meta = activityMeta[type] ?? activityMeta.default;
  const icon = type === 'document' ? <FileText size={13} /> :
               type === 'meeting' ? <Video size={13} /> :
               type === 'automation' ? <Zap size={13} /> :
               <CheckSquare size={13} />;
  return (
    <div style={{
      width: 28, height: 28, borderRadius: '8px',
      background: meta.bg, color: meta.color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      {icon}
    </div>
  );
}

// Pie chart colours for document breakdown
const PIE_COLORS = ['#0EA5E9', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];

export default function Dashboard() {
  const navigate = useNavigate();
  const { isMobile, width } = useLayout();
  const [period, setPeriod] = useState<Period>('week');
  const [approvals, setApprovals] = useState<Approval[]>(initialApprovals);
  const [recommendations, setRecommendations] = useState(initialRecommendations);
  const [uploadDrag, setUploadDrag] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activityFilter, setActivityFilter] = useState<string>('All');
  const [completedDecisions, setCompletedDecisions] = useState<Set<string>>(new Set());
  const [hoveredRagRow, setHoveredRagRow] = useState<number | null>(null);

  // Live Supabase data
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [workspaceFinancials, setWorkspaceFinancials] = useState<WorkspaceFinancialRow[]>([]);

  useEffect(() => {
    getActivities(30).then(setActivities).catch(() => {});
    getMilestones().then(setMilestones).catch(() => {});
    getWorkspaceFinancials().then(setWorkspaceFinancials).catch(() => {});
  }, []);

  const handleApprove = (id: number) => setApprovals(prev => prev.map(a => a.id === id ? { ...a, status: 'approved' as const } : a));
  const handleReject = (id: number) => setApprovals(prev => prev.map(a => a.id === id ? { ...a, status: 'rejected' as const } : a));
  const dismissRec = (id: number) => setRecommendations(prev => prev.filter(r => r.id !== id));
  const handleRefresh = () => { setRefreshing(true); setTimeout(() => setRefreshing(false), 1200); };
  const markDecisionComplete = (id: string) => setCompletedDecisions(prev => new Set([...prev, id]));

  const activityTypes = ['All', 'Document', 'Meeting', 'Automation', 'Task'];
  const filteredActivities = activityFilter === 'All' ? activities : activities.filter(a => a.type === activityFilter.toLowerCase());

  const quickActions = [
    { icon: <Upload size={18} />, label: 'Upload Doc', color: '#0EA5E9', bg: 'rgba(14,165,233,0.08)', border: 'rgba(14,165,233,0.18)', action: () => setShowUploadModal(true) },
    { icon: <Zap size={18} />, label: 'Run Automation', color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.18)', action: () => navigate('/automations') },
    { icon: <Video size={18} />, label: 'New Meeting', color: '#10B981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.18)', action: () => navigate('/meetings') },
    { icon: <FileText size={18} />, label: 'Generate BRD', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.18)', action: () => navigate('/automations') },
    { icon: <BarChart3 size={18} />, label: 'New Report', color: '#EC4899', bg: 'rgba(236,72,153,0.08)', border: 'rgba(236,72,153,0.18)', action: () => navigate('/reports') },
    { icon: <Sparkles size={18} />, label: 'Ask AI', color: '#00D4FF', bg: 'rgba(0,212,255,0.08)', border: 'rgba(0,212,255,0.18)', action: () => navigate('/knowledge') },
  ];

  const kpiCols = width >= 1200 ? 6 : width >= 900 ? 3 : 2;
  const mainCols = width >= 1200 ? '1fr 280px 280px' : width >= 900 ? '1fr 1fr' : '1fr';
  const bottomCols = width >= 900 ? '1.6fr 1fr' : '1fr';
  const p = isMobile ? '0.875rem' : '1.5rem';
  const gap = isMobile ? '0.875rem' : '1.25rem';

  const upcomingMilestones = [...milestones].filter(m => m.status !== 'Completed').slice(0, 5);
  const activeBoardDecisions = boardDecisions.filter(d => d.status !== 'Closed' && !completedDecisions.has(d.id));

  const totalContract = workspaceFinancials.reduce((s, w) => s + w.contract_value, 0);
  const totalSpent = workspaceFinancials.reduce((s, w) => s + w.spent, 0);
  const totalVariance = workspaceFinancials.reduce((s, w) => s + w.variance, 0);

  const wsNames: Record<string, string> = {
    'ws-001': 'NCA Digital Transf.',
    'ws-002': 'ADNOC Supply Chain',
    'ws-003': 'Banking Core',
    'ws-004': 'MOCI Procurement',
    'ws-005': 'Smart City PMO',
    'ws-006': 'Healthcare Digital',
    'ws-007': 'NCBE Regulatory',
    'ws-008': 'Ministry Digital',
  };

  // Suppress unused import warnings for data we keep but may not render
  void automationRunsData;
  void documentsByTypeData;

  return (
    <div style={{ padding: p, display: 'flex', flexDirection: 'column', gap, background: '#080C18', minHeight: '100%' }}>

      {/* ── Hero Banner ─────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #0C1628 0%, #080C18 55%, #0D0C20 100%)',
        border: '1px solid rgba(0,212,255,0.12)',
        borderRadius: '14px',
        padding: isMobile ? '1.25rem' : '1.75rem',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 4px 32px rgba(0,0,0,0.45)',
      }}>
        {/* Ambient glow orbs */}
        <div style={{ position: 'absolute', top: -80, right: -40, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,212,255,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, left: 80, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
        {/* Subtle grid pattern overlay */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)', backgroundSize: '48px 48px', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px rgba(16,185,129,0.8)' }} />
              <span style={{ fontSize: '0.68rem', color: '#64748B', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
                Board Overview · 15 March 2026
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: isMobile ? '1.4rem' : '1.85rem', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: '0.625rem' }}>
              <span style={{
                background: 'linear-gradient(135deg, #F1F5F9 0%, #94A3B8 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>Client Command</span>{' '}
              <span style={{
                background: 'linear-gradient(135deg, #00D4FF 0%, #0EA5E9 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>Center</span>
            </h1>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span>8 active clients</span>
              <span style={{ color: '#1E3A5F' }}>·</span>
              <span style={{ color: '#00D4FF', fontWeight: 700 }}>{fmtSAR(totalContract)}</span>
              <span style={{ color: '#1E3A5F' }}>total engagement value</span>
              <span style={{ color: '#1E3A5F' }}>·</span>
              <span>Last updated 13 Mar 2026</span>
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Period switcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '3px', border: '1px solid rgba(255,255,255,0.07)' }}>
              {(['today', 'week', 'month'] as Period[]).map(pv => (
                <button key={pv} onClick={() => setPeriod(pv)} style={{
                  padding: '0.3rem 0.9rem', borderRadius: '7px', border: 'none', cursor: 'pointer',
                  fontSize: '0.78rem', fontWeight: 600, fontFamily: 'inherit',
                  transition: 'all 0.2s',
                  background: period === pv ? 'rgba(0,212,255,0.12)' : 'transparent',
                  color: period === pv ? '#00D4FF' : '#64748B',
                  boxShadow: period === pv ? '0 0 12px rgba(0,212,255,0.12)' : 'none',
                }}>
                  {pv.charAt(0).toUpperCase() + pv.slice(1)}
                </button>
              ))}
            </div>
            <button onClick={handleRefresh} style={{
              display: 'flex', alignItems: 'center', gap: '0.375rem',
              padding: '0.3rem 0.75rem', borderRadius: '8px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
              cursor: 'pointer', color: '#64748B', fontSize: '0.78rem', fontFamily: 'inherit',
              transition: 'all 0.2s',
            }}>
              <RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
              {!isMobile && 'Refresh'}
            </button>
            <button onClick={() => navigate('/reports')} className="btn-ghost" style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Eye size={13} /> {!isMobile && 'View Reports'}
            </button>
          </div>
        </div>

        {/* Banner stats strip */}
        {!isMobile && (
          <div style={{
            position: 'relative', marginTop: '1.5rem', paddingTop: '1.25rem',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem',
          }}>
            {[
              { label: 'Portfolio Value', value: fmtSAR(totalContract), sub: '8 engagements', color: '#00D4FF' },
              { label: 'Revenue Recognized', value: fmtSAR(totalSpent), sub: `${Math.round((totalSpent / totalContract) * 100)}% collected`, color: '#10B981' },
              { label: 'Budget Variance', value: (totalVariance > 0 ? '+' : '') + fmtSAR(Math.abs(totalVariance)), sub: totalVariance > 0 ? 'Over budget' : 'Under budget', color: totalVariance > 0 ? '#EF4444' : '#10B981' },
              { label: 'Pending Actions', value: `${approvals.filter(a => a.status === 'pending').length + activeBoardDecisions.length}`, sub: 'Approvals + decisions', color: '#F59E0B' },
            ].map(stat => (
              <div key={stat.label} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ fontSize: '0.65rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{stat.label}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, letterSpacing: '-0.02em', color: stat.color, textShadow: `0 0 20px ${stat.color}40` }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#475569' }}>{stat.sub}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Portfolio KPI Row ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${kpiCols}, 1fr)`, gap: isMobile ? '0.625rem' : '0.875rem' }}>
        {portfolioKPIs.map((kpi: PortfolioKPI) => (
          <div key={kpi.label} style={{
            background: '#0C1220',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '12px',
            padding: isMobile ? '0.875rem' : '1.125rem',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.2s',
          }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.borderColor = kpi.color + '35';
              el.style.transform = 'translateY(-2px)';
              el.style.boxShadow = `0 8px 24px rgba(0,0,0,0.3), 0 0 0 1px ${kpi.color}20`;
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.borderColor = 'rgba(255,255,255,0.07)';
              el.style.transform = 'translateY(0)';
              el.style.boxShadow = 'none';
            }}
          >
            {/* Top color bar */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${kpi.color}, ${kpi.color}30)` }} />
            {/* Inner gradient overlay */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '60%', background: `linear-gradient(180deg, ${kpi.color}08 0%, transparent 100%)`, pointerEvents: 'none' }} />

            <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
              <div style={{ padding: '0.5rem', borderRadius: '8px', background: kpi.color + '15', color: kpi.color }}>
                {kpi.icon === 'portfolio' ? <Briefcase size={15} /> :
                 kpi.icon === 'revenue' ? <TrendingUp size={15} /> :
                 kpi.icon === 'risk' ? <AlertTriangle size={15} /> :
                 kpi.icon === 'milestone' ? <Target size={15} /> :
                 kpi.icon === 'delivery' ? <Activity size={15} /> :
                 <CheckSquare size={15} />}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.68rem', fontWeight: 700, color: kpi.trendUp ? '#34D399' : '#FCA5A5' }}>
                {kpi.trendUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {kpi.trend}
              </div>
            </div>

            <div style={{ position: 'relative' }}>
              <div style={{
                fontSize: isMobile ? '1.4rem' : '1.75rem', fontWeight: 900,
                letterSpacing: '-0.03em', lineHeight: 1,
                background: `linear-gradient(135deg, #F1F5F9 0%, ${kpi.color} 200%)`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>
                {kpi.value}
              </div>
              {/* Subtle ambient glow behind number */}
              <div style={{ position: 'absolute', top: '50%', left: '0', transform: 'translateY(-50%)', width: '60px', height: '30px', background: `radial-gradient(ellipse, ${kpi.color}18 0%, transparent 70%)`, pointerEvents: 'none', filter: 'blur(6px)' }} />
            </div>

            <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '0.375rem', fontWeight: 500 }}>{kpi.label}</div>
            <div style={{ fontSize: '0.65rem', color: '#334155', marginTop: '2px' }}>{kpi.subValue}</div>
          </div>
        ))}
      </div>

      {/* ── Quick Actions ─────────────────────────────────────────────── */}
      <div style={{
        background: '#0C1220', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '12px', overflow: 'hidden',
      }}>
        <div style={{
          padding: '0.875rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.01em' }}>Quick Actions</span>
          <span style={{ fontSize: '0.7rem', color: '#334155' }}>6 shortcuts</span>
        </div>
        <div style={{ padding: '0.875rem 1rem', display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 3 : 6}, 1fr)`, gap: '0.625rem' }}>
          {quickActions.map((action) => (
            <button key={action.label} onClick={action.action} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
              padding: isMobile ? '0.875rem 0.25rem' : '1rem 0.5rem',
              borderRadius: '10px',
              background: action.bg,
              border: `1px solid ${action.border}`,
              cursor: 'pointer', transition: 'all 0.2s', color: action.color,
              fontFamily: 'inherit',
            }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.boxShadow = `0 12px 28px ${action.color}20`;
                e.currentTarget.style.borderColor = action.color + '45';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = action.border;
              }}
            >
              {action.icon}
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#94A3B8', textAlign: 'center', lineHeight: 1.3 }}>{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Main 3-col Grid ───────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: mainCols, gap: '1rem' }}>

        {/* Left: Client Health Matrix */}
        <div style={{ background: '#0C1220', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ padding: '0.35rem', borderRadius: '6px', background: 'rgba(0,212,255,0.12)', color: '#00D4FF' }}>
                <Activity size={13} />
              </div>
              <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#F1F5F9' }}>Client Health Matrix</span>
            </div>
            <button style={{
              padding: '0.25rem 0.75rem', borderRadius: '7px', height: '28px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              color: '#94A3B8', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500,
              transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,212,255,0.3)'; e.currentTarget.style.color = '#00D4FF'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#94A3B8'; }}
              onClick={() => navigate('/workspaces')}
            >
              All Workspaces <ArrowRight size={11} />
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '480px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <th style={{ padding: '0.6rem 1.25rem', textAlign: 'left', fontSize: '0.65rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Workspace
                  </th>
                  {['Overall', 'Budget', 'Schedule', 'Risk'].map(h => (
                    <th key={h} style={{ padding: '0.6rem 0.875rem', textAlign: 'center', fontSize: '0.65rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {h}
                    </th>
                  ))}
                  <th style={{ padding: '0.6rem 0.875rem', textAlign: 'left', fontSize: '0.65rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody>
                {ragStatusData.map((row, idx) => (
                  <tr
                    key={row.workspace}
                    style={{
                      cursor: 'pointer',
                      background: hoveredRagRow === idx ? 'rgba(0,212,255,0.04)' : 'transparent',
                      transition: 'background 0.15s',
                      borderTop: '1px solid rgba(255,255,255,0.04)',
                    }}
                    onMouseEnter={() => setHoveredRagRow(idx)}
                    onMouseLeave={() => setHoveredRagRow(null)}
                    onClick={() => navigate('/workspaces')}
                  >
                    <td style={{ padding: '0.75rem 1.25rem' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#E2E8F0', maxWidth: '190px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.workspace}
                      </div>
                    </td>
                    {[row.rag, row.budget, row.schedule, row.risk].map((status, i) => (
                      <td key={i} style={{ padding: '0.75rem 0.875rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <RagDot status={status} />
                        </div>
                      </td>
                    ))}
                    <td style={{ padding: '0.75rem 0.875rem', fontSize: '0.68rem', color: '#475569' }}>
                      {row.lastUpdated}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', gap: '1.5rem' }}>
            {[['Green', '#10B981', 'On Track'], ['Amber', '#F59E0B', 'At Risk'], ['Red', '#EF4444', 'Critical']].map(([, color, label]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}80` }} />
                <span style={{ fontSize: '0.68rem', color: '#475569' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Center: Milestone Tracker */}
        <div style={{ background: '#0C1220', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ padding: '0.35rem', borderRadius: '6px', background: 'rgba(245,158,11,0.12)', color: '#F59E0B' }}>
                <Target size={13} />
              </div>
              <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#F1F5F9' }}>Milestones</span>
            </div>
            <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '99px', background: 'rgba(245,158,11,0.12)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.2)', fontWeight: 700 }}>
              {upcomingMilestones.length} active
            </span>
          </div>
          <div>
            {upcomingMilestones.map((ms, i) => {
              const sc = milestoneStatusColor[ms.status] || '#475569';
              const fillClass = ms.status === 'At Risk' ? 'milestone-fill-amber' : ms.status === 'Delayed' ? 'milestone-fill-red' : 'milestone-fill-blue';
              return (
                <div key={ms.id} style={{
                  padding: '0.875rem 1.25rem',
                  borderBottom: i < upcomingMilestones.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  transition: 'background 0.15s',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div style={{ flex: 1, minWidth: 0, paddingRight: '0.5rem' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#E2E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ms.title}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#475569', marginTop: '2px' }}>
                        {wsNames[ms.workspace_id] || ms.workspace_id}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px', background: `${sc}15`, color: sc, border: `1px solid ${sc}25`, whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 700 }}>
                      {ms.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                    <div className="milestone-bar" style={{ flex: 1, height: '5px', borderRadius: '9999px', background: 'rgba(255,255,255,0.06)' }}>
                      <div className={fillClass} style={{ width: `${ms.completion_pct}%`, height: '100%', borderRadius: '9999px', transition: 'width 0.8s ease' }} />
                    </div>
                    <span style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 700, flexShrink: 0 }}>{ms.completion_pct}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.65rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Calendar size={9} /> {ms.due_date}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: '#F59E0B', fontWeight: 700 }}>
                      {fmtSAR(ms.value)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Board Decisions */}
        <div style={{ background: '#0C1220', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ padding: '0.35rem', borderRadius: '6px', background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}>
                <CheckSquare size={13} />
              </div>
              <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#F1F5F9' }}>Board Decisions</span>
            </div>
            <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '99px', background: 'rgba(239,68,68,0.12)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.2)', fontWeight: 700 }}>
              {activeBoardDecisions.length} open
            </span>
          </div>
          <div>
            {activeBoardDecisions.map((bd: BoardDecision, i) => {
              const pc = bd.priority === 'Critical' ? '#EF4444' : bd.priority === 'High' ? '#F59E0B' : '#0EA5E9';
              const sc = bd.status === 'In Progress' ? '#0EA5E9' : bd.status === 'Pending Implementation' ? '#F59E0B' : '#8B5CF6';
              return (
                <div key={bd.id} style={{
                  padding: '0.875rem 1.25rem',
                  borderBottom: i < activeBoardDecisions.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  transition: 'background 0.15s',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.375rem' }}>
                    <span style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px', background: `${pc}18`, color: pc, border: `1px solid ${pc}28`, fontWeight: 700 }}>
                      {bd.id}
                    </span>
                    <span style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px', background: `${pc}10`, color: pc, fontWeight: 600 }}>
                      {bd.priority}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#E2E8F0', marginBottom: '0.3rem', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {bd.title}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#475569', marginBottom: '0.5rem' }}>
                    {bd.committee} · Due {bd.dueDate}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.62rem', padding: '2px 7px', borderRadius: '4px', background: `${sc}12`, color: sc, border: `1px solid ${sc}20`, fontWeight: 600 }}>
                      {bd.status}
                    </span>
                    <button
                      onClick={() => markDecisionComplete(bd.id)}
                      style={{
                        fontSize: '0.62rem', padding: '3px 8px', borderRadius: '5px',
                        background: 'rgba(16,185,129,0.1)', color: '#34D399',
                        border: '1px solid rgba(16,185,129,0.2)', cursor: 'pointer',
                        fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '3px',
                        fontWeight: 600, transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.2)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.1)'; }}
                    >
                      <Check size={9} /> Done
                    </button>
                  </div>
                </div>
              );
            })}
            {activeBoardDecisions.length === 0 && (
              <div style={{ padding: '2.5rem 1.25rem', textAlign: 'center' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
                  <Check size={20} style={{ color: '#34D399' }} />
                </div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#34D399', marginBottom: '0.25rem' }}>All Clear</div>
                <div style={{ fontSize: '0.72rem', color: '#334155' }}>All board decisions resolved</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom Row: Charts ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: bottomCols, gap: '1rem' }}>

        {/* Delivery Performance Trend */}
        <div style={{ background: '#0C1220', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ padding: '0.35rem', borderRadius: '6px', background: 'rgba(16,185,129,0.12)', color: '#10B981' }}>
                <TrendingUp size={13} />
              </div>
              <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#F1F5F9' }}>Delivery Performance Trend</span>
            </div>
            <div style={{ display: 'flex', gap: '1.25rem' }}>
              {[{ label: 'On Time', color: '#10B981' }, { label: 'At Risk', color: '#F59E0B' }, { label: 'Delayed', color: '#EF4444' }].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <div style={{ width: 8, height: 3, borderRadius: '2px', background: l.color }} />
                  <span style={{ fontSize: '0.7rem', color: '#64748B' }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: '1rem 0.5rem 0.75rem' }}>
            <ResponsiveContainer width="100%" height={170}>
              <AreaChart data={deliveryTrendData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="onTimeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="atRiskGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="delayedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#EF4444" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<DeliveryTooltip />} />
                <Area type="monotone" dataKey="onTime" name="On Time" stroke="#10B981" strokeWidth={2} fill="url(#onTimeGrad)" />
                <Area type="monotone" dataKey="atRisk" name="At Risk" stroke="#F59E0B" strokeWidth={2} fill="url(#atRiskGrad)" />
                <Area type="monotone" dataKey="delayed" name="Delayed" stroke="#EF4444" strokeWidth={2} fill="url(#delayedGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Financial Snapshot */}
        <div style={{ background: '#0C1220', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ padding: '0.35rem', borderRadius: '6px', background: 'rgba(245,158,11,0.12)', color: '#F59E0B' }}>
                <DollarSign size={13} />
              </div>
              <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#F1F5F9' }}>Financial Snapshot</span>
            </div>
            <button style={{
              padding: '0.25rem 0.75rem', borderRadius: '7px', height: '28px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              color: '#94A3B8', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500, transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,212,255,0.3)'; e.currentTarget.style.color = '#00D4FF'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#94A3B8'; }}
              onClick={() => navigate('/workspaces')}
            >
              Details <ArrowRight size={11} />
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '340px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  {['Workspace', 'Contract', 'Spent', 'Variance'].map((h, i) => (
                    <th key={h} style={{ padding: '0.6rem 0.875rem', textAlign: i === 0 ? 'left' : 'right', fontSize: '0.65rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workspaceFinancials.map((wf) => {
                  const spentPct = Math.round((wf.spent / wf.contract_value) * 100);
                  const varColor = wf.variance <= 0 ? '#34D399' : '#FCA5A5';
                  return (
                    <tr key={wf.workspace_id} style={{ cursor: 'pointer', borderTop: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                      onClick={() => navigate('/workspaces')}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '0.55rem 0.875rem', fontSize: '0.72rem', color: '#94A3B8', fontWeight: 500, maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {wf.workspace_name}
                      </td>
                      <td style={{ padding: '0.55rem 0.875rem', textAlign: 'right', fontSize: '0.72rem', color: '#F1F5F9', fontWeight: 700 }}>
                        {fmtSAR(wf.contract_value)}
                      </td>
                      <td style={{ padding: '0.55rem 0.875rem', textAlign: 'right', fontSize: '0.72rem' }}>
                        <span style={{ color: spentPct >= 95 ? '#FCA5A5' : spentPct >= 80 ? '#FCD34D' : '#34D399', fontWeight: 700 }}>
                          {spentPct}%
                        </span>
                      </td>
                      <td style={{ padding: '0.55rem 0.875rem', textAlign: 'right', fontSize: '0.72rem', fontWeight: 700, color: varColor }}>
                        {wf.variance === 0 ? '—' : (wf.variance > 0 ? '+' : '') + fmtSAR(wf.variance)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'rgba(0,212,255,0.04)', borderTop: '1px solid rgba(0,212,255,0.1)' }}>
                  <td style={{ padding: '0.55rem 0.875rem', fontSize: '0.72rem', fontWeight: 800, color: '#F1F5F9' }}>Total</td>
                  <td style={{ padding: '0.55rem 0.875rem', textAlign: 'right', fontSize: '0.72rem', fontWeight: 800, color: '#00D4FF' }}>{fmtSAR(totalContract)}</td>
                  <td style={{ padding: '0.55rem 0.875rem', textAlign: 'right', fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8' }}>
                    {Math.round((totalSpent / totalContract) * 100)}%
                  </td>
                  <td style={{ padding: '0.55rem 0.875rem', textAlign: 'right', fontSize: '0.72rem', fontWeight: 800, color: totalVariance <= 0 ? '#34D399' : '#FCA5A5' }}>
                    {totalVariance === 0 ? '—' : (totalVariance > 0 ? '+' : '') + fmtSAR(totalVariance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* ── Overdue Alert Banner ──────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '1rem 1.375rem', borderRadius: '12px',
        flexWrap: 'wrap', gap: '0.75rem',
        background: 'linear-gradient(135deg, rgba(245,158,11,0.07) 0%, rgba(245,158,11,0.03) 100%)',
        border: '1px solid rgba(245,158,11,0.18)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: 'linear-gradient(180deg, #F59E0B, #F59E0B80)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', paddingLeft: '0.25rem' }}>
          <div style={{ padding: '0.5rem', borderRadius: '8px', background: 'rgba(245,158,11,0.15)', color: '#F59E0B', flexShrink: 0 }}>
            <AlertTriangle size={15} />
          </div>
          <div>
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#F1F5F9' }}>12 overdue tasks across 4 workspaces</span>
            {!isMobile && <span style={{ fontSize: '0.8rem', color: '#64748B', marginLeft: '0.75rem' }}>3 high-priority items may impact milestones</span>}
          </div>
        </div>
        <button className="btn-ghost" style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }} onClick={() => navigate('/tasks')}>
          Review Tasks <ArrowRight size={13} />
        </button>
      </div>

      {/* ── AI Recommendations + Approvals ───────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: width >= 768 ? '1fr 1fr' : '1fr', gap: '1rem' }}>

        {/* AI Recommendations */}
        <div style={{
          background: 'linear-gradient(160deg, #0D1220 0%, #110D22 100%)',
          border: '1px solid rgba(139,92,246,0.15)',
          borderRadius: '12px', overflow: 'hidden',
          position: 'relative',
        }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ padding: '0.35rem', borderRadius: '6px', background: 'rgba(139,92,246,0.15)', color: '#8B5CF6' }}>
                <Bot size={13} />
              </div>
              <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#F1F5F9' }}>AI Recommendations</span>
            </div>
            <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '99px', background: 'rgba(139,92,246,0.15)', color: '#C4B5FD', border: '1px solid rgba(139,92,246,0.25)', fontWeight: 700 }}>
              {recommendations.length} active
            </span>
          </div>
          <div style={{ padding: '0.875rem', position: 'relative' }}>
            {recommendations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(139,92,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
                  <Sparkles size={20} style={{ color: '#8B5CF6' }} />
                </div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#8B5CF6', marginBottom: '0.25rem' }}>All caught up!</div>
                <div style={{ fontSize: '0.72rem', color: '#334155' }}>No pending AI recommendations</div>
              </div>
            ) : recommendations.map((rec) => (
              <div key={rec.id} style={{
                padding: '0.875rem', borderRadius: '10px', marginBottom: '0.625rem',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                cursor: 'pointer', transition: 'all 0.2s', position: 'relative',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)'; e.currentTarget.style.background = 'rgba(139,92,246,0.04)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
              >
                <button onClick={(e) => { e.stopPropagation(); dismissRec(rec.id); }} style={{
                  position: 'absolute', top: '7px', right: '7px',
                  background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer',
                  color: '#334155', padding: '3px', borderRadius: '5px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#334155'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                >
                  <X size={11} />
                </button>
                <div style={{ display: 'flex', gap: '0.625rem', paddingRight: '1rem' }}>
                  <div style={{ padding: '0.5rem', borderRadius: '8px', background: `${rec.color}15`, color: rec.color, flexShrink: 0 }}>
                    {rec.icon === 'zap' ? <Zap size={14} /> : rec.icon === 'alert' ? <AlertTriangle size={14} /> : <Clock size={14} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#F1F5F9', marginBottom: '3px' }}>{rec.title}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748B', marginBottom: '0.625rem', lineHeight: 1.5 }}>{rec.detail}</div>
                    <button onClick={() => navigate(rec.path)} style={{
                      fontSize: '0.7rem', color: '#A78BFA', background: 'transparent',
                      border: 'none', cursor: 'pointer', padding: 0,
                      display: 'flex', alignItems: 'center', gap: '3px', fontFamily: 'inherit',
                      fontWeight: 600, transition: 'color 0.15s',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#C4B5FD'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#A78BFA'; }}
                    >
                      {rec.action} <ArrowRight size={11} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Approvals */}
        <div style={{ background: '#0C1220', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ padding: '0.35rem', borderRadius: '6px', background: 'rgba(245,158,11,0.12)', color: '#F59E0B' }}>
                <CheckSquare size={13} />
              </div>
              <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#F1F5F9' }}>Pending Approvals</span>
            </div>
            <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '99px', background: 'rgba(245,158,11,0.12)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.2)', fontWeight: 700 }}>
              {approvals.filter(a => a.status === 'pending').length} pending
            </span>
          </div>
          <div>
            {approvals.map((item, i) => (
              <div key={item.id} style={{
                padding: '0.875rem 1.25rem',
                borderBottom: i < approvals.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                opacity: item.status !== 'pending' ? 0.45 : 1,
                transition: 'opacity 0.3s',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: item.status === 'pending' ? '0.625rem' : 0 }}>
                  <div style={{ minWidth: 0, paddingRight: '0.5rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#E2E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '2px' }}>{item.type}</div>
                  </div>
                  <span style={{
                    fontSize: '0.62rem', padding: '2px 7px', borderRadius: '5px', flexShrink: 0,
                    background: item.status !== 'pending' ? (item.status === 'approved' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)') :
                      item.urgency === 'High' ? 'rgba(239,68,68,0.12)' : item.urgency === 'Medium' ? 'rgba(245,158,11,0.1)' : 'rgba(148,163,184,0.1)',
                    color: item.status !== 'pending' ? (item.status === 'approved' ? '#34D399' : '#FCA5A5') :
                      item.urgency === 'High' ? '#FCA5A5' : item.urgency === 'Medium' ? '#FCD34D' : '#94A3B8',
                    border: `1px solid ${item.status !== 'pending' ? (item.status === 'approved' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)') :
                      item.urgency === 'High' ? 'rgba(239,68,68,0.18)' : item.urgency === 'Medium' ? 'rgba(245,158,11,0.15)' : 'rgba(148,163,184,0.1)'}`,
                    fontWeight: 700, textTransform: 'capitalize',
                  }}>
                    {item.status !== 'pending' ? item.status : item.urgency}
                  </span>
                </div>
                {item.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => handleApprove(item.id)} style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                      padding: '0.375rem', borderRadius: '7px', border: '1px solid rgba(16,185,129,0.2)',
                      cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: 700,
                      background: 'rgba(16,185,129,0.1)', color: '#34D399', transition: 'all 0.15s',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.22)'; e.currentTarget.style.borderColor = 'rgba(16,185,129,0.35)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.1)'; e.currentTarget.style.borderColor = 'rgba(16,185,129,0.2)'; }}
                    >
                      <Check size={12} /> Approve
                    </button>
                    <button onClick={() => handleReject(item.id)} style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                      padding: '0.375rem', borderRadius: '7px', border: '1px solid rgba(239,68,68,0.18)',
                      cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: 700,
                      background: 'rgba(239,68,68,0.08)', color: '#FCA5A5', transition: 'all 0.15s',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.18)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.18)'; }}
                    >
                      <X size={12} /> Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Activity Feed ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: width >= 900 ? '1fr 340px' : '1fr', gap: '1rem' }}>

        {/* Activity list */}
        <div style={{ background: '#0C1220', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ padding: '0.35rem', borderRadius: '6px', background: 'rgba(0,212,255,0.12)', color: '#00D4FF' }}>
                <Activity size={13} />
              </div>
              <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#F1F5F9' }}>Activity Feed</span>
            </div>
            <div style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.03)', padding: '2px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
              {activityTypes.map(t => (
                <button key={t} onClick={() => setActivityFilter(t)} style={{
                  padding: '0.25rem 0.625rem', borderRadius: '6px', border: 'none',
                  cursor: 'pointer', fontSize: '0.72rem', fontFamily: 'inherit', fontWeight: 600,
                  transition: 'all 0.15s',
                  background: activityFilter === t ? 'rgba(0,212,255,0.12)' : 'transparent',
                  color: activityFilter === t ? '#00D4FF' : '#64748B',
                }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
            {filteredActivities.slice(0, 12).map((activity, i) => (
              <div key={i} style={{
                padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                transition: 'background 0.15s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <ActivityIcon type={activity.type} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#E2E8F0', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activity.action} {activity.target}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.68rem', color: '#64748B' }}>{activity.workspace}</span>
                    {activity.user && (
                      <>
                        <span style={{ color: '#1E3A5F', fontSize: '0.65rem' }}>·</span>
                        <span style={{ fontSize: '0.68rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'linear-gradient(135deg, #0EA5E9, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.5rem', fontWeight: 700, color: 'white' }}>
                            {activity.user.charAt(0)}
                          </div>
                          {activity.user}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <span style={{ fontSize: '0.65rem', color: '#334155', flexShrink: 0, marginTop: '2px' }}>{activity.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Document Distribution Pie */}
        <div style={{ background: '#0C1220', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ padding: '0.35rem', borderRadius: '6px', background: 'rgba(14,165,233,0.12)', color: '#0EA5E9' }}>
                <FileText size={13} />
              </div>
              <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#F1F5F9' }}>Document Distribution</span>
            </div>
          </div>
          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={documentsByTypeData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3} dataKey="value">
                  {documentsByTypeData.map((_entry: unknown, index: number) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#101828', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '0.75rem' }}
                  labelStyle={{ color: '#94A3B8' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.375rem 1rem', width: '100%' }}>
              {documentsByTypeData.map((entry: { name: string; value: number }, index: number) => (
                <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '2px', background: PIE_COLORS[index % PIE_COLORS.length], flexShrink: 0 }} />
                  <span style={{ fontSize: '0.68rem', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</span>
                  <span style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 700, marginLeft: 'auto' }}>{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Upload Modal ──────────────────────────────────────────────── */}
      {showUploadModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(6px)' }}
          onClick={() => setShowUploadModal(false)}
        >
          <div style={{
            background: '#0C1220', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px',
            padding: '1.75rem', width: '100%', maxWidth: '480px',
            boxShadow: '0 24px 64px rgba(0,0,0,0.65)',
            position: 'relative', overflow: 'hidden',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,212,255,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#F1F5F9', letterSpacing: '-0.01em' }}>Upload Document</h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.75rem', color: '#64748B' }}>Add files to a workspace for AI processing</p>
              </div>
              <button onClick={() => setShowUploadModal(false)} style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px', cursor: 'pointer', color: '#64748B', padding: '6px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.color = '#94A3B8'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#64748B'; }}
              >
                <X size={16} />
              </button>
            </div>
            <div
              onDragOver={e => { e.preventDefault(); setUploadDrag(true); }}
              onDragLeave={() => setUploadDrag(false)}
              onDrop={e => { e.preventDefault(); setUploadDrag(false); }}
              style={{
                border: `2px dashed ${uploadDrag ? '#00D4FF' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: '12px', padding: '2.5rem 1.5rem', textAlign: 'center', cursor: 'pointer',
                background: uploadDrag ? 'rgba(0,212,255,0.05)' : 'rgba(255,255,255,0.02)',
                transition: 'all 0.2s', marginBottom: '1.25rem',
              }}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <div style={{ width: 48, height: 48, borderRadius: '12px', background: uploadDrag ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.875rem' }}>
                <Upload size={22} style={{ color: uploadDrag ? '#00D4FF' : '#475569' }} />
              </div>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: uploadDrag ? '#00D4FF' : '#94A3B8', marginBottom: '0.375rem' }}>
                {uploadDrag ? 'Drop to upload' : 'Drop files here or click to browse'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#334155' }}>PDF, DOCX, XLSX, PPTX — up to 50MB each</div>
              <input id="file-input" type="file" multiple style={{ display: 'none' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Workspace</label>
                <select style={{ width: '100%', padding: '0.625rem 0.75rem', background: '#080C18', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '8px', color: '#F1F5F9', fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none' }}>
                  <option>NCA Digital Transformation</option>
                  <option>Banking Core Transformation</option>
                  <option>Smart City PMO</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Document Type</label>
                <select style={{ width: '100%', padding: '0.625rem 0.75rem', background: '#080C18', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '8px', color: '#F1F5F9', fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none' }}>
                  <option>BRD</option>
                  <option>FRD</option>
                  <option>Meeting Minutes</option>
                  <option>Proposal</option>
                  <option>Report</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowUploadModal(false)}>Cancel</button>
              <button className="btn-primary" style={{ flex: 2, justifyContent: 'center' }} onClick={() => { setShowUploadModal(false); navigate('/documents'); }}>
                <Upload size={14} /> Upload & Process
              </button>
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
