import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase, FileText, Zap, CheckSquare, Clock, AlertTriangle,
  TrendingUp, TrendingDown, Upload, Video, Sparkles, ArrowRight,
  Circle, Bot, Check, X, ChevronRight, RefreshCw, Eye,
  Calendar, BarChart3, Play,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { automationRunsData, documentsByTypeData, activities, meetings } from '../data/mockData';
import { useLayout } from '../hooks/useLayout';

type Period = 'today' | 'week' | 'month';

const kpiData: Record<Period, { value: string; trend: string; trendUp: boolean }[]> = {
  today: [
    { value: '3', trend: '+1', trendUp: true },
    { value: '24', trend: '+5', trendUp: true },
    { value: '38', trend: '+12', trendUp: true },
    { value: '6', trend: '-2', trendUp: false },
    { value: '2', trend: '+1', trendUp: false },
    { value: '1', trend: '0', trendUp: true },
  ],
  week: [
    { value: '12', trend: '+2', trendUp: true },
    { value: '847', trend: '+34', trendUp: true },
    { value: '1,284', trend: '+128', trendUp: true },
    { value: '34', trend: '-6', trendUp: false },
    { value: '8', trend: '+3', trendUp: false },
    { value: '3', trend: '+1', trendUp: false },
  ],
  month: [
    { value: '18', trend: '+6', trendUp: true },
    { value: '2,341', trend: '+412', trendUp: true },
    { value: '4,820', trend: '+891', trendUp: true },
    { value: '127', trend: '-18', trendUp: false },
    { value: '21', trend: '+8', trendUp: false },
    { value: '7', trend: '+2', trendUp: false },
  ],
};

