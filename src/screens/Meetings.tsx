import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLayout } from '../hooks/useLayout';
import {
  Plus, Video, Users, Clock, CheckCircle, FileText,
  ChevronRight, Calendar, MapPin, Activity, TrendingUp, Search,
  Upload, Check, Loader2, ExternalLink,
} from 'lucide-react';
import { getMeetings, updateMeeting, upsertMeeting, upsertDocument, getWorkspaces } from '../lib/db';
import type { MeetingRow, WorkspaceRow } from '../lib/db';
import { supabase } from '../lib/supabase';
import { X } from 'lucide-react';

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

const miniCalendar = [
  { day: 'Sun', dates: [1, 8, 15, 22, 29] },
  { day: 'Mon', dates: [2, 9, 16, 23, 30] },
  { day: 'Tue', dates: [3, 10, 17, 24, 31] },
  { day: 'Wed', dates: [4, 11, 18, 25] },
  { day: 'Thu', dates: [5, 12, 19, 26] },
  { day: 'Fri', dates: [6, 13, 20, 27] },
  { day: 'Sat', dates: [7, 14, 21, 28] },
];

const meetingDates = new Set(['14', '15', '18', '20', '22']);

const pendingFollowUps = [
  { title: 'Share updated risk register with NCA steering committee', meeting: 'NCA Steering #14', due: '16 Mar 2026', owner: 'AM', urgent: true },
  { title: 'Confirm Smart City Package 3 new contractor mobilization plan', meeting: 'Smart City PMO Review', due: '18 Mar 2026', owner: 'JL', urgent: true },
  { title: 'Circulate ADNOC ERP integration scope document for sign-off', meeting: 'ADNOC Kickoff', due: '20 Mar 2026', owner: 'RT', urgent: false },
  { title: 'Update ENB UAT test results dashboard and share with client', meeting: 'ENB Progress Review', due: '22 Mar 2026', owner: 'DN', urgent: false },
];

const governanceMetrics = [
  { label: 'Decision Velocity', value: '7.2', unit: '/meeting', color: '#00D4FF' },
  { label: 'Action Closure Rate', value: '84%', unit: 'this quarter', color: '#10B981' },
  { label: 'Quorum Achievement', value: '100%', unit: 'last 30 days', color: '#8B5CF6' },
  { label: 'Avg. Attendance', value: '7.3', unit: 'participants', color: '#F59E0B' },
];

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

// ── Minutes upload modal state ────────────────────────────────
interface MinutesForm {
  meetingId: string;
  meetingTitle: string;
  workspaceId: string;
  workspaceName: string;
  text: string;
  author: string;
  file: File | null;
}
const emptyMinutesForm: MinutesForm = {
  meetingId: '', meetingTitle: '', workspaceId: '', workspaceName: '', text: '', author: '', file: null,
};

