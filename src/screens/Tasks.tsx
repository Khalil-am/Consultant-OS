import { useState, useEffect, useMemo } from 'react';
import { useLayout } from '../hooks/useLayout';
import {
  Plus, Search, Loader2, X, Pencil, Trash2, CheckCircle,
  Clock, AlertTriangle, CheckSquare, Circle, ChevronDown,
  ListTodo, User, CalendarDays, Layers,
} from 'lucide-react';
import { getTasks, upsertTask, updateTask, deleteTask, getWorkspaces } from '../lib/db';
import type { TaskRow, WorkspaceRow } from '../lib/db';
import { v4 as uuid } from 'uuid';

// ── Constants ─────────────────────────────────────────────────

const STATUS_LIST = ['Backlog', 'In Progress', 'In Review', 'Completed', 'Overdue'] as const;
type TaskStatus = typeof STATUS_LIST[number];

const PRIORITY_LIST = ['High', 'Medium', 'Low'] as const;
type TaskPriority = typeof PRIORITY_LIST[number];

const FILTER_TABS = ['All', ...STATUS_LIST] as const;

const STATUS_META: Record<TaskStatus, { color: string; bg: string; border: string; dot: string }> = {
  'Backlog':     { color: '#94A3B8', bg: 'rgba(71,85,105,0.12)',   border: 'rgba(71,85,105,0.25)',   dot: '#475569' },
  'In Progress': { color: '#38BDF8', bg: 'rgba(14,165,233,0.1)',   border: 'rgba(14,165,233,0.22)',  dot: '#0EA5E9' },
  'In Review':   { color: '#A78BFA', bg: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.25)',  dot: '#8B5CF6' },
  'Completed':   { color: '#34D399', bg: 'rgba(16,185,129,0.1)',   border: 'rgba(16,185,129,0.22)',  dot: '#10B981' },
  'Overdue':     { color: '#FCA5A5', bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.22)',   dot: '#EF4444' },
};

const PRIORITY_META: Record<TaskPriority, { color: string; bg: string; border: string }> = {
  'High':   { color: '#FCA5A5', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.22)'   },
  'Medium': { color: '#FCD34D', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.22)'  },
  'Low':    { color: '#34D399', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)'   },
};

// ── Helpers ───────────────────────────────────────────────────

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

function isOverdue(task: TaskRow): boolean {
  if (!task.due_date) return false;
  if (task.status === 'Completed') return false;
  return new Date(task.due_date) < new Date();
}

// ── Sub-components ────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const m = PRIORITY_META[priority];
  return (
    <span style={{
      fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px',
      borderRadius: '9999px', background: m.bg, color: m.color,
      border: `1px solid ${m.border}`, whiteSpace: 'nowrap', letterSpacing: '0.02em',
    }}>
      {priority}
    </span>
  );
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const m = STATUS_META[status] ?? STATUS_META['Backlog'];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      fontSize: '0.65rem', fontWeight: 600, padding: '2px 8px',
      borderRadius: '9999px', background: m.bg, color: m.color,
      border: `1px solid ${m.border}`, whiteSpace: 'nowrap',
    }}>
      {status === 'In Progress' && (
        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: m.dot, animation: 'pulseDot 2s ease-in-out infinite', display: 'inline-block' }} />
      )}
      {status}
    </span>
  );
}

// ── Blank form ────────────────────────────────────────────────

const BLANK_FORM = {
  title: '',
  description: '',
  workspace_id: '',
  workspace: '',
  priority: 'Medium' as TaskPriority,
  status: 'Backlog' as TaskStatus,
  assignee: '',
  due_date: '',
};

// ── Main Component ────────────────────────────────────────────

