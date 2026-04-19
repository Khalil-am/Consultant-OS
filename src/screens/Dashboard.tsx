import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase, FileText, Zap, CheckSquare, AlertTriangle,
  TrendingUp, Upload, Video, ArrowRight, Check, X, Target,
  Activity, Users, ChevronRight, UserPlus, ListTodo, DollarSign, Clock,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  getActivities, getMilestones, getWorkspaceFinancials,
  getRagStatusWithWorkspaces, getApprovals, updateApproval, upsertApproval,
} from '../lib/db';
import type {
  ActivityRow, MilestoneRow, WorkspaceFinancialRow,
  RagStatusWithWorkspace, ApprovalRow,
} from '../lib/db';
import { useLayout } from '../hooks/useLayout';
import { Badge, Progress, cn, fadeUp, stagger } from '../components/ui';

function fmtSAR(val: number): string {
  if (val >= 1_000_000) return `SAR ${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `SAR ${(val / 1_000).toFixed(0)}K`;
  return `SAR ${val.toLocaleString()}`;
}

const FALLBACK_APPROVALS: ApprovalRow[] = [
  { id: 'appr-001', title: 'NCA BRD v2.3',               requester: 'AM', type: 'Document Approval',    urgency: 'High',   status: 'pending', workspace_id: null, notes: null, created_at: '', updated_at: '' },
  { id: 'appr-002', title: 'SC-10 Budget SAR 2.4M',      requester: 'RT', type: 'Budget Approval',      urgency: 'High',   status: 'pending', workspace_id: null, notes: null, created_at: '', updated_at: '' },
  { id: 'appr-003', title: 'MOCI Vendor Shortlist',      requester: 'FH', type: 'Procurement Decision', urgency: 'Medium', status: 'pending', workspace_id: null, notes: null, created_at: '', updated_at: '' },
  { id: 'appr-004', title: 'Healthcare Strategy Report', requester: 'SK', type: 'Report Sign-off',      urgency: 'Low',    status: 'pending', workspace_id: null, notes: null, created_at: '', updated_at: '' },
];

const activityMeta: Record<string, { color: string; Icon: typeof FileText }> = {
  document:   { color: '#A78BFA', Icon: FileText },
  meeting:    { color: '#63E6BE', Icon: Video },
  automation: { color: '#C4B5FD', Icon: Zap },
  task:       { color: '#F5B544', Icon: CheckSquare },
  default:    { color: '#8790A8', Icon: Activity },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { isMobile } = useLayout();
  const [approvals, setApprovals] = useState<ApprovalRow[]>(FALLBACK_APPROVALS);

  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [workspaceFinancials, setWorkspaceFinancials] = useState<WorkspaceFinancialRow[]>([]);
  const [ragStatusData, setRagStatusData] = useState<RagStatusWithWorkspace[]>([]);

  useEffect(() => {
    getActivities(30).then(setActivities).catch(() => {});
    getMilestones().then(setMilestones).catch(() => {});
    getWorkspaceFinancials().then(setWorkspaceFinancials).catch(() => {});
    getRagStatusWithWorkspaces().then(setRagStatusData).catch(() => {});
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

  const totalContract = workspaceFinancials.reduce((s, w) => s + w.contract_value, 0);
  const totalSpent    = workspaceFinancials.reduce((s, w) => s + w.spent, 0);
  const pendingCount  = approvals.filter((a) => a.status === 'pending').length;

  const kpis = useMemo(() => {
    const contract = workspaceFinancials.reduce((s, w) => s + w.contract_value, 0);
    const spent = workspaceFinancials.reduce((s, w) => s + w.spent, 0);
    const atRiskCount = workspaceFinancials.filter((w) => w.variance > 0).length;
    const atRiskVariance = workspaceFinancials.filter((w) => w.variance > 0).reduce((s, w) => s + w.variance, 0);
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const msDue = milestones.filter((m) => { const d = new Date(m.due_date); return d >= now && d <= in30; });
    const completedMs = milestones.filter((m) => m.status === 'Completed').length;
    const totalMs = milestones.length;
    const onTimeRate = totalMs > 0 ? Math.round((completedMs / totalMs) * 100) : 0;
    return [
      { label: 'Total Portfolio Value', value: fmtSAR(contract || 23_400_000),            sub: `${workspaceFinancials.length || 8} engagements` },
      { label: 'Revenue Recognized',    value: fmtSAR(spent    || 13_300_000),            sub: contract > 0 ? `${Math.round((spent / contract) * 100)}%` : '57%' },
      { label: 'Budget at Risk',        value: fmtSAR(atRiskVariance || 520_000),         sub: `${atRiskCount || 4} over forecast`, danger: true },
      { label: 'Milestones Due',        value: String(msDue.length || 2),                 sub: 'Next 30 days' },
      { label: 'On-Time Delivery',      value: `${onTimeRate || 30}%`,                    sub: `${completedMs} of ${totalMs || 10}` },
      { label: 'Client Satisfaction',   value: '—',                                        sub: 'Connect NPS' },
    ];
  }, [workspaceFinancials, milestones]);

  const recentActivities = (activities.length > 0 ? activities : DEMO_ACTIVITIES).slice(0, 6);
  const workspaces = (ragStatusData.length > 0 ? ragStatusData : DEMO_WORKSPACES).slice(0, 5);

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: stagger(0.07, 0.1) } }}
      className="screen-container"
    >
      {/* ── Hero ─────────────────────────────────── */}
      <motion.section variants={fadeUp}>
        <div className="flex items-center gap-2 mb-3 text-[0.66rem] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#63E6BE] shadow-[0_0_8px_rgba(99,230,190,0.8)]" />
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
        <h1 className="text-[1.6rem] md:text-[2rem] font-semibold tracking-[-0.025em] leading-[1.1] mb-2">
          <span className="bg-gradient-to-br from-white to-[#B7BDCE] bg-clip-text text-transparent">
            Good morning, Khalil.
          </span>
        </h1>
        <p className="text-[0.92rem] text-[color:var(--text-muted)] max-w-xl leading-relaxed">
          {pendingCount > 0
            ? <>You have <span className="text-[#A78BFA] font-semibold">{pendingCount} item{pendingCount !== 1 ? 's' : ''}</span> waiting on you and <span className="text-[color:var(--text-secondary)] font-semibold">{workspaces.length} active workspaces</span>.</>
            : <>Everything is on track across <span className="text-[color:var(--text-secondary)] font-semibold">{workspaces.length} active workspaces</span>.</>
          }
        </p>
      </motion.section>

      {/* ── KPI Row (compact) ───────────────────── */}
      <motion.div
        variants={{ hidden: {}, show: { transition: stagger(0.04, 0.05) } }}
        className={cn('grid gap-3', isMobile ? 'grid-cols-2' : 'grid-cols-3 md:grid-cols-6')}
      >
        {kpis.map((k) => (
          <motion.div
            key={k.label}
            variants={fadeUp}
            className="rounded-2xl bg-white/[0.025] border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.04] p-3.5 transition-colors"
          >
            <div className="text-[0.62rem] font-semibold tracking-[0.1em] uppercase text-[color:var(--text-muted)] mb-2 truncate">{k.label}</div>
            <div className={cn('text-[1.25rem] md:text-[1.35rem] font-bold tabular-nums tracking-[-0.02em] leading-none', k.danger ? 'text-[#FCA5A5]' : 'text-white')}>{k.value}</div>
            <div className="text-[0.7rem] text-[color:var(--text-faint)] mt-1.5 truncate">{k.sub}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Two-column: Inbox + Workspaces ─────── */}
      <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'grid-cols-[1.1fr_1fr]')}>

        {/* Action Inbox */}
        <motion.section variants={fadeUp} className="section-card">
          <div className="section-card-header">
            <div className="flex items-center gap-2">
              <span className="text-[0.95rem] font-semibold tracking-tight text-white">Needs your attention</span>
              <Badge tone={pendingCount > 0 ? 'pending' : 'success'}>{pendingCount} pending</Badge>
            </div>
            <button onClick={() => navigate('/tasks')} className="text-[0.75rem] font-medium text-[color:var(--text-muted)] hover:text-white transition-colors flex items-center gap-1">
              View all <ArrowRight size={11} />
            </button>
          </div>
          <div className="p-4 space-y-2 min-h-[240px]">
            <AnimatePresence>
              {approvals.slice(0, 5).map((a) => {
                const urgencyTone = a.urgency === 'High' ? 'critical' : a.urgency === 'Medium' ? 'high' : 'low';
                return (
                  <motion.div
                    key={a.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[0.84rem] font-semibold text-white truncate">{a.title}</span>
                        <Badge tone={urgencyTone} className="flex-shrink-0">{a.urgency}</Badge>
                      </div>
                      <div className="text-[0.7rem] text-[color:var(--text-muted)] truncate">{a.type}</div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {a.status === 'pending' ? (
                        <>
                          <button onClick={() => handleApprove(a.id)} aria-label="Approve" title="Approve"
                            className="p-1.5 rounded-lg bg-[rgba(52,211,153,0.12)] text-[#34D399] border border-[rgba(52,211,153,0.25)] hover:bg-[rgba(52,211,153,0.22)] transition-colors">
                            <Check size={13} />
                          </button>
                          <button onClick={() => handleReject(a.id)} aria-label="Reject" title="Reject"
                            className="p-1.5 rounded-lg bg-[rgba(255,107,107,0.1)] text-[#FCA5A5] border border-[rgba(255,107,107,0.22)] hover:bg-[rgba(255,107,107,0.2)] transition-colors">
                            <X size={13} />
                          </button>
                        </>
                      ) : (
                        <Badge tone={a.status === 'approved' ? 'success' : 'critical'}>{a.status}</Badge>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {approvals.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <div className="w-10 h-10 rounded-full bg-[rgba(52,211,153,0.14)] text-[#34D399] flex items-center justify-center ring-1 ring-[rgba(52,211,153,0.25)]">
                  <Check size={16} />
                </div>
                <div className="text-[0.85rem] font-semibold text-white">All clear</div>
                <div className="text-[0.72rem] text-[color:var(--text-muted)]">No pending items</div>
              </div>
            )}
          </div>
        </motion.section>

        {/* Active Workspaces */}
        <motion.section variants={fadeUp} className="section-card">
          <div className="section-card-header">
            <div className="flex items-center gap-2">
              <span className="text-[0.95rem] font-semibold tracking-tight text-white">Active workspaces</span>
            </div>
            <button onClick={() => navigate('/workspaces')} className="text-[0.75rem] font-medium text-[color:var(--text-muted)] hover:text-white transition-colors flex items-center gap-1">
              All <ChevronRight size={11} />
            </button>
          </div>
          <div>
            {workspaces.map((row, i) => {
              const pct = [78, 45, 92, 28, 62][i] ?? 50;
              const barTone = row.rag === 'Green' ? 'mint' : row.rag === 'Amber' ? 'amber' : 'red';
              const ragColor = row.rag === 'Green' ? '#63E6BE' : row.rag === 'Amber' ? '#F5B544' : '#FF6B6B';
              const contractValue = workspaceFinancials[i]?.contract_value ?? [4_200_000, 3_500_000, 2_800_000, 1_900_000, 6_800_000][i];
              return (
                <motion.button
                  key={row.workspace + i}
                  whileHover={{ backgroundColor: 'rgba(120,119,198,0.04)' }}
                  onClick={() => navigate('/workspaces')}
                  className={cn('w-full text-left px-5 py-3.5 transition-colors', i < workspaces.length - 1 && 'border-b border-white/[0.04]')}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ragColor, boxShadow: `0 0 8px ${ragColor}99` }} />
                      <span className="text-[0.83rem] font-medium text-white truncate">{row.workspace}</span>
                    </div>
                    <span className="text-[0.78rem] font-semibold tabular-nums" style={{ color: ragColor }}>{pct}%</span>
                  </div>
                  <Progress value={pct} tone={barTone} size="sm" />
                  {contractValue != null && (
                    <div className="flex items-center justify-end mt-1.5 text-[0.68rem] text-[color:var(--text-faint)] tabular-nums">
                      {fmtSAR(contractValue)}
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.section>
      </div>

      {/* ── Activity Feed ─────────────────────── */}
      <motion.section variants={fadeUp} className="section-card">
        <div className="section-card-header">
          <div className="flex items-center gap-2">
            <span className="text-[0.95rem] font-semibold tracking-tight text-white">Activity Feed</span>
          </div>
          <span className="text-[0.66rem] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-muted)]">Last 24h</span>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {recentActivities.map((a, i) => {
            const meta = activityMeta[a.type] ?? activityMeta.default;
            const Icon = meta.Icon;
            return (
              <motion.div
                key={a.id || i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-start gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors"
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${meta.color}22`, color: meta.color }}>
                  <Icon size={13} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[0.82rem] text-white leading-snug">
                    <span className="font-semibold">{a.user}</span>{' '}{a.action}{' '}
                    <span className="text-[color:var(--text-muted)]">{a.target}</span>
                  </div>
                  <div className="text-[0.68rem] text-[color:var(--text-faint)] mt-0.5">
                    {a.workspace && <>{a.workspace} · </>}{a.time || new Date(a.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.section>

      {/* ── Quick Actions (compact footer row) ── */}
      <motion.section variants={fadeUp}>
        <div className="text-[0.66rem] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-muted)] mb-3">Quick Actions</div>
        <div className={cn('grid gap-2', isMobile ? 'grid-cols-3' : 'grid-cols-6')}>
          {[
            { Icon: Upload,   label: 'Upload Doc',     to: '/documents' },
            { Icon: Zap,      label: 'Run Automation', to: '/automations' },
            { Icon: Video,    label: 'New Meeting',    to: '/meetings' },
            { Icon: FileText, label: 'Create Report',  to: '/reports' },
            { Icon: UserPlus, label: 'Add Client',     to: '/workspaces' },
            { Icon: ListTodo, label: 'New Task',       to: '/tasks' },
          ].map((qa) => {
            const Icon = qa.Icon;
            return (
              <button
                key={qa.label}
                onClick={() => navigate(qa.to)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.025] border border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.12] transition-colors text-left"
              >
                <Icon size={14} className="text-[color:var(--text-muted)] flex-shrink-0" />
                <span className="text-[0.76rem] font-medium text-[color:var(--text-secondary)] truncate">{qa.label}</span>
              </button>
            );
          })}
        </div>
      </motion.section>
    </motion.div>
  );
}

