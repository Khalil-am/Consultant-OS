import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLayout } from '../hooks/useLayout';
import {
  Plus, Video, Users, Clock, CheckCircle, FileText,
  ChevronRight, Calendar, MapPin, Search, Upload,
  Loader2, X, Pencil, Trash2,
} from 'lucide-react';
import { getMeetings, updateMeeting, upsertMeeting, deleteMeeting, getWorkspaces } from '../lib/db';
import type { MeetingRow, WorkspaceRow } from '../lib/db';

const filterTabs = ['All', 'Upcoming', 'In Progress', 'Completed', 'Committee'];

const typeColors: Record<string, { bg: string; text: string; border: string; accent: string }> = {
  Workshop:  { bg: 'rgba(14,165,233,0.1)',   text: '#38BDF8',  border: 'rgba(14,165,233,0.22)',  accent: '#0EA5E9' },
  Committee: { bg: 'rgba(139,92,246,0.12)',  text: '#A78BFA',  border: 'rgba(139,92,246,0.25)',  accent: '#8B5CF6' },
  Steering:  { bg: 'rgba(239,68,68,0.1)',    text: '#FCA5A5',  border: 'rgba(239,68,68,0.22)',   accent: '#EF4444' },
  Review:    { bg: 'rgba(16,185,129,0.1)',   text: '#34D399',  border: 'rgba(16,185,129,0.22)',  accent: '#10B981' },
  Kickoff:   { bg: 'rgba(0,212,255,0.1)',    text: '#00D4FF',  border: 'rgba(0,212,255,0.22)',   accent: '#00D4FF' },
  Standup:   { bg: 'rgba(148,163,184,0.08)', text: '#94A3B8',  border: 'rgba(148,163,184,0.15)', accent: '#475569' },
};

