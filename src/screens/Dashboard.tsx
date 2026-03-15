import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase, FileText, Zap, CheckSquare, Clock, AlertTriangle,
  TrendingUp, TrendingDown, Upload, Video, Sparkles, ArrowRight,
  Circle, Bot, Check, X, ChevronRight, RefreshCw, Eye,
  Calendar, BarChart3, Play, DollarSign, Target, Activity,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import {
  automationRunsData, documentsByTypeData, activities, meetings,
  portfolioKPIs, ragStatusData, deliveryTrendData, boardDecisions,
  workspaceFinancials, milestones,
  type PortfolioKPI, type BoardDecision,
} from '../data/mockData';
import { useLayout } from '../hooks/useLayout';

type Period = 'today' | 'week' | 'month';

const RAG_COLORS: Record<string, string> = {
  Green: '#10B981',
  Amber: '#F59E0B',
  Red: '#EF4444',
};

function RagDot({ status }: { status: 'Green' | 'Amber' | 'Red' }) {
  return (
    <div style={{
      width: 10, height: 10, borderRadius: '50%',
      background: RAG_COLORS[status],
      boxShadow: `0 0 6px ${RAG_COLORS[status]}80`,
      flexShrink: 0,
    }} />
  );
}

function fmtSAR(val: number): string {
  if (val >= 1000000) return `⃁${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `⃁${(val / 1000).toFixed(0)}K`;
  return `⃁${val.toLocaleString()}`;
}

type ApprovalStatus = 'pending' | 'approved' | 'rejected';
interface Approval { id: number; title: string; requester: string; type: string; urgency: string; status: ApprovalStatus; }

const initialApprovals: Approval[] = [
  { id: 1, title: 'NCA BRD v2.3', requester: 'AM', type: 'Document Approval', urgency: 'High', status: 'pending' },
  { id: 2, title: 'SC-10 Budget ⃁2.4M', requester: 'RT', type: 'Budget Approval', urgency: 'High', status: 'pending' },
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
      <div style={{ background: '#111B35', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 12px', fontSize: '0.75rem', color: '#F1F5F9' }}>
        <p style={{ margin: 0, color: '#94A3B8' }}>{label}</p>
        <p style={{ margin: 0, color: '#00D4FF', fontWeight: 600 }}>{payload[0].value} runs</p>
      </div>
    );
  }
  return null;
};

const DeliveryTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) => {
  if (active && payload?.length) {
    return (
      <div style={{ background: '#111B35', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px 14px', fontSize: '0.75rem' }}>
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

export default function Dashboard() {
  const navigate = useNavigate();
  const { isMobile, isTablet, width } = useLayout();
  const [period, setPeriod] = useState<Period>('week');
  const [approvals, setApprovals] = useState<Approval[]>(initialApprovals);
  const [recommendations, setRecommendations] = useState(initialRecommendations);
  const [uploadDrag, setUploadDrag] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activityFilter, setActivityFilter] = useState<string>('All');
  const [completedDecisions, setCompletedDecisions] = useState<Set<string>>(new Set());
  const [hoveredRagRow, setHoveredRagRow] = useState<number | null>(null);

  const handleApprove = (id: number) => setApprovals(prev => prev.map(a => a.id === id ? { ...a, status: 'approved' as const } : a));
  const handleReject = (id: number) => setApprovals(prev => prev.map(a => a.id === id ? { ...a, status: 'rejected' as const } : a));
  const dismissRec = (id: number) => setRecommendations(prev => prev.filter(r => r.id !== id));
  const handleRefresh = () => { setRefreshing(true); setTimeout(() => setRefreshing(false), 1200); };
  const markDecisionComplete = (id: string) => setCompletedDecisions(prev => new Set([...prev, id]));

  const activityTypes = ['All', 'Document', 'Meeting', 'Automation', 'Task'];
  const filteredActivities = activityFilter === 'All' ? activities : activities.filter(a => a.type === activityFilter.toLowerCase());

  const quickActions = [
    { icon: <Upload size={20} />, label: 'Upload Doc', color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)', action: () => setShowUploadModal(true) },
    { icon: <Zap size={20} />, label: 'Run Automation', color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)', action: () => navigate('/automations') },
    { icon: <Video size={20} />, label: 'New Meeting', color: '#10B981', bg: 'rgba(16,185,129,0.1)', action: () => navigate('/meetings') },
    { icon: <FileText size={20} />, label: 'Generate BRD', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', action: () => navigate('/automations') },
    { icon: <BarChart3 size={20} />, label: 'New Report', color: '#EC4899', bg: 'rgba(236,72,153,0.1)', action: () => navigate('/reports') },
    { icon: <Sparkles size={20} />, label: 'Ask AI', color: '#00D4FF', bg: 'rgba(0,212,255,0.1)', action: () => navigate('/knowledge') },
  ];

  const kpiCols = width >= 1200 ? 6 : width >= 900 ? 3 : 2;
  const mainCols = width >= 1200 ? '50% 25% 25%' : width >= 900 ? '1fr 1fr' : '1fr';
  const bottomCols = width >= 900 ? '1.5fr 1fr' : '1fr';
  const p = isMobile ? '0.875rem' : '1.5rem';
  const gap = isMobile ? '0.875rem' : '1.25rem';

  // Upcoming milestones sorted by due date, top 5 non-completed
  const upcomingMilestones = [...milestones]
    .filter(m => m.status !== 'Completed')
    .slice(0, 5);

  // Board decisions - non-closed
  const activeBoardDecisions = boardDecisions.filter(d => d.status !== 'Closed' && !completedDecisions.has(d.id));

  // Financial snapshot totals
  const totalContract = workspaceFinancials.reduce((s, w) => s + w.contractValue, 0);
  const totalSpent = workspaceFinancials.reduce((s, w) => s + w.spent, 0);
  const totalVariance = workspaceFinancials.reduce((s, w) => s + w.variance, 0);

  // Workspace short names map
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

  return (
    <div style={{ padding: p, display: 'flex', flexDirection: 'column', gap }}>

      {/* Hero Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0D1B3E 0%, #0A0F1E 60%, #0D1527 100%)',
        border: '1px solid rgba(14,165,233,0.15)',
        borderRadius: '12px',
        padding: isMobile ? '1rem' : '1.5rem',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,212,255,0.08) 0%, transparent 70%)' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
              Board Overview · 15 March 2026
            </div>
            <h1 style={{ margin: 0, fontSize: isMobile ? '1.25rem' : '1.5rem', fontWeight: 900, color: '#F1F5F9', letterSpacing: '-0.02em' }}>
              Client Command Center
            </h1>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569', marginTop: '0.25rem' }}>
              8 active clients · ⃁23.4M total engagement value · Last updated 13 Mar 2026
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: 'rgba(255,255,255,0.04)', borderRadius: '0.625rem', padding: '3px', border: '1px solid rgba(255,255,255,0.06)' }}>
              {(['today', 'week', 'month'] as Period[]).map(pv => (
                <button key={pv} onClick={() => setPeriod(pv)} style={{ padding: '0.3rem 0.875rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.2s', background: period === pv ? 'rgba(14,165,233,0.15)' : 'transparent', color: period === pv ? '#38BDF8' : '#475569' }}>
                  {pv.charAt(0).toUpperCase() + pv.slice(1)}
                </button>
              ))}
            </div>
            <button onClick={handleRefresh} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.3rem 0.75rem', borderRadius: '0.5rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', color: '#475569', fontSize: '0.78rem', fontFamily: 'inherit' }}>
              <RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
              {!isMobile && 'Refresh'}
            </button>
            <button onClick={() => navigate('/reports')} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.3rem 0.75rem', borderRadius: '0.5rem', background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)', cursor: 'pointer', color: '#38BDF8', fontSize: '0.78rem', fontFamily: 'inherit' }}>
              <Eye size={13} /> {!isMobile && 'View Reports'}
            </button>
          </div>
        </div>
      </div>

      {/* Portfolio KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${kpiCols}, 1fr)`, gap: isMobile ? '0.625rem' : '0.875rem' }}>
        {portfolioKPIs.map((kpi: PortfolioKPI) => (
          <div key={kpi.label} className="metric-card" style={{ cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = kpi.color + '40'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'; }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${kpi.color}, transparent)` }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ padding: '0.45rem', borderRadius: '8px', background: kpi.color + '15', color: kpi.color, fontSize: '1rem' }}>
                {kpi.icon === 'portfolio' ? <Briefcase size={16} /> :
                 kpi.icon === 'revenue' ? <TrendingUp size={16} /> :
                 kpi.icon === 'risk' ? <AlertTriangle size={16} /> :
                 kpi.icon === 'milestone' ? <Target size={16} /> :
                 kpi.icon === 'delivery' ? <Activity size={16} /> :
                 <CheckSquare size={16} />}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.68rem', fontWeight: 600, color: kpi.trendUp ? '#34D399' : '#FCA5A5' }}>
                {kpi.trendUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {kpi.trend}
              </div>
            </div>
            <div style={{ fontSize: isMobile ? '1.3rem' : '1.6rem', fontWeight: 900, color: '#F1F5F9', lineHeight: 1, letterSpacing: '-0.02em' }}>
              {kpi.value}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: '0.375rem' }}>{kpi.label}</div>
            <div style={{ fontSize: '0.65rem', color: '#334155', marginTop: '2px' }}>{kpi.subValue}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="section-card">
        <div className="section-card-header">
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Quick Actions</span>
        </div>
        <div style={{ padding: '0.875rem', display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 3 : 6}, 1fr)`, gap: '0.625rem' }}>
          {quickActions.map((action) => (
            <button key={action.label} onClick={action.action} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: isMobile ? '0.75rem 0.25rem' : '0.875rem 0.5rem', borderRadius: '0.75rem', background: action.bg, border: `1px solid ${action.color}22`, cursor: 'pointer', transition: 'all 0.2s', color: action.color }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 20px ${action.color}25`; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              {action.icon}
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#94A3B8', textAlign: 'center', lineHeight: 1.3 }}>{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main 3-col Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: mainCols, gap: '1rem' }}>

        {/* Left 50%: Portfolio Health Matrix */}
        <div className="section-card">
          <div className="section-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={14} style={{ color: '#00D4FF' }} />
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Client Health Matrix</span>
            </div>
            <button className="btn-ghost" style={{ padding: '0.25rem 0.625rem', fontSize: '0.72rem' }} onClick={() => navigate('/workspaces')}>
              All Workspaces
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '480px' }}>
              <thead>
                <tr>
                  <th style={{ padding: '0.5rem 1rem', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    Workspace
                  </th>
                  {['Overall', 'Budget', 'Schedule', 'Risk'].map(h => (
                    <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontSize: '0.68rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      {h}
                    </th>
                  ))}
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
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
                      background: hoveredRagRow === idx ? 'rgba(14,165,233,0.04)' : 'transparent',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={() => setHoveredRagRow(idx)}
                    onMouseLeave={() => setHoveredRagRow(null)}
                    onClick={() => navigate('/workspaces')}
                  >
                    <td style={{ padding: '0.625rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#F1F5F9', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.workspace}
                      </div>
                    </td>
                    {[row.rag, row.budget, row.schedule, row.risk].map((status, i) => (
                      <td key={i} style={{ padding: '0.625rem 0.75rem', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <RagDot status={status} />
                        </div>
                      </td>
                    ))}
                    <td style={{ padding: '0.625rem 0.75rem', fontSize: '0.68rem', color: '#334155', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      {row.lastUpdated}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '0.625rem 1rem', display: 'flex', gap: '1.25rem' }}>
            {[['Green', '#10B981'], ['Amber', '#F59E0B'], ['Red', '#EF4444']].map(([label, color]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color as string }} />
                <span style={{ fontSize: '0.68rem', color: '#475569' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Center 25%: Milestone Tracker */}
        <div className="section-card">
          <div className="section-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Target size={14} style={{ color: '#F59E0B' }} />
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Milestone Tracker</span>
            </div>
            <span style={{ fontSize: '0.65rem', padding: '1px 7px', borderRadius: '9999px', background: 'rgba(245,158,11,0.15)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.25)' }}>
              {upcomingMilestones.length} active
            </span>
          </div>
          <div style={{ padding: '0.5rem 0' }}>
            {upcomingMilestones.map((ms, i) => {
              const sc = milestoneStatusColor[ms.status] || '#475569';
              const fillClass = ms.status === 'At Risk' ? 'milestone-fill-amber' : ms.status === 'Delayed' ? 'milestone-fill-red' : 'milestone-fill-blue';
              return (
                <div key={ms.id} style={{ padding: '0.75rem 1rem', borderBottom: i < upcomingMilestones.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.375rem' }}>
                    <div style={{ flex: 1, minWidth: 0, paddingRight: '0.5rem' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ms.title}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#334155', marginTop: '1px' }}>
                        {wsNames[ms.workspaceId] || ms.workspaceId}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: '3px', background: `${sc}15`, color: sc, border: `1px solid ${sc}25`, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {ms.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                    <div className="milestone-bar" style={{ flex: 1 }}>
                      <div className={fillClass} style={{ width: `${ms.completionPct}%`, height: '100%', borderRadius: 3, transition: 'width 0.8s ease' }} />
                    </div>
                    <span style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 600, flexShrink: 0 }}>{ms.completionPct}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.65rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Calendar size={9} /> {ms.dueDate}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: '#F59E0B', fontWeight: 600 }}>
                      {fmtSAR(ms.value)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 25%: Board Decisions */}
        <div className="section-card">
          <div className="section-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckSquare size={14} style={{ color: '#EF4444' }} />
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Board Decisions</span>
            </div>
            <span style={{ fontSize: '0.65rem', padding: '1px 7px', borderRadius: '9999px', background: 'rgba(239,68,68,0.15)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.25)' }}>
              {activeBoardDecisions.length} open
            </span>
          </div>
          <div style={{ padding: '0.375rem 0' }}>
            {activeBoardDecisions.map((bd: BoardDecision, i) => {
              const pc = bd.priority === 'Critical' ? '#EF4444' : bd.priority === 'High' ? '#F59E0B' : '#0EA5E9';
              const sc = bd.status === 'In Progress' ? '#0EA5E9' : bd.status === 'Pending Implementation' ? '#F59E0B' : '#8B5CF6';
              return (
                <div key={bd.id} style={{ padding: '0.75rem 1rem', borderBottom: i < activeBoardDecisions.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.62rem', padding: '1px 5px', borderRadius: '3px', background: `${pc}15`, color: pc, border: `1px solid ${pc}25`, fontWeight: 600 }}>
                      {bd.id}
                    </span>
                    <span style={{ fontSize: '0.62rem', padding: '1px 5px', borderRadius: '3px', background: `${pc}10`, color: pc }}>
                      {bd.priority}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#F1F5F9', marginBottom: '0.25rem', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {bd.title}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#475569', marginBottom: '0.375rem' }}>
                    {bd.committee} · Due {bd.dueDate}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.62rem', padding: '1px 6px', borderRadius: '3px', background: `${sc}12`, color: sc, border: `1px solid ${sc}20` }}>
                      {bd.status}
                    </span>
                    <button
                      onClick={() => markDecisionComplete(bd.id)}
                      style={{ fontSize: '0.62rem', padding: '2px 7px', borderRadius: '4px', background: 'rgba(16,185,129,0.1)', color: '#34D399', border: '1px solid rgba(16,185,129,0.2)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '3px' }}
                    >
                      <Check size={9} /> Done
                    </button>
                  </div>
                </div>
              );
            })}
            {activeBoardDecisions.length === 0 && (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#334155', fontSize: '0.8rem' }}>
                All decisions resolved
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div style={{ display: 'grid', gridTemplateColumns: bottomCols, gap: '1rem' }}>

        {/* Delivery Performance Trend */}
        <div className="section-card">
          <div className="section-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={14} style={{ color: '#10B981' }} />
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Delivery Performance Trend</span>
            </div>
            <span style={{ fontSize: '0.7rem', color: '#475569' }}>7-month client delivery trend</span>
          </div>
          <div style={{ padding: '0.75rem 0.25rem 0.5rem' }}>
            <div style={{ display: 'flex', gap: '1.25rem', padding: '0 1rem', marginBottom: '0.75rem' }}>
              {[{ label: 'On Time', color: '#10B981' }, { label: 'At Risk', color: '#F59E0B' }, { label: 'Delayed', color: '#EF4444' }].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
                  <span style={{ fontSize: '0.7rem', color: '#475569' }}>{l.label}</span>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={deliveryTrendData}>
                <defs>
                  <linearGradient id="onTimeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="atRiskGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="delayedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#EF4444" stopOpacity={0.25} />
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
        <div className="section-card">
          <div className="section-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <DollarSign size={14} style={{ color: '#F59E0B' }} />
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Financial Snapshot</span>
            </div>
            <button className="btn-ghost" style={{ padding: '0.25rem 0.625rem', fontSize: '0.72rem' }} onClick={() => navigate('/workspaces')}>
              Details
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '360px' }}>
              <thead>
                <tr>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.65rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Workspace</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontSize: '0.65rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Contract</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontSize: '0.65rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Spent %</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontSize: '0.65rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Variance</th>
                </tr>
              </thead>
              <tbody>
                {workspaceFinancials.map((wf) => {
                  const spentPct = Math.round((wf.spent / wf.contractValue) * 100);
                  const varColor = wf.variance <= 0 ? '#34D399' : '#FCA5A5';
                  return (
                    <tr key={wf.workspaceId} style={{ cursor: 'pointer' }} onClick={() => navigate('/workspaces')}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.72rem', color: '#94A3B8', borderBottom: '1px solid rgba(255,255,255,0.04)', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {wsNames[wf.workspaceId] || wf.workspaceId}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontSize: '0.72rem', color: '#F1F5F9', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        {fmtSAR(wf.contractValue)}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontSize: '0.72rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <span style={{ color: spentPct >= 95 ? '#FCA5A5' : spentPct >= 80 ? '#FCD34D' : '#34D399', fontWeight: 600 }}>
                          {spentPct}%
                        </span>
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontSize: '0.72rem', fontWeight: 700, color: varColor, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        {wf.variance === 0 ? '—' : (wf.variance > 0 ? '+' : '') + fmtSAR(wf.variance)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.72rem', fontWeight: 700, color: '#F1F5F9' }}>Total</td>
                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontSize: '0.72rem', fontWeight: 700, color: '#00D4FF' }}>{fmtSAR(totalContract)}</td>
                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8' }}>
                    {Math.round((totalSpent / totalContract) * 100)}%
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontSize: '0.72rem', fontWeight: 700, color: totalVariance <= 0 ? '#34D399' : '#FCA5A5' }}>
                    {totalVariance === 0 ? '—' : (totalVariance > 0 ? '+' : '') + fmtSAR(totalVariance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Overdue Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1.25rem', borderRadius: '0.75rem', flexWrap: 'wrap', gap: '0.5rem', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <AlertTriangle size={16} style={{ color: '#F59E0B', flexShrink: 0 }} />
          <div>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>12 overdue tasks across 4 workspaces</span>
            {!isMobile && <span style={{ fontSize: '0.8rem', color: '#475569', marginLeft: '0.75rem' }}>3 high-priority items may impact milestones</span>}
          </div>
        </div>
        <button className="btn-ghost" style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }} onClick={() => navigate('/tasks')}>
          Review Tasks <ArrowRight size={13} />
        </button>
      </div>

      {/* AI Recommendations + Approvals */}
      <div style={{ display: 'grid', gridTemplateColumns: width >= 768 ? '1fr 1fr' : '1fr', gap: '1rem' }}>
        <div className="section-card" style={{ background: 'linear-gradient(160deg, #0D1527 0%, #130D2A 100%)' }}>
          <div className="section-card-header" style={{ borderBottom: '1px solid rgba(139,92,246,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bot size={14} style={{ color: '#8B5CF6' }} />
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>AI Recommendations</span>
            </div>
            <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '9999px', background: 'rgba(139,92,246,0.15)', color: '#C4B5FD', border: '1px solid rgba(139,92,246,0.25)' }}>
              {recommendations.length} active
            </span>
          </div>
          <div style={{ padding: '0.75rem' }}>
            {recommendations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 1rem', color: '#334155', fontSize: '0.8rem' }}>All caught up!</div>
            ) : recommendations.map((rec) => (
              <div key={rec.id} style={{ padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '0.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', transition: 'all 0.2s', position: 'relative' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}
              >
                <button onClick={(e) => { e.stopPropagation(); dismissRec(rec.id); }} style={{ position: 'absolute', top: '6px', right: '6px', background: 'none', border: 'none', cursor: 'pointer', color: '#334155', padding: '2px', borderRadius: '4px' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#94A3B8')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#334155')}
                >
                  <X size={12} />
                </button>
                <div style={{ display: 'flex', gap: '0.5rem', paddingRight: '1rem' }}>
                  <div style={{ padding: '0.375rem', borderRadius: '6px', background: `${rec.color}15`, color: rec.color, flexShrink: 0 }}>
                    {rec.icon === 'zap' ? <Zap size={14} /> : rec.icon === 'alert' ? <AlertTriangle size={14} /> : <Clock size={14} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#F1F5F9', marginBottom: '2px' }}>{rec.title}</div>
                    <div style={{ fontSize: '0.7rem', color: '#475569', marginBottom: '0.5rem' }}>{rec.detail}</div>
                    <button onClick={() => navigate(rec.path)} style={{ fontSize: '0.7rem', color: '#A78BFA', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '3px', fontFamily: 'inherit' }}>
                      {rec.action} <ArrowRight size={11} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="section-card">
          <div className="section-card-header">
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Pending Approvals</span>
            <span style={{ fontSize: '0.68rem', padding: '1px 7px', borderRadius: '9999px', background: 'rgba(245,158,11,0.15)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.25)' }}>
              {approvals.filter(a => a.status === 'pending').length}
            </span>
          </div>
          <div style={{ padding: '0.375rem 0' }}>
            {approvals.map((item, i) => (
              <div key={item.id} style={{ padding: '0.625rem 1rem', borderBottom: i < approvals.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', opacity: item.status !== 'pending' ? 0.5 : 1, transition: 'opacity 0.3s' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: item.status === 'pending' ? '0.5rem' : 0 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 500, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                    <div style={{ fontSize: '0.7rem', color: '#475569' }}>{item.type}</div>
                  </div>
                  <span style={{ fontSize: '0.62rem', padding: '2px 6px', borderRadius: '4px', flexShrink: 0, marginLeft: '0.5rem', background: item.urgency === 'High' ? 'rgba(239,68,68,0.15)' : item.urgency === 'Medium' ? 'rgba(245,158,11,0.1)' : 'rgba(148,163,184,0.1)', color: item.urgency === 'High' ? '#FCA5A5' : item.urgency === 'Medium' ? '#FCD34D' : '#94A3B8', border: `1px solid ${item.urgency === 'High' ? 'rgba(239,68,68,0.2)' : item.urgency === 'Medium' ? 'rgba(245,158,11,0.15)' : 'rgba(148,163,184,0.1)'}` }}>
                    {item.status !== 'pending' ? item.status : item.urgency}
                  </span>
                </div>
                {item.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '0.375rem' }}>
                    <button onClick={() => handleApprove(item.id)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '0.3rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.7rem', fontWeight: 600, background: 'rgba(16,185,129,0.15)', color: '#34D399', transition: 'all 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(16,185,129,0.25)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(16,185,129,0.15)')}
                    >
                      <Check size={11} /> Approve
                    </button>
                    <button onClick={() => handleReject(item.id)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '0.3rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.7rem', fontWeight: 600, background: 'rgba(239,68,68,0.1)', color: '#FCA5A5', transition: 'all 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
                    >
                      <X size={11} /> Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(4px)' }} onClick={() => setShowUploadModal(false)}>
          <div style={{ background: '#0D1527', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '480px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#F1F5F9' }}>Upload Document</h3>
              <button onClick={() => setShowUploadModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '4px', borderRadius: '6px' }}>
                <X size={18} />
              </button>
            </div>
            <div onDragOver={e => { e.preventDefault(); setUploadDrag(true); }} onDragLeave={() => setUploadDrag(false)} onDrop={e => { e.preventDefault(); setUploadDrag(false); }}
              style={{ border: `2px dashed ${uploadDrag ? '#0EA5E9' : 'rgba(255,255,255,0.12)'}`, borderRadius: '12px', padding: '2.5rem 1.5rem', textAlign: 'center', cursor: 'pointer', background: uploadDrag ? 'rgba(14,165,233,0.05)' : 'rgba(255,255,255,0.02)', transition: 'all 0.2s', marginBottom: '1rem' }}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <Upload size={28} style={{ color: uploadDrag ? '#0EA5E9' : '#334155', marginBottom: '0.75rem' }} />
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#94A3B8', marginBottom: '0.375rem' }}>Drop files here or click to browse</div>
              <div style={{ fontSize: '0.75rem', color: '#334155' }}>PDF, DOCX, XLSX, PPTX up to 50MB</div>
              <input id="file-input" type="file" multiple style={{ display: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.72rem', color: '#475569', display: 'block', marginBottom: '0.375rem' }}>Workspace</label>
                <select className="input-field" style={{ height: '36px' }}>
                  <option>NCA Digital Transformation</option>
                  <option>Banking Core Transformation</option>
                  <option>Smart City PMO</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.72rem', color: '#475569', display: 'block', marginBottom: '0.375rem' }}>Document Type</label>
                <select className="input-field" style={{ height: '36px' }}>
                  <option>BRD</option>
                  <option>FRD</option>
                  <option>Meeting Minutes</option>
                  <option>Proposal</option>
                  <option>Report</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.625rem' }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowUploadModal(false)}>Cancel</button>
              <button className="btn-primary" style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }} onClick={() => { setShowUploadModal(false); navigate('/documents'); }}>
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
