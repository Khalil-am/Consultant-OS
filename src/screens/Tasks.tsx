import { useState, useEffect } from 'react';
import { useLayout } from '../hooks/useLayout';
import {
  AlertTriangle, CheckSquare, Clock, TrendingUp, Plus, Filter, Search,
  ArrowRight, MoreHorizontal, RefreshCw, ExternalLink, Download,
} from 'lucide-react';
import { getTasks, getRisks, updateTask, upsertTask, upsertRisk, getWorkspaces } from '../lib/db';
import type { TaskRow, RiskRow, WorkspaceRow } from '../lib/db';
import { X } from 'lucide-react';
import { fetchBoardData } from '../lib/trello';
import type { BoardData, MappedTask, MappedRisk } from '../lib/trello';

const kanbanColumns = [
  { key: 'Backlog',     label: 'Backlog',      color: '#475569', trackColor: 'rgba(71,85,105,0.3)' },
  { key: 'In Progress', label: 'In Progress',  color: '#0EA5E9', trackColor: 'rgba(14,165,233,0.2)' },
  { key: 'In Review',   label: 'In Review',    color: '#8B5CF6', trackColor: 'rgba(139,92,246,0.2)' },
  { key: 'Completed',   label: 'Completed',    color: '#10B981', trackColor: 'rgba(16,185,129,0.2)' },
  { key: 'Overdue',     label: 'Overdue',      color: '#EF4444', trackColor: 'rgba(239,68,68,0.2)' },
];

const priorityConfig: Record<string, { color: string; bg: string; border: string; label: string }> = {
  High:   { color: '#FCA5A5', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.25)',   label: 'High' },
  Medium: { color: '#FCD34D', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.25)',  label: 'Medium' },
  Low:    { color: '#34D399', bg: 'rgba(16,185,129,0.1)',   border: 'rgba(16,185,129,0.22)',  label: 'Low' },
};

type RAIDTab = 'Tasks' | 'Risks' | 'Assumptions' | 'Issues' | 'Dependencies' | 'Trello';

const assumptions = [
  { id: 'AS-001', statement: 'Steering committee approval will be obtained within 5 business days of submission', owner: 'AM', validUntil: '30 Jun 2026', status: 'Valid' },
  { id: 'AS-002', statement: 'Client IT team will provide VPN access for integration work by 20 March', owner: 'SK', validUntil: '20 Mar 2026', status: 'Under Review' },
  { id: 'AS-003', statement: 'Vendor B pricing remains fixed per the proposal dated 01 Feb 2026', owner: 'RT', validUntil: '01 May 2026', status: 'Valid' },
  { id: 'AS-004', statement: 'Legacy system migration data quality is 95%+ clean', owner: 'DN', validUntil: '15 Mar 2026', status: 'Expired' },
  { id: 'AS-005', statement: 'Regulatory approval for new digital channels will not require additional assessment', owner: 'FH', validUntil: '31 May 2026', status: 'Valid' },
];

const issues = [
  { id: 'IS-001', issue: 'ADNOC contract review blocked due to absent legal signatory', workspace: 'ADNOC Supply Chain', priority: 'Critical', owner: 'RT', raised: '10 Mar 2026', targetRes: '15 Mar 2026', status: 'Open' },
  { id: 'IS-002', issue: 'Smart City Package 3 contractor failed mobilization audit — replacement needed', workspace: 'Smart City PMO', priority: 'Critical', owner: 'JL', raised: '08 Mar 2026', targetRes: '22 Mar 2026', status: 'In Progress' },
  { id: 'IS-003', issue: 'ENB UAT environment intermittently unavailable — delaying testing cycle', workspace: 'Banking Core', priority: 'High', owner: 'DN', raised: '11 Mar 2026', targetRes: '14 Mar 2026', status: 'In Progress' },
  { id: 'IS-004', issue: 'NCA Phase 3 resources double-booked with Ministry Digital project', workspace: 'NCA Digital Transf.', priority: 'Medium', owner: 'AM', raised: '06 Mar 2026', targetRes: '20 Mar 2026', status: 'Open' },
  { id: 'IS-005', issue: 'Procurement portal integration API version deprecated — rework required', workspace: 'MOCI Procurement', priority: 'Medium', owner: 'FH', raised: '12 Mar 2026', targetRes: '31 Mar 2026', status: 'Open' },
];

const dependencies = [
  { id: 'DEP-001', fromWorkspace: 'NCA Digital Transf.', description: 'Requires identity federation module from Ministry Digital project', toWorkspace: 'Ministry Digital', due: '01 Apr 2026', status: 'On Track' },
  { id: 'DEP-002', fromWorkspace: 'Smart City PMO', description: 'Requires ADNOC utility data feed for smart grid integration', toWorkspace: 'ADNOC Supply Chain', due: '15 Mar 2026', status: 'At Risk' },
  { id: 'DEP-003', fromWorkspace: 'Banking Core', description: 'Requires MOCI KYC API endpoint documentation', toWorkspace: 'MOCI Procurement', due: '20 Mar 2026', status: 'On Track' },
  { id: 'DEP-004', fromWorkspace: 'Healthcare Digital', description: 'Requires Ministry Digital patient portal API specs', toWorkspace: 'Ministry Digital', due: '30 Apr 2026', status: 'Upcoming' },
  { id: 'DEP-005', fromWorkspace: 'ADNOC Supply Chain', description: 'ERP go-live contingent on Smart City IoT data schema finalization', toWorkspace: 'Smart City PMO', due: '01 May 2026', status: 'At Risk' },
];

