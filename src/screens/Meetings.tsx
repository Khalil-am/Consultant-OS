import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Video, Clock, CheckCircle, FileText, ChevronRight,
  Calendar, MapPin, Search, Loader2, X, Pencil, Trash2, Monitor, Sparkles,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useLayout } from '../hooks/useLayout';
import {
  getMeetings, updateMeeting, upsertMeeting, deleteMeeting, getWorkspaces, upsertDocument,
} from '../lib/db';
import type { MeetingRow, WorkspaceRow } from '../lib/db';
import { chatWithDocument } from '../lib/openrouter';
import { Badge, cn, fadeUp, stagger } from '../components/ui';

const filterTabs = ['All', 'Upcoming', 'Completed', 'Needs Action'] as const;
type Filter = typeof filterTabs[number];

const typeColor: Record<string, string> = {
  Workshop: '#7DD3FC', Committee: '#A78BFA', Steering: '#FF6B6B',
  Review: '#34D399', Kickoff: '#C4B5FD', Standup: '#8790A8',
};

const avatarBgs = ['#7877C6', '#A78BFA', '#34D399', '#F5B544', '#FF6B6B'];

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function parseDateBadge(dateStr: string) {
  const parts = dateStr.split('-');
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return { month: MONTHS[monthIdx] || 'JAN', day: isNaN(day) ? 0 : day };
}

function isVirtualLocation(loc: string | null | undefined): boolean {
  if (!loc) return false;
  const lower = loc.toLowerCase();
  return ['teams', 'zoom', 'virtual', 'online', 'meet', 'webex'].some((k) => lower.includes(k));
}

function statusTone(s: string): 'review' | 'success' | 'critical' | 'neutral' {
  if (s === 'Upcoming') return 'review';
  if (s === 'Completed') return 'success';
  if (s === 'In Progress') return 'critical';
  return 'neutral';
}

