import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase, FileText, Zap, CheckSquare, AlertTriangle,
  TrendingUp, Upload, Video, Sparkles, ArrowRight,
  Bot, Check, X, RefreshCw, Eye, Target, Activity, Brain, Layers,
  Users, ChevronRight, UserPlus, ListTodo, DollarSign, BarChart3, Clock,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { AnimatePresence, motion } from 'motion/react';
import {
  getActivities, getMilestones, getWorkspaceFinancials, getBoardDecisions,
  getRagStatusWithWorkspaces, getApprovals, updateApproval, upsertApproval, getDocuments,
} from '../lib/db';
import type {
  ActivityRow, MilestoneRow, WorkspaceFinancialRow, BoardDecisionRow,
  RagStatusWithWorkspace, ApprovalRow, DocumentRow,
} from '../lib/db';
import { useLayout } from '../hooks/useLayout';
import { Button, Card, Badge, Progress, Tabs, Metric, cn, fadeUp, stagger, spring } from '../components/ui';

type Period = 'today' | 'week' | 'month';

function fmtSAR(val: number): string {
  if (val >= 1_000_000) return `SAR ${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `SAR ${(val / 1_000).toFixed(0)}K`;
  return `SAR ${val.toLocaleString()}`;
}

const FALLBACK_APPROVALS: ApprovalRow[] = [
  { id: 'appr-001', title: 'NCA BRD v2.3',           requester: 'AM', type: 'Document Approval',   urgency: 'High',   status: 'pending', workspace_id: null, notes: null, created_at: '', updated_at: '' },
  { id: 'appr-002', title: 'SC-10 Budget SAR 2.4M',  requester: 'RT', type: 'Budget Approval',     urgency: 'High',   status: 'pending', workspace_id: null, notes: null, created_at: '', updated_at: '' },
  { id: 'appr-003', title: 'MOCI Vendor Shortlist',  requester: 'FH', type: 'Procurement Decision',urgency: 'Medium', status: 'pending', workspace_id: null, notes: null, created_at: '', updated_at: '' },
  { id: 'appr-004', title: 'Healthcare Strategy Report', requester: 'SK', type: 'Report Sign-off', urgency: 'Low',    status: 'pending', workspace_id: null, notes: null, created_at: '', updated_at: '' },
];

const initialRecommendations = [
  { id: 1, icon: 'zap',   title: 'Generate SC-10 Committee Pack', detail: 'Meeting in 5 days — 3 pending decisions need packaging', action: 'Generate Now', tone: 'brand',  path: '/automations' },
  { id: 2, icon: 'alert', title: 'Review 3 Critical Risks',       detail: 'Smart City & NCA have unmitigated critical risks',      action: 'View Risks',   tone: 'danger', path: '/tasks' },
  { id: 3, icon: 'clock', title: 'ADNOC Contract Overdue',        detail: 'Contract review task 3 days overdue — assign or escalate', action: 'View Task', tone: 'gold',   path: '/tasks' },
] as const;

const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color?: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl glass-elevated px-3.5 py-2.5 text-[0.75rem] shadow-[var(--shadow-md)]">
      {label && <div className="text-[color:var(--text-muted)] font-semibold mb-1">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-[color:var(--text-primary)]">
          {p.color && <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />}
          <span className="font-medium">{p.name}:</span>
          <span className="font-bold tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

const milestoneStatusColor: Record<string, string> = {
  Completed:  '#34D399',
  'On Track': '#7DD3FC',
  'At Risk':  '#F5B544',
  Delayed:    '#FF6B6B',
  Upcoming:   '#8790A8',
};

const activityMeta: Record<string, { color: string; bg: string }> = {
  document:   { color: '#A78BFA', bg: 'rgba(167,139,250,0.16)' },
  meeting:    { color: '#63E6BE', bg: 'rgba(99,230,190,0.16)' },
  automation: { color: '#C4B5FD', bg: 'rgba(196,181,253,0.16)' },
  task:       { color: '#F5B544', bg: 'rgba(245,181,68,0.16)' },
  default:    { color: '#8790A8', bg: 'rgba(135,144,168,0.16)' },
};

function ActivityIcon({ type }: { type: string }) {
  const meta = activityMeta[type] ?? activityMeta.default;
  const Icon = type === 'document' ? FileText
    : type === 'meeting' ? Video
    : type === 'automation' ? Zap
    : CheckSquare;
  return (
    <div className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0 ring-1" style={{ background: meta.bg, color: meta.color, boxShadow: `inset 0 0 0 1px ${meta.color}30` }}>
      <Icon size={14} />
    </div>
  );
}

const PIE_COLORS = ['#A78BFA', '#7877C6', '#63E6BE', '#F0A875', '#7DD3FC', '#FCA5A5'];

export default function Dashboard() {
  const navigate = useNavigate();
  const { isMobile, width } = useLayout();
  const [period, setPeriod] = useState<Period>('week');
  const [approvals, setApprovals] = useState<ApprovalRow[]>(FALLBACK_APPROVALS);
  const [recommendations, setRecommendations] = useState([...initialRecommendations]);
  const [refreshing, setRefreshing] = useState(false);
  const [activityFilter, setActivityFilter] = useState<'All' | 'Document' | 'Meeting' | 'Automation' | 'Task'>('All');
  const [completedDecisions, setCompletedDecisions] = useState<Set<string>>(new Set());

  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [workspaceFinancials, setWorkspaceFinancials] = useState<WorkspaceFinancialRow[]>([]);
  const [boardDecisions, setBoardDecisions] = useState<BoardDecisionRow[]>([]);
  const [ragStatusData, setRagStatusData] = useState<RagStatusWithWorkspace[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);

  useEffect(() => {
    getActivities(30).then(setActivities).catch(() => {});
    getMilestones().then(setMilestones).catch(() => {});
    getWorkspaceFinancials().then(setWorkspaceFinancials).catch(() => {});
    getBoardDecisions().then(setBoardDecisions).catch(() => {});
    getRagStatusWithWorkspaces().then(setRagStatusData).catch(() => {});
    getDocuments().then(setDocuments).catch(() => {});
    getApprovals()
      .then((rows) => {
        if (rows.length > 0) setApprovals(rows);
        else Promise.all(FALLBACK_APPROVALS.map((a) => upsertApproval(a)))
          .then((seeded) => { if (seeded.length > 0) setApprovals(seeded); })
          .catch(() => {});
      })
      .catch(() => {});
  }, []);

  const handleApprove = (id: string) => {
    setApprovals((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'approved' as const } : a)));
    updateApproval(id, { status: 'approved' }).catch(() => {});
  };
  const handleReject = (id: string) => {
    setApprovals((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'rejected' as const } : a)));
    updateApproval(id, { status: 'rejected' }).catch(() => {});
  };
  const dismissRec = (id: number) => setRecommendations((prev) => prev.filter((r) => r.id !== id));
  const handleRefresh = () => { setRefreshing(true); setTimeout(() => setRefreshing(false), 1200); };
  const markDecisionComplete = (id: string) => setCompletedDecisions((prev) => new Set([...prev, id]));

  const activityTypes = ['All', 'Document', 'Meeting', 'Automation', 'Task'] as const;
  const filteredActivities = activityFilter === 'All' ? activities : activities.filter((a) => a.type === activityFilter.toLowerCase());

  const upcomingMilestones = useMemo(() => [...milestones].filter((m) => m.status !== 'Completed').slice(0, 5), [milestones]);
  const activeBoardDecisions = useMemo(() => boardDecisions.filter((d) => d.status !== 'Closed' && !completedDecisions.has(d.id)), [boardDecisions, completedDecisions]);

  const totalContract = workspaceFinancials.reduce((s, w) => s + w.contract_value, 0);
  const totalSpent    = workspaceFinancials.reduce((s, w) => s + w.spent, 0);
  const totalVariance = workspaceFinancials.reduce((s, w) => s + w.variance, 0);

  const portfolioKPIs = useMemo(() => {
    const contract = workspaceFinancials.reduce((s, w) => s + w.contract_value, 0);
    const spent = workspaceFinancials.reduce((s, w) => s + w.spent, 0);
    const atRiskVariance = workspaceFinancials.filter((w) => w.variance > 0).reduce((s, w) => s + w.variance, 0);
    const atRiskCount = workspaceFinancials.filter((w) => w.variance > 0).length;
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const msDue = milestones.filter((m) => { const d = new Date(m.due_date); return d >= now && d <= in30; });
    const msAtRisk = msDue.filter((m) => m.status === 'At Risk' || m.status === 'Delayed').length;
    const msOnTrack = msDue.filter((m) => m.status === 'On Track' || m.status === 'Upcoming').length;
    const completedMs = milestones.filter((m) => m.status === 'Completed').length;
    const totalMs = milestones.length;
    const onTimeRate = totalMs > 0 ? Math.round((completedMs / totalMs) * 100) : 0;

    return [
      { label: 'Total Portfolio Value', value: fmtSAR(contract),                               sub: `${workspaceFinancials.length} active engagements`, icon: <Briefcase size={15} />,  tone: 'brand' as const,   trend: null,          trendLabel: '' },
      { label: 'Revenue Recognized',    value: fmtSAR(spent),                                   sub: contract > 0 ? `${Math.round((spent / contract) * 100)}% of portfolio` : '—', icon: <TrendingUp size={15} />, tone: 'mint' as const, trend: null, trendLabel: '' },
      { label: 'Budget at Risk',        value: fmtSAR(atRiskVariance),                          sub: `${atRiskCount} engagement${atRiskCount !== 1 ? 's' : ''} over forecast`, icon: <AlertTriangle size={15} />, tone: 'danger' as const, trend: atRiskCount, trendLabel: atRiskCount > 0 ? `+${atRiskCount}` : '0' },
      { label: 'Milestones Due (30d)',  value: String(msDue.length),                            sub: `${msOnTrack} on track · ${msAtRisk} at risk`, icon: <Target size={15} />,      tone: 'gold' as const,     trend: msAtRisk > 0 ? msAtRisk : null, trendLabel: msAtRisk > 0 ? `${msAtRisk} at risk` : 'All clear' },
      { label: 'On-Time Delivery',      value: `${onTimeRate}%`,                                sub: `${completedMs} of ${totalMs} milestones`, icon: <Activity size={15} />,       tone: 'brand' as const,     trend: onTimeRate >= 80 ? 1 : -1, trendLabel: onTimeRate >= 80 ? 'Healthy' : 'Lagging' },
      { label: 'Client Satisfaction',   value: '—',                                              sub: 'Connect NPS data',                        icon: <Users size={15} />,        tone: 'neutral' as const,  trend: null,          trendLabel: '—' },
    ];
  }, [workspaceFinancials, milestones]);

  const deliveryTrendData = useMemo(() => {
    const monthMap: Record<string, { onTime: number; delayed: number; atRisk: number; value: number }> = {};
    milestones.forEach((ms) => {
      const d = new Date(ms.due_date);
      if (Number.isNaN(d.getTime())) return;
      const key = d.toLocaleString('en-US', { month: 'short' });
      if (!monthMap[key]) monthMap[key] = { onTime: 0, delayed: 0, atRisk: 0, value: 0 };
      if (ms.status === 'Completed' || ms.status === 'On Track') monthMap[key].onTime++;
      else if (ms.status === 'Delayed') monthMap[key].delayed++;
      else if (ms.status === 'At Risk') monthMap[key].atRisk++;
      monthMap[key].value += ms.value / 1_000_000;
    });
    return Object.entries(monthMap).map(([month, d]) => ({ month, ...d }));
  }, [milestones]);

  const documentsByTypeData = useMemo(() => {
    const counts: Record<string, number> = {};
    documents.forEach((d) => { counts[d.type] = (counts[d.type] ?? 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [documents]);

  const quickActions = [
    { icon: Upload,     label: 'Upload Doc',     accent: 'from-[#7877C6] to-[#A78BFA]', action: () => navigate('/documents') },
    { icon: Zap,        label: 'Run Automation', accent: 'from-[#A78BFA] to-[#63E6BE]', action: () => navigate('/automations') },
    { icon: Video,      label: 'New Meeting',    accent: 'from-[#7DD3FC] to-[#63E6BE]', action: () => navigate('/meetings') },
    { icon: FileText,   label: 'Create Report',  accent: 'from-[#FF6B6B] to-[#F0A875]', action: () => navigate('/reports') },
    { icon: UserPlus,   label: 'Add Client',     accent: 'from-[#F5B544] to-[#F0A875]', action: () => navigate('/workspaces') },
    { icon: ListTodo,   label: 'New Task',       accent: 'from-[#34D399] to-[#63E6BE]', action: () => navigate('/tasks') },
  ];

  const kpiCols = width >= 1280 ? 6 : width >= 900 ? 3 : 2;
  const twoColLayout = width >= 960;

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: stagger(0.06, 0.1) } }}
      className="screen-container"
    >
      {/* ── Hero ─────────────────────────────────────────────── */}
      <motion.section variants={fadeUp} className="hero-surface px-6 py-7 md:px-10 md:py-10 relative">
        {/* Aurora shimmer line */}
        <motion.div
          aria-hidden
          initial={{ backgroundPositionX: '-200%' }}
          animate={{ backgroundPositionX: '200%' }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          className="absolute top-0 inset-x-0 h-[1.5px] bg-[linear-gradient(90deg,transparent,rgba(167,139,250,0.8),rgba(99,230,190,0.7),rgba(240,168,117,0.6),transparent)] bg-[length:200%_100%] pointer-events-none"
        />

        <div className="relative flex flex-col md:flex-row md:items-start md:justify-between gap-5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="relative flex items-center justify-center">
                <span className="w-2 h-2 rounded-full bg-[#34D399] shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
                <motion.span
                  initial={{ opacity: 0.6, scale: 1 }}
                  animate={{ opacity: 0, scale: 2.8 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                  className="absolute w-2 h-2 rounded-full ring-2 ring-[#34D399]"
                />
              </div>
              <span className="text-[0.66rem] font-bold tracking-[0.18em] uppercase text-[#63E6BE]">Live · Board Overview</span>
              <span className="w-px h-3 bg-white/10" />
              <span className="text-[0.7rem] text-[color:var(--text-muted)] font-medium tracking-tight">
                {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>

            <h1 className="display-2xl mb-3 leading-[0.98]">
              <span className="bg-gradient-to-br from-white to-[#B7BDCE] bg-clip-text text-transparent">Client </span>
              <span className="serif-display text-[#D4BFFF]">Command</span>{' '}
              <span className="gradient-text-multi">Center</span>
            </h1>

            <div className="flex items-center gap-5 flex-wrap text-[0.82rem]">
              <span className="flex items-center gap-1.5 text-[color:var(--text-muted)]"><Users size={13} />8 active clients</span>
              <span className="flex items-center gap-1.5 text-[#A78BFA] font-semibold"><DollarSign size={13} />{fmtSAR(totalContract || 23_400_000)} portfolio</span>
              <span className="flex items-center gap-1.5 text-[color:var(--text-muted)]"><Layers size={13} />32 open tasks</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Tabs
              value={period}
              onChange={setPeriod}
              items={[
                { value: 'today' as Period, label: 'Today' },
                { value: 'week' as Period, label: 'Week' },
                { value: 'month' as Period, label: 'Month' },
              ]}
            />
            <Button variant="subtle" size="sm" onClick={handleRefresh} leading={<RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />}>
              {!isMobile && 'Refresh'}
            </Button>
            <Button variant="subtle" size="sm" onClick={() => navigate('/reports')} leading={<Eye size={13} />}>
              {!isMobile && 'View Reports'}
            </Button>
          </div>
        </div>

        {/* Inline banner stats */}
        {!isMobile && (
          <motion.div
            variants={fadeUp}
            className="relative mt-8 pt-6 border-t border-white/10 grid grid-cols-4"
          >
            {[
              { label: 'Portfolio Value',  value: fmtSAR(totalContract || 23_400_000),                                         sub: '8 engagements',        color: '#A78BFA', icon: <DollarSign size={13} />,  pct: null as number | null },
              { label: 'Revenue Recognized', value: fmtSAR(totalSpent || 13_300_000),                                           sub: `${Math.max(1, Math.round(((totalSpent || 13_300_000) / (totalContract || 23_400_000)) * 100))}% of portfolio`, color: '#63E6BE', icon: <TrendingUp size={13} />, pct: Math.round(((totalSpent || 13_300_000) / (totalContract || 23_400_000)) * 100) },
              { label: 'Budget Variance',  value: (totalVariance >= 0 ? '+' : '') + fmtSAR(Math.abs(totalVariance || 430_000)),  sub: totalVariance >= 0 ? 'Over budget' : 'Under budget', color: totalVariance >= 0 ? '#FF6B6B' : '#63E6BE', icon: <BarChart3 size={13} />, pct: null },
              { label: 'Pending Actions',  value: String(approvals.filter((a) => a.status === 'pending').length + activeBoardDecisions.length), sub: 'Approvals + decisions', color: '#F0A875', icon: <AlertTriangle size={13} />, pct: null },
            ].map((stat, i) => (
              <div key={stat.label} className={cn('flex flex-col gap-1 px-6', i > 0 && 'border-l border-white/[0.06]')}>
                <div className="flex items-center gap-1.5 mb-1">
                  <div style={{ color: stat.color }} className="opacity-80">{stat.icon}</div>
                  <div className="text-[0.62rem] font-bold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">{stat.label}</div>
                </div>
                <div className="hero-number-lg" style={{ color: stat.color, textShadow: `0 0 32px ${stat.color}40` }}>{stat.value}</div>
                {stat.pct !== null && (
                  <div className="h-[3px] rounded-full bg-white/[0.06] overflow-hidden mt-1">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${stat.pct}%` }}
                      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                      className="h-full rounded-full"
                      style={{ background: `linear-gradient(90deg, ${stat.color}, ${stat.color}90)` }}
                    />
                  </div>
                )}
                <div className="text-[0.7rem] text-[color:var(--text-faint)] mt-0.5">{stat.sub}</div>
              </div>
            ))}
          </motion.div>
        )}
      </motion.section>

      {/* ── Portfolio KPI Row ────────────────────────────────── */}
      <motion.div
        variants={{ hidden: {}, show: { transition: stagger(0.05, 0.1) } }}
        className="grid gap-3.5"
        style={{ gridTemplateColumns: `repeat(${kpiCols}, minmax(0,1fr))` }}
      >
        {portfolioKPIs.map((k) => (
          <Metric
            key={k.label}
            label={k.label}
            value={k.value}
            sublabel={k.sub}
            icon={k.icon}
            tone={k.tone}
            trend={k.trend}
            trendLabel={k.trendLabel}
            interactive
          />
        ))}
      </motion.div>

      {/* ── Quick Actions ───────────────────────────────────── */}
      <motion.section variants={fadeUp} className="section-card">
        <div className="section-card-header">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#A78BFA] shadow-[0_0_8px_rgba(167,139,250,0.9)]" />
            <span className="text-[0.9rem] font-bold tracking-tight text-[color:var(--text-primary)]">Quick Actions</span>
          </div>
          <span className="text-[0.66rem] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">6 Shortcuts</span>
        </div>
        <div className={cn('p-4 md:p-5 grid gap-3', isMobile ? 'grid-cols-3' : 'grid-cols-6')}>
          {quickActions.map((qa, i) => {
            const Icon = qa.icon;
            return (
              <motion.button
                key={qa.label}
                onClick={qa.action}
                variants={fadeUp}
                custom={i}
                whileHover={{ y: -4, transition: spring }}
                whileTap={{ scale: 0.97 }}
                className="group relative flex flex-col items-center gap-2.5 py-4 px-2 rounded-2xl bg-white/[0.025] border border-white/[0.06] hover:border-white/[0.12] transition-colors overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-20 transition-opacity pointer-events-none" style={{ background: `linear-gradient(135deg, rgba(120,119,198,0.2), transparent)` }} />
                <div className={cn('relative w-11 h-11 rounded-2xl flex items-center justify-center bg-gradient-to-br text-white shadow-[0_4px_14px_rgba(120,119,198,0.3),inset_0_1px_0_rgba(255,255,255,0.2)]', qa.accent)}>
                  <Icon size={18} strokeWidth={2.2} />
                </div>
                <span className="relative text-[0.74rem] font-semibold text-[color:var(--text-secondary)] group-hover:text-white transition-colors tracking-tight">{qa.label}</span>
              </motion.button>
            );
          })}
        </div>
      </motion.section>

      {/* ── Workspace Portfolio + Milestones + Decisions ─────── */}
      <div className={cn('grid gap-4', twoColLayout ? 'grid-cols-[1.6fr_1fr]' : 'grid-cols-1')}>

        {/* Workspace Portfolio */}
        <motion.div variants={fadeUp} className="section-card">
          <div className="section-card-header">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[rgba(120,119,198,0.16)] text-[#A78BFA] flex items-center justify-center ring-1 ring-[rgba(120,119,198,0.3)]">
                <Layers size={13} />
              </div>
              <span className="text-[0.9rem] font-bold tracking-tight text-[color:var(--text-primary)]">Workspace Portfolio</span>
            </div>
            <Button variant="subtle" size="sm" onClick={() => navigate('/workspaces')} trailing={<ChevronRight size={13} />}>All Workspaces</Button>
          </div>
          <div>
            {(ragStatusData.length > 0 ? ragStatusData.slice(0, 4) : DEMO_WORKSPACES).map((row, i) => {
              const pct = [78, 45, 92, 28][i] ?? 50;
              const barTone = row.rag === 'Green' ? 'mint' : row.rag === 'Amber' ? 'amber' : 'red';
              const barColor = row.rag === 'Green' ? '#63E6BE' : row.rag === 'Amber' ? '#F5B544' : '#FF6B6B';
              const contractValue = workspaceFinancials[i]?.contract_value ?? [4_200_000, 3_500_000, 2_800_000, 1_900_000][i];
              return (
                <motion.button
                  key={row.workspace + i}
                  whileHover={{ backgroundColor: 'rgba(120,119,198,0.05)' }}
                  onClick={() => navigate('/workspaces')}
                  className={cn('w-full text-left px-5 py-4 transition-colors', i < 3 && 'border-b border-white/[0.04]')}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: barColor, boxShadow: `0 0 8px ${barColor}99` }} />
                      <span className="text-[0.86rem] font-semibold text-[color:var(--text-primary)] truncate">{row.workspace}</span>
                    </div>
                    <span className="text-[0.85rem] font-bold tabular-nums" style={{ color: barColor }}>{pct}%</span>
                  </div>
                  <Progress value={pct} tone={barTone} size="md" className="mb-2" />
                  <div className="flex items-center justify-between text-[0.72rem]">
                    <span className="text-[color:var(--text-faint)]">Due: {row.lastUpdated || '12 Apr 2026'}</span>
                    {contractValue && <span className="text-[color:var(--text-secondary)] font-semibold tabular-nums">{fmtSAR(contractValue)}</span>}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Milestones + Decisions */}
        <div className="flex flex-col gap-4">
          <motion.div variants={fadeUp} className="section-card">
            <div className="section-card-header">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[rgba(240,168,117,0.16)] text-[#F0A875] flex items-center justify-center ring-1 ring-[rgba(240,168,117,0.3)]">
                  <Target size={13} />
                </div>
                <span className="text-[0.9rem] font-bold tracking-tight text-[color:var(--text-primary)]">Milestones</span>
              </div>
              <Badge tone="gold">{upcomingMilestones.length || 3} upcoming</Badge>
            </div>
            <div>
              {(upcomingMilestones.length > 0 ? upcomingMilestones.slice(0, 3) : DEMO_MILESTONES).map((ms, i) => {
                const sc = milestoneStatusColor[ms.status] || '#8790A8';
                return (
                  <div key={ms.id} className={cn('px-5 py-3.5 hover:bg-white/[0.02] transition-colors', i < 2 && 'border-b border-white/[0.04]')}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc, boxShadow: `0 0 6px ${sc}aa` }} />
                      <span className="text-[0.84rem] font-semibold text-[color:var(--text-primary)] truncate flex-1">{ms.title}</span>
                    </div>
                    <div className="text-[0.72rem] text-[color:var(--text-muted)] ml-3.5">{(ms as MilestoneRow & { workspace_name?: string }).workspace_name || 'Banking Core'}</div>
                    <div className="flex items-center gap-1 text-[0.7rem] text-[color:var(--text-faint)] mt-1 ml-3.5">
                      <Clock size={10} />Due: {ms.due_date || '01 Apr 2026'}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          <motion.div variants={fadeUp} className="section-card">
            <div className="section-card-header">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[rgba(99,230,190,0.16)] text-[#63E6BE] flex items-center justify-center ring-1 ring-[rgba(99,230,190,0.3)]">
                  <Check size={13} />
                </div>
                <span className="text-[0.9rem] font-bold tracking-tight text-[color:var(--text-primary)]">Board Decisions</span>
              </div>
            </div>
            <div className="p-5">
              {activeBoardDecisions.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <div className="w-10 h-10 rounded-full bg-[rgba(99,230,190,0.16)] text-[#63E6BE] flex items-center justify-center ring-1 ring-[rgba(99,230,190,0.3)]">
                    <Check size={15} />
                  </div>
                  <div className="text-[0.85rem] font-bold text-[color:var(--text-primary)]">All Clear</div>
                  <div className="text-[0.72rem] text-[color:var(--text-muted)]">No pending decisions</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeBoardDecisions.slice(0, 3).map((d) => (
                    <div key={d.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#F5B544]" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[0.8rem] font-semibold text-[color:var(--text-primary)] truncate">{d.title}</div>
                      </div>
                      <button onClick={() => markDecisionComplete(d.id)} className="text-[0.65rem] font-semibold text-[#63E6BE] hover:text-white">Mark done</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Client Health Matrix ──────────────────────────────── */}
      <motion.section variants={fadeUp} className="section-card">
        <div className="section-card-header flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[rgba(167,139,250,0.16)] text-[#C4B5FD] flex items-center justify-center ring-1 ring-[rgba(167,139,250,0.3)]">
              <Activity size={13} />
            </div>
            <span className="text-[0.9rem] font-bold tracking-tight text-[color:var(--text-primary)]">Client Health Matrix</span>
          </div>
          <div className="flex items-center gap-3 text-[0.72rem]">
            <span className="flex items-center gap-1.5 text-[color:var(--text-muted)]"><span className="rag-green" />On Track</span>
            <span className="flex items-center gap-1.5 text-[color:var(--text-muted)]"><span className="rag-amber" />At Risk</span>
            <span className="flex items-center gap-1.5 text-[color:var(--text-muted)]"><span className="rag-red" />Critical</span>
          </div>
        </div>
        <div className="p-5 grid-auto-fill-280">
          {(ragStatusData.length > 0 ? ragStatusData : DEMO_WORKSPACES).slice(0, 8).map((row, i) => {
            const pct = [78, 45, 92, 28, 62, 90, 50, 40][i] ?? 50;
            const barTone = row.rag === 'Green' ? 'mint' : row.rag === 'Amber' ? 'amber' : 'red';
            const barColor = row.rag === 'Green' ? '#63E6BE' : row.rag === 'Amber' ? '#F5B544' : '#FF6B6B';
            return (
              <motion.button
                whileHover={{ y: -2 }}
                key={row.workspace + i}
                onClick={() => navigate('/workspaces')}
                className="board-pack-card text-left"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[0.82rem] font-semibold text-[color:var(--text-primary)] truncate">{row.workspace}</span>
                  <span className="text-[0.85rem] font-bold tabular-nums" style={{ color: barColor }}>{pct}%</span>
                </div>
                <Progress value={pct} tone={barTone} size="md" className="mb-2" />
                <div className="flex items-center justify-between text-[0.7rem] text-[color:var(--text-muted)]">
                  <span>Due: 12 Mar 2026</span>
                  <span className="font-semibold text-[color:var(--text-secondary)]">{fmtSAR(workspaceFinancials[i]?.contract_value ?? 4_200_000)}</span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </motion.section>

      {/* ── Charts Row ──────────────────────────────────────── */}
      <div className={cn('grid gap-4', twoColLayout ? 'grid-cols-[1.4fr_1fr]' : 'grid-cols-1')}>
        {/* Delivery Trend */}
        <motion.div variants={fadeUp} className="section-card">
          <div className="section-card-header flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[rgba(120,119,198,0.16)] text-[#A78BFA] flex items-center justify-center ring-1 ring-[rgba(120,119,198,0.3)]">
                <TrendingUp size={13} />
              </div>
              <span className="text-[0.9rem] font-bold tracking-tight text-[color:var(--text-primary)]">Delivery Performance Trend</span>
            </div>
            <div className="flex items-center gap-3 text-[0.72rem]">
              <span className="flex items-center gap-1.5 text-[color:var(--text-muted)]"><span className="w-2 h-2 rounded-full bg-[#63E6BE]" />On Time</span>
              <span className="flex items-center gap-1.5 text-[color:var(--text-muted)]"><span className="w-2 h-2 rounded-full bg-[#F5B544]" />At Risk</span>
              <span className="flex items-center gap-1.5 text-[color:var(--text-muted)]"><span className="w-2 h-2 rounded-full bg-[#FF6B6B]" />Delayed</span>
            </div>
          </div>
          <div className="p-4 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={deliveryTrendData.length > 0 ? deliveryTrendData : DEMO_TREND}>
                <defs>
                  <linearGradient id="gradOnTime" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#63E6BE" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#63E6BE" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradAtRisk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F5B544" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#F5B544" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradDelayed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF6B6B" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#FF6B6B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="#4E566E" style={{ fontSize: '0.7rem' }} axisLine={false} tickLine={false} />
                <YAxis stroke="#4E566E" style={{ fontSize: '0.7rem' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="onTime" name="On Time" stroke="#63E6BE" strokeWidth={2.5} fill="url(#gradOnTime)" />
                <Area type="monotone" dataKey="atRisk" name="At Risk" stroke="#F5B544" strokeWidth={2} fill="url(#gradAtRisk)" />
                <Area type="monotone" dataKey="delayed" name="Delayed" stroke="#FF6B6B" strokeWidth={2} fill="url(#gradDelayed)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Financial Snapshot */}
        <motion.div variants={fadeUp} className="section-card">
          <div className="section-card-header">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[rgba(52,211,153,0.16)] text-[#34D399] flex items-center justify-center ring-1 ring-[rgba(52,211,153,0.3)]">
                <DollarSign size={13} />
              </div>
              <span className="text-[0.9rem] font-bold tracking-tight text-[color:var(--text-primary)]">Financial Snapshot</span>
            </div>
            <Button variant="link" size="sm" trailing={<ArrowRight size={12} />}>Details</Button>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Workspace</th>
                  <th>Contract</th>
                  <th>Spent</th>
                  <th>Variance</th>
                </tr>
              </thead>
              <tbody>
                {(workspaceFinancials.length > 0 ? workspaceFinancials : DEMO_FINANCIALS).slice(0, 8).map((w) => (
                  <tr key={w.workspace_name} onClick={() => navigate('/workspaces')} className="cursor-pointer">
                    <td className="font-semibold text-[color:var(--text-primary)]">{w.workspace_name}</td>
                    <td className="tabular-nums">{fmtSAR(w.contract_value)}</td>
                    <td><Progress value={w.contract_value > 0 ? (w.spent / w.contract_value) * 100 : 0} tone="brand" size="sm" /></td>
                    <td className={cn('tabular-nums font-bold', w.variance > 0 ? 'financial-negative' : w.variance < 0 ? 'financial-positive' : 'financial-neutral')}>
                      {w.variance === 0 ? '—' : (w.variance > 0 ? '+' : '') + fmtSAR(Math.abs(w.variance))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold">
                  <td className="text-[color:var(--text-primary)]">Total</td>
                  <td className="tabular-nums text-[color:var(--text-primary)]">{fmtSAR(totalContract || 23_400_000)}</td>
                  <td className="text-[color:var(--text-primary)]">{Math.round(((totalSpent || 13_300_000) / (totalContract || 23_400_000)) * 100)}%</td>
                  <td className={cn('tabular-nums', totalVariance > 0 ? 'financial-negative' : 'financial-positive')}>
                    {(totalVariance >= 0 ? '+' : '') + fmtSAR(Math.abs(totalVariance || 430_000))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </motion.div>
      </div>

      {/* ── Overdue Alert ──────────────────────────────────── */}
      <motion.div
        variants={fadeUp}
        className="flex items-center justify-between gap-4 flex-wrap rounded-2xl px-5 py-4 bg-gradient-to-br from-[rgba(255,107,107,0.1)] to-[rgba(240,168,117,0.05)] border border-[rgba(255,107,107,0.22)] backdrop-blur-md"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[rgba(255,107,107,0.2)] text-[#FCA5A5] flex items-center justify-center flex-shrink-0 ring-1 ring-[rgba(255,107,107,0.3)]">
            <AlertTriangle size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-[0.88rem] font-bold text-[color:var(--text-primary)]">12 overdue tasks across 4 workspaces</div>
            <div className="text-[0.74rem] text-[color:var(--text-muted)] mt-0.5">3 high-priority items may impact milestones</div>
          </div>
        </div>
        <Button variant="danger" onClick={() => navigate('/tasks')} trailing={<ArrowRight size={13} />}>Review Tasks</Button>
      </motion.div>

      {/* ── AI Recommendations + Pending Approvals ──────────── */}
      <div className={cn('grid gap-4', twoColLayout ? 'grid-cols-[1.3fr_1fr]' : 'grid-cols-1')}>
        {/* Recommendations */}
        <motion.div variants={fadeUp} className="section-card">
          <div className="section-card-header">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#7877C6] to-[#A78BFA] text-white flex items-center justify-center shadow-[0_2px_8px_rgba(120,119,198,0.4)]">
                <Brain size={13} />
              </div>
              <span className="text-[0.9rem] font-bold tracking-tight text-[color:var(--text-primary)]">AI Recommendations</span>
            </div>
            <Badge tone="brand">{recommendations.length} active</Badge>
          </div>
          <div className="p-4 space-y-2.5">
            <AnimatePresence mode="popLayout">
              {recommendations.map((r) => {
                const RecIcon = r.icon === 'zap' ? Zap : r.icon === 'alert' ? AlertTriangle : Clock;
                const toneBg = r.tone === 'brand' ? 'bg-[rgba(120,119,198,0.12)] text-[#C4B5FD] ring-[rgba(120,119,198,0.3)]'
                  : r.tone === 'danger' ? 'bg-[rgba(255,107,107,0.12)] text-[#FCA5A5] ring-[rgba(255,107,107,0.3)]'
                  : 'bg-[rgba(240,168,117,0.12)] text-[#F0A875] ring-[rgba(240,168,117,0.3)]';
                return (
                  <motion.div
                    key={r.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10, height: 0 }}
                    className="relative flex items-start gap-3 p-4 rounded-2xl bg-white/[0.025] border border-white/[0.06] hover:border-white/[0.12] transition-colors group"
                  >
                    <button onClick={() => dismissRec(r.id)} className="absolute top-3 right-3 text-[color:var(--text-faint)] hover:text-[color:var(--text-primary)] transition-colors">
                      <X size={13} />
                    </button>
                    <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ring-1', toneBg)}>
                      <RecIcon size={15} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[0.86rem] font-semibold text-[color:var(--text-primary)] mb-0.5 pr-6">{r.title}</div>
                      <div className="text-[0.76rem] text-[color:var(--text-muted)] mb-3">{r.detail}</div>
                      <Button
                        variant="subtle"
                        size="sm"
                        onClick={() => navigate(r.path)}
                        trailing={<ArrowRight size={12} />}
                      >
                        {r.action}
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {recommendations.length === 0 && (
              <div className="py-6 text-center">
                <div className="text-[0.82rem] font-semibold text-[color:var(--text-primary)] mb-1">All caught up</div>
                <div className="text-[0.72rem] text-[color:var(--text-muted)]">No pending recommendations</div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Approvals */}
        <motion.div variants={fadeUp} className="section-card">
          <div className="section-card-header">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[rgba(245,181,68,0.16)] text-[#F5B544] flex items-center justify-center ring-1 ring-[rgba(245,181,68,0.3)]">
                <FileText size={13} />
              </div>
              <span className="text-[0.9rem] font-bold tracking-tight text-[color:var(--text-primary)]">Pending Approvals</span>
            </div>
            <Badge tone="pending">{approvals.filter((a) => a.status === 'pending').length} pending</Badge>
          </div>
          <div className="p-4 space-y-2">
            <AnimatePresence>
              {approvals.map((a) => (
                <motion.div
                  key={a.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.025] border border-white/[0.06] hover:border-white/[0.12] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[0.82rem] font-semibold text-[color:var(--text-primary)] truncate">{a.title}</span>
                      <Badge tone={a.urgency === 'High' ? 'critical' : a.urgency === 'Medium' ? 'high' : 'low'} className="flex-shrink-0">{a.urgency}</Badge>
                    </div>
                    <div className="text-[0.7rem] text-[color:var(--text-muted)]">{a.type}</div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {a.status === 'pending' ? (
                      <>
                        <button onClick={() => handleApprove(a.id)} className="p-1.5 rounded-lg bg-[rgba(52,211,153,0.15)] text-[#34D399] border border-[rgba(52,211,153,0.3)] hover:bg-[rgba(52,211,153,0.25)] transition-colors" aria-label="Approve" title="Approve">
                          <Check size={13} />
                        </button>
                        <button onClick={() => handleReject(a.id)} className="p-1.5 rounded-lg bg-[rgba(255,107,107,0.12)] text-[#FCA5A5] border border-[rgba(255,107,107,0.28)] hover:bg-[rgba(255,107,107,0.22)] transition-colors" aria-label="Reject" title="Reject">
                          <X size={13} />
                        </button>
                      </>
                    ) : (
                      <Badge tone={a.status === 'approved' ? 'success' : 'critical'}>{a.status}</Badge>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {approvals.length === 0 && (
              <div className="py-8 text-center">
                <div className="w-10 h-10 rounded-full bg-[rgba(52,211,153,0.16)] text-[#34D399] flex items-center justify-center ring-1 ring-[rgba(52,211,153,0.3)] mx-auto mb-2">
                  <Check size={15} />
                </div>
                <div className="text-[0.82rem] font-semibold text-[color:var(--text-primary)]">All approvals clear</div>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* ── AI Intelligence CTA ───────────────────────────── */}
      <motion.button
        variants={fadeUp}
        whileHover={{ y: -3, transition: spring }}
        onClick={() => navigate('/ask-ai')}
        className="group relative overflow-hidden rounded-[28px] p-7 md:p-9 text-left bg-gradient-to-br from-[rgba(120,119,198,0.16)] via-[rgba(17,21,35,0.8)] to-[rgba(99,230,190,0.08)] border border-[rgba(120,119,198,0.25)] backdrop-blur-xl shadow-[var(--shadow-md)]"
      >
        <div aria-hidden className="absolute -top-32 -right-20 w-80 h-80 rounded-full bg-[radial-gradient(circle,rgba(120,119,198,0.35)_0%,transparent_60%)] pointer-events-none" />
        <div aria-hidden className="absolute -bottom-32 left-20 w-72 h-72 rounded-full bg-[radial-gradient(circle,rgba(99,230,190,0.18)_0%,transparent_60%)] pointer-events-none" />
        <motion.div
          aria-hidden
          initial={{ backgroundPositionX: '-200%' }}
          animate={{ backgroundPositionX: '200%' }}
          transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
          className="absolute top-0 inset-x-0 h-[1.5px] bg-[linear-gradient(90deg,transparent,rgba(167,139,250,0.8),rgba(99,230,190,0.6),transparent)] bg-[length:200%_100%] pointer-events-none"
        />

        <div className="relative flex items-start gap-5 flex-wrap">
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#7877C6] via-[#A78BFA] to-[#63E6BE] flex items-center justify-center shadow-[0_8px_24px_rgba(120,119,198,0.5),inset_0_1px_0_rgba(255,255,255,0.3)] flex-shrink-0 ring-1 ring-white/20"
          >
            <Sparkles size={22} className="text-white drop-shadow" />
          </motion.div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[0.72rem] font-bold tracking-[0.12em] uppercase text-[#A78BFA]">AI Intelligence Engine</span>
              <Badge tone="brand">GPT-4o</Badge>
            </div>
            <h3 className="text-[1.1rem] md:text-[1.25rem] font-bold text-[color:var(--text-primary)] mb-2 tracking-tight leading-tight">
              Ask anything about your portfolio — <span className="serif-display text-[#C4B5FD]">risks</span>, <span className="serif-display text-[#63E6BE]">decisions</span>, deliverables, financials.
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              {['Summarize NCA risks', 'SC-10 budget status', 'Overdue milestone report'].map((q) => (
                <span key={q} className="text-[0.72rem] font-medium px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-[color:var(--text-secondary)]">
                  {q}
                </span>
              ))}
            </div>
          </div>
          <div className="btn-ai group-hover:[filter:brightness(1.1)] flex items-center gap-2">
            <Bot size={14} />Ask AI<ArrowRight size={13} />
          </div>
        </div>
      </motion.button>

      {/* ── Activity Feed + Document Distribution ───────────── */}
      <div className={cn('grid gap-4', twoColLayout ? 'grid-cols-[1.5fr_1fr]' : 'grid-cols-1')}>
        {/* Activity feed */}
        <motion.div variants={fadeUp} className="section-card">
          <div className="section-card-header flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[rgba(56,189,248,0.16)] text-[#7DD3FC] flex items-center justify-center ring-1 ring-[rgba(56,189,248,0.3)]">
                <Activity size={13} />
              </div>
              <span className="text-[0.9rem] font-bold tracking-tight text-[color:var(--text-primary)]">Activity Feed</span>
            </div>
            <Tabs
              value={activityFilter}
              onChange={setActivityFilter}
              items={activityTypes.map((t) => ({ value: t, label: t }))}
            />
          </div>
          <div className="max-h-[380px] overflow-y-auto">
            {(filteredActivities.length > 0 ? filteredActivities : DEMO_ACTIVITIES).slice(0, 12).map((a, i) => (
              <motion.div
                key={a.id || i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-start gap-3 px-5 py-3 border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.02] transition-colors"
              >
                <ActivityIcon type={a.type} />
                <div className="flex-1 min-w-0">
                  <div className="text-[0.82rem] text-[color:var(--text-primary)] font-medium leading-snug">
                    <span className="font-semibold">{a.user}</span>{' '}{a.action}{' '}<span className="text-[color:var(--text-muted)]">{a.target}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[0.68rem] text-[color:var(--text-faint)] mt-1">
                    {a.workspace && <><span>{a.workspace}</span><span>·</span></>}
                    <span>{a.time || new Date(a.created_at || Date.now()).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </motion.div>
            ))}
            {filteredActivities.length === 0 && activities.length > 0 && (
              <div className="py-8 text-center text-[0.8rem] text-[color:var(--text-muted)]">No {activityFilter.toLowerCase()} activities yet</div>
            )}
          </div>
        </motion.div>

        {/* Document Distribution */}
        <motion.div variants={fadeUp} className="section-card">
          <div className="section-card-header">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[rgba(167,139,250,0.16)] text-[#C4B5FD] flex items-center justify-center ring-1 ring-[rgba(167,139,250,0.3)]">
                <FileText size={13} />
              </div>
              <span className="text-[0.9rem] font-bold tracking-tight text-[color:var(--text-primary)]">Document Distribution</span>
            </div>
          </div>
          <div className="p-5">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={documentsByTypeData.length > 0 ? documentsByTypeData : DEMO_DOC_DIST}
                    dataKey="value"
                    innerRadius={48}
                    outerRadius={82}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {(documentsByTypeData.length > 0 ? documentsByTypeData : DEMO_DOC_DIST).map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 text-[0.72rem]">
              {(documentsByTypeData.length > 0 ? documentsByTypeData : DEMO_DOC_DIST).map((d, i) => (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="flex-1 text-[color:var(--text-secondary)] truncate">{d.name}</span>
                  <span className="font-bold tabular-nums text-[color:var(--text-primary)]">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ── Demo fallbacks (used when supabase empty) ───────────────

const DEMO_WORKSPACES = [
  { workspace: 'NCA Digital Transformation Program', rag: 'Green', budget: 'Green', schedule: 'Amber', risk: 'Green', lastUpdated: '12 Mar 2026', workspace_id: '1' },
  { workspace: 'ADNOC Supply Chain Optimization',   rag: 'Amber', budget: 'Amber', schedule: 'Green', risk: 'Amber', lastUpdated: '10 Mar 2026', workspace_id: '2' },
  { workspace: 'MOCI Procurement Reform',           rag: 'Green', budget: 'Green', schedule: 'Green', risk: 'Green', lastUpdated: '11 Mar 2026', workspace_id: '3' },
  { workspace: 'Healthcare Digital Strategy',       rag: 'Red',   budget: 'Red',   schedule: 'Amber', risk: 'Red',   lastUpdated: '09 Mar 2026', workspace_id: '4' },
  { workspace: 'Smart City Infrastructure PMO',     rag: 'Amber', budget: 'Amber', schedule: 'Green', risk: 'Amber', lastUpdated: '14 Mar 2026', workspace_id: '5' },
  { workspace: 'Banking Core Transformation',       rag: 'Green', budget: 'Green', schedule: 'Green', risk: 'Green', lastUpdated: '15 Mar 2026', workspace_id: '6' },
  { workspace: 'Internal Quality Framework',        rag: 'Amber', budget: 'Green', schedule: 'Amber', risk: 'Green', lastUpdated: '08 Mar 2026', workspace_id: '7' },
  { workspace: 'Retail Digital Commerce',           rag: 'Amber', budget: 'Amber', schedule: 'Amber', risk: 'Amber', lastUpdated: '13 Mar 2026', workspace_id: '8' },
] as unknown as RagStatusWithWorkspace[];

const DEMO_MILESTONES = [
  { id: 'm1', title: 'ENB Core Banking Go-Live',         workspace_name: 'Banking Core',    due_date: '01 Apr 2026', status: 'On Track',  value: 1_200_000, owner: 'KA', completion_pct: 85 },
  { id: 'm2', title: 'Smart City Package 3 Commencement',workspace_name: 'Smart City PMO',  due_date: '01 May 2026', status: 'At Risk',   value: 6_800_000, owner: 'RT', completion_pct: 45 },
  { id: 'm3', title: 'Phase 3: Pilot Implementation',    workspace_name: 'NCA Digital Transf.', due_date: '15 Apr 2026', status: 'On Track', value: 4_200_000, owner: 'KA', completion_pct: 70 },
] as unknown as MilestoneRow[];

const DEMO_FINANCIALS = [
  { workspace_id: '1', workspace_name: 'NCA Digital Transformation Program', contract_value: 4_200_000, spent: 2_856_000, forecast: 4_250_000, variance: -50_000 },
  { workspace_id: '2', workspace_name: 'ADNOC Supply Chain Optimization',    contract_value: 3_500_000, spent: 1_575_000, forecast: 3_650_000, variance:  150_000 },
  { workspace_id: '3', workspace_name: 'MOCI Procurement Reform',            contract_value: 2_800_000, spent: 2_576_000, forecast: 2_820_000, variance:   20_000 },
  { workspace_id: '4', workspace_name: 'Healthcare Digital Strategy',        contract_value: 1_900_000, spent:   855_000, forecast: 1_880_000, variance:  -20_000 },
  { workspace_id: '5', workspace_name: 'Smart City Infrastructure PMO',      contract_value: 6_800_000, spent: 3_060_000, forecast: 7_100_000, variance:  300_000 },
  { workspace_id: '6', workspace_name: 'Banking Core Transformation',        contract_value: 1_200_000, spent: 1_080_000, forecast: 1_250_000, variance:   50_000 },
  { workspace_id: '7', workspace_name: 'Internal Quality Framework',        contract_value:   890_000, spent:   445_000, forecast:   870_000, variance:  -20_000 },
  { workspace_id: '8', workspace_name: 'Retail Digital Commerce',           contract_value: 2_100_000, spent:   840_000, forecast: 2_100_000, variance:        0 },
] as unknown as WorkspaceFinancialRow[];

const DEMO_TREND = [
  { month: 'Jan', onTime: 8, atRisk: 2, delayed: 1, value: 12 },
  { month: 'Feb', onTime: 10, atRisk: 3, delayed: 2, value: 15 },
  { month: 'Mar', onTime: 12, atRisk: 2, delayed: 1, value: 18 },
  { month: 'Apr', onTime: 9,  atRisk: 4, delayed: 1, value: 14 },
  { month: 'May', onTime: 14, atRisk: 3, delayed: 0, value: 21 },
  { month: 'Jun', onTime: 11, atRisk: 2, delayed: 2, value: 17 },
];

const DEMO_DOC_DIST = [
  { name: 'BRD',            value: 2 },
  { name: 'Technical',      value: 1 },
  { name: 'Policy',         value: 1 },
  { name: 'Project Plan',   value: 1 },
  { name: 'Technical Spec', value: 1 },
  { name: 'Architecture',   value: 1 },
  { name: 'Assessment',     value: 1 },
  { name: 'Charter',        value: 1 },
];

const DEMO_ACTIVITIES: ActivityRow[] = [
  { id: '1', user: 'Khalil',  action: 'updated',   target: 'NCA BRD v2.3 draft',                 workspace: 'NCA Digital Transf.',     workspace_id: '1', time: '2h ago',  type: 'document',   created_at: new Date().toISOString() },
  { id: '2', user: 'System',  action: 'completed', target: 'BRD Generator workflow',             workspace: 'NCA Digital Transf.',     workspace_id: '1', time: '3h ago',  type: 'automation', created_at: new Date(Date.now() - 3_600_000).toISOString() },
  { id: '3', user: 'Rashid',  action: 'added',     target: 'meeting notes for SC-10 Committee',  workspace: 'Smart City PMO',          workspace_id: '5', time: '5h ago',  type: 'meeting',    created_at: new Date(Date.now() - 7_200_000).toISOString() },
  { id: '4', user: 'Fahad',   action: 'completed', target: '3 tasks',                            workspace: 'ADNOC Supply Chain',      workspace_id: '2', time: '8h ago',  type: 'task',       created_at: new Date(Date.now() - 10_800_000).toISOString() },
  { id: '5', user: 'Sarah',   action: 'uploaded',  target: 'Healthcare Digital Strategy v1.2',   workspace: 'Healthcare Digital',      workspace_id: '4', time: '1d ago',  type: 'document',   created_at: new Date(Date.now() - 86_400_000).toISOString() },
];
