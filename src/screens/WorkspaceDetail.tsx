import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLayout } from '../hooks/useLayout';
import {
  ArrowLeft, FileText, Video, CheckSquare, AlertTriangle,
  TrendingUp, Plus, ExternalLink, Zap, DollarSign, TrendingDown,
  RefreshCw, AlertCircle, X,
} from 'lucide-react';
import {
  getWorkspace, getDocuments, getMeetings, getTasks, getRisks,
  getWorkspaceFinancial, getMilestones, getWorkspaceRagStatus,
  upsertTask, updateTask,
  type WorkspaceRow, type WorkspaceFinancialRow, type WorkspaceRagStatusRow,
  type MilestoneRow, type DocumentRow, type MeetingRow, type TaskRow, type RiskRow,
} from '../lib/db';

const tabs = ['Overview', 'Documents', 'Meetings', 'Tasks', 'Risks'];

const RAG_COLORS: Record<string, string> = { Green: '#10B981', Amber: '#F59E0B', Red: '#EF4444' };

function fmtAED(val: number): string {
  if (val >= 1_000_000) return `AED ${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `AED ${(val / 1_000).toFixed(0)}K`;
  return `AED ${val.toLocaleString()}`;
}

const milestoneStatusColor: Record<string, string> = {
  Completed: '#10B981', 'On Track': '#0EA5E9', 'At Risk': '#F59E0B', Delayed: '#EF4444', Upcoming: '#475569',
};

const meetingTypeColors: Record<string, string> = {
  Workshop: '#8B5CF6', Committee: '#F59E0B', Steering: '#0EA5E9',
  Review: '#10B981', Kickoff: '#EC4899', Standup: '#06B6D4',
};

interface WorkspaceData {
  ws: WorkspaceRow;
  fin: WorkspaceFinancialRow | null;
  rag: WorkspaceRagStatusRow | null;
  docs: DocumentRow[];
  meetings: MeetingRow[];
  tasks: TaskRow[];
  risks: RiskRow[];
  milestones: MilestoneRow[];
}

interface NewTaskForm { title: string; priority: 'High' | 'Medium' | 'Low'; due_date: string; assignee: string; description: string; }

export default function WorkspaceDetail() {
  const { width, isMobile, isTablet } = useLayout();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Overview');

  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Task modal state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState<NewTaskForm>({ title: '', priority: 'Medium', due_date: '', assignee: '', description: '' });
  const [taskSaving, setTaskSaving] = useState(false);
  const [taskError, setTaskError] = useState('');

  // Task status update
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  const loadData = useCallback(async (isRefresh = false) => {
    if (!id) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const [ws, fin, rag, docs, meetings, tasks, risks, milestones] = await Promise.all([
        getWorkspace(id),
        getWorkspaceFinancial(id).catch(() => null),
        getWorkspaceRagStatus(id).catch(() => null),
        getDocuments(id).catch(() => [] as DocumentRow[]),
        getMeetings(id).catch(() => [] as MeetingRow[]),
        getTasks(id).catch(() => [] as TaskRow[]),
        getRisks(id).catch(() => [] as RiskRow[]),
        getMilestones(id).catch(() => [] as MilestoneRow[]),
      ]);
      if (!ws) { setError('Workspace not found'); return; }
      setData({ ws, fin, rag, docs, meetings, tasks, risks, milestones });
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Failed to load workspace');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreateTask = async () => {
    if (!taskForm.title.trim() || !taskForm.due_date || !taskForm.assignee.trim()) {
      setTaskError('Title, due date and assignee are required.'); return;
    }
    if (!id || !data) return;
    setTaskSaving(true); setTaskError('');
    try {
      await upsertTask({
        id: `tsk-${Date.now()}`, title: taskForm.title.trim(),
        workspace: data.ws.name, workspace_id: id,
        priority: taskForm.priority, status: 'Backlog',
        due_date: taskForm.due_date, assignee: taskForm.assignee.trim(),
        linked_doc: null, linked_meeting: null, description: taskForm.description.trim(),
      });
      setShowTaskModal(false);
      setTaskForm({ title: '', priority: 'Medium', due_date: '', assignee: '', description: '' });
      await loadData(true);
    } catch (e: unknown) {
      setTaskError((e as Error).message ?? 'Failed to create task');
    } finally {
      setTaskSaving(false);
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: TaskRow['status']) => {
    setUpdatingTaskId(taskId);
    try {
      await updateTask(taskId, { status: newStatus });
      await loadData(true);
    } catch (_) { /* ignore */ }
    finally { setUpdatingTaskId(null); }
  };

  if (loading) {
    return (
      <div style={{ padding: isMobile ? '0.875rem' : '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#475569', fontSize: '0.85rem' }}>
          <div style={{ width: 16, height: 16, border: '2px solid #0EA5E9', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          Loading workspace…
        </div>
        <div style={{ height: '160px', borderRadius: '0.875rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }} />
        <div style={{ height: '40px', borderRadius: '0.5rem', background: 'rgba(255,255,255,0.03)' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ height: '200px', borderRadius: '0.875rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }} />
          <div style={{ height: '200px', borderRadius: '0.875rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }} />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: isMobile ? '0.875rem' : '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', paddingTop: '4rem' }}>
        <AlertCircle size={40} style={{ color: '#EF4444' }} />
        <div style={{ fontSize: '0.9rem', color: '#FCA5A5', fontWeight: 600 }}>{error ?? 'Workspace not found'}</div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn-ghost" onClick={() => navigate('/workspaces')}><ArrowLeft size={14} /> Back</button>
          <button className="btn-primary" onClick={() => loadData()}>Retry</button>
        </div>
      </div>
    );
  }

  const { ws, fin, rag, docs, meetings, tasks, risks, milestones } = data;
  const spentPct = fin && fin.contract_value > 0 ? Math.round((fin.spent / fin.contract_value) * 100) : null;
  const forecastPct = fin && fin.contract_value > 0 ? Math.round((fin.forecast / fin.contract_value) * 100) : null;
  const openTasks = tasks.filter(t => t.status !== 'Completed');
  const upcomingMeetings = meetings.filter(m => m.status === 'Upcoming');

  return (
    <div style={{ padding: isMobile ? '0.875rem' : '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Back */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => navigate('/workspaces')} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: '0.8rem', padding: 0, fontFamily: 'inherit' }}>
          <ArrowLeft size={14} /> Back to Workspaces
        </button>
        <button className="btn-ghost" style={{ padding: '0.375rem', width: '30px', height: '30px' }} onClick={() => loadData(true)} title="Refresh">
          <RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
        </button>
      </div>

      {/* Banner */}
      <div style={{ padding: isMobile ? '1.25rem' : '1.75rem', borderRadius: '0.875rem', background: 'linear-gradient(135deg, #0D1527 0%, #111B35 60%, #0D1B3E 100%)', border: '1px solid rgba(255,255,255,0.08)', borderLeft: `4px solid ${ws.sector_color}`, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: '300px', height: '100%', background: `radial-gradient(ellipse at right, ${ws.sector_color}10 0%, transparent 70%)` }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.7rem', color: '#475569' }}>{ws.type}</span>
              <span style={{ color: '#334155' }}>·</span>
              <span className={ws.status === 'Active' ? 'status-active' : 'status-pending'}>{ws.status}</span>
              {rag && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {([['Budget', rag.budget], ['Schedule', rag.schedule], ['Risk', rag.risk], ['Overall', rag.rag]] as [string, string][]).map(([label, status]) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 7px', borderRadius: '4px', background: `${RAG_COLORS[status]}12`, border: `1px solid ${RAG_COLORS[status]}25` }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: RAG_COLORS[status], boxShadow: `0 0 4px ${RAG_COLORS[status]}80` }} />
                      <span style={{ fontSize: '0.6rem', color: RAG_COLORS[status], fontWeight: 600 }}>{label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <h1 style={{ fontSize: isMobile ? '1.25rem' : '1.625rem', fontWeight: 900, color: '#F1F5F9', margin: 0, marginBottom: '0.375rem', letterSpacing: '-0.02em' }}>{ws.name}</h1>
            <p style={{ fontSize: '0.875rem', color: '#94A3B8', margin: 0, marginBottom: '0.75rem' }}>{ws.client}</p>
            <p style={{ fontSize: '0.8rem', color: '#475569', margin: 0, maxWidth: '600px', lineHeight: 1.5 }}>{ws.description}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <button className="btn-ghost" style={{ fontSize: '0.8rem' }}><Zap size={14} /> Run Automation</button>
            <button className="btn-primary" style={{ fontSize: '0.8rem' }} onClick={() => { setShowTaskModal(true); setActiveTab('Tasks'); }}><Plus size={14} /> Add Task</button>
          </div>
        </div>

        {/* Quick Stats */}
        <div style={{ display: 'flex', gap: isMobile ? '1rem' : '2rem', marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
          {[
            { icon: <FileText size={13} />, value: docs.length || ws.docs_count, label: 'Documents', onClick: () => setActiveTab('Documents') },
            { icon: <Video size={13} />, value: meetings.length || ws.meetings_count, label: 'Meetings', onClick: () => setActiveTab('Meetings') },
            { icon: <CheckSquare size={13} />, value: tasks.length || ws.tasks_count, label: 'Tasks', onClick: () => setActiveTab('Tasks') },
            { icon: <AlertTriangle size={13} />, value: risks.length, label: 'Risks', onClick: () => setActiveTab('Risks') },
            { icon: <TrendingUp size={13} />, value: `${ws.progress}%`, label: 'Progress', onClick: undefined },
          ].map(stat => (
            <div key={stat.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: stat.onClick ? 'pointer' : 'default' }} onClick={stat.onClick}>
              <span style={{ color: '#475569' }}>{stat.icon}</span>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: '#F1F5F9' }}>{stat.value}</span>
              <span style={{ fontSize: '0.75rem', color: stat.onClick ? '#38BDF8' : '#475569', textDecoration: stat.onClick ? 'underline' : 'none' }}>{stat.label}</span>
            </div>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#475569' }}>Language:</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#38BDF8' }}>{ws.language}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid rgba(255,255,255,0.06)', overflowX: 'auto' }}>
        {tabs.map(tab => (
          <button key={tab} className={`tab-underline ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)} style={{ marginRight: '1.5rem', whiteSpace: 'nowrap' }}>
            {tab}
            {tab === 'Tasks' && openTasks.length > 0 && <span style={{ marginLeft: '5px', background: '#EF4444', color: 'white', borderRadius: '9999px', fontSize: '0.6rem', padding: '1px 5px', fontWeight: 700 }}>{openTasks.length}</span>}
            {tab === 'Risks' && risks.filter(r => r.status === 'Open').length > 0 && <span style={{ marginLeft: '5px', background: '#F59E0B', color: 'white', borderRadius: '9999px', fontSize: '0.6rem', padding: '1px 5px', fontWeight: 700 }}>{risks.filter(r => r.status === 'Open').length}</span>}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'Overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Financial Summary */}
          {fin && (
            <div style={{ background: 'linear-gradient(135deg, #0D1527 0%, #111B35 100%)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '12px', padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <DollarSign size={15} style={{ color: '#F59E0B' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#F1F5F9' }}>Financial Summary</span>
                <span style={{ fontSize: '0.65rem', padding: '1px 7px', borderRadius: '9999px', background: 'rgba(245,158,11,0.12)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.2)', marginLeft: 'auto' }}>
                  {fin.billing_model} · {fin.currency}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${width >= 768 ? 4 : 2}, 1fr)`, gap: '0.875rem', marginBottom: '1rem' }}>
                {[
                  { label: 'Contract Value', value: fmtAED(fin.contract_value), color: '#00D4FF', icon: <DollarSign size={14} /> },
                  { label: 'Spent to Date', value: fmtAED(fin.spent), color: spentPct !== null && spentPct >= 95 ? '#EF4444' : spentPct !== null && spentPct >= 80 ? '#F59E0B' : '#10B981', icon: <TrendingUp size={14} /> },
                  { label: 'Forecast at Completion', value: fmtAED(fin.forecast), color: '#8B5CF6', icon: <TrendingUp size={14} /> },
                  { label: 'Variance', value: fin.variance === 0 ? 'On Budget' : (fin.variance > 0 ? '+' : '') + fmtAED(Math.abs(fin.variance)), color: fin.variance <= 0 ? '#34D399' : '#FCA5A5', icon: fin.variance > 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} /> },
                ].map(m => (
                  <div key={m.label} style={{ padding: '0.875rem', borderRadius: '8px', background: `${m.color}08`, border: `1px solid ${m.color}20` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.375rem', color: m.color }}>{m.icon}<span style={{ fontSize: '0.65rem', color: '#475569' }}>{m.label}</span></div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>
              {spentPct !== null && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                    <span style={{ fontSize: '0.7rem', color: '#475569' }}>Budget Utilization</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: spentPct >= 95 ? '#FCA5A5' : spentPct >= 80 ? '#FCD34D' : '#34D399' }}>{spentPct}% spent · Forecast {forecastPct}%</span>
                  </div>
                  <div style={{ height: '6px', borderRadius: '9999px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${spentPct}%`, background: `linear-gradient(90deg, ${spentPct >= 95 ? '#EF4444' : spentPct >= 80 ? '#F59E0B' : '#10B981'}, ${spentPct >= 95 ? '#FCA5A5' : spentPct >= 80 ? '#FCD34D' : '#34D399'})`, borderRadius: '9999px', transition: 'width 0.6s ease' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.375rem' }}>
                    <span style={{ fontSize: '0.65rem', color: '#334155' }}>Last Invoice: {fin.last_invoice || '—'}</span>
                    <span style={{ fontSize: '0.65rem', color: '#F59E0B' }}>Next Milestone: {fmtAED(fin.next_milestone_value)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Milestone Tracker */}
          {milestones.length > 0 && (
            <div className="section-card">
              <div className="section-card-header">
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Milestone Tracker</span>
                <span style={{ fontSize: '0.7rem', color: '#475569' }}>{milestones.filter(m => m.status !== 'Completed').length} active</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ minWidth: '560px' }}>
                  <thead><tr><th>Milestone</th><th>Due Date</th><th>Progress</th><th>Value</th><th>Owner</th><th>Status</th></tr></thead>
                  <tbody>
                    {milestones.map(ms => {
                      const sc = milestoneStatusColor[ms.status] ?? '#475569';
                      return (
                        <tr key={ms.id}>
                          <td><div style={{ fontSize: '0.82rem', fontWeight: 500, color: '#F1F5F9' }}>{ms.title}</div></td>
                          <td style={{ fontSize: '0.78rem', color: '#475569' }}>{ms.due_date}</td>
                          <td style={{ minWidth: '120px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ flex: 1, height: '5px', borderRadius: '9999px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${ms.completion_pct}%`, background: `linear-gradient(90deg, ${sc}, ${sc}cc)`, borderRadius: '9999px' }} />
                              </div>
                              <span style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 600, flexShrink: 0 }}>{ms.completion_pct}%</span>
                            </div>
                          </td>
                          <td style={{ fontSize: '0.78rem', color: '#F59E0B', fontWeight: 600 }}>{fmtAED(ms.value)}</td>
                          <td><div className="avatar" style={{ width: '22px', height: '22px', fontSize: '0.58rem' }}>{ms.owner}</div></td>
                          <td><span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', background: `${sc}15`, color: sc, border: `1px solid ${sc}25` }}>{ms.status}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 2-col: Recent Docs + Open Actions */}
          <div style={{ display: 'grid', gridTemplateColumns: isTablet ? '1fr' : '1fr 1fr', gap: '1rem' }}>
            <div className="section-card">
              <div className="section-card-header">
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Recent Documents</span>
                <button className="btn-ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }} onClick={() => setActiveTab('Documents')}>View All</button>
              </div>
              <div>
                {docs.slice(0, 4).map((doc, i) => (
                  <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1.25rem', borderBottom: i < Math.min(docs.length, 4) - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', cursor: 'pointer' }}
                    onClick={() => navigate(`/documents/${doc.id}`)}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ padding: '0.375rem', borderRadius: '6px', background: `${doc.type_color}15`, color: doc.type_color, flexShrink: 0 }}><FileText size={13} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>
                      <div style={{ fontSize: '0.7rem', color: '#475569' }}>{doc.date} · {doc.pages} pages</div>
                    </div>
                    <span className={`status-${doc.status === 'Approved' ? 'approved' : doc.status === 'Under Review' ? 'review' : 'draft'}`} style={{ fontSize: '0.65rem' }}>{doc.status}</span>
                  </div>
                ))}
                {docs.length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: '#334155', fontSize: '0.8rem' }}>No documents yet</div>}
              </div>
            </div>

            <div className="section-card">
              <div className="section-card-header">
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Open Actions</span>
                <button className="btn-ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }} onClick={() => setActiveTab('Tasks')}>View All</button>
              </div>
              <div>
                {openTasks.slice(0, 4).map((task, i) => (
                  <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1.25rem', borderBottom: i < Math.min(openTasks.length, 4) - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '9999px', background: task.priority === 'High' ? '#EF4444' : task.priority === 'Medium' ? '#F59E0B' : '#10B981', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</div>
                      <div style={{ fontSize: '0.7rem', color: '#475569' }}>Due: {task.due_date} · {task.assignee}</div>
                    </div>
                    <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: task.status === 'Overdue' ? 'rgba(239,68,68,0.15)' : 'rgba(14,165,233,0.1)', color: task.status === 'Overdue' ? '#FCA5A5' : '#38BDF8', border: `1px solid ${task.status === 'Overdue' ? 'rgba(239,68,68,0.2)' : 'rgba(14,165,233,0.15)'}` }}>
                      {task.status}
                    </span>
                  </div>
                ))}
                {openTasks.length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: '#334155', fontSize: '0.8rem' }}>No open tasks</div>}
              </div>
            </div>
          </div>

          {/* Upcoming Meetings + Open Risks */}
          <div style={{ display: 'grid', gridTemplateColumns: isTablet ? '1fr' : '1fr 1fr', gap: '1rem' }}>
            <div className="section-card">
              <div className="section-card-header">
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Upcoming Meetings</span>
                <button className="btn-ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }} onClick={() => setActiveTab('Meetings')}>View All</button>
              </div>
              <div>
                {upcomingMeetings.slice(0, 3).map((mtg, i) => (
                  <div key={mtg.id} style={{ display: 'flex', gap: '0.75rem', padding: '0.875rem 1.25rem', borderBottom: i < Math.min(upcomingMeetings.length, 3) - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', cursor: 'pointer' }}
                    onClick={() => navigate(`/meetings/${mtg.id}`)}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ padding: '0.375rem', borderRadius: '6px', background: `${meetingTypeColors[mtg.type] ?? '#8B5CF6'}15`, color: meetingTypeColors[mtg.type] ?? '#8B5CF6', flexShrink: 0 }}><Video size={13} /></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#F1F5F9' }}>{mtg.title}</div>
                      <div style={{ fontSize: '0.7rem', color: '#475569' }}>{mtg.date} · {mtg.time} · {mtg.duration}</div>
                    </div>
                    <ExternalLink size={13} style={{ color: '#334155' }} />
                  </div>
                ))}
                {upcomingMeetings.length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: '#334155', fontSize: '0.8rem' }}>No upcoming meetings</div>}
              </div>
            </div>

            <div className="section-card">
              <div className="section-card-header">
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Open Risks</span>
                <button className="btn-ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }} onClick={() => setActiveTab('Risks')}>View All</button>
              </div>
              <div>
                {risks.filter(r => r.status === 'Open' || r.status === 'Monitoring').slice(0, 3).map((risk, i, arr) => {
                  const sc = risk.severity === 'Critical' ? '#EF4444' : risk.severity === 'High' ? '#F59E0B' : '#10B981';
                  return (
                    <div key={risk.id} style={{ display: 'flex', gap: '0.75rem', padding: '0.875rem 1.25rem', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: sc, boxShadow: `0 0 4px ${sc}80`, flexShrink: 0, marginTop: '5px' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{risk.title}</div>
                        <div style={{ fontSize: '0.7rem', color: '#475569' }}>{risk.category} · P{risk.probability}×I{risk.impact}</div>
                      </div>
                      <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: `${sc}15`, color: sc, border: `1px solid ${sc}25`, flexShrink: 0 }}>{risk.severity}</span>
                    </div>
                  );
                })}
                {risks.filter(r => r.status === 'Open' || r.status === 'Monitoring').length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: '#334155', fontSize: '0.8rem' }}>No open risks</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DOCUMENTS TAB ── */}
      {activeTab === 'Documents' && (
        <div className="section-card">
          <div className="section-card-header">
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>All Documents ({docs.length})</span>
            <button className="btn-primary" style={{ fontSize: '0.8rem' }}><Plus size={13} /> Upload Document</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Document</th><th>Type</th><th>Date</th><th>Language</th><th>Status</th><th>Pages</th><th></th></tr></thead>
              <tbody>
                {docs.map(doc => (
                  <tr key={doc.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/documents/${doc.id}`)}>
                    <td>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#F1F5F9' }}>{doc.name}</div>
                      <div style={{ fontSize: '0.7rem', color: '#475569' }}>{doc.author} · {doc.size}</div>
                    </td>
                    <td><span style={{ fontSize: '0.72rem', padding: '2px 7px', borderRadius: '4px', background: `${doc.type_color}15`, color: doc.type_color, border: `1px solid ${doc.type_color}25` }}>{doc.type}</span></td>
                    <td style={{ fontSize: '0.78rem' }}>{doc.date}</td>
                    <td><span style={{ fontSize: '0.72rem', color: '#38BDF8' }}>{doc.language}</span></td>
                    <td><span className={`status-${doc.status === 'Approved' ? 'approved' : doc.status === 'Under Review' ? 'review' : 'draft'}`} style={{ fontSize: '0.65rem' }}>{doc.status}</span></td>
                    <td style={{ fontSize: '0.78rem' }}>{doc.pages}</td>
                    <td><ExternalLink size={13} style={{ color: '#334155' }} /></td>
                  </tr>
                ))}
                {docs.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#334155' }}>No documents uploaded yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MEETINGS TAB ── */}
      {activeTab === 'Meetings' && (
        <div className="section-card">
          <div className="section-card-header">
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Meetings ({meetings.length})</span>
            <button className="btn-primary" style={{ fontSize: '0.8rem' }}><Plus size={13} /> Schedule Meeting</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ minWidth: '640px' }}>
              <thead><tr><th>Meeting</th><th>Type</th><th>Date & Time</th><th>Duration</th><th>Participants</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {meetings.map(mtg => {
                  const tc = meetingTypeColors[mtg.type] ?? '#8B5CF6';
                  return (
                    <tr key={mtg.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/meetings/${mtg.id}`)}>
                      <td>
                        <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#F1F5F9' }}>{mtg.title}</div>
                        {mtg.location && <div style={{ fontSize: '0.7rem', color: '#475569' }}>{mtg.location}</div>}
                      </td>
                      <td><span style={{ fontSize: '0.72rem', padding: '2px 7px', borderRadius: '4px', background: `${tc}15`, color: tc, border: `1px solid ${tc}25` }}>{mtg.type}</span></td>
                      <td style={{ fontSize: '0.78rem', color: '#94A3B8' }}>{mtg.date} · {mtg.time}</td>
                      <td style={{ fontSize: '0.78rem', color: '#94A3B8' }}>{mtg.duration}</td>
                      <td>
                        <div style={{ display: 'flex' }}>
                          {mtg.participants.slice(0, 3).map((p, i) => (
                            <div key={i} title={p} style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'linear-gradient(135deg, #0EA5E9, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 700, color: 'white', border: '2px solid #0D1527', marginLeft: i > 0 ? '-5px' : 0 }}>
                              {p.slice(0, 2)}
                            </div>
                          ))}
                          {mtg.participants.length > 3 && <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', color: '#94A3B8', border: '2px solid #0D1527', marginLeft: '-5px' }}>+{mtg.participants.length - 3}</div>}
                        </div>
                      </td>
                      <td>
                        <span className={mtg.status === 'Completed' ? 'status-approved' : mtg.status === 'In Progress' ? 'status-active' : 'status-pending'} style={{ fontSize: '0.65rem' }}>{mtg.status}</span>
                        {mtg.minutes_generated && <span style={{ marginLeft: '4px', fontSize: '0.6rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(16,185,129,0.15)', color: '#34D399', border: '1px solid rgba(16,185,129,0.2)' }}>Minutes</span>}
                      </td>
                      <td><ExternalLink size={13} style={{ color: '#334155' }} /></td>
                    </tr>
                  );
                })}
                {meetings.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#334155' }}>No meetings scheduled</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TASKS TAB ── */}
      {activeTab === 'Tasks' && (
        <div className="section-card">
          <div className="section-card-header">
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Tasks ({tasks.length})</span>
            <button className="btn-primary" style={{ fontSize: '0.8rem' }} onClick={() => setShowTaskModal(true)}><Plus size={13} /> New Task</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Task</th><th>Priority</th><th>Status</th><th>Due Date</th><th>Assignee</th><th>Actions</th></tr></thead>
              <tbody>
                {tasks.map(task => (
                  <tr key={task.id}>
                    <td>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#F1F5F9' }}>{task.title}</div>
                      {task.description && <div style={{ fontSize: '0.7rem', color: '#475569' }}>{task.description.slice(0, 60)}{task.description.length > 60 ? '…' : ''}</div>}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.72rem', padding: '2px 7px', borderRadius: '4px', background: task.priority === 'High' ? 'rgba(239,68,68,0.15)' : task.priority === 'Medium' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)', color: task.priority === 'High' ? '#FCA5A5' : task.priority === 'Medium' ? '#FCD34D' : '#34D399' }}>
                        {task.priority}
                      </span>
                    </td>
                    <td>
                      <span className={task.status === 'Overdue' ? 'status-risk-high' : task.status === 'Completed' ? 'status-approved' : task.status === 'In Progress' ? 'status-active' : 'status-review'} style={{ fontSize: '0.65rem' }}>
                        {task.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.78rem', color: task.status === 'Overdue' ? '#FCA5A5' : '#94A3B8' }}>{task.due_date}</td>
                    <td><div className="avatar" style={{ width: '24px', height: '24px', fontSize: '0.62rem' }}>{task.assignee.slice(0, 2).toUpperCase()}</div></td>
                    <td>
                      {task.status !== 'Completed' && (
                        <button
                          className="btn-ghost"
                          style={{ fontSize: '0.68rem', padding: '2px 8px', height: 'auto', opacity: updatingTaskId === task.id ? 0.5 : 1 }}
                          disabled={updatingTaskId === task.id}
                          onClick={() => handleUpdateTaskStatus(task.id, task.status === 'Backlog' ? 'In Progress' : task.status === 'In Progress' ? 'Completed' : 'Completed')}
                        >
                          {updatingTaskId === task.id ? '…' : task.status === 'Backlog' ? '▶ Start' : '✓ Complete'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {tasks.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#334155' }}>No tasks yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── RISKS TAB ── */}
      {activeTab === 'Risks' && (
        <div className="section-card">
          <div className="section-card-header">
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Risk Register ({risks.length})</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>ID</th><th>Risk</th><th>Category</th><th>P×I</th><th>Severity</th><th>Status</th><th>Owner</th>{!isMobile && <th>Exposure</th>}</tr></thead>
              <tbody>
                {risks.map(risk => (
                  <tr key={risk.id}>
                    <td style={{ color: '#EF4444', fontSize: '0.75rem' }}>{risk.id}</td>
                    <td>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#F1F5F9' }}>{risk.title}</div>
                      <div style={{ fontSize: '0.7rem', color: '#475569' }}>{risk.mitigation.slice(0, 60)}{risk.mitigation.length > 60 ? '…' : ''}</div>
                    </td>
                    <td style={{ fontSize: '0.78rem' }}>{risk.category}</td>
                    <td>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                        background: risk.probability * risk.impact >= 17 ? 'rgba(239,68,68,0.15)' : risk.probability * risk.impact >= 10 ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
                        color: risk.probability * risk.impact >= 17 ? '#FCA5A5' : risk.probability * risk.impact >= 10 ? '#FCD34D' : '#34D399',
                      }}>
                        {risk.probability}×{risk.impact}={risk.probability * risk.impact}
                      </span>
                    </td>
                    <td><span className={`status-risk-${risk.severity.toLowerCase()}`}>{risk.severity}</span></td>
                    <td><span className={risk.status === 'Mitigated' || risk.status === 'Closed' ? 'status-approved' : risk.status === 'Monitoring' ? 'status-review' : 'status-pending'} style={{ fontSize: '0.65rem' }}>{risk.status}</span></td>
                    <td><div className="avatar" style={{ width: '24px', height: '24px', fontSize: '0.62rem' }}>{risk.owner.split(' ').map(n => n[0]).join('').slice(0, 2)}</div></td>
                    {!isMobile && <td style={{ fontSize: '0.78rem', color: '#F59E0B', fontWeight: 600 }}>{risk.financial_exposure ? fmtAED(risk.financial_exposure) : '—'}</td>}
                  </tr>
                ))}
                {risks.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#334155' }}>No risks logged</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Task Modal */}
      {showTaskModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) setShowTaskModal(false); }}>
          <div style={{ background: '#0D1527', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1rem', padding: '1.75rem', width: '100%', maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#F1F5F9' }}>New Task</div>
              <button onClick={() => setShowTaskModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569' }}><X size={18} /></button>
            </div>
            {taskError && <div style={{ padding: '0.75rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: '#FCA5A5', fontSize: '0.8rem', marginBottom: '1rem' }}>{taskError}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', display: 'block', marginBottom: '0.375rem' }}>Task Title *</label>
                <input type="text" value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Complete stakeholder analysis"
                  style={{ width: '100%', padding: '0.625rem 0.75rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.5rem', color: '#F1F5F9', fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', display: 'block', marginBottom: '0.375rem' }}>Priority</label>
                  <select value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value as 'High' | 'Medium' | 'Low' }))}
                    style={{ width: '100%', padding: '0.625rem 0.75rem', background: '#0A0F1E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.5rem', color: '#F1F5F9', fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none' }}>
                    <option>High</option><option>Medium</option><option>Low</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', display: 'block', marginBottom: '0.375rem' }}>Due Date *</label>
                  <input type="date" value={taskForm.due_date} onChange={e => setTaskForm(f => ({ ...f, due_date: e.target.value }))}
                    style={{ width: '100%', padding: '0.625rem 0.75rem', background: '#0A0F1E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.5rem', color: '#F1F5F9', fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', display: 'block', marginBottom: '0.375rem' }}>Assignee *</label>
                <input type="text" value={taskForm.assignee} onChange={e => setTaskForm(f => ({ ...f, assignee: e.target.value }))} placeholder="e.g. AM"
                  style={{ width: '100%', padding: '0.625rem 0.75rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.5rem', color: '#F1F5F9', fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', display: 'block', marginBottom: '0.375rem' }}>Description</label>
                <textarea value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional task description…" rows={2}
                  style={{ width: '100%', padding: '0.625rem 0.75rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.5rem', color: '#F1F5F9', fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.25rem' }}>
                <button className="btn-ghost" onClick={() => setShowTaskModal(false)}>Cancel</button>
                <button className="btn-primary" onClick={handleCreateTask} disabled={taskSaving}>{taskSaving ? 'Saving…' : 'Create Task'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