const kpiMeta = [
  { label: 'Active Projects', icon: <Briefcase size={18} />, color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)', path: '/workspaces' },
  { label: 'Docs Processed', icon: <FileText size={18} />, color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)', path: '/documents' },
  { label: 'Automations Run', icon: <Zap size={18} />, color: '#00D4FF', bg: 'rgba(0,212,255,0.1)', path: '/automations' },
  { label: 'Open Actions', icon: <CheckSquare size={18} />, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', path: '/tasks' },
  { label: 'Pending Approvals', icon: <Clock size={18} />, color: '#10B981', bg: 'rgba(16,185,129,0.1)', path: '/tasks' },
  { label: 'Risk Alerts', icon: <AlertTriangle size={18} />, color: '#EF4444', bg: 'rgba(239,68,68,0.1)', path: '/tasks' },
];

type ApprovalStatus = 'pending' | 'approved' | 'rejected';
interface Approval { id: number; title: string; requester: string; type: string; urgency: string; status: ApprovalStatus; }

const initialApprovals: Approval[] = [
  { id: 1, title: 'NCA BRD v2.3', requester: 'AM', type: 'Document Approval', urgency: 'High', status: 'pending' },
  { id: 2, title: 'SC-10 Budget AED 2.4M', requester: 'RT', type: 'Budget Approval', urgency: 'High', status: 'pending' },
  { id: 3, title: 'MOCI Vendor Shortlist', requester: 'FH', type: 'Procurement Decision', urgency: 'Medium', status: 'pending' },
  { id: 4, title: 'Healthcare Strategy Report', requester: 'SK', type: 'Report Sign-off', urgency: 'Low', status: 'pending' },
];

const initialRecommendations = [
  { id: 1, icon: '⚡', title: 'Generate SC-10 Committee Pack', detail: 'Meeting in 5 days — 3 pending decisions need packaging', action: 'Generate Now', color: '#8B5CF6', path: '/automations' },
  { id: 2, icon: '⚠️', title: 'Review 3 Critical Risks', detail: 'Smart City & NCA have unmitigated critical risks', action: 'View Risks', color: '#EF4444', path: '/tasks' },
  { id: 3, icon: '📋', title: 'ADNOC Contract Overdue', detail: 'Contract review task 3 days overdue — assign or escalate', action: 'View Task', color: '#F59E0B', path: '/tasks' },
];

const recentAutomations = [
  { id: 1, name: 'BRD Generator', workspace: 'NCA Digital Transformation', status: 'Success', time: '2h ago', outputs: 1 },
  { id: 2, name: 'Meeting Minutes', workspace: 'Banking Core', status: 'Success', time: '3h ago', outputs: 1 },
  { id: 3, name: 'Weekly Status Reports', workspace: 'Multiple', status: 'Success', time: '8h ago', outputs: 4 },
  { id: 4, name: 'Risk Register Analyzer', workspace: 'Smart City PMO', status: 'Warning', time: '1d ago', outputs: 1 },
  { id: 5, name: 'Knowledge Indexer', workspace: 'All', status: 'Success', time: '15m ago', outputs: 12 },
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

export default function Dashboard() {
  const navigate = useNavigate();
  const { isMobile, isTablet, width } = useLayout();
  const [period, setPeriod] = useState<Period>('week');
  const [approvals, setApprovals] = useState<Approval[]>(initialApprovals);
  const [recommendations, setRecommendations] = useState(initialRecommendations);
  const [animatedVals, setAnimatedVals] = useState<Record<number, string>>({});
  const [uploadDrag, setUploadDrag] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activityFilter, setActivityFilter] = useState<string>('All');

  // Animate KPI numbers when period changes
  useEffect(() => {
    const data = kpiData[period];
    const end: Record<number, string> = {};
    data.forEach((d, i) => { end[i] = d.value; });
    setAnimatedVals(end);
  }, [period]);

  const handleApprove = (id: number) => {
    setApprovals(prev => prev.map(a => a.id === id ? { ...a, status: 'approved' as const } : a));
  };

  const handleReject = (id: number) => {
    setApprovals(prev => prev.map(a => a.id === id ? { ...a, status: 'rejected' as const } : a));
  };

  const dismissRec = (id: number) => {
    setRecommendations(prev => prev.filter(r => r.id !== id));
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  };

  const activityTypes = ['All', 'Document', 'Meeting', 'Automation', 'Task'];
  const filteredActivities = activityFilter === 'All'
    ? activities
    : activities.filter(a => a.type === activityFilter.toLowerCase());

  const quickActions = [
    { icon: <Upload size={20} />, label: 'Upload Doc', color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)', action: () => setShowUploadModal(true) },
    { icon: <Zap size={20} />, label: 'Run Automation', color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)', action: () => navigate('/automations') },
    { icon: <Video size={20} />, label: 'New Meeting', color: '#10B981', bg: 'rgba(16,185,129,0.1)', action: () => navigate('/meetings') },
    { icon: <FileText size={20} />, label: 'Generate BRD', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', action: () => navigate('/automations') },
    { icon: <BarChart3 size={20} />, label: 'New Report', color: '#EC4899', bg: 'rgba(236,72,153,0.1)', action: () => navigate('/reports') },
    { icon: <Sparkles size={20} />, label: 'Ask AI', color: '#00D4FF', bg: 'rgba(0,212,255,0.1)', action: () => navigate('/knowledge') },
  ];

  // Responsive column counts
  const kpiCols = width >= 1200 ? 6 : width >= 900 ? 3 : width >= 600 ? 2 : 2;
  const mainCols = width >= 1100 ? '1fr 1fr 320px' : width >= 768 ? '1fr 1fr' : '1fr';
  const bottomCols = width >= 900 ? '1.5fr 1fr' : '1fr';

  const p = isMobile ? '0.875rem' : '1.5rem';
  const gap = isMobile ? '0.875rem' : '1.25rem';

  return (
    <div style={{ padding: p, display: 'flex', flexDirection: 'column', gap }}>

      {/* Period Filter Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: 'rgba(255,255,255,0.04)', borderRadius: '0.625rem', padding: '3px', border: '1px solid rgba(255,255,255,0.06)' }}>
          {(['today', 'week', 'month'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '0.3rem 0.875rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer',
                fontSize: '0.78rem', fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.2s',
                background: period === p ? 'rgba(14,165,233,0.15)' : 'transparent',
                color: period === p ? '#38BDF8' : '#475569',
              }}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleRefresh}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.3rem 0.75rem',
              borderRadius: '0.5rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
              cursor: 'pointer', color: '#475569', fontSize: '0.78rem', fontFamily: 'inherit', transition: 'all 0.2s',
            }}
          >
            <RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
            {!isMobile && 'Refresh'}
          </button>
          <button
            onClick={() => navigate('/reports')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.3rem 0.75rem',
              borderRadius: '0.5rem', background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)',
              cursor: 'pointer', color: '#38BDF8', fontSize: '0.78rem', fontFamily: 'inherit', transition: 'all 0.2s',
            }}
          >
            <Eye size={13} />
            {!isMobile && 'View Report'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${kpiCols}, 1fr)`, gap: isMobile ? '0.625rem' : '0.875rem' }}>
        {kpiMeta.map((meta, i) => {
          const d = kpiData[period][i];
          const isPositive = meta.label === 'Open Actions' || meta.label === 'Pending Approvals' || meta.label === 'Risk Alerts'
            ? !d.trendUp : d.trendUp;
          return (
            <div
              key={meta.label}
              className="metric-card card-hover"
              onClick={() => navigate(meta.path)}
              style={{ cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div style={{ padding: '0.45rem', borderRadius: '8px', background: meta.bg, color: meta.color }}>
                  {meta.icon}
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '2px',
                  fontSize: '0.68rem', fontWeight: 600,
                  color: isPositive ? '#34D399' : '#FCA5A5',
                }}>
                  {d.trendUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {d.trend}
                </div>
              </div>
              <div style={{ fontSize: isMobile ? '1.5rem' : '1.75rem', fontWeight: 800, color: '#F1F5F9', lineHeight: 1, transition: 'all 0.3s' }}>
                {animatedVals[i] ?? d.value}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '0.25rem' }}>{meta.label}</div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="section-card">
        <div className="section-card-header">
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Quick Actions</span>
        </div>
        <div style={{
          padding: '0.875rem',
          display: 'grid',
          gridTemplateColumns: `repeat(${isMobile ? 3 : 6}, 1fr)`,
          gap: '0.625rem',
        }}>
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={action.action}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
                padding: isMobile ? '0.75rem 0.25rem' : '0.875rem 0.5rem',
                borderRadius: '0.75rem', background: action.bg,
                border: `1px solid ${action.color}22`, cursor: 'pointer', transition: 'all 0.2s', color: action.color,
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 20px ${action.color}25`; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              {action.icon}
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#94A3B8', textAlign: 'center', lineHeight: 1.3 }}>{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Overdue Banner */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.875rem 1.25rem', borderRadius: '0.75rem', flexWrap: 'wrap', gap: '0.5rem',
        background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <AlertTriangle size={16} style={{ color: '#F59E0B', flexShrink: 0 }} />
          <div>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>12 overdue tasks across 4 workspaces</span>
            {!isMobile && <span style={{ fontSize: '0.8rem', color: '#475569', marginLeft: '0.75rem' }}>3 high-priority items may impact milestones</span>}
          </div>
        </div>
        <button
          className="btn-ghost"
          style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
          onClick={() => navigate('/tasks')}
        >
          Review Tasks <ArrowRight size={13} />
        </button>
      </div>

      {/* Main 3-column Row */}
      <div style={{ display: 'grid', gridTemplateColumns: mainCols, gap: '1rem' }}>

        {/* Activity Feed */}
        <div className="section-card">
          <div className="section-card-header">
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Recent Activity</span>
            <button className="btn-ghost" style={{ padding: '0.25rem 0.625rem', fontSize: '0.72rem' }}>View All</button>
          </div>
          {/* Activity type filter */}
          <div style={{ display: 'flex', gap: '0.375rem', padding: '0.625rem 1rem 0', overflowX: 'auto' }}>
            {activityTypes.map(t => (
              <button
                key={t}
                onClick={() => setActivityFilter(t)}
                style={{
                  padding: '0.2rem 0.625rem', borderRadius: '9999px', border: 'none', cursor: 'pointer',
                  fontSize: '0.7rem', fontWeight: 500, fontFamily: 'inherit', whiteSpace: 'nowrap',
                  background: activityFilter === t ? 'rgba(14,165,233,0.15)' : 'rgba(255,255,255,0.04)',
                  color: activityFilter === t ? '#38BDF8' : '#475569',
                  transition: 'all 0.15s',
                }}
              >
                {t}
              </button>
            ))}
          </div>
          <div style={{ padding: '0.375rem 0' }}>
            {filteredActivities.slice(0, 6).map((act, i) => (
              <div
                key={act.id}
                style={{
                  display: 'flex', gap: '0.75rem', padding: '0.625rem 1rem',
                  borderBottom: i < 5 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  cursor: 'pointer', transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '9999px', background: act.color, marginTop: '4px', flexShrink: 0 }} />
                  {i < 5 && <div style={{ width: '1px', flex: 1, background: 'rgba(255,255,255,0.05)' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#F1F5F9', marginBottom: '2px' }}>{act.title}</div>
                  <div style={{ fontSize: '0.72rem', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{act.detail}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '3px' }}>
                    <span style={{ fontSize: '0.68rem', color: '#334155' }}>{act.workspace}</span>
                    <span style={{ fontSize: '0.68rem', color: '#2D3F5E' }}>·</span>
                    <span style={{ fontSize: '0.68rem', color: '#334155' }}>{act.timestamp}</span>
                  </div>
                </div>
                <ChevronRight size={13} style={{ color: '#2D3F5E', marginTop: '4px', flexShrink: 0 }} />
              </div>
            ))}
          </div>
        </div>

        {/* Center: Chart + Meetings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Area Chart */}
          <div className="section-card" style={{ flex: 1 }}>
            <div className="section-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Zap size={14} style={{ color: '#00D4FF' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Automation Runs</span>
              </div>
              <span style={{ fontSize: '0.7rem', color: '#475569' }}>This week</span>
            </div>
            <div style={{ padding: '0.75rem 0.25rem 0.5rem' }}>
              <ResponsiveContainer width="100%" height={110}>
                <AreaChart data={automationRunsData}>
                  <defs>
                    <linearGradient id="runGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00D4FF" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#00D4FF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="runs" stroke="#00D4FF" strokeWidth={2} fill="url(#runGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', gap: '1rem', padding: '0 1rem 0.875rem' }}>
              {[{ label: 'Total', val: '1,284', color: '#00D4FF' }, { label: 'Success', val: '1,261', color: '#10B981' }, { label: 'Failed', val: '23', color: '#EF4444' }].map(s => (
                <div key={s.label}>
                  <div style={{ fontSize: '0.65rem', color: '#475569' }}>{s.label}</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: s.color }}>{s.val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Meetings */}
          <div className="section-card" style={{ flex: 1 }}>
            <div className="section-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={14} style={{ color: '#8B5CF6' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Upcoming Meetings</span>
              </div>
              <button className="btn-ghost" style={{ padding: '0.25rem 0.625rem', fontSize: '0.72rem' }} onClick={() => navigate('/meetings')}>
                View All
              </button>
            </div>
            <div style={{ padding: '0.375rem 0' }}>
              {meetings.filter(m => m.status === 'Upcoming').slice(0, 3).map((mtg, i) => (
                <div
                  key={mtg.id}
                  style={{
                    display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                    padding: '0.75rem 1rem', cursor: 'pointer', transition: 'background 0.15s',
                    borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  }}
                  onClick={() => navigate(`/meetings/${mtg.id}`)}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ padding: '0.35rem', borderRadius: '6px', background: 'rgba(139,92,246,0.1)', color: '#8B5CF6', flexShrink: 0 }}>
                    <Video size={13} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#F1F5F9', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mtg.title}</div>
                    <div style={{ fontSize: '0.7rem', color: '#475569' }}>{mtg.date} · {mtg.time}</div>
                  </div>
                  <span style={{
                    fontSize: '0.62rem', padding: '2px 6px', borderRadius: '4px', flexShrink: 0,
                    background: 'rgba(139,92,246,0.1)', color: '#A78BFA', border: '1px solid rgba(139,92,246,0.2)',
                  }}>
                    {mtg.type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right panel — only shown on wide layout */}
        {width >= 1100 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* AI Recommendations */}
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
                  <div style={{ textAlign: 'center', padding: '1.5rem 1rem', color: '#334155', fontSize: '0.8rem' }}>
                    All caught up! No recommendations right now.
                  </div>
                ) : recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    style={{
                      padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '0.5rem',
                      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                      cursor: 'pointer', transition: 'all 0.2s', position: 'relative',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); dismissRec(rec.id); }}
                      style={{
                        position: 'absolute', top: '6px', right: '6px', background: 'none', border: 'none',
                        cursor: 'pointer', color: '#334155', padding: '2px', borderRadius: '4px',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#94A3B8')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#334155')}
                    >
                      <X size={12} />
                    </button>
                    <div style={{ display: 'flex', gap: '0.5rem', paddingRight: '1rem' }}>
                      <span style={{ fontSize: '0.95rem' }}>{rec.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#F1F5F9', marginBottom: '2px' }}>{rec.title}</div>
                        <div style={{ fontSize: '0.7rem', color: '#475569', marginBottom: '0.5rem' }}>{rec.detail}</div>
                        <button
                          onClick={() => navigate(rec.path)}
                          style={{
                            fontSize: '0.7rem', color: '#A78BFA', background: 'transparent', border: 'none',
                            cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '3px', fontFamily: 'inherit',
                          }}
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
            <div className="section-card">
              <div className="section-card-header">
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Pending Approvals</span>
                <span style={{ fontSize: '0.68rem', padding: '1px 7px', borderRadius: '9999px', background: 'rgba(245,158,11,0.15)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.25)' }}>
                  {approvals.filter(a => a.status === 'pending').length}
                </span>
              </div>
              <div style={{ padding: '0.375rem 0' }}>
                {approvals.map((item, i) => (
                  <div
                    key={item.id}
                    style={{
                      padding: '0.625rem 1rem',
                      borderBottom: i < approvals.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      opacity: item.status !== 'pending' ? 0.5 : 1,
                      transition: 'opacity 0.3s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: item.status === 'pending' ? '0.5rem' : 0 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 500, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                        <div style={{ fontSize: '0.7rem', color: '#475569' }}>{item.type}</div>
                      </div>
                      <span style={{
                        fontSize: '0.62rem', padding: '2px 6px', borderRadius: '4px', flexShrink: 0, marginLeft: '0.5rem',
                        background: item.urgency === 'High' ? 'rgba(239,68,68,0.15)' : item.urgency === 'Medium' ? 'rgba(245,158,11,0.1)' : 'rgba(148,163,184,0.1)',
                        color: item.urgency === 'High' ? '#FCA5A5' : item.urgency === 'Medium' ? '#FCD34D' : '#94A3B8',
                        border: `1px solid ${item.urgency === 'High' ? 'rgba(239,68,68,0.2)' : item.urgency === 'Medium' ? 'rgba(245,158,11,0.15)' : 'rgba(148,163,184,0.1)'}`,
                      }}>
                        {item.status !== 'pending' ? item.status : item.urgency}
                      </span>
                    </div>
                    {item.status === 'pending' && (
                      <div style={{ display: 'flex', gap: '0.375rem' }}>
                        <button
                          onClick={() => handleApprove(item.id)}
                          style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                            padding: '0.3rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                            fontSize: '0.7rem', fontWeight: 600, background: 'rgba(16,185,129,0.15)', color: '#34D399',
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(16,185,129,0.25)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(16,185,129,0.15)')}
                        >
                          <Check size={11} /> Approve
                        </button>
                        <button
                          onClick={() => handleReject(item.id)}
                          style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                            padding: '0.3rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                            fontSize: '0.7rem', fontWeight: 600, background: 'rgba(239,68,68,0.1)', color: '#FCA5A5',
                            transition: 'all 0.15s',
                          }}
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
        )}
      </div>

      {/* AI Recommendations + Approvals — shown below on tablet/mobile */}
      {width < 1100 && (
        <div style={{ display: 'grid', gridTemplateColumns: width >= 640 ? '1fr 1fr' : '1fr', gap: '1rem' }}>
          {/* AI Recs */}
          <div className="section-card" style={{ background: 'linear-gradient(160deg, #0D1527 0%, #130D2A 100%)' }}>
            <div className="section-card-header" style={{ borderBottom: '1px solid rgba(139,92,246,0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Bot size={14} style={{ color: '#8B5CF6' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>AI Recommendations</span>
              </div>
            </div>
            <div style={{ padding: '0.75rem' }}>
              {recommendations.map((rec) => (
                <div
                  key={rec.id}
                  style={{
                    padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '0.5rem',
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer',
                  }}
                  onClick={() => navigate(rec.path)}
                >
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '0.9rem' }}>{rec.icon}</span>
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#F1F5F9', marginBottom: '2px' }}>{rec.title}</div>
                      <div style={{ fontSize: '0.7rem', color: '#475569' }}>{rec.detail}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Approvals */}
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
                  </div>
                  {item.status === 'pending' && (
                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                      <button onClick={() => handleApprove(item.id)} style={{ flex: 1, padding: '0.3rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.7rem', fontWeight: 600, background: 'rgba(16,185,129,0.15)', color: '#34D399', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <Check size={11} /> Approve
                      </button>
                      <button onClick={() => handleReject(item.id)} style={{ flex: 1, padding: '0.3rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.7rem', fontWeight: 600, background: 'rgba(239,68,68,0.1)', color: '#FCA5A5', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <X size={11} /> Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Row */}
      <div style={{ display: 'grid', gridTemplateColumns: bottomCols, gap: '1rem' }}>
        {/* Automation Health */}
        <div className="section-card">
          <div className="section-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Zap size={14} style={{ color: '#00D4FF' }} />
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Automation Health</span>
            </div>
            <button className="btn-ghost" style={{ padding: '0.25rem 0.625rem', fontSize: '0.72rem' }} onClick={() => navigate('/automations')}>
              All Automations
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ minWidth: '480px' }}>
              <thead>
                <tr>
                  <th>Automation</th>
                  <th>Workspace</th>
                  <th>Status</th>
                  <th>Time</th>
                  <th>Outputs</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recentAutomations.map((run) => (
                  <tr key={run.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/automations/${run.id}`)}>
                    <td style={{ color: '#F1F5F9', fontWeight: 500 }}>{run.name}</td>
                    <td style={{ fontSize: '0.75rem', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{run.workspace}</td>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        fontSize: '0.7rem', padding: '2px 7px', borderRadius: '9999px',
                        background: run.status === 'Success' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                        color: run.status === 'Success' ? '#34D399' : '#FCD34D',
                        border: `1px solid ${run.status === 'Success' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
                      }}>
                        <Circle size={5} fill="currentColor" />
                        {run.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.75rem', color: '#475569' }}>{run.time}</td>
                    <td style={{ color: '#00D4FF', fontWeight: 700, fontSize: '0.85rem' }}>{run.outputs}</td>
                    <td>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '2px 4px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#0EA5E9')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
                      >
                        <Play size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Docs by Type */}
        <div className="section-card">
          <div className="section-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={14} style={{ color: '#8B5CF6' }} />
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Documents by Type</span>
            </div>
            <button className="btn-ghost" style={{ padding: '0.25rem 0.625rem', fontSize: '0.72rem' }} onClick={() => navigate('/documents')}>
              View All
            </button>
          </div>
          <div style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie data={documentsByTypeData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} dataKey="value">
                  {documentsByTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1, minWidth: '120px' }}>
              {documentsByTypeData.map((item) => (
                <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: item.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>{item.name}</span>
                  </div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#F1F5F9' }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowUploadModal(false)}
        >
          <div
            style={{ background: '#0D1527', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '480px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#F1F5F9' }}>Upload Document</h3>
              <button onClick={() => setShowUploadModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '4px', borderRadius: '6px' }}>
                <X size={18} />
              </button>
            </div>
            <div
              onDragOver={e => { e.preventDefault(); setUploadDrag(true); }}
              onDragLeave={() => setUploadDrag(false)}
              onDrop={e => { e.preventDefault(); setUploadDrag(false); }}
              style={{
                border: `2px dashed ${uploadDrag ? '#0EA5E9' : 'rgba(255,255,255,0.12)'}`,
                borderRadius: '12px', padding: '2.5rem 1.5rem', textAlign: 'center', cursor: 'pointer',
                background: uploadDrag ? 'rgba(14,165,233,0.05)' : 'rgba(255,255,255,0.02)',
                transition: 'all 0.2s', marginBottom: '1rem',
              }}
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
              <button className="btn-primary" style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                onClick={() => { setShowUploadModal(false); navigate('/documents'); }}
              >
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