const avatarBgs = ['#0EA5E9', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'];

// Current month calendar (March 2026)
const miniCalendar = [
  { day: 'Sun', dates: [1, 8, 15, 22, 29] },
  { day: 'Mon', dates: [2, 9, 16, 23, 30] },
  { day: 'Tue', dates: [3, 10, 17, 24, 31] },
  { day: 'Wed', dates: [4, 11, 18, 25] },
  { day: 'Thu', dates: [5, 12, 19, 26] },
  { day: 'Fri', dates: [6, 13, 20, 27] },
  { day: 'Sat', dates: [7, 14, 21, 28] },
];
const TODAY_DATE = 17;

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
  const [form, setForm] = useState({
    title: '', date: '', time: '09:00', duration: '1h', type: 'Review' as MeetingRow['type'],
    workspace: '', workspace_id: '', location: '', participants: '',
  });

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

  // ── Derived stats ──────────────────────────────────────────
  const upcomingCount   = meetings.filter(m => m.status === 'Upcoming').length;
  const completedCount  = meetings.filter(m => m.status === 'Completed').length;
  const minutesCount    = meetings.filter(m => m.minutes_generated).length;
  const inProgressCount = meetings.filter(m => m.status === 'In Progress').length;

  const statsCards = [
    { label: 'Total Meetings',    value: meetings.length,   color: '#8B5CF6', sub: `${inProgressCount} in progress` },
    { label: 'Upcoming',          value: upcomingCount,     color: '#0EA5E9', sub: 'scheduled' },
    { label: 'Completed',         value: completedCount,    color: '#10B981', sub: 'this period' },
    { label: 'Minutes Uploaded',  value: minutesCount,      color: '#F59E0B', sub: `${completedCount > 0 ? Math.round((minutesCount / completedCount) * 100) : 0}% coverage` },
  ];

  // ── Meeting dates for calendar (derive from real data) ─────
  const meetingDates = new Set(
    meetings
      .filter(m => m.date.startsWith('2026-03'))
      .map(m => String(parseInt(m.date.slice(8))))
  );

  const filtered = meetings.filter(m => {
    const matchesFilter = activeFilter === 'All'
      ? true
      : activeFilter === 'Committee'
      ? (m.type === 'Committee' || m.type === 'Steering')
      : m.status === activeFilter;
    const matchesSearch = !search
      || m.title.toLowerCase().includes(search.toLowerCase())
      || m.workspace.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="screen-container animate-fade-in">

      {/* ── Stats Strip ──────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${width >= 768 ? 4 : 2}, 1fr)`, gap: '0.875rem' }}>
        {statsCards.map(s => (
          <div key={s.label} className="metric-card" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${s.color}, transparent)` }} />
            <div className="hero-number" style={{ color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', marginTop: '2px' }}>{s.label}</div>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-faint)', marginTop: '1px' }}>{s.sub}</div>
          </div>
        ))}
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
                placeholder="Search meetings…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: '2.25rem', height: '36px', fontSize: '0.8rem' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(255,255,255,0.03)', padding: '0.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', overflowX: 'auto' }}>
              {filterTabs.map(tab => (
                <button key={tab} className={`tab-item ${activeFilter === tab ? 'active' : ''}`} onClick={() => setActiveFilter(tab)} style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                  {tab}
                </button>
              ))}
            </div>
            <button className="btn-primary" style={{ height: '36px', flexShrink: 0 }} onClick={() => setShowNewModal(true)}>
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
                  {/* Accent strip */}
                  <div style={{ height: '2px', background: `linear-gradient(90deg, ${tc.accent} 0%, ${tc.accent}44 60%, transparent 100%)` }} />

                  <div style={{ display: 'flex', alignItems: 'flex-start', padding: '0.875rem 1.125rem', gap: '0.875rem' }}>
                    {/* Icon */}
                    <div style={{
                      width: '42px', height: '42px', borderRadius: '10px', flexShrink: 0,
                      background: tc.bg, border: `1px solid ${tc.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                    }}>
                      <Video size={16} style={{ color: tc.text }} />
                      {meeting.status === 'In Progress' && (
                        <div style={{
                          position: 'absolute', top: '-3px', right: '-3px',
                          width: '10px', height: '10px', borderRadius: '50%',
                          background: '#EF4444', border: '2px solid var(--bg-elevated)',
                          animation: 'pulseDot 2s ease-in-out infinite',
                        }} />
                      )}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Title row */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.375rem' }}>
                        <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {meeting.title}
                        </h3>
                        <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', flexShrink: 0 }}>
                          <span style={{
                            fontSize: '0.68rem', fontWeight: 600, padding: '2px 7px', borderRadius: '9999px',
                            background: tc.bg, color: tc.text, border: `1px solid ${tc.border}`,
                            whiteSpace: 'nowrap',
                          }}>{meeting.type}</span>
                          <StatusBadge status={meeting.status} />
                          {meeting.minutes_generated && (
                            <span style={{
                              fontSize: '0.65rem', fontWeight: 600, padding: '2px 6px', borderRadius: '9999px',
                              background: 'rgba(16,185,129,0.1)', color: '#34D399',
                              display: 'inline-flex', alignItems: 'center', gap: '3px',
                              border: '1px solid rgba(16,185,129,0.2)', whiteSpace: 'nowrap',
                            }}>
                              <FileText size={9} /> Minutes
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Meta */}
                      <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.625rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Calendar size={11} style={{ color: 'var(--text-faint)' }} /> {meeting.date} · {meeting.time}
                        </span>
                        <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Clock size={11} style={{ color: 'var(--text-faint)' }} /> {meeting.duration}
                        </span>
                        {meeting.location && (
                          <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <MapPin size={11} style={{ color: 'var(--text-faint)' }} /> {meeting.location}
                          </span>
                        )}
                        <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Users size={11} style={{ color: 'var(--text-faint)' }} /> {meeting.participants.length} attendees
                        </span>
                      </div>

                      {/* Footer */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        {/* Workspace chip */}
                        <span style={{
                          fontSize: '0.68rem', fontWeight: 500, color: 'var(--text-muted)',
                          padding: '2px 7px', borderRadius: '4px',
                          background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)',
                          maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {meeting.workspace}
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {/* Avatar stack */}
                          <div style={{ display: 'flex' }}>
                            {meeting.participants.slice(0, 4).map((p, i) => (
                              <div key={i} style={{
                                width: '22px', height: '22px', borderRadius: '50%',
                                background: avatarBgs[i % avatarBgs.length],
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.55rem', fontWeight: 700, color: 'white',
                                border: '2px solid var(--bg-elevated)',
                                marginLeft: i > 0 ? '-5px' : 0, zIndex: 4 - i,
                              }}>
                                {p}
                              </div>
                            ))}
                          </div>

                          {/* Mark complete */}
                          {(meeting.status === 'Upcoming' || meeting.status === 'In Progress') && (
                            <button
                              onClick={e => handleMarkComplete(meeting.id, e)}
                              disabled={markingComplete === meeting.id}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '3px',
                                fontSize: '0.65rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px',
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
                          )}

                          {/* Upload minutes → navigates to detail */}
                          <button
                            onClick={e => { e.stopPropagation(); navigate(`/meetings/${meeting.id}`); }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '3px',
                              fontSize: '0.65rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px',
                              background: meeting.minutes_generated ? 'rgba(14,165,233,0.08)' : 'rgba(139,92,246,0.12)',
                              color: meeting.minutes_generated ? '#38BDF8' : '#A78BFA',
                              border: `1px solid ${meeting.minutes_generated ? 'rgba(14,165,233,0.2)' : 'rgba(139,92,246,0.25)'}`,
                              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.8'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                          >
                            <Upload size={10} />
                            {meeting.minutes_generated ? 'View Minutes' : 'Upload Minutes'}
                          </button>

                          {/* Edit */}
                          <button
                            onClick={e => openEditModal(meeting, e)}
                            title="Edit meeting"
                            style={{
                              display: 'flex', alignItems: 'center', gap: '3px',
                              fontSize: '0.65rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px',
                              background: 'rgba(14,165,233,0.08)', color: '#38BDF8',
                              border: '1px solid rgba(14,165,233,0.2)',
                              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                            }}
                          >
                            <Pencil size={10} /> Edit
                          </button>

                          {/* Delete */}
                          <button
                            onClick={e => handleDeleteMeeting(meeting.id, e)}
                            disabled={deletingId === meeting.id}
                            title="Delete meeting"
                            style={{
                              display: 'flex', alignItems: 'center', gap: '3px',
                              fontSize: '0.65rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px',
                              background: 'rgba(239,68,68,0.08)', color: '#FCA5A5',
                              border: '1px solid rgba(239,68,68,0.18)',
                              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                            }}
                          >
                            {deletingId === meeting.id ? <Loader2 size={10} /> : <Trash2 size={10} />}
                          </button>

                          <ChevronRight size={13} style={{ color: 'var(--text-faint)' }} />
                        </div>
                      </div>
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
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>March 2026</span>
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

          {/* Upcoming Meetings quick-list */}
          <div className="section-card">
            <div className="section-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#0EA5E9', boxShadow: '0 0 6px rgba(14,165,233,0.5)' }} />
                <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-primary)' }}>Upcoming</span>
              </div>
              <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', padding: '2px 7px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                {upcomingCount}
              </span>
            </div>
            {meetings.filter(m => m.status === 'Upcoming' || m.status === 'In Progress').slice(0, 5).length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-faint)' }}>No upcoming meetings</div>
            ) : (
              <div>
                {meetings.filter(m => m.status === 'Upcoming' || m.status === 'In Progress').slice(0, 5).map((m, i, arr) => {
                  const tc = typeColors[m.type] || typeColors.Standup;
                  return (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                        padding: '0.75rem 1.125rem',
                        borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        cursor: 'pointer', transition: 'background 0.15s',
                      }}
                      onClick={() => navigate(`/meetings/${m.id}`)}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ width: '3px', minHeight: '36px', borderRadius: '9999px', background: tc.accent, flexShrink: 0, marginTop: '2px' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>{m.date} · {m.time} · {m.duration}</div>
                      </div>
                      <span style={{ fontSize: '0.62rem', fontWeight: 600, padding: '2px 6px', borderRadius: '9999px', background: tc.bg, color: tc.text, border: `1px solid ${tc.border}`, flexShrink: 0 }}>
                        {m.type}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Minutes coverage */}
          <div className="section-card" style={{ padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
              <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-primary)' }}>Minutes Coverage</span>
              <FileText size={13} style={{ color: '#F59E0B' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <div style={{ flex: 1, height: '6px', borderRadius: '9999px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: '9999px',
                  width: completedCount > 0 ? `${Math.round((minutesCount / completedCount) * 100)}%` : '0%',
                  background: 'linear-gradient(90deg, #F59E0B, #FCD34D)',
                  transition: 'width 0.5s',
                }} />
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#FCD34D', flexShrink: 0 }}>
                {completedCount > 0 ? Math.round((minutesCount / completedCount) * 100) : 0}%
              </span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-faint)' }}>
              {minutesCount} of {completedCount} completed meetings have minutes uploaded
            </div>
            {completedCount > minutesCount && (
              <button
                className="btn-ghost"
                style={{ marginTop: '0.75rem', width: '100%', justifyContent: 'center', fontSize: '0.72rem', height: '28px' }}
                onClick={() => setActiveFilter('Completed')}
              >
                View {completedCount - minutesCount} without minutes
              </button>
            )}
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
              <button onClick={() => { setShowNewModal(false); setEditMeeting(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', borderRadius: '6px' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>Meeting Title *</label>
                <input className="input-field" placeholder="e.g. NCA Steering Committee #15" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={{ width: '100%' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>Date *</label>
                  <input className="input-field" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>Time</label>
                  <input className="input-field" type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} style={{ width: '100%' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>Duration</label>
                  <select className="input-field" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} style={{ width: '100%' }}>
                    {['30min', '1h', '1.5h', '2h', '3h'].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>Type</label>
                  <select className="input-field" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as MeetingRow['type'] }))} style={{ width: '100%' }}>
                    {['Review', 'Steering', 'Committee', 'Workshop', 'Kickoff', 'Standup'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>Workspace *</label>
                <select className="input-field" value={form.workspace_id} onChange={e => {
                  const ws = workspaces.find(w => w.id === e.target.value);
                  setForm(f => ({ ...f, workspace_id: e.target.value, workspace: ws?.name || '' }));
                }} style={{ width: '100%' }}>
                  <option value="">Select workspace…</option>
                  {workspaces.map(ws => <option key={ws.id} value={ws.id}>{ws.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>Location</label>
                <input className="input-field" placeholder="e.g. Boardroom A / Microsoft Teams" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} style={{ width: '100%' }} />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>Participants (initials, comma-separated)</label>
                <input className="input-field" placeholder="e.g. AM, JL, RT, DN" value={form.participants} onChange={e => setForm(f => ({ ...f, participants: e.target.value }))} style={{ width: '100%' }} />
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
    </div>
  );
}