// ── Demo fallbacks ─────────────────────────────
const DEMO_WORKSPACES = [
  { workspace: 'NCA Digital Transformation Program', rag: 'Green', budget: 'Green', schedule: 'Amber', risk: 'Green', lastUpdated: '12 Mar 2026', workspace_id: '1' },
  { workspace: 'ADNOC Supply Chain Optimization',   rag: 'Amber', budget: 'Amber', schedule: 'Green', risk: 'Amber', lastUpdated: '10 Mar 2026', workspace_id: '2' },
  { workspace: 'MOCI Procurement Reform',           rag: 'Green', budget: 'Green', schedule: 'Green', risk: 'Green', lastUpdated: '11 Mar 2026', workspace_id: '3' },
  { workspace: 'Healthcare Digital Strategy',       rag: 'Red',   budget: 'Red',   schedule: 'Amber', risk: 'Red',   lastUpdated: '09 Mar 2026', workspace_id: '4' },
  { workspace: 'Smart City Infrastructure PMO',     rag: 'Amber', budget: 'Amber', schedule: 'Green', risk: 'Amber', lastUpdated: '14 Mar 2026', workspace_id: '5' },
] as unknown as RagStatusWithWorkspace[];

const DEMO_ACTIVITIES: ActivityRow[] = [
  { id: '1', user: 'Khalil',  action: 'updated',   target: 'NCA BRD v2.3 draft',                 workspace: 'NCA Digital Transf.',     workspace_id: '1', time: '2h ago',  type: 'document',   created_at: new Date().toISOString() },
  { id: '2', user: 'System',  action: 'completed', target: 'BRD Generator workflow',             workspace: 'NCA Digital Transf.',     workspace_id: '1', time: '3h ago',  type: 'automation', created_at: new Date(Date.now() - 3_600_000).toISOString() },
  { id: '3', user: 'Rashid',  action: 'added',     target: 'meeting notes for SC-10 Committee',  workspace: 'Smart City PMO',          workspace_id: '5', time: '5h ago',  type: 'meeting',    created_at: new Date(Date.now() - 7_200_000).toISOString() },
  { id: '4', user: 'Fahad',   action: 'completed', target: '3 tasks',                            workspace: 'ADNOC Supply Chain',      workspace_id: '2', time: '8h ago',  type: 'task',       created_at: new Date(Date.now() - 10_800_000).toISOString() },
  { id: '5', user: 'Sarah',   action: 'uploaded',  target: 'Healthcare Digital Strategy v1.2',   workspace: 'Healthcare Digital',      workspace_id: '4', time: '1d ago',  type: 'document',   created_at: new Date(Date.now() - 86_400_000).toISOString() },
];