export default function Meetings() {
  const navigate = useNavigate();
  const { width, isMobile, isTablet } = useLayout();
  const [activeFilter, setActiveFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '', date: '', time: '09:00', duration: '1h', type: 'Review' as MeetingRow['type'],
    workspace: '', workspace_id: '', location: '', participants: '',
  });

  // Minutes upload
  const [minutesForm, setMinutesForm] = useState<MinutesForm>(emptyMinutesForm);
  const [showMinutesModal, setShowMinutesModal] = useState(false);
  const [uploadingMinutes, setUploadingMinutes] = useState(false);
  const [minutesSaved, setMinutesSaved] = useState<string | null>(null); // docId
  const [minutesError, setMinutesError] = useState('');
  const [markingComplete, setMarkingComplete] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getMeetings().then(data => { setMeetings(data); setLoading(false); }).catch(() => setLoading(false));
    getWorkspaces().then(setWorkspaces).catch(() => {});
  }, []);

  async function handleCreateMeeting() {
    if (!form.title || !form.date || !form.workspace_id) return;
    setSaving(true);
    try {
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
      setShowNewModal(false);
      setForm({ title: '', date: '', time: '09:00', duration: '1h', type: 'Review', workspace: '', workspace_id: '', location: '', participants: '' });
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  // ── Mark meeting complete ────────────────────────────────
  async function handleMarkComplete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setMarkingComplete(id);
    try {
      await updateMeeting(id, { status: 'Completed' });
      setMeetings(prev => prev.map(m => m.id === id ? { ...m, status: 'Completed' } : m));
    } catch { /* ignore */ }
    finally { setMarkingComplete(null); }
  }

  // ── Open upload minutes modal ────────────────────────────
  function openMinutesModal(meeting: MeetingRow, e: React.MouseEvent) {
    e.stopPropagation();
    setMinutesForm({
      meetingId: meeting.id,
      meetingTitle: meeting.title,
      workspaceId: meeting.workspace_id,
      workspaceName: meeting.workspace,
      text: '',
      author: '',
      file: null,
    });
    setMinutesSaved(null);
    setMinutesError('');
    setShowMinutesModal(true);
  }

  // ── Save minutes to workspace ────────────────────────────
  async function handleSaveMinutes() {
    if (!minutesForm.meetingId) return;
    setUploadingMinutes(true);
    setMinutesError('');
    try {
      let storagePath: string | null = null;
      let fileUrl: string | null = null;

      // Upload file to Supabase Storage if provided
      if (minutesForm.file) {
        const ext = minutesForm.file.name.split('.').pop() ?? 'pdf';
        const path = `${minutesForm.workspaceId}/meetings/${minutesForm.meetingId}/minutes.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('documents')
          .upload(path, minutesForm.file, { upsert: true, contentType: minutesForm.file.type });
        if (upErr) throw upErr;
        storagePath = path;
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);
        fileUrl = urlData.publicUrl;
      }

      // Create document record in workspace
      const today = new Date().toISOString().slice(0, 10);
      const doc = await upsertDocument({
        id: crypto.randomUUID(),
        name: `${minutesForm.meetingTitle} — Meeting Minutes`,
        type: 'Meeting Minutes',
        type_color: '#8B5CF6',
        workspace: minutesForm.workspaceName,
        workspace_id: minutesForm.workspaceId,
        date: today,
        author: minutesForm.author || 'Unknown',
        status: 'Final',
        language: 'EN',
        size: minutesForm.file ? `${Math.round(minutesForm.file.size / 1024)} KB` : `${Math.round((minutesForm.text.length * 2) / 1024) || 1} KB`,
        pages: 1,
        summary: minutesForm.text
          ? minutesForm.text.slice(0, 500)
          : `Meeting minutes for ${minutesForm.meetingTitle}. Filed on ${today}.`,
        tags: ['meeting', 'minutes', 'governance'],
        file_url: fileUrl,
      });

      // Mark meeting minutes_generated = true
      await updateMeeting(minutesForm.meetingId, { minutes_generated: true });
      setMeetings(prev => prev.map(m => m.id === minutesForm.meetingId ? { ...m, minutes_generated: true } : m));

      setMinutesSaved(doc.id);
    } catch (e) {
      setMinutesError(e instanceof Error ? e.message : 'Upload failed. Please try again.');
    } finally {
      setUploadingMinutes(false);
    }
  }

  const statsCards = [
    { label: 'Total Meetings', value: String(meetings.length), color: '#8B5CF6', trend: '+' + meetings.filter(m => m.status === 'Upcoming').length + ' upcoming' },
    { label: 'Decisions Logged', value: String(meetings.reduce((s, m) => s + (m.decisions_logged ?? 0), 0)), color: '#0EA5E9', trend: 'cumulative' },
    { label: 'Actions Extracted', value: String(meetings.reduce((s, m) => s + (m.actions_extracted ?? 0), 0)), color: '#10B981', trend: 'from minutes' },
    { label: 'Completed', value: String(meetings.filter(m => m.status === 'Completed').length), color: '#F59E0B', trend: 'this quarter' },
  ];

  const filtered = meetings.filter(m => {
    const matchesFilter = activeFilter === 'All'
      ? true
      : activeFilter === 'Committee'
      ? (m.type === 'Committee' || m.type === 'Steering')
      : m.status === activeFilter;
    const matchesSearch = !search || m.title.toLowerCase().includes(search.toLowerCase()) || m.workspace.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // suppress unused import warning
  void updateMeeting;

  return (
    <div className="screen-container animate-fade-in">

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${width >= 768 ? 4 : 2}, 1fr)`, gap: '0.875rem' }}>
        {statsCards.map(s => (
          <div key={s.label} className="metric-card" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${s.color}, transparent)` }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.625rem' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{s.label}</div>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#34D399', background: 'rgba(16,185,129,0.1)', padding: '1px 5px', borderRadius: '4px', border: '1px solid rgba(16,185,129,0.2)' }}>{s.trend}</span>
            </div>
            <div className="hero-number" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Governance Health Panel */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(14,165,233,0.05) 0%, var(--bg-elevated) 50%, rgba(139,92,246,0.04) 100%)',
        border: '1px solid rgba(14,165,233,0.12)', borderRadius: 'var(--radius-lg)', padding: '1.125rem 1.5rem',
      }}>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity size={12} style={{ color: '#00D4FF' }} />
          Governance Health Indicators
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${width >= 768 ? 4 : 2}, 1fr)`, gap: '0.75rem' }}>
          {governanceMetrics.map(m => (
            <div key={m.label} className="governance-metric">
              <div className="hero-number" style={{ color: m.color }}>{m.value}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '3px' }}>{m.unit}</div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '5px' }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main 2-col Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: isTablet ? '1fr' : '1fr 300px', gap: '1.25rem', alignItems: 'start' }}>

        {/* Left: Meeting List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
              <Search size={13} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                className="input-field"
                placeholder="Search meetings..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: '2.25rem', height: '36px', fontSize: '0.8rem' }}
              />
            </div>
            {/* Filter pills */}
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
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                Loading meetings…
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-default)' }}>
                <Video size={32} style={{ color: 'var(--text-faint)', marginBottom: '0.75rem', margin: '0 auto 0.75rem' }} />
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>No meetings found</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Adjust your filters or create a new meeting</div>
              </div>
            )}
            {filtered.map((meeting) => {
              const tc = typeColors[meeting.type] || typeColors.Standup;
              return (
                <div
                  key={meeting.id}
                  className="section-card card-hover"
                  style={{ cursor: 'pointer', overflow: 'hidden' }}
                  onClick={() => navigate(`/meetings/${meeting.id}`)}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = tc.border;
                    (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 24px rgba(0,0,0,0.35)`;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)';
                    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                  }}
                >
                  {/* Accent strip */}
                  <div style={{ height: '2px', background: `linear-gradient(90deg, ${tc.accent} 0%, ${tc.accent}44 60%, transparent 100%)` }} />

                  <div style={{ display: 'flex', alignItems: 'flex-start', padding: '0.875rem 1.125rem', gap: '0.875rem' }}>
                    {/* Icon block */}
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
                          {/* Type badge */}
                          <span style={{
                            fontSize: '0.68rem', fontWeight: 600, padding: '2px 7px', borderRadius: '9999px',
                            background: tc.bg, color: tc.text, border: `1px solid ${tc.border}`,
                            letterSpacing: '0.01em', whiteSpace: 'nowrap',
                          }}>{meeting.type}</span>
                          {/* Status badge */}
                          <StatusBadge status={meeting.status} />
                          {meeting.status === 'Completed' && meeting.minutes_generated && (
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

                      {/* Meta row */}
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

                      {/* Footer row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{
                          fontSize: '0.68rem', fontWeight: 500, color: 'var(--text-muted)',
                          padding: '2px 7px', borderRadius: '4px',
                          background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)',
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
                          {/* Action buttons */}
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
                                ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} />
                                : <Check size={10} />
                              }
                              Complete
                            </button>
                          )}
                          {meeting.status === 'Completed' && (
                            <button
                              onClick={e => openMinutesModal(meeting, e)}
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
                              {meeting.minutes_generated ? 'Update Minutes' : 'Upload Minutes'}
                            </button>
                          )}
                          {/* Decision/action counts */}
                          {meeting.status === 'Completed' && (
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              {!!meeting.actions_extracted && (
                                <span style={{ fontSize: '0.63rem', fontWeight: 600, padding: '2px 5px', borderRadius: '4px', background: 'rgba(245,158,11,0.1)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.2)', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                  <CheckCircle size={9} /> {meeting.actions_extracted}a
                                </span>
                              )}
                              {!!meeting.decisions_logged && (
                                <span style={{ fontSize: '0.63rem', fontWeight: 600, padding: '2px 5px', borderRadius: '4px', background: 'rgba(14,165,233,0.1)', color: '#38BDF8', border: '1px solid rgba(14,165,233,0.2)', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                  <TrendingUp size={9} /> {meeting.decisions_logged}d
                                </span>
                              )}
                            </div>
                          )}
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

        {/* Right Sidebar */}
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
                  const isToday = date === 15;
                  const hasMeeting = date && meetingDates.has(String(date));
                  return (
                    <div key={dayIdx} style={{ padding: '2px 1px', cursor: date ? 'pointer' : 'default' }}>
                      {date && (
                        <>
                          <div style={{
                            width: '24px', height: '24px', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto',
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

          {/* Today's Agenda */}
          <div className="section-card">
            <div className="section-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#0EA5E9', boxShadow: '0 0 6px rgba(14,165,233,0.5)' }} />
                <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-primary)' }}>Today's Agenda</span>
              </div>
              <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', padding: '2px 7px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>15 Mar</span>
            </div>
            <div>
              {meetings.filter(m => m.status === 'Upcoming' || m.status === 'In Progress').slice(0, 3).map((m, i, arr) => {
                const tc = typeColors[m.type] || typeColors.Standup;
                return (
                  <div key={m.id}
                    style={{
                      display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                      padding: '0.75rem 1.125rem',
                      borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      cursor: 'pointer', transition: 'background var(--transition-fast)',
                    }}
                    onClick={() => navigate(`/meetings/${m.id}`)}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ width: '3px', minHeight: '36px', borderRadius: '9999px', background: tc.accent, flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>{m.time} · {m.duration}</div>
                    </div>
                    <span style={{ fontSize: '0.62rem', fontWeight: 600, padding: '2px 6px', borderRadius: '9999px', background: tc.bg, color: tc.text, border: `1px solid ${tc.border}`, flexShrink: 0 }}>{m.type}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pending Follow-ups */}
          <div className="section-card">
            <div className="section-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle size={13} style={{ color: '#F59E0B' }} />
                <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-primary)' }}>Pending Follow-ups</span>
              </div>
              <span style={{
                fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: '9999px',
                background: 'rgba(245,158,11,0.12)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.22)',
              }}>
                {pendingFollowUps.length}
              </span>
            </div>
            <div>
              {pendingFollowUps.map((item, i) => (
                <div key={i} style={{
                  padding: '0.75rem 1.125rem',
                  borderBottom: i < pendingFollowUps.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  transition: 'background var(--transition-fast)',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
                    <div style={{
                      width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, marginTop: '5px',
                      background: item.urgent ? '#EF4444' : 'var(--text-faint)',
                      boxShadow: item.urgent ? '0 0 6px rgba(239,68,68,0.5)' : 'none',
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.45, marginBottom: '4px' }}>{item.title}</div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.63rem', color: 'var(--text-muted)' }}>From: {item.meeting}</span>
                        <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'var(--text-faint)', display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.63rem', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>{item.owner}</span>
                        <span style={{ fontSize: '0.63rem', color: item.urgent ? '#FCA5A5' : 'var(--text-muted)' }}>Due {item.due}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Upload Minutes Modal ──────────────────────────── */}
      {showMinutesModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => { if (!uploadingMinutes) setShowMinutesModal(false); }}>
          <div style={{
            background: '#0C1220', border: '1px solid rgba(139,92,246,0.25)',
            borderRadius: '16px', width: '100%', maxWidth: '560px',
            boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }} onClick={e => e.stopPropagation()}>
            {/* accent */}
            <div style={{ height: '2px', background: 'linear-gradient(90deg, #8B5CF6, #0EA5E9)', flexShrink: 0 }} />

            {/* Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: '9px', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Upload size={16} style={{ color: '#A78BFA' }} />
                </div>
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#F1F5F9' }}>Upload Meeting Minutes</div>
                  <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '1px' }}>Save to workspace · Available as AI context</div>
                </div>
              </div>
              <button onClick={() => setShowMinutesModal(false)} disabled={uploadingMinutes}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', cursor: 'pointer', color: '#64748B', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
              {/* Meeting info chip */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <Video size={14} style={{ color: '#8B5CF6', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{minutesForm.meetingTitle}</div>
                  <div style={{ fontSize: '0.68rem', color: '#475569', marginTop: '1px' }}>{minutesForm.workspaceName}</div>
                </div>
                <span style={{ fontSize: '0.62rem', padding: '2px 7px', borderRadius: '4px', background: 'rgba(16,185,129,0.1)', color: '#34D399', border: '1px solid rgba(16,185,129,0.2)', fontWeight: 700 }}>
                  Completed
                </span>
              </div>

              {/* File upload */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '0.5rem' }}>
                  Upload File (PDF / DOCX / TXT)
                </label>
                <div
                  onClick={() => fileRef.current?.click()}
                  style={{
                    border: `2px dashed ${minutesForm.file ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: '10px', padding: '1.25rem', textAlign: 'center', cursor: 'pointer',
                    background: minutesForm.file ? 'rgba(139,92,246,0.06)' : 'rgba(255,255,255,0.02)',
                    transition: 'all 0.2s',
                  }}
                >
                  {minutesForm.file ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.625rem' }}>
                      <FileText size={18} style={{ color: '#A78BFA' }} />
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#A78BFA' }}>{minutesForm.file.name}</div>
                        <div style={{ fontSize: '0.68rem', color: '#475569' }}>{(minutesForm.file.size / 1024).toFixed(1)} KB · click to change</div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload size={20} style={{ color: '#334155', margin: '0 auto 0.5rem' }} />
                      <div style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 600 }}>Drop file or click to browse</div>
                      <div style={{ fontSize: '0.7rem', color: '#334155', marginTop: '3px' }}>PDF, DOCX, TXT, MD — up to 20 MB</div>
                    </>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.docx,.doc,.txt,.md"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const f = e.target.files?.[0] ?? null;
                    setMinutesForm(prev => ({ ...prev, file: f }));
                  }}
                />
              </div>

              {/* OR divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
                <span style={{ fontSize: '0.68rem', color: '#334155', fontWeight: 700, letterSpacing: '0.08em' }}>OR PASTE TEXT</span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
              </div>

              {/* Text minutes */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '0.5rem' }}>
                  Minutes Text Content
                </label>
                <textarea
                  rows={6}
                  placeholder="Paste or type meeting minutes here…&#10;&#10;Include: attendees, agenda items discussed, key decisions, action items, next steps."
                  value={minutesForm.text}
                  onChange={e => setMinutesForm(prev => ({ ...prev, text: e.target.value }))}
                  style={{ width: '100%', padding: '0.75rem', background: '#080C18', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#F1F5F9', fontSize: '0.82rem', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {/* Author */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '0.5rem' }}>
                  Author / Minute-Taker
                </label>
                <input
                  type="text"
                  placeholder="e.g. AM, Sara Al-Khalidi"
                  value={minutesForm.author}
                  onChange={e => setMinutesForm(prev => ({ ...prev, author: e.target.value }))}
                  style={{ width: '100%', padding: '0.6rem 0.875rem', background: '#080C18', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#F1F5F9', fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {/* What happens info */}
              <div style={{ padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.15)' }}>
                <div style={{ fontSize: '0.7rem', color: '#38BDF8', fontWeight: 700, marginBottom: '0.375rem' }}>What happens when you save:</div>
                <ul style={{ margin: 0, paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {[
                    'Document saved to workspace as "Meeting Minutes"',
                    'Available as AI context in Knowledge Base & Automations',
                    'Linked to this meeting for traceability',
                    'Searchable across workflows and reports',
                  ].map(item => (
                    <li key={item} style={{ fontSize: '0.72rem', color: '#64748B' }}>{item}</li>
                  ))}
                </ul>
              </div>

              {/* Error */}
              {minutesError && (
                <div style={{ padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#FCA5A5', fontSize: '0.8rem' }}>
                  {minutesError}
                </div>
              )}

              {/* Success */}
              {minutesSaved && (
                <div style={{ padding: '0.875rem 1rem', borderRadius: '8px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Check size={16} style={{ color: '#34D399', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#34D399' }}>Minutes saved to workspace!</div>
                    <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: '2px' }}>Document created and available as AI context in automations</div>
                  </div>
                  <button
                    onClick={() => navigate('/knowledge')}
                    style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '4px 10px', borderRadius: '6px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#34D399', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
                  >
                    <ExternalLink size={11} /> View
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '0.75rem' }}>
              <button className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowMinutesModal(false)} disabled={uploadingMinutes}>
                {minutesSaved ? 'Close' : 'Cancel'}
              </button>
              {!minutesSaved && (
                <button
                  className="btn-primary"
                  style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 800 }}
                  onClick={handleSaveMinutes}
                  disabled={uploadingMinutes || (!minutesForm.file && !minutesForm.text.trim())}
                >
                  {uploadingMinutes
                    ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving to Workspace…</>
                    : <><Upload size={14} /> Save Minutes to Workspace</>
                  }
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Meeting Modal */}
      {showNewModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }} onClick={() => setShowNewModal(false)}>
          <div style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)', padding: '1.75rem', width: '100%', maxWidth: '500px',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>New Meeting</h2>
                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Schedule a new governance meeting</p>
              </div>
              <button onClick={() => setShowNewModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', borderRadius: '6px' }}>
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Title */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>Meeting Title *</label>
                <input className="input-field" placeholder="e.g. NCA Steering Committee #15" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={{ width: '100%' }} />
              </div>

              {/* Date + Time */}
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

              {/* Duration + Type */}
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

              {/* Workspace */}
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

              {/* Location */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>Location</label>
                <input className="input-field" placeholder="e.g. Boardroom A / Microsoft Teams" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} style={{ width: '100%' }} />
              </div>

              {/* Participants */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>Participants (initials, comma-separated)</label>
                <input className="input-field" placeholder="e.g. AM, JL, RT, DN" value={form.participants} onChange={e => setForm(f => ({ ...f, participants: e.target.value }))} style={{ width: '100%' }} />
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.75rem' }}>
              <button className="btn-secondary" onClick={() => setShowNewModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleCreateMeeting} disabled={saving || !form.title || !form.date || !form.workspace_id}>
                {saving ? 'Saving…' : 'Create Meeting'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