export default function Tasks() {
  const { isMobile, isTablet } = useLayout();

  // Data state
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // UI state
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<string>('All');
  const [workspaceFilter, setWorkspaceFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editTask, setEditTask] = useState<TaskRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({ ...BLANK_FORM });

  // ── Data loading ───────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    Promise.all([getTasks(), getWorkspaces()])
      .then(([taskData, wsData]) => {
        setTasks(taskData);
        setWorkspaces(wsData);
        setLoading(false);
      })
      .catch(err => {
        setError(err?.message ?? 'Failed to load tasks');
        setLoading(false);
      });
  }, []);

  async function refreshTasks() {
    try {
      const data = await getTasks();
      setTasks(data);
    } catch { /* ignore */ }
  }

  // ── Modal helpers ──────────────────────────────────────────
  function openNewModal() {
    setEditTask(null);
    setForm({ ...BLANK_FORM });
    setShowModal(true);
  }

  function openEditModal(task: TaskRow, e: React.MouseEvent) {
    e.stopPropagation();
    setEditTask(task);
    setForm({
      title: task.title,
      description: task.description ?? '',
      workspace_id: task.workspace_id,
      workspace: task.workspace,
      priority: task.priority as TaskPriority,
      status: task.status as TaskStatus,
      assignee: task.assignee ?? '',
      due_date: task.due_date ?? '',
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditTask(null);
    setForm({ ...BLANK_FORM });
  }

  // ── Workspace select handler ───────────────────────────────
  function handleWorkspaceChange(wsId: string) {
    const ws = workspaces.find(w => w.id === wsId);
    setForm(f => ({ ...f, workspace_id: wsId, workspace: ws?.name ?? '' }));
  }

  // ── Save (create / update) ─────────────────────────────────
  async function handleSave() {
    if (!form.title.trim() || !form.workspace_id) return;
    setSaving(true);
    try {
      if (editTask) {
        await updateTask(editTask.id, {
          title: form.title.trim(),
          description: form.description.trim(),
          workspace_id: form.workspace_id,
          workspace: form.workspace,
          priority: form.priority,
          status: form.status,
          assignee: form.assignee.trim(),
          due_date: form.due_date || undefined,
        });
      } else {
        await upsertTask({
          id: uuid(),
          title: form.title.trim(),
          description: form.description.trim(),
          workspace_id: form.workspace_id,
          workspace: form.workspace,
          priority: form.priority,
          status: form.status,
          assignee: form.assignee.trim(),
          due_date: form.due_date || '',
          linked_doc: null,
          linked_meeting: null,
        });
      }
      await refreshTasks();
      closeModal();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  // ── Delete ─────────────────────────────────────────────────
  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm('Delete this task? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await deleteTask(id);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch { /* ignore */ }
    finally { setDeletingId(null); }
  }

  // ── Quick status cycle ─────────────────────────────────────
  const STATUS_CYCLE: TaskStatus[] = ['Backlog', 'In Progress', 'In Review', 'Completed'];

  async function handleCycleStatus(task: TaskRow, e: React.MouseEvent) {
    e.stopPropagation();
    const idx = STATUS_CYCLE.indexOf(task.status as TaskStatus);
    const next = idx === -1 ? 'In Progress' : STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    setUpdatingId(task.id);
    try {
      await updateTask(task.id, { status: next });
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: next } : t));
    } catch { /* ignore */ }
    finally { setUpdatingId(null); }
  }

  // ── Derived stats ──────────────────────────────────────────
  const totalCount      = tasks.length;
  const inProgressCount = tasks.filter(t => t.status === 'In Progress').length;
  const overdueCount    = tasks.filter(t => t.status === 'Overdue' || isOverdue(t)).length;
  const completedCount  = tasks.filter(t => t.status === 'Completed').length;

  // ── Filtered tasks ─────────────────────────────────────────
  const filtered = useMemo(() => {
    return tasks.filter(t => {
      if (activeTab !== 'All' && t.status !== activeTab) return false;
      if (workspaceFilter && t.workspace_id !== workspaceFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          t.title.toLowerCase().includes(q) ||
          (t.description ?? '').toLowerCase().includes(q) ||
          (t.assignee ?? '').toLowerCase().includes(q) ||
          t.workspace.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [tasks, activeTab, workspaceFilter, search]);

  // ── Responsive columns ─────────────────────────────────────
  const colCount = isMobile ? 2 : isTablet ? 2 : 4;

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="screen-container animate-fade-in">

      {/* ── Stat Cards ──────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${colCount}, 1fr)`, gap: '0.875rem' }}>
        {[
          { label: 'Total Tasks',  value: totalCount,      color: '#8B5CF6', sub: 'across all workspaces', icon: <ListTodo size={14} /> },
          { label: 'In Progress',  value: inProgressCount, color: '#0EA5E9', sub: 'actively being worked', icon: <Clock size={14} /> },
          { label: 'Overdue',      value: overdueCount,    color: '#EF4444', sub: 'past due date',         icon: <AlertTriangle size={14} /> },
          { label: 'Completed',    value: completedCount,  color: '#10B981', sub: 'finished tasks',        icon: <CheckCircle size={14} /> },
        ].map(s => (
          <div key={s.label} className="metric-card" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${s.color}, transparent)` }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
              <div>
                <div className="hero-number" style={{ color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', marginTop: '2px' }}>{s.label}</div>
                <div style={{ fontSize: '0.62rem', color: 'var(--text-faint)', marginTop: '1px' }}>{s.sub}</div>
              </div>
              <div style={{ color: s.color, opacity: 0.45, marginTop: '0.2rem', flexShrink: 0 }}>{s.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter Tabs + Toolbar ────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
          <Search size={13} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            className="input-field"
            placeholder="Search tasks, assignee, workspace…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: '2.25rem', height: '36px', fontSize: '0.8rem', width: '100%' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 0 }}>
              <X size={12} />
            </button>
          )}
        </div>

        {/* Workspace filter */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <Layers size={12} style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <select
            className="input-field"
            value={workspaceFilter}
            onChange={e => setWorkspaceFilter(e.target.value)}
            style={{ height: '36px', fontSize: '0.78rem', paddingLeft: '1.875rem', paddingRight: '1.875rem', minWidth: '160px', appearance: 'none' }}
          >
            <option value="">All Workspaces</option>
            {workspaces.map(ws => (
              <option key={ws.id} value={ws.id}>{ws.name}</option>
            ))}
          </select>
          <ChevronDown size={11} style={{ position: 'absolute', right: '0.625rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        </div>

        {/* New Task */}
        <button className="btn-primary" style={{ height: '36px', flexShrink: 0 }} onClick={openNewModal}>
          <Plus size={14} /> New Task
        </button>
      </div>

      {/* Status filter tabs */}
      <div style={{ display: 'flex', gap: '0.2rem', background: 'rgba(255,255,255,0.03)', padding: '0.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', overflowX: 'auto', flexShrink: 0 }}>
        {FILTER_TABS.map(tab => {
          const m = tab !== 'All' ? STATUS_META[tab as TaskStatus] : null;
          const count = tab === 'All' ? tasks.length : tasks.filter(t => t.status === tab).length;
          return (
            <button
              key={tab}
              className={`tab-item ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
              style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem', whiteSpace: 'nowrap', color: activeTab === tab && m ? m.color : undefined }}
            >
              {tab}
              <span style={{ marginLeft: '0.3rem', fontSize: '0.65rem', opacity: 0.7 }}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* ── Loading / Error states ───────────────────────────── */}
      {loading && (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <Loader2 size={16} className="animate-spin" /> Loading tasks…
        </div>
      )}

      {!loading && error && (
        <div style={{ padding: '1.25rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-lg)', color: '#FCA5A5', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={15} />
          {error}
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────── */}
      {!loading && !error && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3.5rem 1rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-subtle)' }}>
          <CheckSquare size={36} style={{ color: 'var(--text-faint)', margin: '0 auto 0.875rem', display: 'block' }} />
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
            {tasks.length === 0 ? 'No tasks yet' : 'No tasks match your filters'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            {tasks.length === 0 ? 'Create your first task to get started' : 'Try adjusting the search or clearing filters'}
          </div>
          {tasks.length === 0 && (
            <button className="btn-primary" style={{ height: '34px', fontSize: '0.78rem' }} onClick={openNewModal}>
              <Plus size={13} /> Create Task
            </button>
          )}
        </div>
      )}

      {/* ── Task List ────────────────────────────────────────── */}
      {!loading && !error && filtered.length > 0 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr auto' : '2fr 110px 110px 120px 120px 100px auto',
            gap: '0', padding: '0.6rem 1rem',
            background: 'var(--bg-elevated)',
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            {['Task', ...(isMobile ? [] : ['Priority', 'Status', 'Workspace', 'Assignee', 'Due Date', ''])].map((h, i) => (
              <div key={i} style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 0.5rem', textAlign: i > 0 && i < 6 ? 'center' : 'left' }}>
                {h}
              </div>
            ))}
          </div>

          {/* Task rows */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filtered.map((task, idx) => {
              const sm = STATUS_META[task.status as TaskStatus] ?? STATUS_META['Backlog'];
              const overdue = isOverdue(task);
              const dueDateColor = task.status === 'Completed' ? '#34D399' : overdue ? '#FCA5A5' : 'var(--text-secondary)';
              const isDeleting = deletingId === task.id;
              const isUpdating = updatingId === task.id;

              return (
                <div
                  key={task.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr auto' : '2fr 110px 110px 120px 120px 100px auto',
                    gap: '0',
                    padding: '0.75rem 1rem',
                    borderBottom: idx < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    borderLeft: `3px solid ${sm.dot}30`,
                    transition: 'background 0.12s',
                    alignItems: 'center',
                    cursor: 'pointer',
                    opacity: isDeleting ? 0.4 : 1,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  onClick={e => openEditModal(task, e)}
                >
                  {/* Title + description */}
                  <div style={{ padding: '0 0.5rem', minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {task.title}
                    </div>
                    {task.description && (
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {task.description}
                      </div>
                    )}
                  </div>

                  {isMobile ? (
                    /* Mobile: compact action cell */
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0 0.25rem' }}>
                      <PriorityBadge priority={task.priority as TaskPriority} />
                      <button
                        className="btn-ghost"
                        style={{ width: '26px', height: '26px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                        onClick={e => handleDelete(task.id, e)}
                        disabled={isDeleting}
                        title="Delete task"
                      >
                        <Trash2 size={12} style={{ color: '#EF4444' }} />
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Priority */}
                      <div style={{ padding: '0 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <PriorityBadge priority={task.priority as TaskPriority} />
                      </div>

                      {/* Status */}
                      <div style={{ padding: '0 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <button
                          onClick={e => handleCycleStatus(task, e)}
                          title="Click to advance status"
                          style={{ background: 'none', border: 'none', cursor: isUpdating ? 'wait' : 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                        >
                          {isUpdating
                            ? <Loader2 size={11} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
                            : <StatusBadge status={task.status as TaskStatus} />
                          }
                        </button>
                      </div>

                      {/* Workspace */}
                      <div style={{ padding: '0 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 600, padding: '2px 7px', borderRadius: '4px',
                          background: 'rgba(0,212,255,0.07)', color: '#38BDF8', border: '1px solid rgba(0,212,255,0.16)',
                          maxWidth: '108px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
                        }}>
                          {task.workspace}
                        </span>
                      </div>

                      {/* Assignee */}
                      <div style={{ padding: '0 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                        {task.assignee ? (
                          <>
                            <div style={{
                              width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                              background: 'linear-gradient(135deg, #0EA5E9, #8B5CF6)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.5rem', fontWeight: 800, color: '#fff',
                            }}>
                              {task.assignee.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80px' }}>
                              {task.assignee.split(' ')[0]}
                            </span>
                          </>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <User size={11} /> —
                          </span>
                        )}
                      </div>

                      {/* Due Date */}
                      <div style={{ padding: '0 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                        <CalendarDays size={10} style={{ color: dueDateColor, flexShrink: 0 }} />
                        <span style={{ fontSize: '0.72rem', color: dueDateColor, fontWeight: overdue ? 700 : 400 }}>
                          {fmtDate(task.due_date)}
                        </span>
                      </div>

                      {/* Actions */}
                      <div style={{ padding: '0 0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                        <button
                          className="btn-ghost"
                          style={{ width: '28px', height: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                          onClick={e => openEditModal(task, e)}
                          title="Edit task"
                        >
                          <Pencil size={12} style={{ color: 'var(--text-muted)' }} />
                        </button>
                        <button
                          className="btn-ghost"
                          style={{ width: '28px', height: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                          onClick={e => handleDelete(task.id, e)}
                          disabled={isDeleting}
                          title="Delete task"
                        >
                          {isDeleting
                            ? <Loader2 size={12} className="animate-spin" style={{ color: '#EF4444' }} />
                            : <Trash2 size={12} style={{ color: '#EF4444' }} />
                          }
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer count */}
          <div style={{ padding: '0.625rem 1.25rem', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-faint)' }}>
              Showing <strong style={{ color: 'var(--text-secondary)' }}>{filtered.length}</strong> of {tasks.length} tasks
            </span>
            {overdueCount > 0 && (
              <span style={{ fontSize: '0.7rem', color: '#FCA5A5', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <AlertTriangle size={11} /> {overdueCount} overdue
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── New / Edit Task Modal ────────────────────────────── */}
      {showModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div
            className="animate-fade-in"
            style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '560px',
              maxHeight: '90vh', overflowY: 'auto',
              boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
            }}
          >
            {/* Modal header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--bg-elevated)', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {editTask ? <Pencil size={14} style={{ color: '#A78BFA' }} /> : <Plus size={14} style={{ color: '#A78BFA' }} />}
                </div>
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {editTask ? 'Edit Task' : 'New Task'}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-faint)' }}>
                    {editTask ? 'Update task details' : 'Add a new task to your workspace'}
                  </div>
                </div>
              </div>
              <button className="btn-ghost" style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={closeModal}>
                <X size={14} />
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>

              {/* Title */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>
                  Title <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  className="input-field"
                  placeholder="Task title…"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  style={{ width: '100%', height: '38px', fontSize: '0.85rem' }}
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>
                  Description
                </label>
                <textarea
                  className="input-field"
                  placeholder="Optional description…"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  style={{ width: '100%', fontSize: '0.82rem', resize: 'vertical', minHeight: '72px', fontFamily: 'inherit' }}
                />
              </div>

              {/* Workspace */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>
                  Workspace <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    className="input-field"
                    value={form.workspace_id}
                    onChange={e => handleWorkspaceChange(e.target.value)}
                    style={{ width: '100%', height: '38px', fontSize: '0.82rem', appearance: 'none', paddingRight: '2rem' }}
                  >
                    <option value="">Select workspace…</option>
                    {workspaces.map(ws => (
                      <option key={ws.id} value={ws.id}>{ws.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                </div>
              </div>

              {/* Priority + Status row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>
                    Priority
                  </label>
                  <div style={{ position: 'relative' }}>
                    <select
                      className="input-field"
                      value={form.priority}
                      onChange={e => setForm(f => ({ ...f, priority: e.target.value as TaskPriority }))}
                      style={{ width: '100%', height: '38px', fontSize: '0.82rem', appearance: 'none', paddingRight: '2rem', color: PRIORITY_META[form.priority]?.color }}
                    >
                      {PRIORITY_LIST.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <ChevronDown size={12} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>
                    Status
                  </label>
                  <div style={{ position: 'relative' }}>
                    <select
                      className="input-field"
                      value={form.status}
                      onChange={e => setForm(f => ({ ...f, status: e.target.value as TaskStatus }))}
                      style={{ width: '100%', height: '38px', fontSize: '0.82rem', appearance: 'none', paddingRight: '2rem', color: STATUS_META[form.status]?.color }}
                    >
                      {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown size={12} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  </div>
                </div>
              </div>

              {/* Assignee + Due Date row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>
                    Assignee
                  </label>
                  <input
                    className="input-field"
                    placeholder="Full name…"
                    value={form.assignee}
                    onChange={e => setForm(f => ({ ...f, assignee: e.target.value }))}
                    style={{ width: '100%', height: '38px', fontSize: '0.82rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>
                    Due Date
                  </label>
                  <input
                    type="date"
                    className="input-field"
                    value={form.due_date}
                    onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                    style={{ width: '100%', height: '38px', fontSize: '0.82rem' }}
                  />
                </div>
              </div>

            </div>

            {/* Modal footer */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.625rem', background: 'var(--bg-elevated)', borderRadius: '0 0 var(--radius-lg) var(--radius-lg)' }}>
              <button className="btn-ghost" style={{ height: '36px' }} onClick={closeModal} disabled={saving}>
                Cancel
              </button>
              <button
                className="btn-primary"
                style={{ height: '36px', minWidth: '100px', opacity: (!form.title.trim() || !form.workspace_id) ? 0.5 : 1 }}
                onClick={handleSave}
                disabled={saving || !form.title.trim() || !form.workspace_id}
              >
                {saving ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : editTask ? <><CheckCircle size={13} /> Update Task</> : <><Plus size={13} /> Create Task</>}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
