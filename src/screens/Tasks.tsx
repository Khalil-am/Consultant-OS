import { useState, useEffect, useMemo } from 'react';
import { useLayout } from '../hooks/useLayout';
import {
  Search, Loader2, X, RefreshCw,
  Clock, AlertTriangle, CheckCircle, CheckSquare,
  ListTodo, User, CalendarDays, Layers, ExternalLink,
  ChevronDown, Paperclip, MessageSquare, Download, Plus, Trash2, ClipboardCopy, FileText, Star,
} from 'lucide-react';
import { fetchBATrafficBoard } from '../lib/trello';
import type { BACard, BATrafficData, TrelloList } from '../lib/trello';

const LOCAL_TASKS_KEY = 'local_tasks';
const STARRED_TASKS_KEY = 'tasks_starred';

interface LocalTask {
  id: string;
  name: string;
  client: string;
  priority: string;
  status: string;
  dueDate: string;
  assignee: string;
  createdAt: string;
}

interface NewTaskForm {
  name: string;
  client: string;
  priority: string;
  status: string;
  dueDate: string;
  assignee: string;
}

// ── CSV export helper ─────────────────────────────────────────
function exportTasksCSV(cards: (BACard & { status: string })[]) {
  const headers = ['Title', 'Status', 'Priority', 'Client', 'List', 'Due Date', 'Members', 'URL'];
  const rows = cards.map(c => [
    `"${c.name.replace(/"/g, '""')}"`,
    c.status,
    c.priority || 'Medium',
    c.client || '',
    c.listName,
    c.dueDate ? new Date(c.dueDate).toLocaleDateString('en-GB') : '',
    c.members.join('; '),
    c.url,
  ].join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tasks_export_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Status mapping from Trello list names ────────────────────
function mapListToStatus(listName: string): string {
  const n = listName.toLowerCase();
  if (n.includes('done') || n.includes('complete') || n.includes('finished') || n.includes('closed')) return 'Completed';
  if (n.includes('review') || n.includes('testing') || n.includes('qa') || n.includes('approval')) return 'In Review';
  if (n.includes('progress') || n.includes('doing') || n.includes('active') || n.includes('wip')) return 'In Progress';
  if (n.includes('overdue') || n.includes('blocked') || n.includes('escalat')) return 'Overdue';
  return 'Backlog';
}

type TaskStatus = 'Backlog' | 'In Progress' | 'In Review' | 'Completed' | 'Overdue';

const FILTER_TABS = ['All', 'Backlog', 'In Progress', 'In Review', 'Completed', 'Overdue'] as const;

const STATUS_META: Record<string, { color: string; bg: string; border: string; dot: string }> = {
  'Backlog':     { color: '#94A3B8', bg: 'rgba(71,85,105,0.12)',   border: 'rgba(71,85,105,0.25)',   dot: '#475569' },
  'In Progress': { color: '#38BDF8', bg: 'rgba(14,165,233,0.1)',   border: 'rgba(14,165,233,0.22)',  dot: '#0EA5E9' },
  'In Review':   { color: '#A78BFA', bg: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.25)',  dot: '#8B5CF6' },
  'Completed':   { color: '#34D399', bg: 'rgba(16,185,129,0.1)',   border: 'rgba(16,185,129,0.22)',  dot: '#10B981' },
  'Overdue':     { color: '#FCA5A5', bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.22)',   dot: '#EF4444' },
};

const PRIORITY_META: Record<string, { color: string; bg: string; border: string }> = {
  'Highest':  { color: '#FCA5A5', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.25)'  },
  'High':     { color: '#FCA5A5', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.22)'  },
  'Medium':   { color: '#FCD34D', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.22)' },
  'Low':      { color: '#34D399', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)'  },
  'Lowest':   { color: '#94A3B8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.15)' },
};

// ── Helpers ───────────────────────────────────────────────────
function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

function isOverdue(card: BACard): boolean {
  if (!card.dueDate) return false;
  if (card.dueComplete) return false;
  return new Date(card.dueDate) < new Date();
}

// ── Sub-components ────────────────────────────────────────────
function PriorityBadge({ priority }: { priority: string }) {
  const m = PRIORITY_META[priority] ?? PRIORITY_META['Medium'];
  return (
    <span style={{
      fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px',
      borderRadius: '9999px', background: m.bg, color: m.color,
      border: `1px solid ${m.border}`, whiteSpace: 'nowrap', letterSpacing: '0.02em',
    }}>
      {priority || 'Medium'}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
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

// ── Main Component ────────────────────────────────────────────
export default function Tasks() {
  const { isMobile, isTablet } = useLayout();

  const [cards, setCards] = useState<BACard[]>([]);
  const [lists, setLists] = useState<TrelloList[]>([]);
  const [boardName, setBoardName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [taskSummaryCopied, setTaskSummaryCopied] = useState(false);
  const [tasksTxtExported, setTasksTxtExported] = useState(false);

  // Local tasks (created without Trello)
  const [localTasks, setLocalTasks] = useState<LocalTask[]>(() => {
    try { return JSON.parse(localStorage.getItem(LOCAL_TASKS_KEY) ?? 'null') ?? []; } catch { return []; }
  });
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [newTaskForm, setNewTaskForm] = useState<NewTaskForm>({
    name: '', client: '', priority: 'Medium', status: 'Backlog', dueDate: '', assignee: '',
  });

  function handleAddLocalTask() {
    if (!newTaskForm.name.trim()) return;
    const task: LocalTask = {
      id: `local-${Date.now()}`,
      name: newTaskForm.name.trim(),
      client: newTaskForm.client.trim(),
      priority: newTaskForm.priority,
      status: newTaskForm.status,
      dueDate: newTaskForm.dueDate,
      assignee: newTaskForm.assignee.trim(),
      createdAt: new Date().toISOString(),
    };
    const updated = [task, ...localTasks];
    setLocalTasks(updated);
    try { localStorage.setItem(LOCAL_TASKS_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
    setShowNewTaskModal(false);
    setNewTaskForm({ name: '', client: '', priority: 'Medium', status: 'Backlog', dueDate: '', assignee: '' });
  }

  function handleDeleteLocalTask(id: string) {
    const updated = localTasks.filter(t => t.id !== id);
    setLocalTasks(updated);
    try { localStorage.setItem(LOCAL_TASKS_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
  }

  // Starred tasks
  const [starredTasks, setStarredTasks] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(STARRED_TASKS_KEY) ?? '[]')); } catch { return new Set(); }
  });
  const [starredOnly, setStarredOnly] = useState(false);
  const [overdueOnly, setOverdueOnly] = useState(false);

  function handleToggleStarTask(id: string) {
    setStarredTasks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem(STARRED_TASKS_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

  // UI state
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<string>('All');
  const [listFilter, setListFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'default' | 'priority' | 'due_date' | 'client' | 'assignee' | 'name' | 'label' | 'status'>('default');
  const [dueDateFilter, setDueDateFilter] = useState<'All' | 'Due Today' | 'Due This Week' | 'No Due Date'>('All');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('All');
  const [paymentOnly, setPaymentOnly] = useState(false);
  const [clientFilter, setClientFilter] = useState<string>('All');
  const [labelFilter, setLabelFilter] = useState<string>('All');

  // ── Data loading from Trello ────────────────────────────────
  async function loadFromTrello() {
    try {
      const data: BATrafficData = await fetchBATrafficBoard();
      setCards(data.cards);
      setLists(data.lists);
      setBoardName(data.boardName);
      setLastSynced(new Date());
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load Trello board');
    }
  }

  useEffect(() => {
    setLoading(true);
    loadFromTrello().finally(() => setLoading(false));
  }, []);

  async function handleSync() {
    setSyncing(true);
    await loadFromTrello();
    setSyncing(false);
  }

  function handleCopyTaskSummary() {
    const lines = [
      `Task Summary – ${boardName || 'Consultant OS'}`,
      `Total: ${totalCount}`,
      `In Progress: ${inProgressCount}`,
      `Overdue: ${overdueCount}`,
      `Completed: ${completedCount}`,
    ].join('\n');
    navigator.clipboard.writeText(lines).then(() => {
      setTaskSummaryCopied(true);
      setTimeout(() => setTaskSummaryCopied(false), 2000);
    }).catch(() => {});
  }

  function handleExportTasksTxt(tasksToExport: (BACard & { status: string })[]) {
    if (tasksToExport.length === 0) return;
    const lines = [
      `Tasks Export – ${boardName || 'Consultant OS'}`,
      `Total: ${tasksToExport.length}`,
      '',
      ...tasksToExport.map(t => [
        `Task: ${t.name}`,
        `Status: ${t.status} | Priority: ${t.priority || 'Medium'}`,
        t.client ? `Client: ${t.client}` : null,
        t.dueDate ? `Due: ${new Date(t.dueDate).toLocaleDateString('en-GB')}` : null,
        t.members.length > 0 ? `Assignees: ${t.members.join(', ')}` : null,
        '',
      ].filter(Boolean).join('\n')),
    ].join('\n');
    const blob = new Blob([lines], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tasks_export.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setTasksTxtExported(true);
    setTimeout(() => setTasksTxtExported(false), 2000);
  }

  // ── Enriched cards with status (Trello + local) ──────────────
  const enrichedCards = useMemo(() => {
    const trello = cards.map(card => ({
      ...card,
      status: card.dueComplete ? 'Completed' : isOverdue(card) ? 'Overdue' : mapListToStatus(card.listName),
      local: false as const,
    }));
    const local = localTasks.map(lt => ({
      id: lt.id,
      name: lt.name,
      url: '',
      desc: '',
      labels: [] as string[],
      client: lt.client,
      products: [] as string[],
      members: lt.assignee ? [lt.assignee] : [] as string[],
      dueDate: lt.dueDate,
      listName: lt.status,
      priority: lt.priority,
      pm: '',
      estimation: '',
      deliveryDate: '',
      relatedToPayment: false,
      dueComplete: lt.status === 'Completed',
      commentCount: 0,
      attachmentCount: 0,
      checklistTotal: 0,
      checklistDone: 0,
      lastActivity: lt.createdAt,
      status: lt.status,
      local: true as const,
    }));
    return [...trello, ...local];
  }, [cards, localTasks]);

  const assigneeOptions = useMemo(() =>
    ['All', ...Array.from(new Set(enrichedCards.flatMap(c => c.members).filter(Boolean))).sort()],
    [enrichedCards]
  );

  const clientOptions = useMemo(() =>
    ['All', ...Array.from(new Set(enrichedCards.map(c => c.client).filter(Boolean))).sort()],
    [enrichedCards]
  );

  const labelOptions = useMemo(() =>
    ['All', ...Array.from(new Set(enrichedCards.flatMap(c => c.labels).filter(Boolean))).sort()],
    [enrichedCards]
  );

  // ── Stats ───────────────────────────────────────────────────
  const totalCount = enrichedCards.length;
  const inProgressCount = enrichedCards.filter(c => c.status === 'In Progress').length;
  const overdueCount = enrichedCards.filter(c => c.status === 'Overdue').length;
  const completedCount = enrichedCards.filter(c => c.status === 'Completed').length;

  // ── Unique lists for filter ─────────────────────────────────
  const uniqueLists = useMemo(() => {
    const listNames = [...new Set(cards.map(c => c.listName))].sort();
    return listNames;
  }, [cards]);

  // ── Filtered cards ──────────────────────────────────────────
  const PRIORITY_ORDER: Record<string, number> = { Highest: 0, High: 1, Medium: 2, Low: 3, Lowest: 4 };

  const filtered = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const weekStart = (() => {
      const d = new Date(); const day = d.getDay();
      const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
      return mon.toISOString().slice(0, 10);
    })();
    const weekEnd = (() => {
      const d = new Date(); const day = d.getDay();
      const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return sun.toISOString().slice(0, 10);
    })();

    const base = enrichedCards.filter(c => {
      if (activeTab !== 'All' && c.status !== activeTab) return false;
      if (listFilter && c.listName !== listFilter) return false;
      if (priorityFilter !== 'All' && (c.priority ?? 'Medium') !== priorityFilter) return false;
      if (dueDateFilter === 'No Due Date') {
        if (c.dueDate) return false;
      } else if (dueDateFilter !== 'All') {
        if (!c.dueDate) return false;
        const dd = c.dueDate.slice(0, 10);
        if (dueDateFilter === 'Due Today' && dd !== todayStr) return false;
        if (dueDateFilter === 'Due This Week' && (dd < weekStart || dd > weekEnd)) return false;
      }
      if (assigneeFilter !== 'All' && !c.members.includes(assigneeFilter)) return false;
      if (paymentOnly && !c.relatedToPayment) return false;
      if (clientFilter !== 'All' && c.client !== clientFilter) return false;
      if (labelFilter !== 'All' && !c.labels.includes(labelFilter)) return false;
      if (starredOnly && !starredTasks.has(c.id)) return false;
      if (overdueOnly && !isOverdue(c)) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.client.toLowerCase().includes(q) ||
          c.members.some(m => m.toLowerCase().includes(q)) ||
          c.listName.toLowerCase().includes(q) ||
          c.labels.some(l => l.toLowerCase().includes(q))
        );
      }
      return true;
    });

    if (sortBy === 'priority') {
      return [...base].sort((a, b) => (PRIORITY_ORDER[a.priority ?? 'Medium'] ?? 2) - (PRIORITY_ORDER[b.priority ?? 'Medium'] ?? 2));
    }
    if (sortBy === 'due_date') {
      return [...base].sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
    }
    if (sortBy === 'client') {
      return [...base].sort((a, b) => (a.client ?? '').localeCompare(b.client ?? ''));
    }
    if (sortBy === 'assignee') {
      return [...base].sort((a, b) => (a.members[0] ?? '').localeCompare(b.members[0] ?? ''));
    }
    if (sortBy === 'name') {
      return [...base].sort((a, b) => a.name.localeCompare(b.name));
    }
    if (sortBy === 'label') {
      return [...base].sort((a, b) => (a.labels[0] ?? '').localeCompare(b.labels[0] ?? ''));
    }
    if (sortBy === 'status') {
      return [...base].sort((a, b) => (a.status ?? '').localeCompare(b.status ?? ''));
    }
    return base;
  }, [enrichedCards, activeTab, listFilter, priorityFilter, search, sortBy, dueDateFilter, assigneeFilter, paymentOnly, clientFilter, labelFilter, starredOnly, starredTasks, overdueOnly]);



  const colCount = isMobile ? 1 : isTablet ? 2 : 4;

  return (
    <div className="screen-container animate-fade-in">

      {/* ── Board Header ───────────────────────────────────────── */}
      {boardName && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.75rem 1rem', borderRadius: 'var(--radius-lg)',
          background: 'linear-gradient(135deg, rgba(14,165,233,0.06) 0%, rgba(139,92,246,0.04) 100%)',
          border: '1px solid rgba(14,165,233,0.12)', flexWrap: 'wrap', gap: '0.5rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div style={{ padding: '0.375rem', borderRadius: '8px', background: 'rgba(14,165,233,0.12)', color: '#0EA5E9' }}>
              <Layers size={15} />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{boardName}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                Trello Board · {totalCount} cards
                {lastSynced && <> · Last synced {lastSynced.toLocaleTimeString()}</>}
              </div>
            </div>
          </div>
          <button
            className="btn-ghost"
            style={{ height: '32px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
            onClick={handleSync}
            disabled={syncing}
          >
            <RefreshCw size={12} style={{ animation: syncing ? 'spin 0.8s linear infinite' : 'none' }} />
            {syncing ? 'Syncing…' : 'Sync'}
          </button>
        </div>
      )}

      {/* ── Stat Cards ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${colCount}, 1fr)`, gap: '0.875rem' }}>
        {[
          { label: 'Total Cards',   value: totalCount,      color: '#8B5CF6', sub: `${uniqueLists.length} lists`, icon: <ListTodo size={14} /> },
          { label: 'In Progress',   value: inProgressCount, color: '#0EA5E9', sub: 'actively being worked',       icon: <Clock size={14} /> },
          { label: 'Overdue',       value: overdueCount,    color: '#EF4444', sub: 'past due date',               icon: <AlertTriangle size={14} /> },
          { label: 'Completed',     value: completedCount,  color: '#10B981', sub: 'finished cards',              icon: <CheckCircle size={14} /> },
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

      {/* ── Filter Tabs + Toolbar ──────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: isMobile ? '100%' : '180px' }}>
          <Search size={13} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            className="input-field"
            aria-label="Search cards"
            placeholder="Search cards, client, members…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: '2.25rem', height: '36px', fontSize: '0.8rem', width: '100%' }}
          />
          {search && (
            <button onClick={() => setSearch('')} aria-label="Clear search" style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 0 }}>
              <X size={12} />
            </button>
          )}
        </div>

        {/* List filter */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <Layers size={12} style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <select
            className="input-field"
            aria-label="Filter by list"
            value={listFilter}
            onChange={e => setListFilter(e.target.value)}
            style={{ height: '36px', fontSize: '0.78rem', paddingLeft: '1.875rem', paddingRight: '1.875rem', minWidth: '160px', appearance: 'none' }}
          >
            <option value="">All Lists</option>
            {uniqueLists.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <ChevronDown size={11} style={{ position: 'absolute', right: '0.625rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        </div>

        {/* Priority filter */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <select
            className="input-field"
            aria-label="Filter by priority"
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            style={{ height: '36px', fontSize: '0.78rem', paddingLeft: '0.75rem', paddingRight: '1.875rem', minWidth: '130px', appearance: 'none' }}
          >
            <option value="All">All Priorities</option>
            <option value="Highest">P: Highest</option>
            <option value="High">P: High</option>
            <option value="Medium">P: Medium</option>
            <option value="Low">P: Low</option>
            <option value="Lowest">P: Lowest</option>
          </select>
          <ChevronDown size={11} style={{ position: 'absolute', right: '0.625rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        </div>

        {/* Sort */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <select
            className="input-field"
            aria-label="Sort cards"
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            style={{ height: '36px', fontSize: '0.78rem', paddingLeft: '0.75rem', paddingRight: '1.875rem', minWidth: '130px', appearance: 'none' }}
          >
            <option value="default">Sort: Default</option>
            <option value="priority">Sort: Priority</option>
            <option value="due_date">Sort: Due Date</option>
            <option value="client">Sort: Client</option>
            <option value="assignee">Sort: Assignee</option>
            <option value="name">Sort: Name</option>
            <option value="label">Sort: Label</option>
            <option value="status">Sort: Status</option>
          </select>
          <ChevronDown size={11} style={{ position: 'absolute', right: '0.625rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        </div>

        {/* New Task */}
        <button
          className="btn-primary"
          aria-label="Add new local task"
          onClick={() => setShowNewTaskModal(true)}
          style={{ height: '36px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0, whiteSpace: 'nowrap', padding: '0 0.75rem' }}
        >
          <Plus size={12} />
          {!isMobile && 'New Task'}
        </button>

        {/* Export CSV */}
        {filtered.length > 0 && (
          <button
            className="btn-ghost"
            aria-label="Export tasks to CSV"
            onClick={() => exportTasksCSV(filtered)}
            style={{ height: '36px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            <Download size={12} />
            {!isMobile && 'Export CSV'}
          </button>
        )}

        {/* Export TXT */}
        {filtered.length > 0 && (
          <button
            className="btn-ghost"
            aria-label="Export tasks to TXT"
            onClick={() => handleExportTasksTxt(filtered)}
            style={{ height: '36px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            <FileText size={12} />
            {!isMobile && (tasksTxtExported ? 'Exported!' : 'Export TXT')}
          </button>
        )}

        {/* Copy Summary */}
        <button
          className="btn-ghost"
          aria-label="Copy task summary to clipboard"
          onClick={handleCopyTaskSummary}
          style={{ height: '36px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          <ClipboardCopy size={12} />
          {!isMobile && (taskSummaryCopied ? 'Copied!' : 'Copy Summary')}
        </button>
      </div>

      {/* Due-date quick filters */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {(['All', 'Due Today', 'Due This Week', 'No Due Date'] as const).map(df => (
          <button
            key={df}
            className={`btn-ghost${dueDateFilter === df ? ' active' : ''}`}
            aria-label={`Filter tasks by due date: ${df}`}
            aria-pressed={dueDateFilter === df}
            onClick={() => setDueDateFilter(df)}
            style={{ height: '28px', fontSize: '0.72rem', padding: '0 0.625rem', borderRadius: 'var(--radius-md)', fontWeight: dueDateFilter === df ? 700 : 500, opacity: dueDateFilter === df ? 1 : 0.72 }}
          >
            {df}
          </button>
        ))}
      </div>

      {/* Assignee filter */}
      {assigneeOptions.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <select
            aria-label="Filter tasks by assignee"
            value={assigneeFilter}
            onChange={e => setAssigneeFilter(e.target.value)}
            style={{ height: '28px', fontSize: '0.72rem', padding: '0 0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: assigneeFilter !== 'All' ? 'rgba(0,212,255,0.07)' : 'rgba(255,255,255,0.04)', color: assigneeFilter !== 'All' ? '#00D4FF' : '#94A3B8', fontFamily: 'inherit', cursor: 'pointer', outline: 'none' }}
          >
            <option value="All">All Assignees</option>
            {assigneeOptions.slice(1).map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      )}

      {/* Client filter */}
      {clientOptions.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <select
            aria-label="Filter tasks by client"
            value={clientFilter}
            onChange={e => setClientFilter(e.target.value)}
            style={{ height: '28px', fontSize: '0.72rem', padding: '0 0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: clientFilter !== 'All' ? 'rgba(0,212,255,0.07)' : 'rgba(255,255,255,0.04)', color: clientFilter !== 'All' ? '#00D4FF' : '#94A3B8', fontFamily: 'inherit', cursor: 'pointer', outline: 'none' }}
          >
            <option value="All">All Clients</option>
            {clientOptions.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      {/* Label filter */}
      {labelOptions.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <select
            aria-label="Filter tasks by label"
            value={labelFilter}
            onChange={e => setLabelFilter(e.target.value)}
            style={{ height: '28px', fontSize: '0.72rem', padding: '0 0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: labelFilter !== 'All' ? 'rgba(139,92,246,0.07)' : 'rgba(255,255,255,0.04)', color: labelFilter !== 'All' ? '#A78BFA' : '#94A3B8', fontFamily: 'inherit', cursor: 'pointer', outline: 'none' }}
          >
            <option value="All">All Labels</option>
            {labelOptions.slice(1).map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      )}

      {/* Payment / Starred / Overdue quick filters */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        <button
          aria-label="Show payment-related tasks only"
          aria-pressed={paymentOnly}
          onClick={() => setPaymentOnly(p => !p)}
          style={{ height: '28px', fontSize: '0.72rem', padding: '0 0.625rem', borderRadius: 'var(--radius-md)', border: `1px solid ${paymentOnly ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.1)'}`, background: paymentOnly ? 'rgba(245,158,11,0.1)' : 'transparent', color: paymentOnly ? '#FCD34D' : '#94A3B8', cursor: 'pointer', fontFamily: 'inherit', fontWeight: paymentOnly ? 700 : 500 }}
        >
          💰 Payment
        </button>
        <button
          aria-label="Show starred tasks only"
          aria-pressed={starredOnly}
          onClick={() => setStarredOnly(p => !p)}
          style={{ height: '28px', fontSize: '0.72rem', padding: '0 0.625rem', borderRadius: 'var(--radius-md)', border: `1px solid ${starredOnly ? 'rgba(251,191,36,0.5)' : 'rgba(255,255,255,0.1)'}`, background: starredOnly ? 'rgba(251,191,36,0.1)' : 'transparent', color: starredOnly ? '#FBBF24' : '#94A3B8', cursor: 'pointer', fontFamily: 'inherit', fontWeight: starredOnly ? 700 : 500, display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <Star size={11} fill={starredOnly ? '#FBBF24' : 'none'} />
          Starred
        </button>
        <button
          aria-label="Show overdue tasks only"
          aria-pressed={overdueOnly}
          onClick={() => setOverdueOnly(p => !p)}
          style={{ height: '28px', fontSize: '0.72rem', padding: '0 0.625rem', borderRadius: 'var(--radius-md)', border: `1px solid ${overdueOnly ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)'}`, background: overdueOnly ? 'rgba(239,68,68,0.1)' : 'transparent', color: overdueOnly ? '#FCA5A5' : '#94A3B8', cursor: 'pointer', fontFamily: 'inherit', fontWeight: overdueOnly ? 700 : 500, display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <AlertTriangle size={11} />
          Overdue
        </button>
      </div>

      {/* Status filter tabs */}
      <div style={{ display: 'flex', gap: '0.2rem', background: 'rgba(255,255,255,0.03)', padding: '0.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', overflowX: 'auto', WebkitOverflowScrolling: 'touch', flexShrink: 0 }}>
        {FILTER_TABS.map(tab => {
          const m = tab !== 'All' ? STATUS_META[tab] : null;
          const count = tab === 'All' ? enrichedCards.length : enrichedCards.filter(c => c.status === tab).length;
          return (
            <button
              key={tab}
              className={`tab-item ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
              aria-label={`Task status: ${tab}`}
              aria-pressed={activeTab === tab}
              style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem', whiteSpace: 'nowrap', color: activeTab === tab && m ? m.color : undefined }}
            >
              {tab}
              <span style={{ marginLeft: '0.3rem', fontSize: '0.65rem', opacity: 0.7 }}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* ── Loading / Error states ─────────────────────────────── */}
      {loading && (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <Loader2 size={16} className="animate-spin" /> Loading Trello board…
        </div>
      )}

      {!loading && error && (
        <div style={{ padding: '1.25rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-lg)', color: '#FCA5A5', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={15} />
          {error}
          <button className="btn-ghost" style={{ marginLeft: 'auto', fontSize: '0.72rem' }} onClick={handleSync}>Retry</button>
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────────── */}
      {!loading && !error && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3.5rem 1rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-subtle)' }}>
          <CheckSquare size={36} style={{ color: 'var(--text-faint)', margin: '0 auto 0.875rem', display: 'block' }} />
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
            {cards.length === 0 && localTasks.length === 0 ? 'No cards found on this board' : 'No cards match your filters'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {cards.length === 0 && localTasks.length === 0 ? 'Check your Trello board connection or add a local task' : 'Try adjusting the search or clearing filters'}
          </div>
        </div>
      )}

      {/* ── Card List (Table) ──────────────────────────────────── */}
      {!loading && !error && filtered.length > 0 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr auto' : 'minmax(0, 2fr) 90px 110px minmax(100px, 140px) minmax(80px, 120px) 90px auto',
            gap: '0', padding: '0.6rem 1rem',
            background: 'var(--bg-elevated)',
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            {['Card', ...(isMobile ? [] : ['Priority', 'Status', 'List', 'Client', 'Due Date', ''])].map((h, i) => (
              <div key={i} style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 0.5rem', textAlign: i > 0 && i < 6 ? 'center' : 'left' }}>
                {h}
              </div>
            ))}
          </div>

          {/* Card rows */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filtered.slice(0, 100).map((card, idx) => {
              const sm = STATUS_META[card.status] ?? STATUS_META['Backlog'];
              const overdue = isOverdue(card);
              const dueDateColor = card.dueComplete ? '#34D399' : overdue ? '#FCA5A5' : 'var(--text-secondary)';

              const rowStyle: React.CSSProperties = {
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr auto' : 'minmax(0, 2fr) 90px 110px minmax(100px, 140px) minmax(80px, 120px) 90px auto',
                gap: '0',
                padding: '0.75rem 1rem',
                borderBottom: idx < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                borderLeft: `3px solid ${sm.dot}30`,
                transition: 'background 0.12s',
                alignItems: 'center',
                textDecoration: 'none',
                color: 'inherit',
              };
              const onEnter = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; };
              const onLeave = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.background = 'transparent'; };

              const cardContent = (
                <>
                  {/* Title + members + meta */}
                  <div style={{ padding: '0 0.5rem', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {card.name}
                      </div>
                      {card.local && (
                        <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', background: 'rgba(139,92,246,0.15)', color: '#A78BFA', border: '1px solid rgba(139,92,246,0.25)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          Local
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '3px', flexWrap: 'wrap' }}>
                      {card.members.length > 0 && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <User size={9} /> {card.members.slice(0, 2).join(', ')}
                          {card.members.length > 2 && ` +${card.members.length - 2}`}
                        </span>
                      )}
                      {card.commentCount > 0 && (
                        <span style={{ fontSize: '0.62rem', color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <MessageSquare size={9} /> {card.commentCount}
                        </span>
                      )}
                      {card.attachmentCount > 0 && (
                        <span style={{ fontSize: '0.62rem', color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <Paperclip size={9} /> {card.attachmentCount}
                        </span>
                      )}
                      {card.checklistTotal > 0 && (
                        <span style={{ fontSize: '0.62rem', color: card.checklistDone === card.checklistTotal ? '#34D399' : 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <CheckSquare size={9} /> {card.checklistDone}/{card.checklistTotal}
                        </span>
                      )}
                    </div>
                  </div>

                  {isMobile ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0 0.25rem' }}>
                      <PriorityBadge priority={card.priority || 'Medium'} />
                    </div>
                  ) : (
                    <>
                      <div style={{ padding: '0 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <PriorityBadge priority={card.priority || 'Medium'} />
                      </div>
                      <div style={{ padding: '0 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <StatusBadge status={card.status} />
                      </div>
                      <div style={{ padding: '0 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '2px 7px', borderRadius: '4px', background: 'rgba(0,212,255,0.07)', color: '#38BDF8', border: '1px solid rgba(0,212,255,0.16)', maxWidth: '128px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                          {card.listName}
                        </span>
                      </div>
                      <div style={{ padding: '0 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {card.client ? (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '110px' }}>
                            {card.client}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>—</span>
                        )}
                      </div>
                      <div style={{ padding: '0 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                        <CalendarDays size={10} style={{ color: dueDateColor, flexShrink: 0 }} />
                        <span style={{ fontSize: '0.72rem', color: dueDateColor, fontWeight: overdue ? 700 : 400 }}>
                          {fmtDate(card.dueDate)}
                        </span>
                      </div>
                      <div style={{ padding: '0 0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <button
                          aria-label={`${starredTasks.has(card.id) ? 'Unstar' : 'Star'} task: ${card.name}`}
                          aria-pressed={starredTasks.has(card.id)}
                          onClick={e => { e.preventDefault(); e.stopPropagation(); handleToggleStarTask(card.id); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: starredTasks.has(card.id) ? '#FBBF24' : 'var(--text-muted)', opacity: starredTasks.has(card.id) ? 1 : 0.5, padding: '2px', display: 'flex', alignItems: 'center' }}
                        >
                          <Star size={12} fill={starredTasks.has(card.id) ? '#FBBF24' : 'none'} />
                        </button>
                        {card.local ? (
                          <button
                            aria-label={`Delete local task ${card.name}`}
                            onClick={() => handleDeleteLocalTask(card.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', opacity: 0.6, padding: '2px', display: 'flex', alignItems: 'center' }}
                            title="Delete local task"
                          >
                            <Trash2 size={12} />
                          </button>
                        ) : (
                          <ExternalLink size={12} style={{ color: 'var(--text-muted)' }} />
                        )}
                      </div>
                    </>
                  )}
                </>
              );

              return card.local ? (
                <div key={card.id} style={{ ...rowStyle, cursor: 'default' }} onMouseEnter={onEnter} onMouseLeave={onLeave}>
                  {cardContent}
                </div>
              ) : (
                <a
                  key={card.id}
                  href={card.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ...rowStyle, cursor: 'pointer' }}
                  onMouseEnter={onEnter}
                  onMouseLeave={onLeave}
                >
                  {cardContent}
                </a>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{ padding: '0.625rem 1.25rem', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-faint)' }}>
              Showing <strong style={{ color: 'var(--text-secondary)' }}>{Math.min(filtered.length, 100)}</strong> of {enrichedCards.length} cards
              {filtered.length > 100 && <> (limited to 100)</>}
            </span>
            {overdueCount > 0 && (
              <span style={{ fontSize: '0.7rem', color: '#FCA5A5', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <AlertTriangle size={11} /> {overdueCount} overdue
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── New Local Task Modal ──────────────────────────────── */}
      {showNewTaskModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}
          onClick={() => setShowNewTaskModal(false)}
        >
          <div
            role="dialog"
            aria-label="Add New Task"
            style={{ background: '#0C1220', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '1.5rem', width: '100%', maxWidth: '480px', margin: '1rem' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Add New Task</h3>
              <button className="btn-ghost" style={{ padding: '0.25rem' }} onClick={() => setShowNewTaskModal(false)} aria-label="Close dialog">
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', display: 'block', marginBottom: '0.375rem' }}>Task Title *</label>
                <input
                  className="input-field"
                  placeholder="Task title"
                  value={newTaskForm.name}
                  onChange={e => setNewTaskForm(prev => ({ ...prev, name: e.target.value }))}
                  style={{ width: '100%', padding: '0.625rem 0.75rem', fontSize: '0.85rem' }}
                  aria-label="Task title"
                  autoFocus
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', display: 'block', marginBottom: '0.375rem' }}>Client</label>
                  <input
                    className="input-field"
                    placeholder="Client name"
                    value={newTaskForm.client}
                    onChange={e => setNewTaskForm(prev => ({ ...prev, client: e.target.value }))}
                    style={{ width: '100%', padding: '0.625rem 0.75rem', fontSize: '0.85rem' }}
                    aria-label="Client"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', display: 'block', marginBottom: '0.375rem' }}>Assignee</label>
                  <input
                    className="input-field"
                    placeholder="Assignee name"
                    value={newTaskForm.assignee}
                    onChange={e => setNewTaskForm(prev => ({ ...prev, assignee: e.target.value }))}
                    style={{ width: '100%', padding: '0.625rem 0.75rem', fontSize: '0.85rem' }}
                    aria-label="Assignee"
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', display: 'block', marginBottom: '0.375rem' }}>Priority</label>
                  <select
                    className="input-field"
                    value={newTaskForm.priority}
                    onChange={e => setNewTaskForm(prev => ({ ...prev, priority: e.target.value }))}
                    style={{ width: '100%', padding: '0.625rem 0.75rem', fontSize: '0.85rem', background: '#080C18' }}
                    aria-label="Priority"
                  >
                    <option value="Highest">Highest</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                    <option value="Lowest">Lowest</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', display: 'block', marginBottom: '0.375rem' }}>Status</label>
                  <select
                    className="input-field"
                    value={newTaskForm.status}
                    onChange={e => setNewTaskForm(prev => ({ ...prev, status: e.target.value }))}
                    style={{ width: '100%', padding: '0.625rem 0.75rem', fontSize: '0.85rem', background: '#080C18' }}
                    aria-label="Task status"
                  >
                    <option value="Backlog">Backlog</option>
                    <option value="In Progress">In Progress</option>
                    <option value="In Review">In Review</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', display: 'block', marginBottom: '0.375rem' }}>Due Date</label>
                <input
                  type="date"
                  className="input-field"
                  value={newTaskForm.dueDate}
                  onChange={e => setNewTaskForm(prev => ({ ...prev, dueDate: e.target.value }))}
                  style={{ width: '100%', padding: '0.625rem 0.75rem', fontSize: '0.85rem' }}
                  aria-label="Due date"
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                <button className="btn-ghost" onClick={() => setShowNewTaskModal(false)}>Cancel</button>
                <button
                  className="btn-primary"
                  onClick={handleAddLocalTask}
                  disabled={!newTaskForm.name.trim()}
                  style={{ padding: '0.5rem 1.25rem' }}
                  aria-label="Create task"
                >
                  Create Task
                </button>
              </div>
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
