import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLayout } from '../hooks/useLayout';
import {
  Plus, Video, Users, Clock, CheckCircle, FileText,
  ChevronRight, Calendar, MapPin, Search, Upload,
  Loader2, X, Pencil, Trash2, Monitor, FolderOpen,
  TrendingUp, Sparkles, MessageSquareQuote, Copy, Download, ClipboardCopy, Bell,
} from 'lucide-react';
import { getMeetings, updateMeeting, upsertMeeting, deleteMeeting, getWorkspaces, upsertDocument } from '../lib/db';
import type { MeetingRow, WorkspaceRow } from '../lib/db';
import { chatWithDocument } from '../lib/openrouter';

const filterTabs = ['All', 'Upcoming', 'Completed', 'Needs Action'];

function exportMeetingsCSV(meetings: MeetingRow[]) {
  const headers = ['Title', 'Type', 'Status', 'Date', 'Time', 'Duration', 'Workspace', 'Location', 'Participants'];
  const rows = meetings.map(m => [
    `"${m.title.replace(/"/g, '""')}"`,
    m.type,
    m.status,
    m.date,
    m.time,
    m.duration,
    `"${m.workspace.replace(/"/g, '""')}"`,
    m.location ? `"${m.location.replace(/"/g, '""')}"` : '',
    `"${m.participants.join('; ')}"`,
  ].join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `meetings_export_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const typeColors: Record<string, { bg: string; text: string; border: string; accent: string }> = {
  Workshop:  { bg: 'rgba(14,165,233,0.1)',   text: '#38BDF8',  border: 'rgba(14,165,233,0.22)',  accent: '#0EA5E9' },
  Committee: { bg: 'rgba(139,92,246,0.12)',  text: '#A78BFA',  border: 'rgba(139,92,246,0.25)',  accent: '#8B5CF6' },
  Steering:  { bg: 'rgba(239,68,68,0.1)',    text: '#FCA5A5',  border: 'rgba(239,68,68,0.22)',   accent: '#EF4444' },
  Review:    { bg: 'rgba(16,185,129,0.1)',   text: '#34D399',  border: 'rgba(16,185,129,0.22)',  accent: '#10B981' },
  Kickoff:   { bg: 'rgba(0,212,255,0.1)',    text: '#00D4FF',  border: 'rgba(0,212,255,0.22)',   accent: '#00D4FF' },
  Standup:   { bg: 'rgba(148,163,184,0.08)', text: '#94A3B8',  border: 'rgba(148,163,184,0.15)', accent: '#475569' },
};

const avatarBgs = ['#0EA5E9', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'];

const MONTH_NAMES = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const LONG_MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Dynamic mini calendar for current month
function buildMiniCalendar(year: number, month: number): { day: string; dates: number[] }[] {
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cols: { day: string; dates: number[] }[] = DAYS.map(d => ({ day: d, dates: [] }));
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = (new Date(year, month, d).getDay());
    cols[dow].dates.push(d);
  }
  return cols;
}

const _today = new Date();
const miniCalendar = buildMiniCalendar(_today.getFullYear(), _today.getMonth());
const TODAY_DATE = _today.getDate();
const CURRENT_MONTH_LABEL = `${LONG_MONTH_NAMES[_today.getMonth()]} ${_today.getFullYear()}`;

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; border: string; dot: string }> = {
    'Upcoming':    { bg: 'rgba(14,165,233,0.1)',  color: '#38BDF8',  border: 'rgba(14,165,233,0.22)',  dot: '#38BDF8' },
    'In Progress': { bg: 'rgba(239,68,68,0.12)',  color: '#FCA5A5',  border: 'rgba(239,68,68,0.25)',   dot: '#EF4444' },
    'Completed':   { bg: 'rgba(16,185,129,0.1)',  color: '#34D399',  border: 'rgba(16,185,129,0.22)',  dot: '#10B981' },
  };
  const s = map[status] || map['Upcoming'];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      fontSize: '0.68rem', fontWeight: 600, padding: '2px 8px',
      borderRadius: '9999px', background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      letterSpacing: '0.02em', whiteSpace: 'nowrap',
    }}>
      {status === 'In Progress' && (
        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: s.dot, animation: 'pulseDot 2s ease-in-out infinite', display: 'inline-block' }} />
      )}
      {status}
    </span>
  );
}

function parseDateBadge(dateStr: string) {
  const parts = dateStr.split('-');
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return { month: MONTH_NAMES[monthIdx] || 'JAN', day };
}

function isVirtualLocation(loc: string | null | undefined): boolean {
  if (!loc) return false;
  const lower = loc.toLowerCase();
  return lower.includes('teams') || lower.includes('zoom') || lower.includes('virtual') || lower.includes('online') || lower.includes('meet') || lower.includes('webex');
}

const aiInsights = [
  '"3 meetings this week have overlapping participants -- consider consolidating."',
  '"Minutes for Core Migration Sync are 2 days overdue. Draft available."',
  '"Completion rate improved 12% this month. Keep the momentum going."',
];

export default function Meetings() {
  const navigate = useNavigate();
  const { width, isMobile, isTablet } = useLayout();
  const [activeFilter, setActiveFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [showNewModal, setShowNewModal] = useState(false);
  const [editMeeting, setEditMeeting] = useState<MeetingRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [markingComplete, setMarkingComplete] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState<string | null>(null); // tracks which AI action is running
  const [cloningMeetingId, setCloningMeetingId] = useState<string | null>(null);
  const [cloneToast, setCloneToast] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [dateFilter, setDateFilter] = useState<'All' | 'Today' | 'This Week'>('All');
  const [locFilter, setLocFilter] = useState<'All' | 'Virtual' | 'In-Person'>('All');
  const [hasActionsOnly, setHasActionsOnly] = useState(false);
  const [durationFilter, setDurationFilter] = useState<'All' | 'Short' | 'Long'>('All');
  const [minParticipants, setMinParticipants] = useState<0 | 3 | 5 | 10>(0);
  const [quorumFilter, setQuorumFilter] = useState<'All' | 'Met' | 'Not Met'>('All');
  const [meetingSort, setMeetingSort] = useState<'newest' | 'oldest' | 'title' | 'participants' | 'workspace' | 'type' | 'location'>('newest');
  const [starredMeetings, setStarredMeetings] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('meetings_starred') ?? '[]')); } catch { return new Set(); }
  });
  const [reminderIds, setReminderIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('meetings_reminders') ?? '[]')); } catch { return new Set(); }
  });
  const [starredMeetingsOnly, setStarredMeetingsOnly] = useState(false);
  const [meetingsSummaryCopied, setMeetingsSummaryCopied] = useState(false);
  const [meetingsTxtExported, setMeetingsTxtExported] = useState(false);
  const [form, setForm] = useState({
    title: '', date: '', time: '09:00', duration: '1h', type: 'Review' as MeetingRow['type'],
    workspace: '', workspace_id: '', location: '', participants: '',
  });

  // ── Action Items ──────────────────────────────────────────────
  interface ActionItem { id: string; text: string; owner: string; dueDate: string; done: boolean; meetingId: string; }
  const ACTION_ITEMS_KEY = 'meetings_action_items';
  const [actionItems, setActionItems] = useState<ActionItem[]>(() => {
    try { return JSON.parse(localStorage.getItem(ACTION_ITEMS_KEY) ?? 'null') ?? []; } catch { return []; }
  });
  const [showActionPanel, setShowActionPanel] = useState(false);
  const [newActionText, setNewActionText] = useState('');
  const [newActionOwner, setNewActionOwner] = useState('');
  const [newActionDue, setNewActionDue] = useState('');
  const [newActionMeetingId, setNewActionMeetingId] = useState('');

  function saveActionItems(items: ActionItem[]) {
    try { localStorage.setItem(ACTION_ITEMS_KEY, JSON.stringify(items)); } catch { /* ignore */ }
  }

  function handleToggleStarMeeting(meetingId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setStarredMeetings(prev => {
      const next = new Set(prev);
      if (next.has(meetingId)) next.delete(meetingId);
      else next.add(meetingId);
      try { localStorage.setItem('meetings_starred', JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

  function handleToggleReminder(meetingId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setReminderIds(prev => {
      const next = new Set(prev);
      if (next.has(meetingId)) next.delete(meetingId);
      else next.add(meetingId);
      try { localStorage.setItem('meetings_reminders', JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

  function handleAddActionItem() {
    if (!newActionText.trim()) return;
    const item: ActionItem = {
      id: `ai-${Date.now()}`,
      text: newActionText.trim(),
      owner: newActionOwner.trim() || 'Unassigned',
      dueDate: newActionDue,
      done: false,
      meetingId: newActionMeetingId,
    };
    const updated = [item, ...actionItems];
    setActionItems(updated);
    saveActionItems(updated);
    setNewActionText('');
    setNewActionOwner('');
    setNewActionDue('');
    setNewActionMeetingId('');
  }

  function handleToggleActionItem(id: string) {
    const updated = actionItems.map(a => a.id === id ? { ...a, done: !a.done } : a);
    setActionItems(updated);
    saveActionItems(updated);
  }

  function handleDeleteActionItem(id: string) {
    const updated = actionItems.filter(a => a.id !== id);
    setActionItems(updated);
    saveActionItems(updated);
  }

  const pendingActionItems = actionItems.filter(a => !a.done);
  const doneActionItems = actionItems.filter(a => a.done);

  function openEditModal(meeting: MeetingRow, e: React.MouseEvent) {
    e.stopPropagation();
    setEditMeeting(meeting);
    setForm({
      title: meeting.title,
      date: meeting.date,
      time: meeting.time || '09:00',
      duration: meeting.duration || '1h',
      type: meeting.type,
      workspace: meeting.workspace,
      workspace_id: meeting.workspace_id || '',
      location: meeting.location || '',
      participants: (meeting.participants || []).join(', '),
    });
    setShowNewModal(true);
  }

  useEffect(() => {
    getMeetings().then(data => { setMeetings(data); setLoading(false); }).catch(() => setLoading(false));
    getWorkspaces().then(setWorkspaces).catch(() => {});
  }, []);

  // ── Create / Update meeting ────────────────────────────────
  async function handleCreateMeeting() {
    if (!form.title || !form.date || !form.workspace_id) return;
    setSaving(true);
    try {
      if (editMeeting) {
        // Update existing
        const updated = await updateMeeting(editMeeting.id, {
          title: form.title,
          date: form.date,
          time: form.time,
          duration: form.duration,
          type: form.type,
          workspace: form.workspace,
          workspace_id: form.workspace_id,
          participants: form.participants.split(',').map(p => p.trim()).filter(Boolean),
          location: form.location || null,
        });
        setMeetings(prev => prev.map(m => m.id === editMeeting.id ? updated : m));
      } else {
        // Create new
        const newMeeting = await upsertMeeting({
          id: crypto.randomUUID(),
          title: form.title,
          date: form.date,
          time: form.time,
          duration: form.duration,
          type: form.type,
          status: 'Upcoming',
          workspace: form.workspace,
          workspace_id: form.workspace_id,
          participants: form.participants.split(',').map(p => p.trim()).filter(Boolean),
          location: form.location || null,
          minutes_generated: false,
          actions_extracted: 0,
          decisions_logged: 0,
          agenda: null,
          quorum_status: null,
        });
        setMeetings(prev => [newMeeting, ...prev]);
      }
      setShowNewModal(false);
      setEditMeeting(null);
      setForm({ title: '', date: '', time: '09:00', duration: '1h', type: 'Review', workspace: '', workspace_id: '', location: '', participants: '' });
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  // ── Delete meeting ─────────────────────────────────────────
  async function handleDeleteMeeting(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Delete this meeting?')) return;
    setDeletingId(id);
    try {
      await deleteMeeting(id);
      setMeetings(prev => prev.filter(m => m.id !== id));
    } catch { /* ignore */ }
    finally { setDeletingId(null); }
  }

  // ── Clone meeting ──────────────────────────────────────────
  async function handleCloneMeeting(meeting: MeetingRow, e: React.MouseEvent) {
    e.stopPropagation();
    setCloningMeetingId(meeting.id);
    try {
      const base = new Date(meeting.date);
      base.setDate(base.getDate() + 7);
      const cloned = await upsertMeeting({
        id: crypto.randomUUID(),
        title: `Copy of ${meeting.title}`,
        date: base.toISOString().slice(0, 10),
        time: meeting.time,
        duration: meeting.duration,
        type: meeting.type,
        status: 'Upcoming',
        participants: meeting.participants,
        workspace: meeting.workspace,
        workspace_id: meeting.workspace_id,
        minutes_generated: false,
        actions_extracted: 0,
        decisions_logged: 0,
        location: meeting.location,
        agenda: meeting.agenda,
        quorum_status: null,
      });
      setMeetings(prev => [cloned, ...prev]);
      setCloneToast(`"Copy of ${meeting.title}" created`);
      setTimeout(() => setCloneToast(null), 3000);
    } catch { /* ignore */ }
    finally { setCloningMeetingId(null); }
  }

  // ── Mark complete ──────────────────────────────────────────
  async function handleMarkComplete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setMarkingComplete(id);
    try {
      await updateMeeting(id, { status: 'Completed' });
      setMeetings(prev => prev.map(m => m.id === id ? { ...m, status: 'Completed' } : m));
    } catch { /* ignore */ }
    finally { setMarkingComplete(null); }
  }

  // ── AI Quick Actions ──────────────────────────────────────
  function buildMeetingContext(m: MeetingRow): string {
    return `Title: ${m.title}\nDate: ${m.date}\nTime: ${m.time}\nDuration: ${m.duration}\nType: ${m.type}\nStatus: ${m.status}\nWorkspace: ${m.workspace}\nParticipants: ${(m.participants || []).join(', ')}\nLocation: ${m.location || 'N/A'}\nAgenda: ${(m.agenda || []).join('; ') || 'N/A'}\nActions extracted: ${m.actions_extracted}\nDecisions logged: ${m.decisions_logged}`;
  }

  async function handleSummarizeMinutes() {
    const target = meetings.find(m => m.status === 'Completed' && !m.minutes_generated);
    if (!target) { alert('No completed meetings pending minutes summarization.'); return; }
    setAiLoading('summarize');
    try {
      await chatWithDocument(
        [{ role: 'user', content: `Generate meeting minutes for:\n${buildMeetingContext(target)}` }],
        'You are a meeting analyst. Generate professional meeting minutes based on the meeting details provided.'
      );
      await updateMeeting(target.id, { minutes_generated: true });
      setMeetings(prev => prev.map(m => m.id === target.id ? { ...m, minutes_generated: true } : m));
      navigate(`/meetings/${target.id}`);
    } catch (err) {
      alert(`Failed to summarize minutes: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally { setAiLoading(null); }
  }

  async function handleDraftFollowUp(meeting?: MeetingRow) {
    const target = meeting || meetings.find(m => m.status === 'Completed');
    if (!target) { alert('No completed meetings found.'); return; }
    setAiLoading('followup');
    try {
      const result = await chatWithDocument(
        [{ role: 'user', content: `Draft a professional follow-up email for this meeting:\n${buildMeetingContext(target)}` }],
        'You are a professional consultant. Draft a concise follow-up email summarizing key outcomes, action items, and next steps from the meeting.'
      );
      // Save as a document record
      await upsertDocument({
        id: crypto.randomUUID(),
        name: `Follow-up: ${target.title}`,
        type: 'Meeting Minutes',
        type_color: '#10B981',
        workspace: target.workspace,
        workspace_id: target.workspace_id ?? '',
        date: new Date().toISOString().slice(0, 10),
        language: 'EN',
        status: 'Draft',
        size: `${Math.ceil(result.length / 100) * 0.1} KB`,
        author: 'Consultant OS AI',
        pages: 1,
        summary: result,
        tags: ['follow-up', 'meeting', 'AI-generated'],
        file_url: null,
      }).catch(() => { /* silently ignore if DB unavailable */ });
      try { await navigator.clipboard.writeText(result); alert('Follow-up email drafted and saved to Documents. Also copied to clipboard!'); }
      catch { alert('Follow-up email drafted and saved to Documents.\n\n' + result); }
    } catch (err) {
      alert(`Failed to draft follow-up: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally { setAiLoading(null); }
  }

  async function handleGenerateReport() {
    const recentMeetings = meetings.slice(0, 10);
    if (recentMeetings.length === 0) { alert('No meetings found to generate a report.'); return; }
    setAiLoading('report');
    try {
      const context = recentMeetings.map((m, i) => `Meeting ${i + 1}:\n${buildMeetingContext(m)}`).join('\n\n');
      const result = await chatWithDocument(
        [{ role: 'user', content: `Generate a summary report covering these recent meetings:\n\n${context}` }],
        'You are a senior consultant. Generate a professional meetings summary report highlighting key themes, decisions, action items, and upcoming priorities across all meetings.'
      );
      try { await navigator.clipboard.writeText(result); alert('AI report copied to clipboard!'); }
      catch { alert(result); }
    } catch (err) {
      alert(`Failed to generate report: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally { setAiLoading(null); }
  }

  // ── Derived stats ──────────────────────────────────────────
  const upcomingCount   = meetings.filter(m => m.status === 'Upcoming').length;
  const completedCount  = meetings.filter(m => m.status === 'Completed').length;
  const minutesCount    = meetings.filter(m => m.minutes_generated).length;
  const pendingMinutes  = completedCount - minutesCount;
  const coveragePct     = completedCount > 0 ? Math.round((minutesCount / completedCount) * 100) : 0;
  const nextUpcoming    = meetings.find(m => m.status === 'Upcoming');

  // ── Meeting dates for calendar (derive from real data) ─────
  const meetingDates = new Set(
    meetings
      .filter(m => m.date.startsWith('2026-03'))
      .map(m => String(parseInt(m.date.slice(8))))
  );

  const filtered = (() => {
    const base = meetings.filter(m => {
      const matchesFilter = activeFilter === 'All'
        ? true
        : activeFilter === 'Needs Action'
        ? (m.status === 'Completed' && !m.minutes_generated)
        : m.status === activeFilter;
      const matchesType = typeFilter === 'All Types' || m.type === typeFilter;
      const matchesSearch = !search
        || m.title.toLowerCase().includes(search.toLowerCase())
        || m.workspace.toLowerCase().includes(search.toLowerCase());
      const today = new Date().toISOString().slice(0, 10);
      const matchesDate = dateFilter === 'All' ? true
        : dateFilter === 'Today' ? m.date === today
        : (() => {
            const d = new Date(); const day = d.getDay();
            const monday = new Date(d); monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
            const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
            return m.date >= monday.toISOString().slice(0, 10) && m.date <= sunday.toISOString().slice(0, 10);
          })();
      const matchesLoc = locFilter === 'All' ? true
        : locFilter === 'Virtual' ? isVirtualLocation(m.location)
        : !isVirtualLocation(m.location);
      const meetingHasRowActions = (() => { try { const p = JSON.parse((m as { action_items?: string }).action_items ?? '[]'); return Array.isArray(p) && p.length > 0; } catch { return false; } })();
      const matchesHasActions = !hasActionsOnly || actionItems.some(a => a.meetingId === m.id) || meetingHasRowActions;
      const matchesDuration = durationFilter === 'All' ? true
        : durationFilter === 'Short' ? (m.duration === '30min' || m.duration === '1h')
        : (m.duration !== '30min' && m.duration !== '1h');
      const matchesStarred = !starredMeetingsOnly || starredMeetings.has(m.id);
      const matchesMinParticipants = (m.participants?.length ?? 0) >= minParticipants;
      const matchesQuorum = quorumFilter === 'All' ? true : m.quorum_status === quorumFilter;
      return matchesFilter && matchesType && matchesSearch && matchesDate && matchesLoc && matchesHasActions && matchesDuration && matchesStarred && matchesMinParticipants && matchesQuorum;
    });
    if (meetingSort === 'title') return [...base].sort((a, b) => a.title.localeCompare(b.title));
    if (meetingSort === 'oldest') return [...base].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
    if (meetingSort === 'participants') return [...base].sort((a, b) => (b.participants?.length ?? 0) - (a.participants?.length ?? 0));
    if (meetingSort === 'workspace') return [...base].sort((a, b) => (a.workspace ?? '').localeCompare(b.workspace ?? ''));
    if (meetingSort === 'type') return [...base].sort((a, b) => (a.type ?? '').localeCompare(b.type ?? ''));
    if (meetingSort === 'location') return [...base].sort((a, b) => (a.location ?? '').localeCompare(b.location ?? ''));
    return [...base].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  })();

  function handleCopyMeetingsSummary(meetingsToSummarize: MeetingRow[]) {
    if (meetingsToSummarize.length === 0) return;
    const upcoming = meetingsToSummarize.filter(m => m.status === 'Upcoming').length;
    const completed = meetingsToSummarize.filter(m => m.status === 'Completed').length;
    const needsAction = meetingsToSummarize.filter(m => m.status === 'Completed' && !m.minutes_generated).length;
    const lines = [
      `Meetings Summary`,
      `Total: ${meetingsToSummarize.length}`,
      `Upcoming: ${upcoming}`,
      `Completed: ${completed}`,
      `Needs Action: ${needsAction}`,
    ].join('\n');
    navigator.clipboard.writeText(lines).then(() => {
      setMeetingsSummaryCopied(true);
      setTimeout(() => setMeetingsSummaryCopied(false), 2000);
    }).catch(() => {});
  }

  function handleExportMeetingsTxt(meetingsToExport: MeetingRow[]) {
    if (meetingsToExport.length === 0) return;
    const lines = [
      `Meetings Export – Consultant OS`,
      `Total: ${meetingsToExport.length}`,
      '',
      ...meetingsToExport.map(m => [
        `Title: ${m.title}`,
        `Date: ${m.date} at ${m.time} (${m.duration})`,
        `Type: ${m.type} | Status: ${m.status}`,
        `Workspace: ${m.workspace}`,
        m.location ? `Location: ${m.location}` : null,
        `Participants: ${m.participants.join(', ')}`,
        '',
      ].filter(Boolean).join('\n')),
    ].join('\n');
    const blob = new Blob([lines], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meetings_export.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setMeetingsTxtExported(true);
    setTimeout(() => setMeetingsTxtExported(false), 2000);
  }

  return (
    <div className="screen-container animate-fade-in">

      {/* ── Stats Strip ──────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${width >= 768 ? 4 : width >= 480 ? 2 : 1}, 1fr)`, gap: '0.875rem' }}>

        {/* Total Meetings */}
        <div className="metric-card" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #8B5CF6, transparent)' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Total Meetings</div>
              <div className="hero-number" style={{ color: '#8B5CF6' }}>{meetings.length}</div>
            </div>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(139,92,246,0.25)' }}>
              <Video size={14} style={{ color: '#A78BFA' }} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
            <TrendingUp size={10} style={{ color: '#34D399' }} />
            <span style={{ fontSize: '0.62rem', fontWeight: 600, color: '#34D399' }}>+12% vs last month</span>
          </div>
        </div>

        {/* Upcoming */}
        <div className="metric-card" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #0EA5E9, transparent)' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Upcoming</div>
              <div className="hero-number" style={{ color: '#0EA5E9' }}>{upcomingCount}</div>
            </div>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(14,165,233,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(14,165,233,0.25)' }}>
              <Calendar size={14} style={{ color: '#38BDF8' }} />
            </div>
          </div>
          <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {nextUpcoming ? `Next: ${nextUpcoming.title}` : 'No upcoming meetings'}
          </div>
        </div>

        {/* Completed */}
        <div className="metric-card" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #10B981, transparent)' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Completed</div>
              <div className="hero-number" style={{ color: '#10B981' }}>{completedCount}</div>
            </div>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(16,185,129,0.25)' }}>
              <CheckCircle size={14} style={{ color: '#34D399' }} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
            <TrendingUp size={10} style={{ color: '#34D399' }} />
            <span style={{ fontSize: '0.62rem', fontWeight: 600, color: '#34D399' }}>+5% completion rate</span>
          </div>
        </div>

        {/* Minutes Coverage */}
        <div className="metric-card" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #F59E0B, transparent)' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Minutes Coverage</div>
              <div className="hero-number" style={{ color: '#F59E0B' }}>{coveragePct}%</div>
            </div>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(245,158,11,0.25)' }}>
              <FileText size={14} style={{ color: '#FBBF24' }} />
            </div>
          </div>
          <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '6px' }}>
            {pendingMinutes > 0 ? `${pendingMinutes} pending generation` : 'All minutes generated'}
          </div>
          <div style={{ height: '4px', borderRadius: '9999px', background: 'rgba(255,255,255,0.06)', marginTop: '6px', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: '9999px', width: `${coveragePct}%`, background: 'linear-gradient(90deg, #F59E0B, #FCD34D)', transition: 'width 0.5s' }} />
          </div>
        </div>
      </div>

      {/* ── Main 2-col layout ────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: isTablet ? '1fr' : '1fr 280px', gap: '1.25rem', alignItems: 'start' }}>

        {/* Left: Meeting List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
              <Search size={13} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                className="input-field"
                aria-label="Search meetings"
                placeholder="Search meetings…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: '2.25rem', height: '36px', fontSize: '0.8rem' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(255,255,255,0.03)', padding: '0.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              {filterTabs.map(tab => (
                <button key={tab} className={`tab-item ${activeFilter === tab ? 'active' : ''}`} onClick={() => setActiveFilter(tab)}
                  aria-label={`Meeting filter: ${tab === 'All' ? 'All Meetings' : tab}`}
                  aria-pressed={activeFilter === tab}
                  style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                  {tab === 'All' ? 'All Meetings' : tab}
                </button>
              ))}
            </div>
            {/* Type filter */}
            <select
              className="input-field"
              aria-label="Filter by meeting type"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              style={{ height: '36px', fontSize: '0.78rem', minWidth: '140px', flexShrink: 0 }}
            >
              <option value="All Types">All Types</option>
              {(['Workshop', 'Committee', 'Steering', 'Review', 'Kickoff', 'Standup'] as const).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            {/* Date quick filter */}
            <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
              {(['All', 'Today', 'This Week'] as const).map(df => (
                <button
                  key={df}
                  className={`btn-ghost${dateFilter === df ? ' active' : ''}`}
                  aria-label={`Filter meetings by date: ${df}`}
                  aria-pressed={dateFilter === df}
                  onClick={() => setDateFilter(df)}
                  style={{ fontSize: '0.72rem', height: '36px', padding: '0 0.5rem', background: dateFilter === df ? 'rgba(0,212,255,0.1)' : undefined, borderColor: dateFilter === df ? 'rgba(0,212,255,0.3)' : undefined }}
                >
                  {df}
                </button>
              ))}
            </div>

            {/* Location quick filter */}
            <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
              {(['All', 'Virtual', 'In-Person'] as const).map(lf => (
                <button
                  key={lf}
                  className={`btn-ghost${locFilter === lf ? ' active' : ''}`}
                  aria-label={`Filter meetings by location: ${lf}`}
                  aria-pressed={locFilter === lf}
                  onClick={() => setLocFilter(lf)}
                  style={{ fontSize: '0.72rem', height: '36px', padding: '0 0.5rem', background: locFilter === lf ? 'rgba(139,92,246,0.1)' : undefined, borderColor: locFilter === lf ? 'rgba(139,92,246,0.3)' : undefined }}
                >
                  {lf}
                </button>
              ))}
            </div>

            {/* Has Actions toggle */}
            <button
              className={`btn-ghost${hasActionsOnly ? ' active' : ''}`}
              aria-label="Show meetings with action items only"
              aria-pressed={hasActionsOnly}
              onClick={() => setHasActionsOnly(v => !v)}
              style={{ fontSize: '0.72rem', height: '36px', padding: '0 0.5rem', background: hasActionsOnly ? 'rgba(245,158,11,0.1)' : undefined, borderColor: hasActionsOnly ? 'rgba(245,158,11,0.3)' : undefined, flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              Has Actions
            </button>

            {/* Starred only toggle */}
            <button
              className={`btn-ghost${starredMeetingsOnly ? ' active' : ''}`}
              aria-label="Show starred meetings only"
              aria-pressed={starredMeetingsOnly}
              onClick={() => setStarredMeetingsOnly(v => !v)}
              style={{ fontSize: '0.72rem', height: '36px', padding: '0 0.5rem', background: starredMeetingsOnly ? 'rgba(245,158,11,0.1)' : undefined, borderColor: starredMeetingsOnly ? 'rgba(245,158,11,0.3)' : undefined, color: starredMeetingsOnly ? '#F59E0B' : undefined, flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              ⭐ Starred
            </button>

            {/* Duration filter */}
            {(['All', 'Short', 'Long'] as const).map(d => (
              <button
                key={d}
                onClick={() => setDurationFilter(d)}
                aria-label={`Filter meetings by duration: ${d}`}
                aria-pressed={durationFilter === d}
                className="btn-ghost"
                style={{ fontSize: '0.72rem', height: '36px', padding: '0 0.5rem', background: durationFilter === d ? 'rgba(14,165,233,0.1)' : undefined, borderColor: durationFilter === d ? 'rgba(14,165,233,0.3)' : undefined, color: durationFilter === d ? '#38BDF8' : undefined, flexShrink: 0, whiteSpace: 'nowrap' }}
              >{d === 'All' ? 'Any Duration' : d}</button>
            ))}

            {/* Min participants */}
            <select
              className="input-field"
              aria-label="Filter meetings by minimum participants"
              value={minParticipants}
              onChange={e => setMinParticipants(Number(e.target.value) as typeof minParticipants)}
              style={{ height: '36px', fontSize: '0.78rem', minWidth: '120px', flexShrink: 0 }}
            >
              <option value={0}>Any Size</option>
              <option value={3}>3+ Participants</option>
              <option value={5}>5+ Participants</option>
              <option value={10}>10+ Participants</option>
            </select>

            {/* Quorum filter */}
            <select
              className="input-field"
              aria-label="Filter meetings by quorum status"
              value={quorumFilter}
              onChange={e => setQuorumFilter(e.target.value as typeof quorumFilter)}
              style={{ height: '36px', fontSize: '0.78rem', minWidth: '130px', flexShrink: 0 }}
            >
              <option value="All">Any Quorum</option>
              <option value="Met">Quorum Met</option>
              <option value="Not Met">Quorum Not Met</option>
            </select>

            {/* Sort */}
            <select
              className="input-field"
              aria-label="Sort meetings"
              value={meetingSort}
              onChange={e => setMeetingSort(e.target.value as typeof meetingSort)}
              style={{ height: '36px', fontSize: '0.78rem', minWidth: '120px', flexShrink: 0 }}
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="title">Title</option>
              <option value="participants">Most Participants</option>
              <option value="workspace">By Workspace</option>
              <option value="type">By Type</option>
              <option value="location">By Location</option>
            </select>

            {filtered.length > 0 && (
              <button
                className="btn-ghost"
                aria-label="Copy meetings summary to clipboard"
                onClick={() => handleCopyMeetingsSummary(filtered)}
                style={{ height: '36px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0, whiteSpace: 'nowrap' }}
              >
                <ClipboardCopy size={12} /> {meetingsSummaryCopied ? 'Copied!' : 'Copy Summary'}
              </button>
            )}
            {filtered.length > 0 && (
              <button
                className="btn-ghost"
                aria-label="Export meetings to CSV"
                onClick={() => exportMeetingsCSV(filtered)}
                style={{ height: '36px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0, whiteSpace: 'nowrap' }}
              >
                <Download size={12} /> Export CSV
              </button>
            )}
            {filtered.length > 0 && (
              <button
                className="btn-ghost"
                aria-label="Export meetings to TXT"
                onClick={() => handleExportMeetingsTxt(filtered)}
                style={{ height: '36px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0, whiteSpace: 'nowrap' }}
              >
                <FileText size={12} /> {meetingsTxtExported ? 'Exported!' : 'Export TXT'}
              </button>
            )}
            <button className="btn-primary" aria-label="New Meeting" style={{ height: '36px', flexShrink: 0 }} onClick={() => setShowNewModal(true)}>
              <Plus size={14} /> New Meeting
            </button>
          </div>

          {/* Meeting Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {loading && (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <Loader2 size={16} className="animate-spin" /> Loading meetings…
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-default)' }}>
                <Video size={32} style={{ color: 'var(--text-faint)', margin: '0 auto 0.75rem', display: 'block' }} />
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>No meetings found</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Adjust filters or create a new meeting</div>
              </div>
            )}

            {filtered.map(meeting => {
              const tc = typeColors[meeting.type] || typeColors.Standup;
              const dateBadge = parseDateBadge(meeting.date);
              const virtual = isVirtualLocation(meeting.location);
              return (
                <div
                  key={meeting.id}
                  className="section-card card-hover"
                  style={{ cursor: 'pointer', overflow: 'hidden' }}
                  onClick={() => navigate(`/meetings/${meeting.id}`)}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = tc.border;
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 24px rgba(0,0,0,0.35)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)';
                    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', padding: isMobile ? '0.625rem 0.75rem' : '0.875rem 1.125rem', gap: isMobile ? '0.625rem' : '0.875rem' }}>

                    {/* Date Badge */}
                    <div style={{
                      width: '50px', minWidth: '50px', borderRadius: '10px', flexShrink: 0,
                      background: tc.bg, border: `1px solid ${tc.border}`,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      padding: '6px 4px',
                    }}>
                      <span style={{ fontSize: '0.55rem', fontWeight: 700, color: tc.text, textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1 }}>
                        {dateBadge.month}
                      </span>
                      <span style={{ fontSize: '1.25rem', fontWeight: 800, color: tc.text, lineHeight: 1.1 }}>
                        {dateBadge.day}
                      </span>
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Title row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                        <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                          {meeting.title}
                        </h3>
                        <StatusBadge status={meeting.status} />
                      </div>

                      {/* Meta row */}
                      <div style={{ display: 'flex', gap: '0.875rem', marginBottom: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Clock size={11} style={{ color: 'var(--text-faint)' }} /> {meeting.time} · {meeting.duration}
                        </span>
                        {meeting.location && (
                          <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            {virtual
                              ? <Monitor size={11} style={{ color: 'var(--text-faint)' }} />
                              : <MapPin size={11} style={{ color: 'var(--text-faint)' }} />
                            }
                            {meeting.location}
                          </span>
                        )}
                        <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <FolderOpen size={11} style={{ color: 'var(--text-faint)' }} />
                          <span style={{
                            fontSize: '0.68rem', fontWeight: 500, color: 'var(--text-muted)',
                            padding: '1px 6px', borderRadius: '4px',
                            background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)',
                            maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {meeting.workspace}
                          </span>
                        </span>
                      </div>

                      {/* Action buttons for completed meetings */}
                      {meeting.status === 'Completed' && (
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                          <button
                            onClick={e => { e.stopPropagation(); navigate(`/meetings/${meeting.id}`); }}
                            aria-label={`Summarize minutes for ${meeting.title}`}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '4px',
                              fontSize: '0.65rem', fontWeight: 700, padding: '4px 10px', borderRadius: '6px',
                              background: 'rgba(16,185,129,0.12)', color: '#34D399',
                              border: '1px solid rgba(16,185,129,0.25)',
                              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.22)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.12)'; }}
                          >
                            <FileText size={10} /> Summarize Minutes
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); handleDraftFollowUp(meeting); }}
                            aria-label={`Draft follow-up for ${meeting.title}`}
                            disabled={aiLoading === 'followup'}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '4px',
                              fontSize: '0.65rem', fontWeight: 700, padding: '4px 10px', borderRadius: '6px',
                              background: 'rgba(14,165,233,0.1)', color: '#38BDF8',
                              border: '1px solid rgba(14,165,233,0.22)',
                              cursor: aiLoading === 'followup' ? 'wait' : 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                              opacity: aiLoading === 'followup' ? 0.6 : 1,
                            }}
                            onMouseEnter={e => { if (!aiLoading) (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.2)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.1)'; }}
                          >
                            {aiLoading === 'followup' ? <><Loader2 size={10} className="animate-spin" /> Drafting...</> : <><Upload size={10} /> Draft Follow-up</>}
                          </button>
                        </div>
                      )}

                      {/* Complete button for upcoming / in-progress */}
                      {(meeting.status === 'Upcoming' || meeting.status === 'In Progress') && (
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                          <button
                            onClick={e => handleMarkComplete(meeting.id, e)}
                            disabled={markingComplete === meeting.id}
                            aria-label={`Mark ${meeting.title} as complete`}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '4px',
                              fontSize: '0.65rem', fontWeight: 700, padding: '4px 10px', borderRadius: '6px',
                              background: 'rgba(16,185,129,0.1)', color: '#34D399',
                              border: '1px solid rgba(16,185,129,0.22)', cursor: 'pointer',
                              fontFamily: 'inherit', transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.2)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.1)'; }}
                          >
                            {markingComplete === meeting.id
                              ? <Loader2 size={10} className="animate-spin" />
                              : <CheckCircle size={10} />
                            }
                            Complete
                          </button>
                        </div>
                      )}

                      {/* Edit / Delete buttons */}
                      <div style={{ display: 'flex', gap: '4px', marginTop: '0.375rem' }}>
                        <button
                          onClick={e => handleToggleStarMeeting(meeting.id, e)}
                          aria-label={`${starredMeetings.has(meeting.id) ? 'Unstar' : 'Star'} meeting: ${meeting.title}`}
                          aria-pressed={starredMeetings.has(meeting.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '3px',
                            fontSize: '0.62rem', fontWeight: 500, padding: '3px 8px', borderRadius: '5px',
                            background: starredMeetings.has(meeting.id) ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)',
                            color: starredMeetings.has(meeting.id) ? '#F59E0B' : '#64748B',
                            border: starredMeetings.has(meeting.id) ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.08)',
                            cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          {starredMeetings.has(meeting.id) ? '⭐' : '☆'}
                        </button>
                        <button
                          onClick={e => handleToggleReminder(meeting.id, e)}
                          aria-label={reminderIds.has(meeting.id) ? `Remove reminder: ${meeting.title}` : `Set reminder: ${meeting.title}`}
                          aria-pressed={reminderIds.has(meeting.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '3px',
                            fontSize: '0.62rem', fontWeight: 500, padding: '3px 8px', borderRadius: '5px',
                            background: reminderIds.has(meeting.id) ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.04)',
                            color: reminderIds.has(meeting.id) ? '#818CF8' : '#64748B',
                            border: reminderIds.has(meeting.id) ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(255,255,255,0.08)',
                            cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          <Bell size={10} /> {reminderIds.has(meeting.id) ? 'Reminded' : 'Remind'}
                        </button>
                        <button
                          onClick={e => openEditModal(meeting, e)}
                          title="Edit meeting"
                          aria-label={`Edit ${meeting.title}`}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '3px',
                            fontSize: '0.62rem', fontWeight: 500, padding: '3px 8px', borderRadius: '5px',
                            background: 'rgba(255,255,255,0.04)', color: '#64748B',
                            border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', fontFamily: 'inherit',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#94A3B8'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#64748B'; }}
                        >
                          <Pencil size={10} /> Edit
                        </button>
                        <button
                          onClick={e => handleCloneMeeting(meeting, e)}
                          title="Clone meeting"
                          aria-label={`Clone ${meeting.title}`}
                          disabled={cloningMeetingId === meeting.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '3px',
                            fontSize: '0.62rem', fontWeight: 500, padding: '3px 8px', borderRadius: '5px',
                            background: 'rgba(14,165,233,0.06)', color: '#38BDF8',
                            border: '1px solid rgba(14,165,233,0.15)', cursor: 'pointer', fontFamily: 'inherit', opacity: cloningMeetingId === meeting.id ? 0.5 : 1,
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.12)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.06)'; }}
                        >
                          <Copy size={10} /> Clone
                        </button>
                        <button
                          onClick={e => handleDeleteMeeting(meeting.id, e)}
                          title="Delete meeting"
                          aria-label={`Delete ${meeting.title}`}
                          disabled={deletingId === meeting.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '3px',
                            fontSize: '0.62rem', fontWeight: 500, padding: '3px 8px', borderRadius: '5px',
                            background: 'rgba(239,68,68,0.06)', color: '#EF4444',
                            border: '1px solid rgba(239,68,68,0.15)', cursor: 'pointer', fontFamily: 'inherit', opacity: deletingId === meeting.id ? 0.5 : 1,
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.12)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.06)'; }}
                        >
                          <Trash2 size={10} /> Delete
                        </button>
                      </div>
                    </div>

                    {/* Right side: avatar stack + chevron */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', flexShrink: 0 }}>
                      <div style={{ display: 'flex' }}>
                        {meeting.participants.slice(0, 3).map((p, i) => (
                          <div key={i} style={{
                            width: '26px', height: '26px', borderRadius: '50%',
                            background: avatarBgs[i % avatarBgs.length],
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.58rem', fontWeight: 700, color: 'white',
                            border: '2px solid var(--bg-elevated)',
                            marginLeft: i > 0 ? '-6px' : 0, zIndex: 4 - i,
                          }}>
                            {p}
                          </div>
                        ))}
                        {meeting.participants.length > 3 && (
                          <div style={{
                            width: '26px', height: '26px', borderRadius: '50%',
                            background: 'rgba(255,255,255,0.08)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.55rem', fontWeight: 700, color: 'var(--text-muted)',
                            border: '2px solid var(--bg-elevated)',
                            marginLeft: '-6px', zIndex: 0,
                          }}>
                            +{meeting.participants.length - 3}
                          </div>
                        )}
                      </div>
                      <ChevronRight size={13} style={{ color: 'var(--text-faint)' }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right Sidebar ────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Mini Calendar */}
          <div className="section-card" style={{ padding: '1rem 1.125rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>{CURRENT_MONTH_LABEL}</span>
              <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: '0.25rem' }}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-faint)', padding: '3px 0', letterSpacing: '0.04em' }}>{d}</div>
              ))}
            </div>
            {[0, 1, 2, 3, 4].map(week => (
              <div key={week} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center' }}>
                {miniCalendar.map((col, dayIdx) => {
                  const date = col.dates[week];
                  const isToday = date === TODAY_DATE;
                  const hasMeeting = date && meetingDates.has(String(date));
                  return (
                    <div key={dayIdx} style={{ padding: '2px 1px' }}>
                      {date && (
                        <>
                          <div style={{
                            width: '24px', height: '24px', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
                            background: isToday ? 'linear-gradient(135deg, #0EA5E9, #00D4FF)' : hasMeeting ? 'rgba(139,92,246,0.12)' : 'transparent',
                            fontSize: '0.7rem', fontWeight: isToday ? 700 : hasMeeting ? 600 : 400,
                            color: isToday ? 'white' : hasMeeting ? '#A78BFA' : 'var(--text-muted)',
                            boxShadow: isToday ? '0 2px 8px rgba(0,212,255,0.3)' : 'none',
                          }}>
                            {date}
                          </div>
                          {hasMeeting && !isToday && (
                            <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#8B5CF6', margin: '2px auto 0' }} />
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="section-card" style={{ padding: '1rem 1.125rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981', boxShadow: '0 0 6px rgba(16,185,129,0.5)' }} />
              <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-primary)' }}>Quick Actions</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                onClick={handleSummarizeMinutes}
                aria-label="Summarize Minutes"
                disabled={aiLoading === 'summarize'}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', width: '100%',
                  fontSize: '0.72rem', fontWeight: 700, padding: '8px 12px', borderRadius: '8px',
                  background: 'rgba(16,185,129,0.1)', color: '#34D399',
                  border: '1px solid rgba(16,185,129,0.22)',
                  cursor: aiLoading === 'summarize' ? 'wait' : 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  opacity: aiLoading === 'summarize' ? 0.6 : 1,
                }}
                onMouseEnter={e => { if (!aiLoading) (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.2)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.1)'; }}
              >
                {aiLoading === 'summarize' ? <><Loader2 size={13} className="animate-spin" /> Summarizing...</> : <><FileText size={13} /> Summarize Minutes</>}
              </button>
              <button
                onClick={() => handleDraftFollowUp()}
                aria-label="Draft Follow-up"
                disabled={aiLoading === 'followup'}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', width: '100%',
                  fontSize: '0.72rem', fontWeight: 700, padding: '8px 12px', borderRadius: '8px',
                  background: 'rgba(14,165,233,0.1)', color: '#38BDF8',
                  border: '1px solid rgba(14,165,233,0.22)',
                  cursor: aiLoading === 'followup' ? 'wait' : 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  opacity: aiLoading === 'followup' ? 0.6 : 1,
                }}
                onMouseEnter={e => { if (!aiLoading) (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.2)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.1)'; }}
              >
                {aiLoading === 'followup' ? <><Loader2 size={13} className="animate-spin" /> Drafting...</> : <><Upload size={13} /> Draft Follow-up</>}
              </button>
              <button
                onClick={handleGenerateReport}
                aria-label="Generate AI Report"
                disabled={aiLoading === 'report'}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', width: '100%',
                  fontSize: '0.72rem', fontWeight: 700, padding: '8px 12px', borderRadius: '8px',
                  background: 'rgba(139,92,246,0.1)', color: '#A78BFA',
                  border: '1px solid rgba(139,92,246,0.22)',
                  cursor: aiLoading === 'report' ? 'wait' : 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  opacity: aiLoading === 'report' ? 0.6 : 1,
                }}
                onMouseEnter={e => { if (!aiLoading) (e.currentTarget as HTMLElement).style.background = 'rgba(139,92,246,0.2)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(139,92,246,0.1)'; }}
              >
                {aiLoading === 'report' ? <><Loader2 size={13} className="animate-spin" /> Generating...</> : <><Sparkles size={13} /> Generate AI Report</>}
              </button>
            </div>
          </div>

          {/* Action Items Panel */}
          <div className="section-card" style={{ padding: '1rem 1.125rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle size={13} style={{ color: '#10B981' }} />
                <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-primary)' }}>Action Items</span>
                {pendingActionItems.length > 0 && (
                  <span style={{
                    fontSize: '0.6rem', fontWeight: 700, padding: '1px 6px', borderRadius: '9999px',
                    background: 'rgba(239,68,68,0.12)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.25)',
                  }}>
                    {pendingActionItems.length} open
                  </span>
                )}
              </div>
              <button
                className="btn-ghost"
                aria-label={showActionPanel ? 'Hide action items form' : 'Add action item'}
                onClick={() => setShowActionPanel(p => !p)}
                style={{ height: '28px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Plus size={11} /> Add
              </button>
            </div>

            {/* Add action item form */}
            {showActionPanel && (
              <div style={{
                background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.12)',
                borderRadius: '8px', padding: '0.75rem', marginBottom: '0.75rem',
                display: 'flex', flexDirection: 'column', gap: '0.5rem',
              }}>
                <input
                  className="input-field"
                  aria-label="Action item description"
                  placeholder="Action item description…"
                  value={newActionText}
                  onChange={e => setNewActionText(e.target.value)}
                  style={{ fontSize: '0.78rem', height: '34px' }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <input
                    className="input-field"
                    aria-label="Owner name"
                    placeholder="Owner"
                    value={newActionOwner}
                    onChange={e => setNewActionOwner(e.target.value)}
                    style={{ fontSize: '0.75rem', height: '32px' }}
                  />
                  <input
                    className="input-field"
                    aria-label="Action item due date"
                    type="date"
                    value={newActionDue}
                    onChange={e => setNewActionDue(e.target.value)}
                    style={{ fontSize: '0.75rem', height: '32px' }}
                  />
                </div>
                <select
                  className="input-field"
                  aria-label="Link to meeting"
                  value={newActionMeetingId}
                  onChange={e => setNewActionMeetingId(e.target.value)}
                  style={{ fontSize: '0.75rem', height: '32px' }}
                >
                  <option value="">No meeting linked</option>
                  {meetings.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
                <button
                  className="btn-primary"
                  aria-label="Save action item"
                  onClick={handleAddActionItem}
                  disabled={!newActionText.trim()}
                  style={{ fontSize: '0.75rem', height: '32px', alignSelf: 'flex-end' }}
                >
                  Save
                </button>
              </div>
            )}

            {/* Action items list */}
            {actionItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1rem 0', color: 'var(--text-faint)', fontSize: '0.75rem' }}>
                No action items yet. Add one above.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {[...pendingActionItems, ...doneActionItems].map(item => (
                  <div
                    key={item.id}
                    data-testid={`action-item-${item.id}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.5rem 0.625rem', borderRadius: '7px',
                      background: item.done ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${item.done ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.06)'}`,
                      opacity: item.done ? 0.7 : 1,
                    }}
                  >
                    <button
                      onClick={() => handleToggleActionItem(item.id)}
                      aria-label={item.done ? `Mark action item incomplete: ${item.text}` : `Mark action item complete: ${item.text}`}
                      style={{
                        background: item.done ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${item.done ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}`,
                        borderRadius: '50%', width: '18px', height: '18px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: item.done ? '#34D399' : 'transparent',
                        flexShrink: 0, padding: 0,
                      }}
                    >
                      {item.done && <CheckCircle size={10} />}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '0.75rem', color: item.done ? 'var(--text-muted)' : 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        textDecoration: item.done ? 'line-through' : 'none',
                      }}>
                        {item.text}
                      </div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-faint)' }}>
                        {item.owner}{item.dueDate ? ` · Due ${new Date(item.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}` : ''}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteActionItem(item.id)}
                      aria-label={`Delete action item: ${item.text}`}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: '2px', display: 'flex', flexShrink: 0 }}
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Assistant Insights */}
          <div className="section-card" style={{ padding: '1rem 1.125rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#A78BFA', boxShadow: '0 0 6px rgba(139,92,246,0.5)' }} />
              <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-primary)' }}>AI Assistant</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {aiInsights.map((insight, i) => (
                <div key={i} style={{
                  display: 'flex', gap: '0.5rem', alignItems: 'flex-start',
                  padding: '0.625rem 0.75rem', borderRadius: '8px',
                  background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.12)',
                }}>
                  <MessageSquareQuote size={12} style={{ color: '#A78BFA', flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.45, fontStyle: 'italic' }}>
                    {insight}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── New Meeting Modal ─────────────────────────────────── */}
      {showNewModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }} onClick={() => { setShowNewModal(false); setEditMeeting(null); }}>
          <div style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)', padding: '1.75rem', width: '100%', maxWidth: '500px',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6)', position: 'relative', overflow: 'hidden',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #8B5CF6, #0EA5E9)' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>{editMeeting ? 'Edit Meeting' : 'New Meeting'}</h2>
                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Schedule and track a meeting</p>
              </div>
              <button onClick={() => { setShowNewModal(false); setEditMeeting(null); }} aria-label="Close meeting modal" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', borderRadius: '6px' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>Meeting Title *</label>
                <input className="input-field" aria-label="Meeting title" placeholder="e.g. NCA Steering Committee #15" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={{ width: '100%' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>Date *</label>
                  <input className="input-field" aria-label="Meeting date" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>Time</label>
                  <input className="input-field" aria-label="Meeting time" type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} style={{ width: '100%' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>Duration</label>
                  <select className="input-field" aria-label="Meeting duration" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} style={{ width: '100%' }}>
                    {['30min', '1h', '1.5h', '2h', '3h'].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>Type</label>
                  <select className="input-field" aria-label="Meeting type" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as MeetingRow['type'] }))} style={{ width: '100%' }}>
                    {['Review', 'Steering', 'Committee', 'Workshop', 'Kickoff', 'Standup'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>Workspace *</label>
                <select className="input-field" aria-label="Meeting workspace" value={form.workspace_id} onChange={e => {
                  const ws = workspaces.find(w => w.id === e.target.value);
                  setForm(f => ({ ...f, workspace_id: e.target.value, workspace: ws?.name || '' }));
                }} style={{ width: '100%' }}>
                  <option value="">Select workspace…</option>
                  {workspaces.map(ws => <option key={ws.id} value={ws.id}>{ws.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>Location</label>
                <input className="input-field" aria-label="Meeting location" placeholder="e.g. Boardroom A / Microsoft Teams" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} style={{ width: '100%' }} />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>Participants (initials, comma-separated)</label>
                <input className="input-field" aria-label="Meeting participants" placeholder="e.g. AM, JL, RT, DN" value={form.participants} onChange={e => setForm(f => ({ ...f, participants: e.target.value }))} style={{ width: '100%' }} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.75rem' }}>
              <button className="btn-ghost" onClick={() => { setShowNewModal(false); setEditMeeting(null); }}>Cancel</button>
              <button className="btn-primary" onClick={handleCreateMeeting} disabled={saving || !form.title || !form.date || !form.workspace_id}>
                {saving ? 'Saving…' : editMeeting ? 'Save Changes' : 'Create Meeting'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clone toast */}
      {cloneToast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 2000,
            background: 'rgba(14,165,233,0.15)', border: '1px solid rgba(14,165,233,0.35)',
            borderRadius: '10px', padding: '0.75rem 1.25rem',
            color: '#38BDF8', fontSize: '0.82rem', fontWeight: 600,
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}
        >
          <Copy size={13} /> {cloneToast}
        </div>
      )}
    </div>
  );
}
