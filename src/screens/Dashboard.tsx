import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase, FileText, Zap, CheckSquare, Clock, AlertTriangle,
  TrendingUp, TrendingDown, Upload, Video, Sparkles, ArrowRight,
  Bot, Check, X, RefreshCw, Eye,
  Calendar, BarChart3, DollarSign, Target, Activity,
  Brain, Layers, Users, ChevronRight, UserPlus, ListTodo, ClipboardCopy, Download, Eraser,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import {
  documentsByTypeData, deliveryTrendData, boardDecisions,
  type BoardDecision,
} from '../data/mockData';
import {
  getActivities, getMilestones, getWorkspaceFinancials,
  getWorkspaces, getTasks, getRisks, getWorkspaceRagStatuses,
  getApprovals, updateApproval, upsertApproval,
} from '../lib/db';
import type {
  ActivityRow, MilestoneRow, WorkspaceFinancialRow,
  WorkspaceRow, TaskRow, RiskRow, WorkspaceRagStatusRow,
} from '../lib/db';
import { useLayout } from '../hooks/useLayout';

type Period = 'today' | 'week' | 'month';


function fmtSAR(val: number): string {
  if (val >= 1000000) return `SAR ${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `SAR ${(val / 1000).toFixed(0)}K`;
  return `SAR ${val.toLocaleString()}`;
}

type ApprovalStatus = 'pending' | 'approved' | 'rejected';
interface Approval { id: number; title: string; requester: string; type: string; urgency: string; status: ApprovalStatus; }

const initialApprovals: Approval[] = [
  { id: 1, title: 'NCA BRD v2.3', requester: 'AM', type: 'Document Approval', urgency: 'High', status: 'pending' },
  { id: 2, title: 'SC-10 Budget SAR 2.4M', requester: 'RT', type: 'Budget Approval', urgency: 'High', status: 'pending' },
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
  const [approvals, setApprovals] = useState<Approval[]>(() => {
    try {
      const saved = localStorage.getItem('dashboard_approvals');
      if (saved) return JSON.parse(saved) as Approval[];
    } catch { /* ignore */ }
    return initialApprovals;
  });
  const [recommendations, setRecommendations] = useState(initialRecommendations);
  const [uploadDrag, setUploadDrag] = useState(false);
  const [notifDismissed, setNotifDismissed] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('dashboard_notif_dismissed') ?? '[]') as number[]); } catch { return new Set(); }
  });
  const pendingHighUrgency = approvals.filter(a => a.status === 'pending' && a.urgency === 'High' && !notifDismissed.has(a.id));
  const notifCount = pendingHighUrgency.length;

  function dismissNotif(id: number) {
    setNotifDismissed(prev => {
      const next = new Set([...prev, id]);
      try { localStorage.setItem('dashboard_notif_dismissed', JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

  function dismissAllNotifs() {
    const allIds = approvals.filter(a => a.status === 'pending' && a.urgency === 'High').map(a => a.id);
    setNotifDismissed(prev => {
      const next = new Set([...prev, ...allIds]);
      try { localStorage.setItem('dashboard_notif_dismissed', JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activityFilter, setActivityFilter] = useState<string>('All');
  const [activityUserFilter, setActivityUserFilter] = useState<string>('All');
  const [activitySearch, setActivitySearch] = useState('');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<'All' | 'Overdue' | 'High' | 'Medium'>('All');
  const [milestoneStatusFilter, setMilestoneStatusFilter] = useState<'All' | 'On Track' | 'At Risk' | 'Delayed'>('All');
  const [milestoneWorkspaceFilter, setMilestoneWorkspaceFilter] = useState<string>('All');
  const [milestoneSort, setMilestoneSort] = useState<'due_date' | 'name' | 'status' | 'value' | 'owner'>('due_date');
  const [activityCopied, setActivityCopied] = useState(false);
  const [activityCsvExported, setActivityCsvExported] = useState(false);
  const [kpiCopied, setKpiCopied] = useState(false);
  const [kpiCsvExported, setKpiCsvExported] = useState(false);
  const [dashboardTxtExported, setDashboardTxtExported] = useState(false);
  const [completedDecisions, setCompletedDecisions] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('dashboard_completed_decisions');
      if (saved) return new Set(JSON.parse(saved) as string[]);
    } catch { /* ignore */ }
    return new Set();
  });
  const [quickNotes, setQuickNotes] = useState<string>(() => {
    try { return localStorage.getItem('dashboard_quick_notes') ?? ''; } catch { return ''; }
  });
  const [notesCopied, setNotesCopied] = useState(false);
  function handleSaveNotes(value: string) {
    setQuickNotes(value);
    try { localStorage.setItem('dashboard_quick_notes', value); } catch { /* ignore */ }
  }
  function handleClearNotes() {
    setQuickNotes('');
    try { localStorage.removeItem('dashboard_quick_notes'); } catch { /* ignore */ }
  }
  function handleCopyNotes() {
    if (!quickNotes.trim()) return;
    navigator.clipboard.writeText(quickNotes).then(() => {
      setNotesCopied(true);
      setTimeout(() => setNotesCopied(false), 2000);
    }).catch(() => {});
  }

  // Live Supabase data
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [workspaceFinancials, setWorkspaceFinancials] = useState<WorkspaceFinancialRow[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [risks, setRisks] = useState<RiskRow[]>([]);
  const [ragStatuses, setRagStatuses] = useState<WorkspaceRagStatusRow[]>([]);

  useEffect(() => {
    getActivities(30).then(setActivities).catch(() => {});
    getMilestones().then(setMilestones).catch(() => {});
    getWorkspaceFinancials().then(setWorkspaceFinancials).catch(() => {});
    getWorkspaces().then(setWorkspaces).catch(() => {});
    getTasks().then(setTasks).catch(() => {});
    getRisks().then(setRisks).catch(() => {});
    getWorkspaceRagStatuses().then(setRagStatuses).catch(() => {});
    // Load approvals from DB, falling back to localStorage
    getApprovals().then(rows => {
      if (rows.length > 0) {
        setApprovals(rows.map(r => ({
          id: parseInt(r.id.replace('apr-', '')) || Math.random(),
          title: r.title,
          requester: r.requester,
          type: r.type,
          urgency: r.urgency,
          status: r.status,
        })));
      }
    }).catch(() => {});
  }, []);

  const handleApprove = (id: number) => {
    setApprovals(prev => {
      const next = prev.map(a => a.id === id ? { ...a, status: 'approved' as const } : a);
      try { localStorage.setItem('dashboard_approvals', JSON.stringify(next)); } catch { /* ignore */ }
      const target = next.find(a => a.id === id);
      if (target) {
        updateApproval(`apr-${id}`, { status: 'approved' }).catch(() => {
          // If update fails (row may not exist), try upsert
          upsertApproval({
            id: `apr-${id}`, title: target.title, requester: target.requester,
            type: target.type, urgency: target.urgency as 'High' | 'Medium' | 'Low',
            status: 'approved',
          }).catch(() => {});
        });
      }
      return next;
    });
  };
  const handleReject = (id: number) => {
    setApprovals(prev => {
      const next = prev.map(a => a.id === id ? { ...a, status: 'rejected' as const } : a);
      try { localStorage.setItem('dashboard_approvals', JSON.stringify(next)); } catch { /* ignore */ }
      const target = next.find(a => a.id === id);
      if (target) {
        updateApproval(`apr-${id}`, { status: 'rejected' }).catch(() => {
          upsertApproval({
            id: `apr-${id}`, title: target.title, requester: target.requester,
            type: target.type, urgency: target.urgency as 'High' | 'Medium' | 'Low',
            status: 'rejected',
          }).catch(() => {});
        });
      }
      return next;
    });
  };
  const dismissRec = (id: number) => setRecommendations(prev => prev.filter(r => r.id !== id));
  const handleRefresh = () => { setRefreshing(true); setTimeout(() => setRefreshing(false), 1200); };
  const handleCopyKpiSummary = () => {
    const portfolio = totalContract > 0 ? fmtSAR(totalContract) : 'SAR 23.4M';
    const recognized = totalContract > 0 ? fmtSAR(totalSpent) : 'SAR 12.1M';
    const lines = [
      'Dashboard KPI Summary – Consultant OS',
      `Portfolio Value: ${portfolio}`,
      `Revenue Recognized: ${recognized}`,
      `Active Workspaces: ${workspaceFinancials.length || 8}`,
    ].join('\n');
    navigator.clipboard.writeText(lines).then(() => {
      setKpiCopied(true);
      setTimeout(() => setKpiCopied(false), 2000);
    }).catch(() => {});
  };
  const handleExportKpiCSV = () => {
    const headers = ['KPI', 'Value', 'Sub-Value', 'Trend'];
    const rows = computedKPIs.map(kpi => [
      `"${kpi.label.replace(/"/g, '""')}"`,
      `"${kpi.value.replace(/"/g, '""')}"`,
      `"${kpi.subValue.replace(/"/g, '""')}"`,
      `"${kpi.trend.replace(/"/g, '""')}"`,
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard_kpis.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setKpiCsvExported(true);
    setTimeout(() => setKpiCsvExported(false), 2000);
  };
  const handleCopyActivityLog = () => {
    const text = filteredActivities.slice(0, 12).map(a => `[${a.time}] ${a.user} ${a.action}${a.target ? ` — ${a.target}` : ''}`).join('\n');
    navigator.clipboard.writeText(text || 'No activity to copy.').then(() => {
      setActivityCopied(true);
      setTimeout(() => setActivityCopied(false), 2000);
    }).catch(() => {});
  };
  const handleExportActivityCSV = () => {
    if (filteredActivities.length === 0) return;
    const headers = ['Time', 'User', 'Action', 'Target', 'Type'];
    const rows = filteredActivities.map(a => [
      `"${(a.time ?? '').replace(/"/g, '""')}"`,
      `"${(a.user ?? '').replace(/"/g, '""')}"`,
      `"${(a.action ?? '').replace(/"/g, '""')}"`,
      `"${(a.target ?? '').replace(/"/g, '""')}"`,
      a.type ?? '',
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const aEl = document.createElement('a');
    aEl.href = url;
    aEl.download = `activity_log.csv`;
    document.body.appendChild(aEl);
    aEl.click();
    document.body.removeChild(aEl);
    URL.revokeObjectURL(url);
    setActivityCsvExported(true);
    setTimeout(() => setActivityCsvExported(false), 2000);
  };
  const handleExportDashboardTxt = () => {
    const kpiLines = computedKPIs.map(k => `  ${k.label}: ${k.value}${k.unit ?? ''} (${k.trend})`);
    const activityLines = filteredActivities.slice(0, 12).map(a => `  [${a.time}] ${a.user} ${a.action}${a.target ? ` — ${a.target}` : ''}`);
    const lines = [
      `Dashboard Summary – Consultant OS`,
      '',
      `Portfolio KPIs`,
      ...kpiLines,
      '',
      `Recent Activity (${filteredActivities.length} events)`,
      ...activityLines,
    ].join('\n');
    const blob = new Blob([lines], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard_summary.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDashboardTxtExported(true);
    setTimeout(() => setDashboardTxtExported(false), 2000);
  };

  const markDecisionComplete = (id: string) => setCompletedDecisions(prev => {
    const next = new Set([...prev, id]);
    try { localStorage.setItem('dashboard_completed_decisions', JSON.stringify([...next])); } catch { /* ignore */ }
    return next;
  });

  const activityTypes = ['All', 'Document', 'Meeting', 'Automation', 'Task'];
  const activityUserOptions = ['All', ...Array.from(new Set(activities.map(a => a.user).filter(Boolean))).sort()];
  const filteredActivities = activities.filter(a => {
    const matchType = activityFilter === 'All' || a.type === activityFilter.toLowerCase();
    const matchUser = activityUserFilter === 'All' || a.user === activityUserFilter;
    const q = activitySearch.toLowerCase().trim();
    const matchSearch = !q || a.action.toLowerCase().includes(q) || (a.target ?? '').toLowerCase().includes(q) || a.user.toLowerCase().includes(q);
    return matchType && matchUser && matchSearch;
  });

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

  const wsNameById = Object.fromEntries(workspaces.map(w => [w.id, w.name]));
  const milestoneWorkspaceOptions = ['All', ...Array.from(new Set(milestones.map(m => wsNameById[m.workspace_id]).filter(Boolean))).sort()];

  const upcomingMilestones = (() => {
    const base = [...milestones]
      .filter(m => m.status !== 'Completed')
      .filter(m => milestoneStatusFilter === 'All' || m.status === milestoneStatusFilter)
      .filter(m => milestoneWorkspaceFilter === 'All' || wsNameById[m.workspace_id] === milestoneWorkspaceFilter);
    if (milestoneSort === 'name') base.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));
    else if (milestoneSort === 'status') base.sort((a, b) => (a.status ?? '').localeCompare(b.status ?? ''));
    else if (milestoneSort === 'value') base.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    else if (milestoneSort === 'owner') base.sort((a, b) => (a.owner ?? '').localeCompare(b.owner ?? ''));
    else base.sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''));
    return base.slice(0, 5);
  })();
  const activeBoardDecisions = boardDecisions.filter(d => d.status !== 'Closed' && !completedDecisions.has(d.id));

  const totalContract = workspaceFinancials.reduce((s, w) => s + w.contract_value, 0);
  const totalSpent = workspaceFinancials.reduce((s, w) => s + w.spent, 0);
  const totalVariance = workspaceFinancials.reduce((s, w) => s + w.variance, 0);

  // Dynamic computed values from Supabase
  const activeWorkspaces = workspaces.filter(w => w.status === 'Active');
  const openTasks = tasks.filter(t => t.status !== 'Completed');
  const overdueTasks = tasks.filter(t => t.status === 'Overdue');
  const filteredPriorityTasks = openTasks.filter(t => {
    if (taskPriorityFilter === 'All') return true;
    if (taskPriorityFilter === 'Overdue') return t.status === 'Overdue';
    if (taskPriorityFilter === 'High') return t.priority === 'High';
    if (taskPriorityFilter === 'Medium') return t.priority === 'Medium';
    return true;
  }).slice(0, 5);
  const completedTaskCount = tasks.filter(t => t.status === 'Completed').length;
  const openRisks = risks.filter(r => r.status === 'Open');
  const criticalRisks = openRisks.filter(r => r.severity === 'Critical' || r.severity === 'High');
  const overBudgetWs = workspaceFinancials.filter(w => w.variance > 0);
  const now30d = new Date(); now30d.setDate(now30d.getDate() + 30);
  const milestonesIn30d = milestones.filter(m => {
    if (m.status === 'Completed') return false;
    const due = new Date(m.due_date);
    return !isNaN(due.getTime()) && due <= now30d;
  });
  const milestonesAtRisk = milestonesIn30d.filter(m => m.status === 'At Risk' || m.status === 'Delayed');

  // Workspace health data joined from Supabase (with fallback)
  const workspaceHealthData = activeWorkspaces.slice(0, 4).map(ws => {
    const rag = ragStatuses.find(r => r.workspace_id === ws.id);
    const fin = workspaceFinancials.find(f => f.workspace_id === ws.id);
    return {
      workspace: ws.name,
      workspace_id: ws.id,
      rag: rag?.rag ?? 'Green' as 'Green' | 'Amber' | 'Red',
      lastUpdated: rag?.last_updated ?? ws.last_activity,
      progress: ws.progress,
      contractValue: fin?.contract_value,
    };
  });

  // Computed portfolio KPIs from real data (fall back to static when no Supabase data)
  const hasLiveData = workspaces.length > 0;
  const computedKPIs = [
    {
      label: 'Active Engagements', color: '#00D4FF', icon: 'portfolio', trendUp: true,
      value: hasLiveData ? String(activeWorkspaces.length) : '8',
      subValue: hasLiveData ? `${workspaces.length} total workspaces` : '8 active workspaces',
      trend: '+12%',
    },
    {
      label: 'Pipeline Revenue', color: '#10B981', icon: 'revenue', trendUp: true,
      value: totalContract > 0 ? fmtSAR(totalContract) : 'SAR 23.4M',
      subValue: totalContract > 0 ? `${workspaceFinancials.length} tracked` : '8 active engagements',
      trend: '+8%',
    },
    {
      label: 'Open Risk Items', color: '#EF4444', icon: 'risk', trendUp: false,
      value: hasLiveData ? String(criticalRisks.length) : '6',
      subValue: hasLiveData ? `${openRisks.length} total open risks` : '2 critical unmitigated',
      trend: criticalRisks.length > 5 ? '+3' : '-2',
    },
    {
      label: 'Milestones Due (30d)', color: '#F59E0B', icon: 'milestone', trendUp: false,
      value: hasLiveData ? String(milestonesIn30d.length) : '6',
      subValue: hasLiveData
        ? `${milestonesIn30d.length - milestonesAtRisk.length} on track · ${milestonesAtRisk.length} at risk`
        : '4 on track · 2 at risk',
      trend: `${milestonesAtRisk.length} at risk`,
    },
    {
      label: 'On-Time Delivery Rate', color: '#8B5CF6', icon: 'delivery', trendUp: true,
      value: '87%', subValue: 'vs 82% last quarter', trend: '+5pp',
    },
    {
      label: 'Tasks Completed', color: '#EC4899', icon: 'satisfaction', trendUp: true,
      value: hasLiveData ? String(completedTaskCount) : '38',
      subValue: hasLiveData ? `${openTasks.length} still open` : 'NPS +62 across 6 clients',
      trend: '+8',
    },
  ];

  // Build workspace name lookup from real data, fallback to hardcoded for known IDs
  const wsNames: Record<string, string> = {
    'ws-001': 'NCA Digital Transf.', 'ws-002': 'ADNOC Supply Chain',
    'ws-003': 'Banking Core', 'ws-004': 'MOCI Procurement',
    'ws-005': 'Smart City PMO', 'ws-006': 'Healthcare Digital',
    'ws-007': 'NCBE Regulatory', 'ws-008': 'Ministry Digital',
    ...Object.fromEntries(workspaces.map(w => [w.id, w.name.length > 22 ? w.name.slice(0, 20) + '…' : w.name])),
  };

    // ── sparkline data per KPI ────────────────────────────────────────
  const kpiSparks: Record<string, number[]> = {
    'Active Engagements':    [6, 6, 7, 7, 8, 8, hasLiveData ? activeWorkspaces.length : 8],
    'Pipeline Revenue':      [18, 22, 20, 25, 28, 30, totalContract > 0 ? Math.round(totalContract / 1_000_000) : 32],
    'Open Risk Items':       [9, 11, 8, 10, 7, 9, hasLiveData ? criticalRisks.length : 6],
    'Milestones Due (30d)':  [4, 5, 3, 6, 4, 5, hasLiveData ? milestonesIn30d.length : 7],
    'On-Time Delivery Rate': [78, 80, 79, 83, 85, 82, 88],
    'Tasks Completed':       [22, 27, 25, 30, 28, 34, hasLiveData ? completedTaskCount : 38],
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
                { icon: <Users size={11} />, label: `${hasLiveData ? activeWorkspaces.length : 8} active clients`, color: '#64748B' },
                { icon: <DollarSign size={11} />, label: `${fmtSAR(totalContract || 23400000)} portfolio`, color: '#00D4FF' },
                { icon: <Layers size={11} />, label: `${hasLiveData ? openTasks.length : 32} open tasks`, color: '#64748B' },
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
                <button key={pv} onClick={() => setPeriod(pv)} aria-label={`Period: ${pv}`} aria-pressed={period === pv} style={{
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
            }} aria-label="Refresh dashboard">
              <RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
              {!isMobile && 'Refresh'}
            </button>
            <button onClick={() => navigate('/reports')} className="btn-ghost" style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }} aria-label="View Reports">
              <Eye size={13} /> {!isMobile && 'View Reports'}
            </button>
            <button onClick={handleCopyKpiSummary} className="btn-ghost" style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }} aria-label="Copy KPI summary to clipboard">
              <ClipboardCopy size={13} /> {!isMobile && (kpiCopied ? 'Copied!' : 'KPI Summary')}
            </button>
            <button onClick={handleExportKpiCSV} className="btn-ghost" style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }} aria-label="Export KPI data to CSV">
              <Download size={13} /> {!isMobile && (kpiCsvExported ? 'Exported!' : 'Export KPIs')}
            </button>
            <button onClick={handleExportDashboardTxt} className="btn-ghost" style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }} aria-label="Export dashboard summary to TXT">
              <FileText size={13} /> {!isMobile && (dashboardTxtExported ? 'Exported!' : 'Export TXT')}
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
        {computedKPIs.map((kpi) => {
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
            aria-label={`Quick action: ${action.label}`}
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
              aria-label="All Workspaces"
            >
              All Workspaces <ChevronRight size={13} />
            </button>
          </div>
          <div style={{ padding: '0.5rem 0' }}>
            {workspaceHealthData.map((row, i) => {
              const barColor = row.rag === 'Green' ? '#10B981' : row.rag === 'Amber' ? '#F59E0B' : '#EF4444';
              const glowColor = row.rag === 'Green' ? 'rgba(16,185,129,0.35)' : row.rag === 'Amber' ? 'rgba(245,158,11,0.35)' : 'rgba(239,68,68,0.35)';
              const pct = row.progress ?? 50;
              return (
                <div key={row.workspace_id || row.workspace} style={{
                  padding: '1rem 1.5rem', cursor: 'pointer',
                  borderBottom: i < workspaceHealthData.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
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
                    <span style={{ fontSize: '0.68rem', color: '#475569' }}>Updated: {row.lastUpdated}</span>
                    {row.contractValue != null && <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 600 }}>{fmtSAR(row.contractValue)}</span>}
                  </div>
                </div>
              );
            })}
            {workspaceHealthData.length === 0 && (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: '#334155', fontSize: '0.78rem' }}>
                No active workspaces yet
              </div>
            )}
          </div>
        </div>

        {/* Right: Milestones + Board Decisions stacked */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Milestones */}
          <div style={{ background: '#0C1220', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ padding: '0.35rem', borderRadius: '6px', background: 'rgba(245,158,11,0.12)', color: '#F59E0B' }}>
                  <Target size={13} />
                </div>
                <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#F1F5F9' }}>Milestones</span>
              </div>
              <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {(['All', 'On Track', 'At Risk', 'Delayed'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setMilestoneStatusFilter(s)}
                    aria-label={`Filter milestones by status: ${s}`}
                    aria-pressed={milestoneStatusFilter === s}
                    style={{
                      fontSize: '0.6rem', fontWeight: 600, padding: '2px 7px', borderRadius: '5px',
                      background: milestoneStatusFilter === s ? 'rgba(245,158,11,0.15)' : 'transparent',
                      color: milestoneStatusFilter === s ? '#F59E0B' : '#475569',
                      border: milestoneStatusFilter === s ? '1px solid rgba(245,158,11,0.3)' : '1px solid transparent',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {s}
                  </button>
                ))}
                {milestoneWorkspaceOptions.length > 2 && (
                  <select
                    aria-label="Filter milestones by workspace"
                    value={milestoneWorkspaceFilter}
                    onChange={e => setMilestoneWorkspaceFilter(e.target.value)}
                    style={{ fontSize: '0.6rem', height: '22px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.1)', background: milestoneWorkspaceFilter !== 'All' ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.04)', color: milestoneWorkspaceFilter !== 'All' ? '#F59E0B' : '#94A3B8', fontFamily: 'inherit', cursor: 'pointer', outline: 'none' }}
                  >
                    {milestoneWorkspaceOptions.map(w => <option key={w} value={w}>{w === 'All' ? 'All Workspaces' : w}</option>)}
                  </select>
                )}
                <select
                  aria-label="Sort milestones"
                  value={milestoneSort}
                  onChange={e => setMilestoneSort(e.target.value as typeof milestoneSort)}
                  style={{ fontSize: '0.6rem', height: '22px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#94A3B8', fontFamily: 'inherit', cursor: 'pointer', outline: 'none' }}
                >
                  <option value="due_date">Due Date</option>
                  <option value="name">Name</option>
                  <option value="status">Status</option>
                  <option value="value">Value</option>
                  <option value="owner">Owner</option>
                </select>
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
              {activeBoardDecisions.slice(0, 3).map((bd: BoardDecision, i) => {
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
            {workspaceHealthData.map((row) => {
              const barColor = row.rag === 'Green' ? '#10B981' : row.rag === 'Amber' ? '#F59E0B' : '#EF4444';
              const glowColor = row.rag === 'Green' ? 'rgba(16,185,129,0.35)' : row.rag === 'Amber' ? 'rgba(245,158,11,0.35)' : 'rgba(239,68,68,0.35)';
              const pct = row.progress ?? 50;
              return (
                <div key={row.workspace_id || row.workspace} style={{
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
                    <span style={{ fontSize: '0.68rem', color: '#475569' }}>Updated: {row.lastUpdated}</span>
                    {row.contractValue != null && <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 600 }}>{fmtSAR(row.contractValue)}</span>}
                  </div>
                </div>
              );
            })}
            {workspaceHealthData.length === 0 && (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#334155', fontSize: '0.78rem', gridColumn: '1 / -1' }}>
                No active workspaces to display
              </div>
            )}
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
              aria-label="View financial details"
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
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#F1F5F9' }}>
              {hasLiveData
                ? `${overdueTasks.length} overdue task${overdueTasks.length !== 1 ? 's' : ''} across ${new Set(overdueTasks.map(t => t.workspace_id)).size} workspace${new Set(overdueTasks.map(t => t.workspace_id)).size !== 1 ? 's' : ''}`
                : '12 overdue tasks across 4 workspaces'
              }
            </span>
            {!isMobile && <span style={{ fontSize: '0.8rem', color: '#64748B', marginLeft: '0.75rem' }}>
              {hasLiveData
                ? `${criticalRisks.length} critical risk${criticalRisks.length !== 1 ? 's' : ''} may impact milestones`
                : '3 high-priority items may impact milestones'
              }
            </span>}
          </div>
        </div>
        <button className="btn-ghost" style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }} onClick={() => navigate('/tasks')}>
          Review Tasks <ArrowRight size={13} />
        </button>
      </div>

      {/* ── Priority Tasks Quick View ─────────────────────────────────── */}
      {hasLiveData && (
        <div className="section-card" style={{ overflow: 'hidden' }}>
          <div className="section-card-header">
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>Priority Tasks</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {(['All', 'Overdue', 'High', 'Medium'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setTaskPriorityFilter(f)}
                  aria-label={`Filter priority tasks: ${f}`}
                  aria-pressed={taskPriorityFilter === f}
                  style={{
                    padding: '3px 8px', borderRadius: '5px', fontSize: '0.68rem', fontWeight: 500,
                    background: taskPriorityFilter === f ? 'rgba(14,165,233,0.15)' : 'transparent',
                    color: taskPriorityFilter === f ? '#38BDF8' : '#64748B',
                    border: taskPriorityFilter === f ? '1px solid rgba(14,165,233,0.25)' : '1px solid transparent',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >{f}</button>
              ))}
            </div>
          </div>
          {filteredPriorityTasks.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No tasks match this filter</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {filteredPriorityTasks.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 1rem', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{
                    fontSize: '0.65rem', fontWeight: 600, padding: '2px 6px', borderRadius: '4px',
                    background: t.status === 'Overdue' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                    color: t.status === 'Overdue' ? '#FCA5A5' : '#FCD34D',
                  }}>{t.status}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', flexShrink: 0 }}>{t.workspace_id}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Workspace RAG Summary ────────────────────────────────────── */}
      {hasLiveData && ragStatuses.length > 0 && (
        <div className="section-card" style={{ overflow: 'hidden' }}>
          <div className="section-card-header">
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>Workspace Health (RAG)</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{ragStatuses.length} workspace{ragStatuses.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ display: 'flex', gap: '1rem', padding: '0.875rem 1.25rem', flexWrap: 'wrap' }}>
            {(['Green', 'Amber', 'Red'] as const).map(color => {
              const count = ragStatuses.filter(r => r.rag === color).length;
              const hex = color === 'Green' ? '#10B981' : color === 'Amber' ? '#F59E0B' : '#EF4444';
              return (
                <div key={color} aria-label={`RAG ${color} count: ${count}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.875rem', borderRadius: '8px', background: `rgba(${color === 'Green' ? '16,185,129' : color === 'Amber' ? '245,158,11' : '239,68,68'},0.08)`, border: `1px solid ${hex}30` }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: hex, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: hex }}>{count}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{color}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                  aria-label={`Dismiss: ${rec.title}`}
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
                      aria-label={rec.action}
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
              {notifCount > 0 && (
                <span
                  aria-label={`${notifCount} high urgency approval${notifCount > 1 ? 's' : ''} need attention`}
                  style={{
                    minWidth: 18, height: 18, borderRadius: '9999px', fontSize: '0.6rem', fontWeight: 800,
                    background: '#EF4444', color: '#fff', display: 'inline-flex', alignItems: 'center',
                    justifyContent: 'center', padding: '0 5px', boxShadow: '0 0 8px rgba(239,68,68,0.5)',
                    animation: 'pulseDot 2s ease-in-out infinite',
                  }}
                >
                  {notifCount}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {notifCount > 0 && (
                <button
                  aria-label="Dismiss all high urgency notifications"
                  onClick={dismissAllNotifs}
                  style={{
                    fontSize: '0.65rem', padding: '2px 8px', borderRadius: '99px',
                    background: 'rgba(239,68,68,0.1)', color: '#FCA5A5',
                    border: '1px solid rgba(239,68,68,0.25)', fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Dismiss All
                </button>
              )}
              <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '99px', background: 'rgba(245,158,11,0.12)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.2)', fontWeight: 700 }}>
                {approvals.filter(a => a.status === 'pending').length} pending
              </span>
            </div>
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
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      aria-label={`Approve ${item.title}`}
                      onClick={() => handleApprove(item.id)} style={{
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
                    <button
                      aria-label={`Reject ${item.title}`}
                      onClick={() => handleReject(item.id)} style={{
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
                    {item.urgency === 'High' && !notifDismissed.has(item.id) && (
                      <button
                        aria-label={`Dismiss notification for ${item.title}`}
                        onClick={() => dismissNotif(item.id)}
                        style={{
                          padding: '0.375rem 0.625rem', borderRadius: '7px', border: '1px solid rgba(148,163,184,0.12)',
                          cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.67rem', fontWeight: 600,
                          background: 'transparent', color: '#475569', transition: 'all 0.15s',
                        }}
                        title="Dismiss notification"
                      >
                        Dismiss
                      </button>
                    )}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.03)', padding: '2px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                {activityTypes.map(t => (
                  <button key={t} onClick={() => setActivityFilter(t)}
                    aria-label={`Filter activity: ${t}`}
                    aria-pressed={activityFilter === t}
                    style={{
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
              {activityUserOptions.length > 1 && (
                <select
                  aria-label="Filter activity by user"
                  value={activityUserFilter}
                  onChange={e => setActivityUserFilter(e.target.value)}
                  style={{ height: '28px', fontSize: '0.7rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)', background: activityUserFilter !== 'All' ? 'rgba(0,212,255,0.07)' : 'rgba(255,255,255,0.03)', color: activityUserFilter !== 'All' ? '#00D4FF' : '#64748B', fontFamily: 'inherit', cursor: 'pointer', outline: 'none', paddingLeft: '4px', paddingRight: '4px' }}
                >
                  <option value="All">All Users</option>
                  {activityUserOptions.slice(1).map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              )}
              <div style={{ display: 'flex', gap: '0.375rem' }}>
                <button
                  onClick={handleCopyActivityLog}
                  aria-label="Copy activity log to clipboard"
                  style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)', cursor: 'pointer', color: activityCopied ? '#34D399' : '#64748B', fontSize: '0.72rem', fontFamily: 'inherit' }}
                >
                  <ClipboardCopy size={11} />
                  {activityCopied ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={handleExportActivityCSV}
                  aria-label="Export activity log to CSV"
                  disabled={filteredActivities.length === 0}
                  style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)', cursor: filteredActivities.length === 0 ? 'not-allowed' : 'pointer', color: activityCsvExported ? '#34D399' : '#64748B', fontSize: '0.72rem', fontFamily: 'inherit' }}
                >
                  <Download size={11} />
                  {activityCsvExported ? 'Exported!' : 'CSV'}
                </button>
              </div>
            </div>
          </div>
          {activities.length > 0 && (
            <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <input
                aria-label="Search activity log"
                placeholder="Search actions, users, targets…"
                value={activitySearch}
                onChange={e => setActivitySearch(e.target.value)}
                style={{ width: '100%', padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)', color: '#E2E8F0', fontSize: '0.72rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          )}
          <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
            {filteredActivities.length === 0 && activitySearch && (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: '#475569', fontSize: '0.78rem' }}>No activity matches "{activitySearch}"</div>
            )}
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

      {/* ── Quick Notes ──────────────────────────────────────────────── */}
      <div className="section-card" style={{ overflow: 'hidden' }}>
        <div className="section-card-header">
          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>Quick Notes</span>
          <div style={{ display: 'flex', gap: '0.375rem' }}>
            <button
              onClick={handleCopyNotes}
              disabled={!quickNotes.trim()}
              aria-label="Copy quick notes to clipboard"
              style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)', cursor: quickNotes.trim() ? 'pointer' : 'not-allowed', color: notesCopied ? '#34D399' : '#64748B', fontSize: '0.72rem', fontFamily: 'inherit', opacity: quickNotes.trim() ? 1 : 0.4 }}
            >
              <ClipboardCopy size={11} />{notesCopied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={handleClearNotes}
              disabled={!quickNotes.trim()}
              aria-label="Clear quick notes"
              style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)', cursor: quickNotes.trim() ? 'pointer' : 'not-allowed', color: '#64748B', fontSize: '0.72rem', fontFamily: 'inherit', opacity: quickNotes.trim() ? 1 : 0.4 }}
            >
              <Eraser size={11} />Clear
            </button>
          </div>
        </div>
        <div style={{ padding: '0.75rem 1rem' }}>
          <textarea
            aria-label="Quick notes"
            placeholder="Jot down quick thoughts, reminders, or action items…"
            value={quickNotes}
            onChange={e => handleSaveNotes(e.target.value)}
            rows={4}
            style={{ width: '100%', resize: 'vertical', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.8rem', fontFamily: 'inherit', padding: '0.625rem 0.75rem', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6 }}
          />
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
                aria-label="Close upload modal"
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
                  {workspaces.length > 0
                    ? workspaces.filter(w => w.status === 'Active').map(w => <option key={w.id} value={w.id}>{w.name}</option>)
                    : [<option key="nca">NCA Digital Transformation</option>, <option key="bank">Banking Core Transformation</option>, <option key="sc">Smart City PMO</option>]
                  }
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
