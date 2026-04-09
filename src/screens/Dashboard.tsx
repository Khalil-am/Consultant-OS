import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase, FileText, Zap, CheckSquare, Clock, AlertTriangle,
  TrendingUp, TrendingDown, Upload, Video, Sparkles, ArrowRight,
  Bot, Check, X, RefreshCw, Eye,
  Calendar, BarChart3, DollarSign, Target, Activity,
  Brain, Layers, Users, ChevronRight, UserPlus, ListTodo,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { getActivities, getMilestones, getWorkspaceFinancials, getBoardDecisions, getRagStatusWithWorkspaces, getApprovals, updateApproval, upsertApproval } from '../lib/db';
import type { ActivityRow, MilestoneRow, WorkspaceFinancialRow, BoardDecisionRow, RagStatusWithWorkspace, ApprovalRow } from '../lib/db';
import { useLayout } from '../hooks/useLayout';

type Period = 'today' | 'week' | 'month';

interface PortfolioKPI {
  label: string;
  value: string;
  subValue: string;
  trend: string;
  trendUp: boolean;
  color: string;
  icon: string;
}


function fmtSAR(val: number): string {
  if (val >= 1000000) return `SAR ${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `SAR ${(val / 1000).toFixed(0)}K`;
  return `SAR ${val.toLocaleString()}`;
}

// Use ApprovalRow from db for Supabase-backed approvals
const FALLBACK_APPROVALS: ApprovalRow[] = [
  { id: 'appr-001', title: 'NCA BRD v2.3', requester: 'AM', type: 'Document Approval', urgency: 'High', status: 'pending', workspace_id: null, notes: null, created_at: '', updated_at: '' },
  { id: 'appr-002', title: 'SC-10 Budget SAR 2.4M', requester: 'RT', type: 'Budget Approval', urgency: 'High', status: 'pending', workspace_id: null, notes: null, created_at: '', updated_at: '' },
  { id: 'appr-003', title: 'MOCI Vendor Shortlist', requester: 'FH', type: 'Procurement Decision', urgency: 'Medium', status: 'pending', workspace_id: null, notes: null, created_at: '', updated_at: '' },
  { id: 'appr-004', title: 'Healthcare Strategy Report', requester: 'SK', type: 'Report Sign-off', urgency: 'Low', status: 'pending', workspace_id: null, notes: null, created_at: '', updated_at: '' },
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
  const [approvals, setApprovals] = useState<ApprovalRow[]>(FALLBACK_APPROVALS);
  const [recommendations, setRecommendations] = useState(initialRecommendations);
  const [uploadDrag, setUploadDrag] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activityFilter, setActivityFilter] = useState<string>('All');
  const [completedDecisions, setCompletedDecisions] = useState<Set<string>>(new Set());

  // Live Supabase data
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [workspaceFinancials, setWorkspaceFinancials] = useState<WorkspaceFinancialRow[]>([]);
  const [boardDecisions, setBoardDecisions] = useState<BoardDecisionRow[]>([]);
  const [ragStatusData, setRagStatusData] = useState<RagStatusWithWorkspace[]>([]);

  useEffect(() => {
    getActivities(30).then(setActivities).catch(() => {});
    getMilestones().then(setMilestones).catch(() => {});
    getWorkspaceFinancials().then(setWorkspaceFinancials).catch(() => {});
    getBoardDecisions().then(setBoardDecisions).catch(() => {});
    getRagStatusWithWorkspaces().then(setRagStatusData).catch(() => {});
    // Load approvals from Supabase; seed defaults if table is empty
    getApprovals().then(rows => {
      if (rows.length > 0) {
        setApprovals(rows);
      } else {
        // Seed with fallbacks into Supabase
        Promise.all(FALLBACK_APPROVALS.map(a => upsertApproval(a))).then(seeded => {
          if (seeded.length > 0) setApprovals(seeded);
        }).catch(() => {});
      }
    }).catch(() => {/* Supabase table may not exist yet — keep fallback data */});
  }, []);

  const handleApprove = (id: string) => {
    setApprovals(prev => prev.map(a => a.id === id ? { ...a, status: 'approved' as const } : a));
    updateApproval(id, { status: 'approved' }).catch(() => {});
  };
  const handleReject = (id: string) => {
    setApprovals(prev => prev.map(a => a.id === id ? { ...a, status: 'rejected' as const } : a));
    updateApproval(id, { status: 'rejected' }).catch(() => {});
  };
  const dismissRec = (id: number) => setRecommendations(prev => prev.filter(r => r.id !== id));
  const handleRefresh = () => { setRefreshing(true); setTimeout(() => setRefreshing(false), 1200); };

  function handleGenerateCommitteePack() {
    const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const pendingApprovals = approvals.filter(a => a.status === 'pending');
    const ragRows = ragStatusData.map(r =>
      `<tr><td>${r.workspace}</td><td style="color:${r.rag==='Green'?'#10B981':r.rag==='Red'?'#EF4444':'#F59E0B'}">${r.rag}</td><td style="color:${r.budget==='Green'?'#10B981':r.budget==='Red'?'#EF4444':'#F59E0B'}">${r.budget}</td><td style="color:${r.schedule==='Green'?'#10B981':r.schedule==='Red'?'#EF4444':'#F59E0B'}">${r.schedule}</td><td style="color:${r.risk==='Green'?'#10B981':r.risk==='Red'?'#EF4444':'#F59E0B'}">${r.risk}</td></tr>`
    ).join('');
    const financialRows = workspaceFinancials.map(w =>
      `<tr><td>${w.workspace_name}</td><td>${fmtSAR(w.contract_value)}</td><td>${fmtSAR(w.spent)}</td><td>${fmtSAR(w.forecast)}</td><td style="color:${w.variance>0?'#EF4444':'#10B981'}">${w.variance>0?'+':''}${fmtSAR(w.variance)}</td></tr>`
    ).join('');
    const milestoneRows = upcomingMilestones.map(m =>
      `<tr><td>${m.title}</td><td>${m.due_date}</td><td style="color:${m.status==='On Track'?'#10B981':m.status==='At Risk'?'#F59E0B':m.status==='Delayed'?'#EF4444':'#94A3B8'}">${m.status}</td><td>${m.owner}</td><td>${m.completion_pct}%</td></tr>`
    ).join('');
    const approvalRows = pendingApprovals.map(a =>
      `<tr><td>${a.title}</td><td>${a.requester}</td><td>${a.type}</td><td style="color:${a.urgency==='High'?'#EF4444':a.urgency==='Medium'?'#F59E0B':'#10B981'}">${a.urgency}</td></tr>`
    ).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Committee Pack – ${date}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1E293B; margin: 0; padding: 32px; background: #fff; }
  h1 { color: #0F172A; font-size: 26px; border-bottom: 3px solid #0EA5E9; padding-bottom: 12px; }
  h2 { color: #1E40AF; font-size: 16px; margin-top: 28px; }
  .meta { color: #64748B; font-size: 13px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
  th { background: #F1F5F9; color: #374151; padding: 8px 12px; text-align: left; border-bottom: 2px solid #E2E8F0; }
  td { padding: 8px 12px; border-bottom: 1px solid #F1F5F9; }
  tr:hover td { background: #F8FAFC; }
  .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 16px 0; }
  .kpi { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; }
  .kpi-label { font-size: 11px; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.08em; }
  .kpi-value { font-size: 20px; font-weight: 700; color: #0F172A; margin-top: 4px; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #E2E8F0; color: #94A3B8; font-size: 11px; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
<h1>Steering Committee Pack</h1>
<div class="meta">Generated: ${date} | Consultant OS | CONFIDENTIAL</div>

<h2>1. Portfolio KPI Summary</h2>
<div class="kpi-grid">
  <div class="kpi"><div class="kpi-label">Total Portfolio</div><div class="kpi-value">${fmtSAR(totalContract)}</div></div>
  <div class="kpi"><div class="kpi-label">Revenue Recognized</div><div class="kpi-value">${fmtSAR(totalSpent)}</div></div>
  <div class="kpi"><div class="kpi-label">Budget Variance</div><div class="kpi-value" style="color:${totalVariance>0?'#EF4444':'#10B981'}">${totalVariance>0?'+':''}${fmtSAR(totalVariance)}</div></div>
</div>

<h2>2. Portfolio RAG Status</h2>
${ragStatusData.length > 0 ? `<table><thead><tr><th>Workspace</th><th>Overall RAG</th><th>Budget</th><th>Schedule</th><th>Risk</th></tr></thead><tbody>${ragRows}</tbody></table>` : '<p style="color:#94A3B8">No RAG data available.</p>'}

<h2>3. Financial Overview</h2>
${workspaceFinancials.length > 0 ? `<table><thead><tr><th>Workspace</th><th>Contract Value</th><th>Spent</th><th>Forecast</th><th>Variance</th></tr></thead><tbody>${financialRows}</tbody></table>` : '<p style="color:#94A3B8">No financial data available.</p>'}

<h2>4. Upcoming Milestones</h2>
${upcomingMilestones.length > 0 ? `<table><thead><tr><th>Milestone</th><th>Due Date</th><th>Status</th><th>Owner</th><th>Completion</th></tr></thead><tbody>${milestoneRows}</tbody></table>` : '<p style="color:#94A3B8">No upcoming milestones.</p>'}

<h2>5. Pending Approvals</h2>
${pendingApprovals.length > 0 ? `<table><thead><tr><th>Item</th><th>Requester</th><th>Type</th><th>Urgency</th></tr></thead><tbody>${approvalRows}</tbody></table>` : '<p style="color:#94A3B8">No pending approvals.</p>'}

<div class="footer">Consultant OS · Generated ${date} · This document is confidential and intended for committee members only.</div>
</body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Committee_Pack_${date.replace(/\s/g, '_')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  const markDecisionComplete = (id: string) => setCompletedDecisions(prev => new Set([...prev, id]));

  const activityTypes = ['All', 'Document', 'Meeting', 'Automation', 'Task'];
  const filteredActivities = activityFilter === 'All' ? activities : activities.filter(a => a.type === activityFilter.toLowerCase());

  const quickActions = [
    { icon: <Upload size={18} />, label: 'Upload Doc', color: '#0EA5E9', bg: 'rgba(14,165,233,0.08)', border: 'rgba(14,165,233,0.18)', action: () => setShowUploadModal(true) },
    { icon: <Zap size={18} />, label: 'Run Automation', color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.18)', action: () => navigate('/automations') },
    { icon: <Video size={18} />, label: 'New Meeting', color: '#10B981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.18)', action: () => navigate('/meetings') },
    { icon: <FileText size={18} />, label: 'Create Report', color: '#EF4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.18)', action: () => navigate('/reports') },
    { icon: <UserPlus size={18} />, label: 'Add Client', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.18)', action: () => navigate('/workspaces') },
    { icon: <ListTodo size={18} />, label: 'New Task', color: '#00D4FF', bg: 'rgba(0,212,255,0.08)', border: 'rgba(0,212,255,0.18)', action: () => navigate('/tasks') },
  ];

  const kpiCols = width >= 1200 ? 6 : width >= 900 ? 3 : 2;
  const bottomCols = width >= 900 ? '1.6fr 1fr' : '1fr';
  const p = isMobile ? '0.875rem' : '1.5rem';
  const gap = isMobile ? '0.875rem' : '1.25rem';

  const upcomingMilestones = [...milestones].filter(m => m.status !== 'Completed').slice(0, 5);
  const activeBoardDecisions = boardDecisions.filter(d => d.status !== 'Closed' && !completedDecisions.has(d.id));

  const totalContract = workspaceFinancials.reduce((s, w) => s + w.contract_value, 0);
  const totalSpent = workspaceFinancials.reduce((s, w) => s + w.spent, 0);
  const totalVariance = workspaceFinancials.reduce((s, w) => s + w.variance, 0);

  // Portfolio KPIs computed from live data
  const portfolioKPIs = useMemo((): PortfolioKPI[] => {
    const contract = workspaceFinancials.reduce((s, w) => s + w.contract_value, 0);
    const spent = workspaceFinancials.reduce((s, w) => s + w.spent, 0);
    const atRiskVariance = workspaceFinancials.filter(w => w.variance > 0).reduce((s, w) => s + w.variance, 0);
    const atRiskCount = workspaceFinancials.filter(w => w.variance > 0).length;
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const msDue = milestones.filter(m => { const d = new Date(m.due_date); return d >= now && d <= in30; });
    const msAtRisk = msDue.filter(m => m.status === 'At Risk' || m.status === 'Delayed').length;
    const msOnTrack = msDue.filter(m => m.status === 'On Track' || m.status === 'Upcoming').length;
    const completedMs = milestones.filter(m => m.status === 'Completed').length;
    const totalMs = milestones.length;
    const onTimeRate = totalMs > 0 ? Math.round((completedMs / totalMs) * 100) : 0;
    return [
      { label: 'Total Portfolio Value', value: fmtSAR(contract), subValue: `${workspaceFinancials.length} active engagements`, trend: '', trendUp: true, color: '#00D4FF', icon: 'portfolio' },
      { label: 'Revenue Recognized', value: fmtSAR(spent), subValue: contract > 0 ? `${Math.round((spent / contract) * 100)}% of portfolio` : '—', trend: '', trendUp: true, color: '#10B981', icon: 'revenue' },
      { label: 'Budget at Risk', value: fmtSAR(atRiskVariance), subValue: `${atRiskCount} engagement${atRiskCount !== 1 ? 's' : ''} over forecast`, trend: atRiskCount > 0 ? `+${atRiskCount}` : '0', trendUp: atRiskCount === 0, color: '#EF4444', icon: 'risk' },
      { label: 'Milestones Due (30d)', value: String(msDue.length), subValue: `${msOnTrack} on track · ${msAtRisk} at risk`, trend: msAtRisk > 0 ? `${msAtRisk} at risk` : 'All clear', trendUp: msAtRisk === 0, color: '#F59E0B', icon: 'milestone' },
      { label: 'On-Time Delivery Rate', value: `${onTimeRate}%`, subValue: `${completedMs} of ${totalMs} milestones`, trend: onTimeRate >= 80 ? '+' : '', trendUp: onTimeRate >= 80, color: '#8B5CF6', icon: 'delivery' },
      { label: 'Client Satisfaction', value: '—', subValue: 'Connect NPS data', trend: '—', trendUp: true, color: '#EC4899', icon: 'satisfaction' },
    ];
  }, [workspaceFinancials, milestones]);

  // Delivery trend computed from milestones grouped by month
  const deliveryTrendData = useMemo(() => {
    const monthMap: Record<string, { onTime: number; delayed: number; atRisk: number; value: number }> = {};
    milestones.forEach(ms => {
      const d = new Date(ms.due_date);
      if (isNaN(d.getTime())) return;
      const key = d.toLocaleString('en-US', { month: 'short' });
      if (!monthMap[key]) monthMap[key] = { onTime: 0, delayed: 0, atRisk: 0, value: 0 };
      if (ms.status === 'Completed' || ms.status === 'On Track') monthMap[key].onTime++;
      else if (ms.status === 'Delayed') monthMap[key].delayed++;
      else if (ms.status === 'At Risk') monthMap[key].atRisk++;
      monthMap[key].value += ms.value / 1_000_000;
    });
    return Object.entries(monthMap).map(([month, d]) => ({ month, ...d }));
  }, [milestones]);

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

    // ── sparkline data per KPI ────────────────────────────────────────
  const kpiSparks: Record<string, number[]> = {
    'Active Engagements': [6, 6, 7, 7, 8, 8, 8],
    'Pipeline Revenue':   [18, 22, 20, 25, 28, 30, 32],
    'Open Risk Items':    [9, 11, 8, 10, 7, 9, 6],
    'Milestones Due':     [4, 5, 3, 6, 4, 5, 7],
    'Delivery Score':     [78, 80, 79, 83, 85, 82, 88],
    'Tasks Completed':    [22, 27, 25, 30, 28, 34, 38],
  };

  return (
    <div style={{ padding: p, display: 'flex', flexDirection: 'column', gap, background: '#080C18', minHeight: '100%' }}>

      {/* ── Hero Banner ─────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #0A1628 0%, #080C18 45%, #0C0A1E 100%)',
        border: '1px solid rgba(0,212,255,0.15)',
        borderRadius: '16px',
        padding: isMobile ? '1.25rem' : '2rem',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 4px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,212,255,0.06)',
      }}>
        {/* Animated shimmer bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.8), rgba(139,92,246,0.6), transparent)', animation: 'shimmerBar 3s linear infinite', backgroundSize: '200% 100%', pointerEvents: 'none' }} />
        {/* Ambient glow orbs */}
        <div style={{ position: 'absolute', top: -100, right: -60, width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,212,255,0.09) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -80, left: 60, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '30%', right: '30%', width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />
        {/* Grid pattern overlay */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)', backgroundSize: '52px 52px', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.875rem' }}>
              {/* Live pulse indicator */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 10px rgba(16,185,129,0.9)' }} />
                <div style={{ position: 'absolute', width: 16, height: 16, borderRadius: '50%', border: '1px solid rgba(16,185,129,0.5)', animation: 'liveRing 2s ease-out infinite' }} />
              </div>
              <span style={{ fontSize: '0.68rem', color: '#10B981', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>
                Live · Board Overview
              </span>
              <span style={{ width: '1px', height: '12px', background: 'rgba(255,255,255,0.1)' }} />
              <span style={{ fontSize: '0.68rem', color: '#475569', letterSpacing: '0.04em' }}>{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
            <h1 style={{ margin: 0, fontSize: isMobile ? '1.6rem' : '2.2rem', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: '0.75rem' }}>
              <span style={{
                background: 'linear-gradient(135deg, #F8FAFC 0%, #CBD5E1 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>Client Command</span>
              {' '}
              <span style={{
                background: 'linear-gradient(135deg, #00D4FF 0%, #38BDF8 50%, #818CF8 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                textShadow: 'none',
              }}>Center</span>
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flexWrap: 'wrap' }}>
              {[
                { icon: <Users size={11} />, label: '8 active clients', color: '#64748B' },
                { icon: <DollarSign size={11} />, label: `${fmtSAR(totalContract)} portfolio`, color: '#00D4FF' },
                { icon: <Layers size={11} />, label: '32 open tasks', color: '#64748B' },
              ].map((item, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', color: item.color, fontWeight: item.color === '#00D4FF' ? 700 : 500 }}>
                  {item.icon}{item.label}
                </span>
              ))}
            </div>
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
            position: 'relative', marginTop: '1.75rem', paddingTop: '1.5rem',
            borderTop: '1px solid rgba(255,255,255,0.07)',
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0',
          }}>
            {[
              { label: 'Portfolio Value', value: fmtSAR(totalContract), sub: '8 engagements', color: '#00D4FF', icon: <DollarSign size={13} />, pct: null },
              { label: 'Revenue Recognized', value: fmtSAR(totalSpent), sub: `${Math.round((totalSpent / totalContract) * 100)}% of portfolio`, color: '#10B981', icon: <TrendingUp size={13} />, pct: Math.round((totalSpent / totalContract) * 100) },
              { label: 'Budget Variance', value: (totalVariance > 0 ? '+' : '') + fmtSAR(Math.abs(totalVariance)), sub: totalVariance > 0 ? 'Over budget' : 'Under budget', color: totalVariance > 0 ? '#EF4444' : '#10B981', icon: <BarChart3 size={13} />, pct: null },
              { label: 'Pending Actions', value: `${approvals.filter(a => a.status === 'pending').length + activeBoardDecisions.length}`, sub: 'Approvals + decisions', color: '#F59E0B', icon: <AlertTriangle size={13} />, pct: null },
            ].map((stat, i) => (
              <div key={stat.label} style={{
                display: 'flex', flexDirection: 'column', gap: '4px',
                padding: '0 1.5rem',
                borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '4px' }}>
                  <div style={{ color: stat.color, opacity: 0.7 }}>{stat.icon}</div>
                  <div style={{ fontSize: '0.62rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>{stat.label}</div>
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 900, letterSpacing: '-0.03em', color: stat.color, textShadow: `0 0 24px ${stat.color}50`, lineHeight: 1 }}>
                  {stat.value}
                </div>
                {stat.pct !== null && (
                  <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', marginTop: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${stat.pct}%`, background: `linear-gradient(90deg, ${stat.color}, ${stat.color}90)`, borderRadius: '2px', transition: 'width 1s ease' }} />
                  </div>
                )}
                <div style={{ fontSize: '0.68rem', color: '#475569', marginTop: stat.pct !== null ? '2px' : '0' }}>{stat.sub}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Portfolio KPI Row ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${kpiCols}, 1fr)`, gap: isMobile ? '0.625rem' : '0.875rem' }}>
        {portfolioKPIs.map((kpi: PortfolioKPI) => {
          const trendColor = kpi.trendUp ? '#10B981' : '#EF4444';
          const trendBg = kpi.trendUp ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)';
          return (
            <div key={kpi.label} style={{
              background: `linear-gradient(135deg, ${kpi.color}12 0%, #0C1220 60%)`,
              border: `1px solid ${kpi.color}25`,
              borderRadius: '12px',
              padding: isMobile ? '0.875rem' : '1.125rem',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
              transition: 'all 0.2s',
            }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = kpi.color + '45';
                el.style.transform = 'translateY(-2px)';
                el.style.boxShadow = `0 8px 24px rgba(0,0,0,0.3), 0 0 0 1px ${kpi.color}20`;
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = kpi.color + '25';
                el.style.transform = 'translateY(0)';
                el.style.boxShadow = 'none';
              }}
            >
              <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
                <div style={{ padding: '0.5rem', borderRadius: '8px', background: kpi.color + '18', color: kpi.color }}>
                  {kpi.icon === 'portfolio' ? <Briefcase size={15} /> :
                   kpi.icon === 'revenue' ? <TrendingUp size={15} /> :
                   kpi.icon === 'risk' ? <AlertTriangle size={15} /> :
                   kpi.icon === 'milestone' ? <Target size={15} /> :
                   kpi.icon === 'delivery' ? <Activity size={15} /> :
                   <CheckSquare size={15} />}
                </div>
                {/* Trend pill badge */}
                <span style={{
                  display: 'flex', alignItems: 'center', gap: '2px',
                  fontSize: '0.65rem', fontWeight: 700,
                  padding: '2px 7px', borderRadius: '6px',
                  background: trendBg, color: trendColor,
                  border: `1px solid ${trendColor}30`,
                }}>
                  {kpi.trendUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  {kpi.trend}
                </span>
              </div>

              <div style={{ position: 'relative' }}>
                <div style={{
                  fontSize: isMobile ? '1.4rem' : '1.75rem', fontWeight: 900,
                  letterSpacing: '-0.03em', lineHeight: 1, color: '#F1F5F9',
                }}>
                  {kpi.value}
                </div>
              </div>

              <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '0.5rem', fontWeight: 500 }}>{kpi.label}</div>
              <div style={{ fontSize: '0.65rem', color: '#334155', marginTop: '2px' }}>{kpi.subValue}</div>

              {/* Mini sparkline */}
              {(() => {
                const data = kpiSparks[kpi.label];
                if (!data) return null;
                const mn = Math.min(...data), mx = Math.max(...data), range = mx - mn || 1;
                const w = 80, h = 24;
                const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - mn) / range) * h}`).join(' ');
                return (
                  <svg width={w} height={h} style={{ marginTop: '0.5rem', opacity: 0.7 }}>
                    <defs>
                      <linearGradient id={`sg-${kpi.label.replace(/\s/g,'')}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={kpi.color} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={kpi.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <polygon
                      points={`0,${h} ${pts} ${w},${h}`}
                      fill={`url(#sg-${kpi.label.replace(/\s/g,'')})`}
                    />
                    <polyline points={pts} fill="none" stroke={kpi.color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* ── Quick Actions ─────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(160deg, #0A1220 0%, #080C18 100%)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '14px', overflow: 'hidden',
      }}>
        <div style={{
          padding: '0.875rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#00D4FF', boxShadow: '0 0 6px rgba(0,212,255,0.8)' }} />
            <span style={{ fontSize: '0.825rem', fontWeight: 800, color: '#F1F5F9', letterSpacing: '-0.01em' }}>Quick Actions</span>
          </div>
          <span style={{ fontSize: '0.68rem', color: '#334155', letterSpacing: '0.06em' }}>6 SHORTCUTS</span>
        </div>
        <div style={{ padding: '1rem 1.25rem', display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 3 : 6}, 1fr)`, gap: '0.75rem' }}>
          {quickActions.map((action) => (
            <button key={action.label} onClick={action.action} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.625rem',
              padding: isMobile ? '1rem 0.25rem' : '1.25rem 0.5rem',
              borderRadius: '12px',
              background: action.bg,
              border: `1px solid ${action.border}`,
              cursor: 'pointer', transition: 'all 0.2s', color: action.color,
              fontFamily: 'inherit', position: 'relative', overflow: 'hidden',
            }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = `0 16px 32px ${action.color}25, 0 0 0 1px ${action.color}30`;
                e.currentTarget.style.borderColor = action.color + '55';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = action.border;
              }}
            >
              {/* icon glow */}
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', inset: '-4px', borderRadius: '50%', background: `radial-gradient(circle, ${action.color}30 0%, transparent 70%)`, filter: 'blur(4px)' }} />
                <div style={{ position: 'relative' }}>{action.icon}</div>
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8', textAlign: 'center', lineHeight: 1.3 }}>{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Workspace Portfolio + Milestones (2-col) ─────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: width >= 900 ? '1.6fr 1fr' : '1fr', gap: '1rem' }}>

        {/* Left: Workspace Portfolio */}
        <div style={{
          background: 'linear-gradient(160deg, #0A1220 0%, #080C18 100%)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '14px', overflow: 'hidden', position: 'relative',
        }}>
          {/* RGB moving accent */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #0EA5E9, #8B5CF6, #10B981, #F59E0B, #0EA5E9)', backgroundSize: '200% 100%', animation: 'shimmerBar 4s linear infinite', pointerEvents: 'none' }} />
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <div style={{ padding: '0.4rem', borderRadius: '8px', background: 'rgba(14,165,233,0.12)', color: '#0EA5E9' }}>
                <Layers size={14} />
              </div>
              <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#F1F5F9', letterSpacing: '-0.01em' }}>Workspace Portfolio</span>
            </div>
            <button onClick={() => navigate('/workspaces')} style={{
              display: 'flex', alignItems: 'center', gap: '0.375rem',
              padding: '0.35rem 0.875rem', borderRadius: '8px',
              background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)',
              color: '#0EA5E9', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit', transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(14,165,233,0.16)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(14,165,233,0.08)'; }}
            >
              All Workspaces <ChevronRight size={13} />
            </button>
          </div>
          <div style={{ padding: '0.5rem 0' }}>
            {ragStatusData.slice(0, 4).map((row, i) => {
              const pct = [78, 45, 92, 28][i] ?? 50;
              const barColor = row.rag === 'Green' ? '#10B981' : row.rag === 'Amber' ? '#F59E0B' : '#EF4444';
              const glowColor = row.rag === 'Green' ? 'rgba(16,185,129,0.35)' : row.rag === 'Amber' ? 'rgba(245,158,11,0.35)' : 'rgba(239,68,68,0.35)';
              const contractValue = workspaceFinancials[i]?.contract_value;
              return (
                <div key={row.workspace} style={{
                  padding: '1rem 1.5rem', cursor: 'pointer',
                  borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  transition: 'background 0.15s',
                }}
                  onClick={() => navigate('/workspaces')}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: barColor, boxShadow: `0 0 6px ${glowColor}`, flexShrink: 0 }} />
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#E2E8F0' }}>{row.workspace}</span>
                    </div>
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: barColor }}>{pct}%</span>
                  </div>
                  <div style={{ height: '6px', borderRadius: '99px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: '0.5rem' }}>
                    <div style={{
                      height: '100%', width: `${pct}%`,
                      background: `linear-gradient(90deg, ${barColor}CC, ${barColor})`,
                      borderRadius: '99px', boxShadow: `0 0 8px ${glowColor}`,
                      transition: 'width 1.2s ease',
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.68rem', color: '#475569' }}>Due: {row.lastUpdated}</span>
                    {contractValue && <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 600 }}>{fmtSAR(contractValue)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Milestones + Board Decisions stacked */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Milestones */}
          <div style={{ background: '#0C1220', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ padding: '0.35rem', borderRadius: '6px', background: 'rgba(245,158,11,0.12)', color: '#F59E0B' }}>
                  <Target size={13} />
                </div>
                <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#F1F5F9' }}>Milestones</span>
              </div>
            </div>
            <div>
              {upcomingMilestones.slice(0, 3).map((ms, i) => {
                const sc = milestoneStatusColor[ms.status] || '#475569';
                return (
                  <div key={ms.id} style={{
                    padding: '0.875rem 1.25rem',
                    borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    transition: 'background 0.15s',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: sc, boxShadow: `0 0 6px ${sc}80`, flexShrink: 0 }} />
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#E2E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ms.title}</span>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#64748B', marginLeft: '1.2rem', marginBottom: '0.25rem' }}>
                      {wsNames[ms.workspace_id] || ms.workspace_id}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#475569', marginLeft: '1.2rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Calendar size={9} /> Due: {ms.due_date}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Board Decisions (compact) */}
          <div style={{ background: '#0C1220', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ padding: '0.35rem', borderRadius: '6px', background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}>
                <Sparkles size={13} />
              </div>
              <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#F1F5F9' }}>Board Decisions</span>
            </div>
            <div>
              {activeBoardDecisions.slice(0, 3).map((bd: BoardDecisionRow, i) => {
                const sc = bd.status === 'In Progress' ? '#0EA5E9' : bd.status === 'Pending Implementation' ? '#F59E0B' : bd.status === 'Closed' ? '#10B981' : '#EF4444';
                const statusLabel = bd.status === 'In Progress' ? 'Pending' : bd.status === 'Closed' ? 'Approved' : bd.status === 'Pending Implementation' ? 'Approved' : 'Rejected';
                return (
                  <div key={bd.id} style={{
                    padding: '0.75rem 1.25rem',
                    borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
                  }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#E2E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, paddingRight: '0.75rem' }}>
                      {bd.title}
                    </span>
                    <span style={{
                      fontSize: '0.62rem', fontWeight: 700, padding: '3px 8px', borderRadius: '5px',
                      background: `${sc}15`, color: sc, border: `1px solid ${sc}25`, flexShrink: 0,
                    }}>
                      {statusLabel}
                    </span>
                    <button
                      onClick={() => markDecisionComplete(bd.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '3px',
                        padding: '3px 8px', borderRadius: '5px', border: '1px solid rgba(16,185,129,0.2)',
                        background: 'rgba(16,185,129,0.1)', color: '#34D399',
                        fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer',
                        fontFamily: 'inherit', flexShrink: 0, transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.22)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.1)'; }}
                    >
                      <Check size={10} /> Done
                    </button>
                  </div>
                );
              })}
              {activeBoardDecisions.length === 0 && (
                <div style={{ padding: '1.5rem 1.25rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#34D399' }}>All Clear</div>
                  <div style={{ fontSize: '0.68rem', color: '#334155' }}>No pending decisions</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Client Health Matrix ────────────────────────────────────────── */}
      {!isMobile && (
        <div style={{ background: '#0C1220', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ padding: '0.35rem', borderRadius: '6px', background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}>
                <Activity size={13} />
              </div>
              <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#F1F5F9' }}>Client Health Matrix</span>
            </div>
            <div style={{ display: 'flex', gap: '1.25rem' }}>
              {[['Green', '#10B981', 'On Track'], ['Amber', '#F59E0B', 'At Risk'], ['Red', '#EF4444', 'Critical']].map(([, color, label]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}80` }} />
                  <span style={{ fontSize: '0.68rem', color: '#475569' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: '1rem 1.5rem', display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? '220px' : '280px'}, 1fr))`, gap: '1rem' }}>
            {ragStatusData.slice(0, 4).map((row, i) => {
              const pct = [78, 45, 92, 28][i] ?? 50;
              const barColor = row.rag === 'Green' ? '#10B981' : row.rag === 'Amber' ? '#F59E0B' : '#EF4444';
              const glowColor = row.rag === 'Green' ? 'rgba(16,185,129,0.35)' : row.rag === 'Amber' ? 'rgba(245,158,11,0.35)' : 'rgba(239,68,68,0.35)';
              const contractValue = workspaceFinancials[i]?.contract_value;
              return (
                <div key={row.workspace} style={{
                  padding: '1rem', borderRadius: '10px', cursor: 'pointer',
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                  transition: 'all 0.15s',
                }}
                  onClick={() => navigate('/workspaces')}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = `${barColor}30`; e.currentTarget.style.background = 'rgba(255,255,255,0.035)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: barColor, boxShadow: `0 0 6px ${glowColor}` }} />
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#E2E8F0' }}>{row.workspace}</span>
                    </div>
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: barColor }}>{pct}%</span>
                  </div>
                  <div style={{ height: '5px', borderRadius: '99px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: '0.5rem' }}>
                    <div style={{
                      height: '100%', width: `${pct}%`,
                      background: `linear-gradient(90deg, ${barColor}CC, ${barColor})`,
                      borderRadius: '99px', boxShadow: `0 0 8px ${glowColor}`,
                      transition: 'width 1.2s ease',
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.68rem', color: '#475569' }}>Due: {row.lastUpdated}</span>
                    {contractValue && <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 600 }}>{fmtSAR(contractValue)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                    <button onClick={() => rec.id === 1 ? handleGenerateCommitteePack() : navigate(rec.path)} style={{
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

      {/* ── AI Intelligence CTA ──────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #0E0C22 0%, #120B28 40%, #08111E 100%)',
        border: '1px solid rgba(139,92,246,0.2)',
        borderRadius: '14px',
        padding: isMobile ? '1.25rem' : '1.5rem 2rem',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
      }} onClick={() => navigate('/ask-ai')}>
        {/* Glow orbs */}
        <div style={{ position: 'absolute', top: -60, right: 80, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -40, left: 120, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,212,255,0.07) 0%, transparent 65%)', pointerEvents: 'none' }} />
        {/* Animated border shimmer */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.7), rgba(0,212,255,0.5), transparent)', animation: 'shimmerBar 4s linear infinite', backgroundSize: '200% 100%', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          {/* Icon */}
          <div style={{
            width: 52, height: 52, borderRadius: '14px', flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(0,212,255,0.15))',
            border: '1px solid rgba(139,92,246,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 24px rgba(139,92,246,0.2)',
          }}>
            <Brain size={24} style={{ color: '#A78BFA' }} />
          </div>

          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
              <span style={{ fontSize: '1rem', fontWeight: 800, color: '#F1F5F9', letterSpacing: '-0.02em' }}>AI Intelligence Engine</span>
              <span style={{ fontSize: '0.62rem', padding: '2px 8px', borderRadius: '99px', background: 'rgba(139,92,246,0.2)', color: '#C4B5FD', border: '1px solid rgba(139,92,246,0.3)', fontWeight: 700, letterSpacing: '0.06em' }}>GPT-4o</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748B', lineHeight: 1.5 }}>
              Ask anything about your portfolio — risks, decisions, deliverables, financials.
            </p>
          </div>

          {!isMobile && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
              {['Summarize NCA risks', 'SC-10 budget status', 'Overdue milestone report'].map(q => (
                <span key={q} style={{
                  padding: '0.375rem 0.875rem', borderRadius: '99px',
                  background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)',
                  color: '#A78BFA', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.22)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.1)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.2)'; }}
                >{q}</span>
              ))}
            </div>
          )}

          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.375rem',
            padding: '0.625rem 1.25rem', borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(0,212,255,0.2))',
            border: '1px solid rgba(139,92,246,0.4)',
            color: '#F1F5F9', fontSize: '0.82rem', fontWeight: 700,
            flexShrink: 0, boxShadow: '0 0 20px rgba(139,92,246,0.15)',
          }}>
            <Sparkles size={14} /> Ask AI <ArrowRight size={13} />
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
        @keyframes liveRing {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes shimmerBar {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