function buildHeatmap(risks: RiskRow[]) {
  const grid: Record<number, Record<number, string[]>> = {};
  for (let i = 1; i <= 5; i++) {
    grid[i] = {};
    for (let p = 1; p <= 5; p++) grid[i][p] = [];
  }
  risks.forEach((r, idx) => {
    const imp = Math.min(5, Math.max(1, r.impact));
    const prob = Math.min(5, Math.max(1, r.probability));
    grid[imp][prob].push(String(idx + 1));
  });
  return grid;
}

function heatmapCellColor(impact: number, prob: number): string {
  const score = impact * prob;
  if (score >= 17) return 'rgba(239,68,68,0.28)';
  if (score >= 10) return 'rgba(239,68,68,0.14)';
  if (score >= 5)  return 'rgba(245,158,11,0.14)';
  return 'rgba(16,185,129,0.12)';
}

function heatmapBorder(impact: number, prob: number): string {
  const score = impact * prob;
  if (score >= 17) return 'rgba(239,68,68,0.45)';
  if (score >= 10) return 'rgba(239,68,68,0.25)';
  if (score >= 5)  return 'rgba(245,158,11,0.25)';
  return 'rgba(16,185,129,0.2)';
}

function fmtSAR(val: number): string {
  if (val >= 1000000) return `SAR ${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `SAR ${(val / 1000).toFixed(0)}K`;
  return `SAR ${val.toLocaleString()}`;
}

const riskFinancialImpact: Record<string, number> = {
  Critical: 2500000,
  High:     1200000,
  Medium:    450000,
  Low:       120000,
};

function PriorityBadge({ priority }: { priority: string }) {
  const cfg = priorityConfig[priority] || priorityConfig.Low;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px',
      borderRadius: '9999px', background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      letterSpacing: '0.03em', whiteSpace: 'nowrap',
    }}>
      {priority}
    </span>
  );
}

export default function Tasks() {
  const { width, isMobile } = useLayout();
  const [activeView, setActiveView] = useState<RAIDTab>('Tasks');
  const [taskSearch, setTaskSearch] = useState('');
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [risks, setRisks] = useState<RiskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [savingTask, setSavingTask] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '', workspace: '', workspace_id: '', priority: 'Medium' as TaskRow['priority'],
    status: 'Backlog' as TaskRow['status'], due_date: '', assignee: '', description: '',
  });

  // Trello integration state
  const [trelloData, setTrelloData] = useState<BoardData | null>(null);
  const [trelloLoading, setTrelloLoading] = useState(false);
  const [trelloError, setTrelloError] = useState('');
  const [trelloLastSync, setTrelloLastSync] = useState<string | null>(null);
  const [importingTasks, setImportingTasks] = useState(false);
  const [importingRisks, setImportingRisks] = useState(false);
  const [importedCount, setImportedCount] = useState<{ tasks: number; risks: number } | null>(null);

  useEffect(() => {
    Promise.all([getTasks(), getRisks(), getWorkspaces()])
      .then(([t, r, ws]) => { setTasks(t); setRisks(r); setWorkspaces(ws); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function syncTrello() {
    setTrelloLoading(true);
    setTrelloError('');
    setImportedCount(null);
    try {
      const data = await fetchBoardData();
      setTrelloData(data);
      setTrelloLastSync(new Date().toLocaleTimeString());
    } catch (e) {
      setTrelloError(e instanceof Error ? e.message : 'Failed to connect to Trello');
    } finally {
      setTrelloLoading(false);
    }
  }

  async function handleImportTrelloTasks(trelloTasks: MappedTask[]) {
    if (!trelloTasks.length) return;
    setImportingTasks(true);
    try {
      const ws = workspaces[0];
      let count = 0;
      for (const t of trelloTasks) {
        await upsertTask({
          id: crypto.randomUUID(),
          title: t.title,
          workspace: ws?.name ?? 'Trello Import',
          workspace_id: ws?.id ?? '',
          priority: t.priority === 'Critical' ? 'High' : t.priority as TaskRow['priority'],
          status: t.status as TaskRow['status'],
          due_date: t.dueDate ?? new Date().toISOString().slice(0, 10),
          assignee: t.assignees[0] ?? '',
          description: t.description,
          linked_doc: null,
          linked_meeting: null,
        });
        count++;
      }
      setTasks(await getTasks());
      setImportedCount(prev => ({ tasks: count, risks: prev?.risks ?? 0 }));
    } catch { /* ignore */ }
    finally { setImportingTasks(false); }
  }

  async function handleImportTrelloRisks(trelloRisks: MappedRisk[]) {
    if (!trelloRisks.length) return;
    setImportingRisks(true);
    try {
      const ws = workspaces[0];
      let count = 0;
      for (const r of trelloRisks) {
        await upsertRisk({
          id: crypto.randomUUID(),
          title: r.title,
          workspace: ws?.name ?? 'Trello Import',
          workspace_id: ws?.id ?? '',
          severity: r.severity,
          status: 'Open',
          probability: 3,
          impact: r.severity === 'Critical' ? 5 : r.severity === 'High' ? 4 : r.severity === 'Medium' ? 3 : 2,
          owner: r.assignees[0] ?? '',
          mitigation: r.description || 'To be assessed',
          date_identified: new Date().toISOString().slice(0, 10),
          category: r.category,
          financial_exposure: null,
        });
        count++;
      }
      setRisks(await getRisks());
      setImportedCount(prev => ({ tasks: prev?.tasks ?? 0, risks: count }));
    } catch { /* ignore */ }
    finally { setImportingRisks(false); }
  }

  async function handleUpdateStatus(taskId: string, newStatus: string) {
    setUpdatingTaskId(taskId);
    try {
      await updateTask(taskId, { status: newStatus as TaskRow['status'] });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus as TaskRow['status'] } : t));
    } catch { /* ignore */ }
    finally { setUpdatingTaskId(null); }
  }

  async function handleCreateTask() {
    if (!taskForm.title || !taskForm.workspace_id || !taskForm.due_date) return;
    setSavingTask(true);
    try {
      const newTask = await upsertTask({
        id: crypto.randomUUID(),
        title: taskForm.title,
        workspace: taskForm.workspace,
        workspace_id: taskForm.workspace_id,
        priority: taskForm.priority,
        status: taskForm.status,
        due_date: taskForm.due_date,
        assignee: taskForm.assignee,
        description: taskForm.description,
        linked_doc: null,
        linked_meeting: null,
      });
      setTasks(prev => [newTask, ...prev]);
      setShowNewTask(false);
      setTaskForm({ title: '', workspace: '', workspace_id: '', priority: 'Medium', status: 'Backlog', due_date: '', assignee: '', description: '' });
    } catch { /* ignore */ }
    finally { setSavingTask(false); }
  }

  const heatmap = buildHeatmap(risks);

  const tasksByStatus = (status: string) =>
    tasks.filter(t => t.status === status && (!taskSearch || t.title.toLowerCase().includes(taskSearch.toLowerCase())));

  const statusColor = (s: string) => {
    if (s === 'Valid')        return { color: '#34D399', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.22)' };
    if (s === 'Expired')      return { color: '#FCA5A5', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.22)' };
    return                           { color: '#FCD34D', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.22)' };
  };

  const depStatusStyle = (s: string) => {
    if (s === 'On Track')  return { color: '#34D399', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.22)' };
    if (s === 'At Risk')   return { color: '#FCD34D', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.22)' };
    if (s === 'Upcoming')  return { color: '#38BDF8', bg: 'rgba(14,165,233,0.1)',  border: 'rgba(14,165,233,0.22)' };
    return                        { color: '#FCA5A5', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.22)' };
  };

  const issueColor = (p: string) => {
    if (p === 'Critical') return { color: '#FCA5A5', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.25)' };
    if (p === 'High')     return { color: '#FCD34D', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)' };
    return                       { color: '#38BDF8', bg: 'rgba(14,165,233,0.12)', border: 'rgba(14,165,233,0.25)' };
  };

  const raidTabs: RAIDTab[] = ['Tasks', 'Risks', 'Assumptions', 'Issues', 'Dependencies', 'Trello'];

  const tabLabels: Record<RAIDTab, string> = {
    Tasks: 'Tasks', Risks: 'Risks', Assumptions: 'Assumptions', Issues: 'Issues', Dependencies: 'Dependencies',
    Trello: '⬡ Trello',
  };

  const addLabel: Record<RAIDTab, string> = {
    Tasks: 'New Task', Risks: 'Log Risk', Assumptions: 'Add Assumption', Issues: 'Log Issue', Dependencies: 'Add Dependency',
    Trello: 'Sync Board',
  };

  // suppress unused warning
  void isMobile;
  void updatingTaskId;
  void handleUpdateStatus;
  void ArrowRight;

  return (
    <div className="screen-container animate-fade-in">

      {/* Summary Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${width >= 768 ? 4 : 2}, 1fr)`, gap: '0.875rem' }}>
        {[
          { label: 'Total Tasks',   value: tasks.length,                                               icon: <CheckSquare size={16} />, color: '#0EA5E9', sub: `${tasks.filter(t => t.status === 'In Progress').length} in progress` },
          { label: 'Overdue',       value: tasks.filter(t => t.status === 'Overdue').length,           icon: <Clock size={16} />,       color: '#EF4444', sub: 'Require immediate action' },
          { label: 'High Priority', value: tasks.filter(t => t.priority === 'High').length,            icon: <AlertTriangle size={16} />, color: '#F59E0B', sub: 'Across all workspaces' },
          { label: 'Active Risks',  value: risks.filter(r => r.status === 'Open' || r.status === 'Monitoring').length, icon: <TrendingUp size={16} />, color: '#8B5CF6', sub: `${risks.filter(r => r.severity === 'Critical').length} critical` },
        ].map(stat => (
          <div key={stat.label} className="metric-card" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${stat.color}, transparent)` }} />
            <div style={{ padding: '0.625rem', borderRadius: '8px', background: `${stat.color}15`, color: stat.color, flexShrink: 0 }}>
              {stat.icon}
            </div>
            <div>
              <div className="hero-number" style={{ color: 'var(--text-primary)' }}>{stat.value}</div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginTop: '2px' }}>{stat.label}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-faint)', marginTop: '1px' }}>{stat.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* RAID Tab Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.625rem' }}>
        <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(255,255,255,0.03)', padding: '0.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', overflowX: 'auto' }}>
          {raidTabs.map(view => (
            <button key={view} className={`tab-item ${activeView === view ? 'active' : ''}`} onClick={() => setActiveView(view)} style={{ padding: '0.35rem 0.875rem', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
              {tabLabels[view]}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {activeView === 'Tasks' && (
            <div style={{ position: 'relative' }}>
              <Search size={12} style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                className="input-field"
                placeholder="Search tasks..."
                value={taskSearch}
                onChange={e => setTaskSearch(e.target.value)}
                style={{ paddingLeft: '2rem', height: '34px', fontSize: '0.78rem', width: '180px' }}
              />
            </div>
          )}
          <button className="btn-ghost" style={{ height: '34px', fontSize: '0.78rem' }}>
            <Filter size={12} /> Filter
          </button>
          <button className="btn-primary" style={{ height: '34px', fontSize: '0.78rem' }} onClick={() => activeView === 'Tasks' ? setShowNewTask(true) : activeView === 'Trello' ? syncTrello() : undefined}>
            {activeView === 'Trello' ? <RefreshCw size={12} className={trelloLoading ? 'animate-spin' : ''} /> : <Plus size={12} />}
            {addLabel[activeView]}
          </button>
        </div>
      </div>

      {/* Tasks View – Kanban */}
      {activeView === 'Tasks' && (
        <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem', alignItems: 'flex-start' }}>
          {loading && (
            <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              Loading tasks…
            </div>
          )}
          {!loading && kanbanColumns.map(col => {
            const colTasks = tasksByStatus(col.key);
            return (
              <div key={col.key} style={{ minWidth: '248px', width: '248px', flexShrink: 0 }}>
                {/* Column header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: '0.75rem', padding: '0 0.25rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: col.color, boxShadow: `0 0 6px ${col.color}80` }} />
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.01em' }}>{col.label}</span>
                  </div>
                  <span style={{
                    fontSize: '0.65rem', fontWeight: 700, padding: '1px 7px', borderRadius: '9999px',
                    background: `${col.color}15`, color: col.color, border: `1px solid ${col.color}30`,
                  }}>
                    {colTasks.length}
                  </span>
                </div>

                {/* Column track */}
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: '0.5rem',
                  minHeight: '140px', padding: '0.625rem',
                  borderRadius: 'var(--radius-md)',
                  background: col.trackColor,
                  border: `1px dashed ${col.color}25`,
                }}>
                  {colTasks.map(task => {
                    const pc = priorityConfig[task.priority] || priorityConfig.Low;
                    return (
                      <div key={task.id} className="kanban-card">
                        {/* Card top: workspace + priority dot */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span style={{
                            fontSize: '0.6rem', fontWeight: 600, padding: '1px 6px', borderRadius: '3px',
                            background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)',
                            border: '1px solid var(--border-subtle)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px',
                          }}>
                            {task.workspace.split(' ').slice(0, 2).join(' ')}
                          </span>
                          <div style={{
                            width: '8px', height: '8px', borderRadius: '50%',
                            background: pc.color, boxShadow: `0 0 6px ${pc.color}60`, flexShrink: 0,
                          }} />
                        </div>

                        {/* Task title */}
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.45, marginBottom: '0.625rem' }}>
                          {task.title.slice(0, 65)}{task.title.length > 65 ? '…' : ''}
                        </div>

                        {/* Card footer */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{
                            fontSize: '0.63rem', fontWeight: 500,
                            color: task.status === 'Overdue' ? '#FCA5A5' : 'var(--text-muted)',
                            display: 'flex', alignItems: 'center', gap: '3px',
                          }}>
                            <Clock size={9} style={{ color: task.status === 'Overdue' ? '#EF4444' : 'var(--text-faint)' }} /> {task.due_date}
                          </span>
                          <div className="avatar" style={{ width: '20px', height: '20px', fontSize: '0.55rem', flexShrink: 0 }}>
                            {task.assignee}
                          </div>
                        </div>

                        {/* Linked item */}
                        {(task.linked_doc || task.linked_meeting) && (
                          <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                            <span style={{ fontSize: '0.6rem', color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              {task.linked_doc ? `📄 ${task.linked_doc.slice(0, 24)}…` : `🗓 ${task.linked_meeting?.slice(0, 24)}…`}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {colTasks.length === 0 && (
                    <div style={{ padding: '1.5rem 1rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>No tasks</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Risks View */}
      {activeView === 'Risks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Risk severity summary */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${width >= 768 ? 4 : 2}, 1fr)`, gap: '0.75rem' }}>
            {[
              { label: 'Critical', color: '#EF4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.22)',  count: risks.filter(r => r.severity === 'Critical').length },
              { label: 'High',     color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.22)', count: risks.filter(r => r.severity === 'High').length },
              { label: 'Medium',   color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)', border: 'rgba(14,165,233,0.22)', count: risks.filter(r => r.severity === 'Medium').length },
              { label: 'Low',      color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.22)', count: risks.filter(r => r.severity === 'Low').length },
            ].map(cat => (
              <div key={cat.label} style={{
                padding: '1rem 1.25rem', borderRadius: 'var(--radius-md)',
                background: cat.bg, border: `1px solid ${cat.border}`,
                display: 'flex', flexDirection: 'column', gap: '0.25rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div className="hero-number" style={{ color: cat.color }}>{cat.count}</div>
                  <div style={{ padding: '0.375rem', borderRadius: '6px', background: `${cat.color}20`, color: cat.color }}>
                    <AlertTriangle size={14} />
                  </div>
                </div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: cat.color }}>{cat.label} Risks</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  Exposure: {fmtSAR(cat.count * riskFinancialImpact[cat.label])}
                </div>
              </div>
            ))}
          </div>

          {/* Risk Heat Map */}
          <div className="section-card">
            <div className="section-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={14} style={{ color: '#EF4444' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>Risk Heat Map – All Portfolios</span>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', padding: '2px 7px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>{risks.length} risks plotted</span>
            </div>
            <div style={{ padding: '1.25rem', overflowX: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', minWidth: '420px' }}>
                {/* Y-axis */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', height: '280px', paddingBottom: '2rem' }}>
                  {[5, 4, 3, 2, 1].map(i => (
                    <div key={i} style={{ fontSize: '0.62rem', fontWeight: 500, color: 'var(--text-muted)', textAlign: 'right', width: '82px', lineHeight: 1.2 }}>
                      {i === 5 ? 'Catastrophic' : i === 4 ? 'Major' : i === 3 ? 'Moderate' : i === 2 ? 'Minor' : 'Negligible'}
                    </div>
                  ))}
                </div>
                <div style={{ flex: 1 }}>
                  {[5, 4, 3, 2, 1].map(impact => (
                    <div key={impact} style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '3px', marginBottom: '3px' }}>
                      {[1, 2, 3, 4, 5].map(prob => {
                        const cellRisks = heatmap[impact]?.[prob] || [];
                        const score = impact * prob;
                        const dotColor = score >= 17 ? 'rgba(239,68,68,0.7)' : score >= 10 ? 'rgba(239,68,68,0.5)' : score >= 5 ? 'rgba(245,158,11,0.6)' : 'rgba(16,185,129,0.5)';
                        return (
                          <div key={prob} style={{
                            height: '52px', borderRadius: '6px',
                            background: heatmapCellColor(impact, prob),
                            border: `1px solid ${heatmapBorder(impact, prob)}`,
                            display: 'flex', flexWrap: 'wrap', alignItems: 'center',
                            justifyContent: 'center', gap: '2px', padding: '4px',
                            transition: 'transform var(--transition-fast)',
                          }}>
                            {cellRisks.slice(0, 4).map((rId) => (
                              <div key={rId} style={{
                                width: '18px', height: '18px', borderRadius: '50%',
                                background: dotColor,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.52rem', fontWeight: 800, color: 'white',
                              }}>
                                {rId}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  {/* X-axis */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '3px', marginTop: '8px' }}>
                    {['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost Certain'].map(l => (
                      <div key={l} style={{ fontSize: '0.58rem', fontWeight: 500, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.3 }}>{l}</div>
                    ))}
                  </div>
                  <div style={{ textAlign: 'center', marginTop: '0.375rem', fontSize: '0.62rem', color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Probability →</div>
                </div>
              </div>
              {/* Legend */}
              <div style={{ display: 'flex', gap: '1.25rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                {[
                  { label: 'Low (1–4)',       bg: 'rgba(16,185,129,0.15)', border: '#10B981' },
                  { label: 'Medium (5–9)',     bg: 'rgba(245,158,11,0.15)', border: '#F59E0B' },
                  { label: 'High (10–16)',     bg: 'rgba(239,68,68,0.15)',  border: '#EF4444' },
                  { label: 'Critical (17–25)', bg: 'rgba(239,68,68,0.3)',   border: '#EF4444' },
                ].map(({ label, bg, border }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: bg, border: `1px solid ${border}45` }} />
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Risk Register Table */}
          <div className="section-card">
            <div className="section-card-header">
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>Risk Register</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', padding: '2px 7px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>{risks.length} risks · 8 workspaces</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ minWidth: '820px' }}>
                <thead>
                  <tr>
                    <th style={{ width: '90px' }}>ID</th>
                    <th>Risk Title</th>
                    <th>Workspace</th>
                    <th>Category</th>
                    <th style={{ textAlign: 'center', width: '48px' }}>P</th>
                    <th style={{ textAlign: 'center', width: '48px' }}>I</th>
                    <th style={{ width: '90px' }}>Severity</th>
                    <th>Fin. Exposure</th>
                    <th style={{ width: '90px' }}>Status</th>
                    <th style={{ width: '56px' }}>Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {risks.map(risk => (
                    <tr key={risk.id} style={{ cursor: 'pointer' }}>
                      <td>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#FCA5A5', fontFamily: 'monospace', letterSpacing: '0.02em' }}>{risk.id}</span>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{risk.title}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px', marginTop: '2px' }}>{risk.mitigation.slice(0, 44)}…</div>
                      </td>
                      <td style={{ fontSize: '0.72rem', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{risk.workspace.split(' ').slice(0, 2).join(' ')}</td>
                      <td>
                        <span style={{ fontSize: '0.67rem', fontWeight: 600, padding: '2px 7px', borderRadius: '9999px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>{risk.category}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: '24px', height: '24px', borderRadius: '5px', fontSize: '0.78rem', fontWeight: 800,
                          background: risk.probability >= 4 ? 'rgba(239,68,68,0.15)' : risk.probability >= 3 ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.1)',
                          color:      risk.probability >= 4 ? '#FCA5A5'               : risk.probability >= 3 ? '#FCD34D'                 : '#34D399',
                        }}>
                          {risk.probability}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: '24px', height: '24px', borderRadius: '5px', fontSize: '0.78rem', fontWeight: 800,
                          background: risk.impact >= 5 ? 'rgba(239,68,68,0.2)'  : risk.impact >= 4 ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.1)',
                          color:      risk.impact >= 5 ? '#FCA5A5'              : risk.impact >= 4 ? '#FCD34D'                : '#34D399',
                        }}>
                          {risk.impact}
                        </span>
                      </td>
                      <td><span className={`status-risk-${risk.severity.toLowerCase()}`}>{risk.severity}</span></td>
                      <td style={{ fontSize: '0.72rem', fontWeight: 700, color: '#FCD34D' }}>
                        {fmtSAR(riskFinancialImpact[risk.severity] || 100000)}
                      </td>
                      <td>
                        <span className={risk.status === 'Mitigated' || risk.status === 'Closed' ? 'status-approved' : risk.status === 'Monitoring' ? 'status-review' : 'status-pending'} style={{ fontSize: '0.65rem' }}>
                          {risk.status}
                        </span>
                      </td>
                      <td>
                        <div className="avatar" style={{ width: '24px', height: '24px', fontSize: '0.6rem' }}>
                          {risk.owner.split(' ').map((n: string) => n[0]).join('')}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Assumptions View */}
      {activeView === 'Assumptions' && (
        <div className="section-card animate-fade-in">
          <div className="section-card-header">
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>Assumptions Register</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', padding: '2px 7px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>{assumptions.length} assumptions logged</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ minWidth: '700px' }}>
              <thead>
                <tr>
                  <th style={{ width: '90px' }}>ID</th>
                  <th>Assumption Statement</th>
                  <th style={{ width: '70px' }}>Owner</th>
                  <th style={{ width: '120px' }}>Valid Until</th>
                  <th style={{ width: '120px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {assumptions.map(a => {
                  const sc = statusColor(a.status);
                  return (
                    <tr key={a.id}>
                      <td>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#38BDF8', fontFamily: 'monospace' }}>{a.id}</span>
                      </td>
                      <td style={{ maxWidth: '340px' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>{a.statement}</div>
                      </td>
                      <td>
                        <div className="avatar" style={{ width: '26px', height: '26px', fontSize: '0.62rem' }}>{a.owner}</div>
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{a.validUntil}</td>
                      <td>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                          {a.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Issues View */}
      {activeView === 'Issues' && (
        <div className="section-card animate-fade-in">
          <div className="section-card-header">
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>Issues Log</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', padding: '2px 7px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>{issues.length} issues tracked</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ minWidth: '820px' }}>
              <thead>
                <tr>
                  <th style={{ width: '90px' }}>ID</th>
                  <th>Issue Description</th>
                  <th>Workspace</th>
                  <th style={{ width: '90px' }}>Priority</th>
                  <th style={{ width: '60px' }}>Owner</th>
                  <th>Raised</th>
                  <th>Target Res.</th>
                  <th style={{ width: '100px' }}>Status</th>
                  <th style={{ width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {issues.map(iss => {
                  const ic = issueColor(iss.priority);
                  return (
                    <tr key={iss.id} style={{ cursor: 'pointer' }}>
                      <td>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#FCA5A5', fontFamily: 'monospace' }}>{iss.id}</span>
                      </td>
                      <td style={{ maxWidth: '260px' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.45, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{iss.issue}</div>
                      </td>
                      <td style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{iss.workspace}</td>
                      <td>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: ic.bg, color: ic.color, border: `1px solid ${ic.border}` }}>
                          {iss.priority}
                        </span>
                      </td>
                      <td>
                        <div className="avatar" style={{ width: '24px', height: '24px', fontSize: '0.6rem' }}>{iss.owner}</div>
                      </td>
                      <td style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{iss.raised}</td>
                      <td style={{ fontSize: '0.72rem', color: iss.status === 'In Progress' ? '#38BDF8' : 'var(--text-secondary)' }}>{iss.targetRes}</td>
                      <td>
                        <span style={{
                          fontSize: '0.67rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px',
                          background: iss.status === 'In Progress' ? 'rgba(14,165,233,0.1)' : 'rgba(245,158,11,0.1)',
                          color: iss.status === 'In Progress' ? '#38BDF8' : '#FCD34D',
                          border: `1px solid ${iss.status === 'In Progress' ? 'rgba(14,165,233,0.22)' : 'rgba(245,158,11,0.22)'}`,
                        }}>
                          {iss.status}
                        </span>
                      </td>
                      <td>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-faint)')}
                        >
                          <MoreHorizontal size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dependencies View */}
      {activeView === 'Dependencies' && (
        <div className="section-card animate-fade-in">
          <div className="section-card-header">
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>Cross-Workspace Dependencies</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', padding: '2px 7px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>{dependencies.length} dependencies tracked</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ minWidth: '760px' }}>
              <thead>
                <tr>
                  <th style={{ width: '100px' }}>ID</th>
                  <th>From Workspace</th>
                  <th>Dependency Description</th>
                  <th>To Workspace</th>
                  <th>Due Date</th>
                  <th style={{ width: '100px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {dependencies.map(dep => {
                  const ds = depStatusStyle(dep.status);
                  return (
                    <tr key={dep.id}>
                      <td>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#A78BFA', fontFamily: 'monospace' }}>{dep.id}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{dep.fromWorkspace}</span>
                      </td>
                      <td style={{ maxWidth: '260px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                          <ArrowRight size={12} style={{ color: 'var(--text-faint)', flexShrink: 0, marginTop: '3px' }} />
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{dep.description}</div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{dep.toWorkspace}</span>
                      </td>
                      <td style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{dep.due}</td>
                      <td>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: ds.bg, color: ds.color, border: `1px solid ${ds.border}` }}>
                          {dep.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Trello Board View */}
      {activeView === 'Trello' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} className="animate-fade-in">

          {/* Trello Connect Banner */}
          {!trelloData && !trelloLoading && !trelloError && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(0,82,204,0.12) 0%, var(--bg-elevated) 60%, rgba(0,121,191,0.08) 100%)',
              border: '1px solid rgba(0,121,191,0.25)', borderRadius: 'var(--radius-lg)',
              padding: '2.5rem 2rem', textAlign: 'center',
            }}>
              <div style={{ width: '56px', height: '56px', background: 'rgba(0,121,191,0.15)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', border: '1px solid rgba(0,121,191,0.3)' }}>
                <svg viewBox="0 0 32 32" width="28" height="28" fill="none"><rect x="2" y="2" width="12" height="28" rx="3" fill="#0052CC"/><rect x="18" y="2" width="12" height="18" rx="3" fill="#0052CC"/></svg>
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>Connect to Trello BA Board</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem', maxWidth: '420px', margin: '0 auto 1.5rem' }}>
                Sync your Trello board to import tasks and risks directly into your RAID log. Cards are automatically mapped to status, priority, and risk category.
              </div>
              <button className="btn-primary" onClick={syncTrello} style={{ fontSize: '0.85rem', padding: '0.6rem 1.5rem' }}>
                <RefreshCw size={14} /> Sync BA Board
              </button>
            </div>
          )}

          {/* Loading */}
          {trelloLoading && (
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '2rem', textAlign: 'center' }}>
              <RefreshCw size={20} style={{ color: '#0052CC', animation: 'spin 1s linear infinite', margin: '0 auto 0.75rem', display: 'block' }} />
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Connecting to Trello…</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Fetching board data</div>
            </div>
          )}

          {/* Error */}
          {trelloError && (
            <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.22)', borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '0.82rem', color: '#FCA5A5' }}>{trelloError}</div>
              <button className="btn-ghost" onClick={syncTrello} style={{ fontSize: '0.75rem', height: '30px' }}><RefreshCw size={12} /> Retry</button>
            </div>
          )}

          {/* Board Data */}
          {trelloData && !trelloLoading && (
            <>
              {/* Board Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '32px', height: '32px', background: 'rgba(0,82,204,0.15)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(0,82,204,0.3)' }}>
                    <svg viewBox="0 0 32 32" width="18" height="18" fill="none"><rect x="2" y="2" width="12" height="28" rx="3" fill="#0052CC"/><rect x="18" y="2" width="12" height="18" rx="3" fill="#0052CC"/></svg>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{trelloData.board.name}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      {trelloData.tasks.length} tasks · {trelloData.risks.length} risks · {trelloData.members.length} members
                      {trelloLastSync && <span style={{ marginLeft: '0.5rem', color: 'var(--text-faint)' }}>· Last synced {trelloLastSync}</span>}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button className="btn-ghost" onClick={syncTrello} style={{ height: '32px', fontSize: '0.75rem' }}>
                    <RefreshCw size={12} /> Refresh
                  </button>
                  <a href={trelloData.board.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', height: '32px', padding: '0 0.875rem', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 600, color: '#38BDF8', background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)', textDecoration: 'none' }}>
                    <ExternalLink size={11} /> Open in Trello
                  </a>
                </div>
              </div>

              {/* Import Success */}
              {importedCount && (
                <div style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.22)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#34D399' }}>
                  <CheckSquare size={14} /> Imported {importedCount.tasks} task{importedCount.tasks !== 1 ? 's' : ''} and {importedCount.risks} risk{importedCount.risks !== 1 ? 's' : ''} into your RAID log
                  <button onClick={() => setImportedCount(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#34D399', display: 'flex', alignItems: 'center' }}><X size={13} /></button>
                </div>
              )}

              {/* Tasks Section */}
              <div className="section-card">
                <div className="section-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckSquare size={14} style={{ color: '#0EA5E9' }} />
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>Tasks from Trello</span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '1px 7px', borderRadius: '9999px', background: 'rgba(14,165,233,0.12)', color: '#38BDF8', border: '1px solid rgba(14,165,233,0.22)' }}>{trelloData.tasks.length}</span>
                  </div>
                  <button className="btn-primary" style={{ height: '30px', fontSize: '0.75rem' }}
                    onClick={() => handleImportTrelloTasks(trelloData.tasks)}
                    disabled={importingTasks || trelloData.tasks.length === 0}>
                    {importingTasks ? <RefreshCw size={11} className="animate-spin" /> : <Download size={11} />}
                    {importingTasks ? 'Importing…' : 'Import All Tasks'}
                  </button>
                </div>
                {trelloData.tasks.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-faint)', fontSize: '0.8rem' }}>No task cards found on this board</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table" style={{ minWidth: '680px' }}>
                      <thead>
                        <tr>
                          <th>Card Title</th>
                          <th style={{ width: '120px' }}>List / Status</th>
                          <th style={{ width: '90px' }}>Priority</th>
                          <th style={{ width: '110px' }}>Due Date</th>
                          <th style={{ width: '90px' }}>Assignees</th>
                          <th style={{ width: '60px' }}>Link</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trelloData.tasks.map((t: MappedTask) => {
                          const pc = priorityConfig[t.priority === 'Critical' ? 'High' : t.priority] || priorityConfig.Low;
                          const sc = kanbanColumns.find(c => c.key === t.status);
                          return (
                            <tr key={t.trelloId}>
                              <td>
                                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{t.title}</div>
                                {t.description && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</div>}
                              </td>
                              <td>
                                <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: '9999px', background: `${sc?.color ?? '#475569'}18`, color: sc?.color ?? '#94A3B8', border: `1px solid ${sc?.color ?? '#475569'}30` }}>
                                  {t.listName}
                                </span>
                              </td>
                              <td>
                                <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: '9999px', background: pc.bg, color: pc.color, border: `1px solid ${pc.border}` }}>
                                  {t.priority}
                                </span>
                              </td>
                              <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{t.dueDate ?? '—'}</td>
                              <td>
                                <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                                  {t.assignees.length ? t.assignees.map((a, i) => (
                                    <div key={i} className="avatar" style={{ width: '22px', height: '22px', fontSize: '0.55rem' }}>{a}</div>
                                  )) : <span style={{ color: 'var(--text-faint)', fontSize: '0.72rem' }}>—</span>}
                                </div>
                              </td>
                              <td>
                                <a href={t.trelloUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#38BDF8', display: 'flex', alignItems: 'center' }}>
                                  <ExternalLink size={12} />
                                </a>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Risks Section */}
              <div className="section-card">
                <div className="section-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertTriangle size={14} style={{ color: '#EF4444' }} />
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>Risks from Trello</span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '1px 7px', borderRadius: '9999px', background: 'rgba(239,68,68,0.12)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.25)' }}>{trelloData.risks.length}</span>
                  </div>
                  <button className="btn-primary" style={{ height: '30px', fontSize: '0.75rem', background: 'rgba(239,68,68,0.15)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.3)' }}
                    onClick={() => handleImportTrelloRisks(trelloData.risks)}
                    disabled={importingRisks || trelloData.risks.length === 0}>
                    {importingRisks ? <RefreshCw size={11} className="animate-spin" /> : <Download size={11} />}
                    {importingRisks ? 'Importing…' : 'Import All Risks'}
                  </button>
                </div>
                {trelloData.risks.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-faint)', fontSize: '0.8rem' }}>No risk cards found — label cards with "Risk" to surface them here</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table" style={{ minWidth: '680px' }}>
                      <thead>
                        <tr>
                          <th>Risk Title</th>
                          <th style={{ width: '100px' }}>Category</th>
                          <th style={{ width: '90px' }}>Severity</th>
                          <th style={{ width: '110px' }}>Due Date</th>
                          <th style={{ width: '90px' }}>Assignees</th>
                          <th style={{ width: '60px' }}>Link</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trelloData.risks.map((r: MappedRisk) => {
                          const sevColor = r.severity === 'Critical' ? { color: '#FCA5A5', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)' }
                            : r.severity === 'High' ? { color: '#FCD34D', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)' }
                            : r.severity === 'Medium' ? { color: '#38BDF8', bg: 'rgba(14,165,233,0.1)', border: 'rgba(14,165,233,0.22)' }
                            : { color: '#34D399', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.22)' };
                          return (
                            <tr key={r.trelloId}>
                              <td>
                                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{r.title}</div>
                                {r.description && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</div>}
                              </td>
                              <td>
                                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', padding: '1px 6px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>{r.category}</span>
                              </td>
                              <td>
                                <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: '9999px', background: sevColor.bg, color: sevColor.color, border: `1px solid ${sevColor.border}` }}>
                                  {r.severity}
                                </span>
                              </td>
                              <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{r.dueDate ?? '—'}</td>
                              <td>
                                <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                                  {r.assignees.length ? r.assignees.map((a, i) => (
                                    <div key={i} className="avatar" style={{ width: '22px', height: '22px', fontSize: '0.55rem' }}>{a}</div>
                                  )) : <span style={{ color: 'var(--text-faint)', fontSize: '0.72rem' }}>—</span>}
                                </div>
                              </td>
                              <td>
                                <a href={r.trelloUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#38BDF8', display: 'flex', alignItems: 'center' }}>
                                  <ExternalLink size={12} />
                                </a>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Lists overview */}
              <div className="section-card">
                <div className="section-card-header">
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>Board Lists</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {trelloData.lists.map(list => {
                    const count = trelloData.cards.filter(c => c.idList === list.id && !c.closed).length;
                    return (
                      <div key={list.id} style={{ padding: '0.5rem 0.875rem', background: 'rgba(255,255,255,0.04)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{list.name}</span>
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: '9999px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* New Task Modal */}
      {showNewTask && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }} onClick={() => setShowNewTask(false)}>
          <div style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)', padding: '1.75rem', width: '100%', maxWidth: '500px',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>New Task</h2>
                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Add a task to the RAID log</p>
              </div>
              <button onClick={() => setShowNewTask(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', borderRadius: '6px' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>Task Title *</label>
                <input className="input-field" placeholder="Describe the task..." value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} style={{ width: '100%' }} />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>Workspace *</label>
                <select className="input-field" value={taskForm.workspace_id} onChange={e => {
                  const ws = workspaces.find(w => w.id === e.target.value);
                  setTaskForm(f => ({ ...f, workspace_id: e.target.value, workspace: ws?.name || '' }));
                }} style={{ width: '100%' }}>
                  <option value="">Select workspace…</option>
                  {workspaces.map(ws => <option key={ws.id} value={ws.id}>{ws.name}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>Priority</label>
                  <select className="input-field" value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value as TaskRow['priority'] }))} style={{ width: '100%' }}>
                    {['High', 'Medium', 'Low'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>Status</label>
                  <select className="input-field" value={taskForm.status} onChange={e => setTaskForm(f => ({ ...f, status: e.target.value as TaskRow['status'] }))} style={{ width: '100%' }}>
                    {['Backlog', 'In Progress', 'In Review', 'Completed', 'Overdue'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>Due Date *</label>
                  <input className="input-field" type="date" value={taskForm.due_date} onChange={e => setTaskForm(f => ({ ...f, due_date: e.target.value }))} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>Assignee</label>
                  <input className="input-field" placeholder="Initials, e.g. AM" value={taskForm.assignee} onChange={e => setTaskForm(f => ({ ...f, assignee: e.target.value }))} style={{ width: '100%' }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>Description</label>
                <textarea className="input-field" placeholder="Optional details..." value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} style={{ width: '100%', minHeight: '80px', resize: 'vertical' }} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.75rem' }}>
              <button className="btn-secondary" onClick={() => setShowNewTask(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleCreateTask} disabled={savingTask || !taskForm.title || !taskForm.workspace_id || !taskForm.due_date}>
                {savingTask ? 'Saving…' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