export default function Meetings() {
  const navigate = useNavigate();
  const { isMobile } = useLayout();
  const [activeFilter, setActiveFilter] = useState<Filter>('All');
  const [search, setSearch] = useState('');
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editMeeting, setEditMeeting] = useState<MeetingRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [markingComplete, setMarkingComplete] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: '', date: '', time: '09:00', duration: '1h',
    type: 'Review' as MeetingRow['type'],
    workspace: '', workspace_id: '', location: '', participants: '',
  });

  useEffect(() => {
    getMeetings().then((data) => { setMeetings(data); setLoading(false); }).catch(() => setLoading(false));
    getWorkspaces().then(setWorkspaces).catch(() => {});
  }, []);

  function resetForm() {
    setForm({ title: '', date: '', time: '09:00', duration: '1h', type: 'Review', workspace: '', workspace_id: '', location: '', participants: '' });
  }

  function openEditModal(m: MeetingRow, e: React.MouseEvent) {
    e.stopPropagation();
    setEditMeeting(m);
    setForm({
      title: m.title, date: m.date, time: m.time || '09:00', duration: m.duration || '1h',
      type: m.type, workspace: m.workspace, workspace_id: m.workspace_id || '',
      location: m.location || '', participants: (m.participants || []).join(', '),
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.title || !form.date || !form.workspace_id) return;
    setSaving(true);
    try {
      if (editMeeting) {
        const updated = await updateMeeting(editMeeting.id, {
          title: form.title, date: form.date, time: form.time, duration: form.duration,
          type: form.type, workspace: form.workspace, workspace_id: form.workspace_id,
          participants: form.participants.split(',').map((p) => p.trim()).filter(Boolean),
          location: form.location || null,
        });
        setMeetings((prev) => prev.map((m) => (m.id === editMeeting.id ? updated : m)));
      } else {
        const created = await upsertMeeting({
          id: crypto.randomUUID(),
          title: form.title, date: form.date, time: form.time, duration: form.duration,
          type: form.type, status: 'Upcoming', workspace: form.workspace, workspace_id: form.workspace_id,
          participants: form.participants.split(',').map((p) => p.trim()).filter(Boolean),
          location: form.location || null, minutes_generated: false,
          actions_extracted: 0, decisions_logged: 0, agenda: null, quorum_status: null,
        });
        setMeetings((prev) => [created, ...prev]);
      }
      setShowModal(false);
      setEditMeeting(null);
      resetForm();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Delete this meeting?')) return;
    setDeletingId(id);
    try {
      await deleteMeeting(id);
      setMeetings((prev) => prev.filter((m) => m.id !== id));
    } catch { /* ignore */ }
    finally { setDeletingId(null); }
  }

  async function handleMarkComplete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setMarkingComplete(id);
    try {
      await updateMeeting(id, { status: 'Completed' });
      setMeetings((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'Completed' } : m)));
    } catch { /* ignore */ }
    finally { setMarkingComplete(null); }
  }

  function buildContext(m: MeetingRow): string {
    return `Title: ${m.title}\nDate: ${m.date}\nTime: ${m.time}\nDuration: ${m.duration}\nType: ${m.type}\nStatus: ${m.status}\nWorkspace: ${m.workspace}\nParticipants: ${(m.participants || []).join(', ')}\nLocation: ${m.location || 'N/A'}`;
  }

  async function handleSummarizeMinutes() {
    const target = meetings.find((m) => m.status === 'Completed' && !m.minutes_generated);
    if (!target) { alert('No completed meetings pending minutes summarization.'); return; }
    setAiLoading('summarize');
    try {
      await chatWithDocument(
        [{ role: 'user', content: `Generate meeting minutes for:\n${buildContext(target)}` }],
        'You are a meeting analyst. Generate professional meeting minutes.',
      );
      await updateMeeting(target.id, { minutes_generated: true });
      setMeetings((prev) => prev.map((m) => (m.id === target.id ? { ...m, minutes_generated: true } : m)));
      navigate(`/meetings/${target.id}`);
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally { setAiLoading(null); }
  }

  async function handleDraftFollowUp(target: MeetingRow) {
    setAiLoading('followup');
    try {
      const result = await chatWithDocument(
        [{ role: 'user', content: `Draft a professional follow-up email for this meeting:\n${buildContext(target)}` }],
        'You are a professional consultant. Draft a concise follow-up email.',
      );
      await upsertDocument({
        id: crypto.randomUUID(),
        name: `Follow-up: ${target.title}`,
        type: 'Meeting Minutes', type_color: '#34D399',
        workspace: target.workspace, workspace_id: target.workspace_id ?? '',
        date: new Date().toISOString().slice(0, 10), language: 'EN', status: 'Draft',
        size: `${Math.ceil(result.length / 100) * 0.1} KB`,
        author: 'Consultant OS AI', pages: 1, summary: result,
        tags: ['follow-up', 'meeting', 'AI-generated'], file_url: null,
      }).catch(() => {});
      try { await navigator.clipboard.writeText(result); alert('Follow-up drafted and saved. Copied to clipboard.'); }
      catch { alert(result); }
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally { setAiLoading(null); }
  }

  const upcomingCount = meetings.filter((m) => m.status === 'Upcoming').length;
  const completedCount = meetings.filter((m) => m.status === 'Completed').length;
  const pendingMinutes = meetings.filter((m) => m.status === 'Completed' && !m.minutes_generated).length;

  const filtered = useMemo(() => meetings.filter((m) => {
    const matchesFilter = activeFilter === 'All'
      ? true
      : activeFilter === 'Needs Action'
      ? (m.status === 'Completed' && !m.minutes_generated)
      : m.status === activeFilter;
    const q = search.toLowerCase();
    const matchesSearch = !q || m.title.toLowerCase().includes(q) || m.workspace.toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  }), [meetings, activeFilter, search]);

  return (
    <motion.div
      initial="hidden" animate="show"
      variants={{ hidden: {}, show: { transition: stagger(0.05, 0.08) } }}
      className="screen-container"
    >
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-[1.5rem] md:text-[1.75rem] font-semibold tracking-[-0.025em] leading-tight text-white">Meetings</h1>
          <p className="text-[0.78rem] text-[color:var(--text-muted)] mt-1">
            {meetings.length} total · {upcomingCount} upcoming · {completedCount} completed
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex items-center gap-2 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-md px-3.5 h-[38px] w-full sm:w-[260px]">
            <Search size={14} className="text-[color:var(--text-muted)] flex-shrink-0" />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search meetings…"
              className="flex-1 bg-transparent border-0 outline-none text-[0.83rem] text-white placeholder:text-[color:var(--text-faint)] min-w-0"
            />
          </div>
          <button type="button" onClick={() => { setEditMeeting(null); resetForm(); setShowModal(true); }} className="btn-primary">
            <Plus size={14} /> New Meeting
          </button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div
        variants={{ hidden: {}, show: { transition: stagger(0.04, 0.05) } }}
        className={cn('grid gap-3', isMobile ? 'grid-cols-2' : 'grid-cols-4')}
      >
        {[
          { label: 'Total Meetings', value: meetings.length, color: '#A78BFA', Icon: Video },
          { label: 'Upcoming',       value: upcomingCount,   color: '#7DD3FC', Icon: Calendar },
          { label: 'Completed',      value: completedCount,  color: '#34D399', Icon: CheckCircle },
          { label: 'Pending Minutes',value: pendingMinutes,  color: '#F5B544', Icon: FileText },
        ].map((s) => {
          const Icon = s.Icon;
          return (
            <motion.div
              key={s.label}
              variants={fadeUp}
              className="rounded-2xl bg-white/[0.025] border border-white/[0.06] p-3.5"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="text-[0.62rem] font-semibold tracking-[0.1em] uppercase text-[color:var(--text-muted)]">{s.label}</div>
                <Icon size={14} style={{ color: s.color }} className="opacity-70" />
              </div>
              <div className="text-[1.25rem] md:text-[1.4rem] font-bold tabular-nums leading-none" style={{ color: s.color }}>{s.value}</div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Filter pills */}
      <motion.div variants={fadeUp} className="flex items-center gap-1.5 flex-wrap">
        {filterTabs.map((tab) => {
          const label = tab === 'All' ? 'All Meetings' : tab;
          const count = tab === 'All'
            ? meetings.length
            : tab === 'Needs Action'
            ? pendingMinutes
            : meetings.filter((m) => m.status === tab).length;
          const isActive = activeFilter === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveFilter(tab)}
              aria-label={label}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[0.76rem] font-medium transition-colors border',
                isActive
                  ? 'bg-[rgba(120,119,198,0.18)] text-white border-[rgba(120,119,198,0.35)]'
                  : 'bg-white/[0.025] border-white/[0.06] text-[color:var(--text-muted)] hover:text-white hover:bg-white/[0.05]',
              )}
            >
              {label}
              {count > 0 && (
                <span aria-hidden className={cn('text-[0.62rem] tabular-nums font-bold', isActive ? 'text-[#C4B5FD]' : 'text-[color:var(--text-faint)]')}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
        <div className="ml-auto">
          <button
            type="button"
            onClick={handleSummarizeMinutes}
            disabled={aiLoading === 'summarize'}
            className="flex items-center gap-1.5 text-[0.75rem] font-medium text-[color:var(--text-muted)] hover:text-white transition-colors disabled:opacity-50"
          >
            {aiLoading === 'summarize' ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            Summarize minutes
          </button>
        </div>
      </motion.div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-14 text-[color:var(--text-muted)] text-[0.82rem]">
          <Loader2 size={15} className="animate-spin" /> Loading meetings…
        </div>
      ) : filtered.length === 0 ? (
        <motion.div variants={fadeUp} className="section-card p-12 flex flex-col items-center gap-2 text-center">
          <Video size={26} className="text-[color:var(--text-faint)]" />
          <div className="text-[0.92rem] font-semibold text-white">No meetings found</div>
          <div className="text-[0.76rem] text-[color:var(--text-muted)] max-w-md">Adjust filters or create a new meeting.</div>
        </motion.div>
      ) : (
        <motion.div
          variants={{ hidden: {}, show: { transition: stagger(0.035, 0.05) } }}
          className="space-y-2.5"
        >
          {filtered.map((meeting) => {
            const tc = typeColor[meeting.type] ?? '#8790A8';
            const dateBadge = parseDateBadge(meeting.date);
            const virtual = isVirtualLocation(meeting.location);
            return (
              <motion.div
                key={meeting.id}
                variants={fadeUp}
                whileHover={{ y: -2, transition: { type: 'spring', stiffness: 320, damping: 24 } }}
                onClick={() => navigate(`/meetings/${meeting.id}`)}
                className="section-card cursor-pointer transition-colors"
              >
                <div className={cn('flex items-start gap-3.5 p-4', isMobile && 'p-3')}>
                  {/* Date chip */}
                  <div
                    className="w-[52px] min-w-[52px] flex-shrink-0 rounded-xl flex flex-col items-center justify-center p-2 border"
                    style={{ background: `${tc}18`, borderColor: `${tc}35`, color: tc }}
                  >
                    <span className="text-[0.58rem] font-bold uppercase tracking-[0.08em] leading-none">{dateBadge.month}</span>
                    <span className="text-[1.25rem] font-bold leading-tight">{dateBadge.day}</span>
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <h3 className="text-[0.9rem] font-semibold text-white truncate flex-1 min-w-0">{meeting.title}</h3>
                      <Badge tone={statusTone(meeting.status)}>{meeting.status}</Badge>
                    </div>

                    <div className="flex items-center gap-3 text-[0.72rem] text-[color:var(--text-muted)] flex-wrap mb-2">
                      <span className="flex items-center gap-1"><Clock size={11} />{meeting.time} · {meeting.duration}</span>
                      {meeting.location && (
                        <span className="flex items-center gap-1">
                          {virtual ? <Monitor size={11} /> : <MapPin size={11} />}
                          <span className="truncate max-w-[180px]">{meeting.location}</span>
                        </span>
                      )}
                      <span className="text-[color:var(--text-secondary)] font-semibold truncate max-w-[160px]">{meeting.workspace}</span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(meeting.status === 'Upcoming' || meeting.status === 'In Progress') && (
                        <button
                          type="button"
                          onClick={(e) => handleMarkComplete(meeting.id, e)}
                          disabled={markingComplete === meeting.id}
                          className="flex items-center gap-1 text-[0.66rem] font-semibold px-2.5 py-1 rounded-lg bg-[rgba(52,211,153,0.12)] text-[#34D399] border border-[rgba(52,211,153,0.25)] hover:bg-[rgba(52,211,153,0.2)] transition-colors"
                        >
                          {markingComplete === meeting.id ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />}
                          Complete
                        </button>
                      )}
                      {meeting.status === 'Completed' && !meeting.minutes_generated && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDraftFollowUp(meeting); }}
                          disabled={aiLoading === 'followup'}
                          className="flex items-center gap-1 text-[0.66rem] font-semibold px-2.5 py-1 rounded-lg bg-[rgba(120,119,198,0.1)] text-[#A78BFA] border border-[rgba(120,119,198,0.25)] hover:bg-[rgba(120,119,198,0.2)] transition-colors"
                        >
                          {aiLoading === 'followup' ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                          Draft follow-up
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => openEditModal(meeting, e)}
                        title="Edit meeting"
                        className="flex items-center gap-1 text-[0.66rem] font-medium px-2 py-1 rounded-lg text-[color:var(--text-muted)] hover:text-white hover:bg-white/[0.05] transition-colors"
                      >
                        <Pencil size={10} /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(meeting.id, e)}
                        title="Delete meeting"
                        disabled={deletingId === meeting.id}
                        className="flex items-center gap-1 text-[0.66rem] font-medium px-2 py-1 rounded-lg text-[#FCA5A5] hover:bg-[rgba(255,107,107,0.08)] transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={10} /> Delete
                      </button>
                    </div>
                  </div>

                  {/* Right: avatars + chevron */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <div className="flex">
                      {meeting.participants.slice(0, 3).map((p, i) => (
                        <div
                          key={i}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[0.58rem] font-bold text-white ring-2 ring-[color:var(--bg-base)]"
                          style={{ background: avatarBgs[i % avatarBgs.length], marginLeft: i > 0 ? -6 : 0, zIndex: 3 - i }}
                        >
                          {p}
                        </div>
                      ))}
                      {meeting.participants.length > 3 && (
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[0.55rem] font-bold text-[color:var(--text-muted)] bg-white/[0.08] ring-2 ring-[color:var(--bg-base)] -ml-1.5">
                          +{meeting.participants.length - 3}
                        </div>
                      )}
                    </div>
                    <ChevronRight size={14} className="text-[color:var(--text-faint)]" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* ── Meeting Modal ─────────────────────────── */}
      {showModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => { setShowModal(false); setEditMeeting(null); }}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-elevated w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-[1.05rem] font-semibold text-white tracking-tight">{editMeeting ? 'Edit Meeting' : 'New Meeting'}</h2>
                <p className="text-[0.76rem] text-[color:var(--text-muted)] mt-0.5">Schedule and track a meeting.</p>
              </div>
              <button
                type="button"
                onClick={() => { setShowModal(false); setEditMeeting(null); }}
                className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[color:var(--text-muted)] hover:bg-white/[0.08] hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-3.5">
              <Field label="Meeting title *">
                <input className="input-field" placeholder="e.g. NCA Steering Committee #15" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date *">
                  <input className="input-field" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
                </Field>
                <Field label="Time">
                  <input className="input-field" type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Duration">
                  <select className="input-field" value={form.duration} onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}>
                    {['30min', '1h', '1.5h', '2h', '3h'].map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="Type">
                  <select className="input-field" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as MeetingRow['type'] }))}>
                    {['Review', 'Steering', 'Committee', 'Workshop', 'Kickoff', 'Standup'].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Workspace *">
                <select
                  className="input-field"
                  value={form.workspace_id}
                  onChange={(e) => {
                    const ws = workspaces.find((w) => w.id === e.target.value);
                    setForm((f) => ({ ...f, workspace_id: e.target.value, workspace: ws?.name || '' }));
                  }}
                >
                  <option value="">Select workspace…</option>
                  {workspaces.map((ws) => <option key={ws.id} value={ws.id}>{ws.name}</option>)}
                </select>
              </Field>
              <Field label="Location">
                <input className="input-field" placeholder="e.g. Boardroom A / Microsoft Teams" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
              </Field>
              <Field label="Participants (initials, comma-separated)">
                <input className="input-field" placeholder="e.g. AM, JL, RT, DN" value={form.participants} onChange={(e) => setForm((f) => ({ ...f, participants: e.target.value }))} />
              </Field>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" className="btn-ghost" onClick={() => { setShowModal(false); setEditMeeting(null); }}>Cancel</button>
                <button type="button" className="btn-primary min-w-[150px] justify-center" onClick={handleSave} disabled={saving || !form.title || !form.date || !form.workspace_id}>
                  {saving ? 'Saving…' : editMeeting ? 'Save Changes' : 'Create Meeting'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[0.7rem] font-semibold tracking-[0.08em] uppercase text-[color:var(--text-muted)] mb-1.5">{label}</label>
      {children}
    </div>
  );
}
