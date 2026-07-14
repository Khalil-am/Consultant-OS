import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLayout } from '../hooks/useLayout';
import {
  ArrowLeft, Upload, FileText, Download, Trash2,
  Calendar, Clock, MapPin, Users, Video,
  CheckCircle, AlertCircle, Loader2, X, RefreshCw, ClipboardCopy,
} from 'lucide-react';
import { getMeeting, updateMeeting, upsertDocument, getDocuments, deleteDocument } from '../lib/db';
import type { MeetingRow, DocumentRow } from '../lib/db';
import { supabase } from '../lib/supabase';

// ── Helpers ───────────────────────────────────────────────────

function fmtSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function fmtDate(d: string): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(d: string): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function fileExt(name: string): string {
  return (name.split('.').pop() ?? '').toUpperCase();
}

const EXT_COLOR: Record<string, { bg: string; text: string }> = {
  PDF:  { bg: 'rgba(239,68,68,0.12)',   text: '#FCA5A5' },
  DOCX: { bg: 'rgba(14,165,233,0.12)',  text: '#38BDF8' },
  DOC:  { bg: 'rgba(14,165,233,0.12)',  text: '#38BDF8' },
  XLSX: { bg: 'rgba(16,185,129,0.12)',  text: '#34D399' },
  XLS:  { bg: 'rgba(16,185,129,0.12)',  text: '#34D399' },
  PPTX: { bg: 'rgba(245,158,11,0.12)',  text: '#FCD34D' },
  PPT:  { bg: 'rgba(245,158,11,0.12)',  text: '#FCD34D' },
  TXT:  { bg: 'rgba(148,163,184,0.1)',  text: '#94A3B8' },
};

const TYPE_COLORS: Record<string, string> = {
  Workshop: '#0EA5E9', Committee: '#8B5CF6', Steering: '#EF4444',
  Review: '#10B981', Kickoff: '#00D4FF', Standup: '#475569',
};
const STATUS_COLORS: Record<string, { text: string; bg: string }> = {
  Upcoming:    { text: '#38BDF8', bg: 'rgba(14,165,233,0.1)' },
  'In Progress': { text: '#FCD34D', bg: 'rgba(245,158,11,0.1)' },
  Completed:   { text: '#34D399', bg: 'rgba(16,185,129,0.1)' },
};

// ── Main Component ────────────────────────────────────────────

export default function MeetingDetail() {
  const { isMobile } = useLayout();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [meeting, setMeeting]     = useState<MeetingRow | null>(null);
  const [loading, setLoading]     = useState(true);
  const [attachments, setAttachments] = useState<DocumentRow[]>([]);
  const [attLoading, setAttLoading]   = useState(false);

  // Upload state
  const [dragging, setDragging]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Copy meeting info
  const [copiedInfo, setCopiedInfo] = useState(false);

  function handleCopyMeetingInfo() {
    if (!meeting) return;
    const text = [
      `Meeting: ${meeting.title}`,
      `Date: ${fmtDate(meeting.date)}`,
      `Time: ${meeting.time} · ${meeting.duration}`,
      meeting.location ? `Location: ${meeting.location}` : null,
      `Status: ${meeting.status}`,
      `Workspace: ${meeting.workspace}`,
      `Participants: ${meeting.participants.join(', ')}`,
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopiedInfo(true);
      setTimeout(() => setCopiedInfo(false), 2000);
    }).catch(() => {});
  }

  // Attendee check-in (persisted to localStorage)
  const attendanceKey = `meeting_attendance_${id ?? 'unknown'}`;
  const [checkedIn, setCheckedIn] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(attendanceKey);
      return raw ? new Set<string>(JSON.parse(raw) as string[]) : new Set<string>();
    } catch { return new Set<string>(); }
  });

  function toggleAttendance(name: string) {
    setCheckedIn(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      try { localStorage.setItem(attendanceKey, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

  // Meeting notes (persisted to localStorage)
  const notesKey = `meeting_notes_${id ?? 'unknown'}`;
  const [meetingNotes, setMeetingNotes] = useState<string>(() => {
    try { return localStorage.getItem(notesKey) ?? ''; } catch { return ''; }
  });
  const [notesSaved, setNotesSaved] = useState(false);
  const [attendanceCopied, setAttendanceCopied] = useState(false);
  const [attendanceCsvExported, setAttendanceCsvExported] = useState(false);
  const [notesExported, setNotesExported] = useState(false);
  const [notesCopied, setNotesCopied] = useState(false);
  const [actionItemsCsvExported, setActionItemsCsvExported] = useState(false);
  const [actionItemsCopied, setActionItemsCopied] = useState(false);

  function handleExportAttendanceCSV() {
    if (!meeting || meeting.participants.length === 0) return;
    const headers = ['Name', 'Status'];
    const rows = meeting.participants.map(p => [
      `"${p.replace(/"/g, '""')}"`,
      checkedIn.has(p) ? 'Present' : 'Absent',
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${meeting.title.replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setAttendanceCsvExported(true);
    setTimeout(() => setAttendanceCsvExported(false), 2000);
  }

  function handleCopyAttendance() {
    if (!meeting) return;
    const checkedInList = meeting.participants.filter(p => checkedIn.has(p));
    const absentList = meeting.participants.filter(p => !checkedIn.has(p));
    const lines = [
      `Attendance Summary – ${meeting.title}`,
      `Date: ${meeting.date}`,
      `Total Participants: ${meeting.participants.length}`,
      `Checked In: ${checkedIn.size}`,
      `Absent: ${absentList.length}`,
      checkedInList.length ? `Present: ${checkedInList.join(', ')}` : '',
      absentList.length ? `Absent: ${absentList.join(', ')}` : '',
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(lines).then(() => {
      setAttendanceCopied(true);
      setTimeout(() => setAttendanceCopied(false), 2000);
    }).catch(() => {});
  }

  function handleSaveNotes() {
    try { localStorage.setItem(notesKey, meetingNotes); } catch { /* ignore */ }
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  }

  function handleExportNotesAsTxt() {
    if (!meetingNotes.trim()) return;
    const header = meeting ? `Meeting Notes – ${meeting.title}\nDate: ${meeting.date}\n\n` : '';
    const content = header + meetingNotes;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notes_${(meeting?.title ?? 'meeting').replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setNotesExported(true);
    setTimeout(() => setNotesExported(false), 2000);
  }

  function handleCopyMeetingNotes() {
    if (!meetingNotes.trim()) return;
    const header = meeting ? `Meeting Notes – ${meeting.title}\nDate: ${meeting.date}\n\n` : '';
    navigator.clipboard.writeText(header + meetingNotes).then(() => {
      setNotesCopied(true);
      setTimeout(() => setNotesCopied(false), 2000);
    }).catch(() => {});
  }

  function handleExportActionItemsCSV() {
    if (actionItems.length === 0) return;
    const headers = ['Text', 'Owner', 'Status'];
    const rows = actionItems.map(a => [
      `"${a.text.replace(/"/g, '""')}"`,
      `"${(a.owner ?? '').replace(/"/g, '""')}"`,
      a.done ? 'Done' : 'Pending',
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `action_items_${(meeting?.title ?? 'meeting').replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setActionItemsCsvExported(true);
    setTimeout(() => setActionItemsCsvExported(false), 2000);
  }

  function handleCopyActionItemsSummary() {
    if (actionItems.length === 0) return;
    const pending = actionItems.filter(a => !a.done);
    const done = actionItems.filter(a => a.done);
    const lines = [
      `Action Items – ${meeting?.title ?? 'Meeting'}`,
      `Total: ${actionItems.length} | Pending: ${pending.length} | Done: ${done.length}`,
      '',
      ...actionItems.map(a => `[${a.done ? '✓' : ' '}] ${a.text}${a.owner ? ` (${a.owner})` : ''}`),
    ].join('\n');
    navigator.clipboard.writeText(lines).then(() => {
      setActionItemsCopied(true);
      setTimeout(() => setActionItemsCopied(false), 2000);
    }).catch(() => {});
  }

  // Decision log (persisted to localStorage)
  const decisionsKey = `meeting_decisions_${id ?? 'unknown'}`;
  interface Decision { id: string; text: string; timestamp: string; }
  const [decisions, setDecisions] = useState<Decision[]>(() => {
    try { return JSON.parse(localStorage.getItem(decisionsKey) ?? 'null') ?? []; } catch { return []; }
  });
  const [newDecision, setNewDecision] = useState('');
  const [decisionSearch, setDecisionSearch] = useState('');
  const [decisionSort, setDecisionSort] = useState<'default' | 'text'>('default');

  const actionsKey = `meeting_actions_${id ?? 'unknown'}`;
  interface ActionItem { id: string; text: string; owner: string; done: boolean; }
  const [actionItems, setActionItems] = useState<ActionItem[]>(() => {
    try { return JSON.parse(localStorage.getItem(actionsKey) ?? 'null') ?? []; } catch { return []; }
  });
  const [newActionText, setNewActionText] = useState('');
  const [newActionOwner, setNewActionOwner] = useState('');
  const [pendingActionsOnly, setPendingActionsOnly] = useState(false);
  const [actionSearch, setActionSearch] = useState('');
  const [actionSort, setActionSort] = useState<'default' | 'owner' | 'pending' | 'text'>('default');

  function handleAddActionItem() {
    if (!newActionText.trim()) return;
    const entry: ActionItem = { id: `act-${Date.now()}`, text: newActionText.trim(), owner: newActionOwner.trim(), done: false };
    const updated = [entry, ...actionItems];
    setActionItems(updated);
    try { localStorage.setItem(actionsKey, JSON.stringify(updated)); } catch { /* ignore */ }
    setNewActionText('');
    setNewActionOwner('');
  }

  function handleToggleActionDone(actId: string) {
    const updated = actionItems.map(a => a.id === actId ? { ...a, done: !a.done } : a);
    setActionItems(updated);
    try { localStorage.setItem(actionsKey, JSON.stringify(updated)); } catch { /* ignore */ }
  }

  function handleDeleteActionItem(actId: string) {
    const updated = actionItems.filter(a => a.id !== actId);
    setActionItems(updated);
    try { localStorage.setItem(actionsKey, JSON.stringify(updated)); } catch { /* ignore */ }
  }

  function handleAddDecision() {
    if (!newDecision.trim()) return;
    const entry: Decision = { id: `dec-${Date.now()}`, text: newDecision.trim(), timestamp: new Date().toISOString() };
    const updated = [entry, ...decisions];
    setDecisions(updated);
    try { localStorage.setItem(decisionsKey, JSON.stringify(updated)); } catch { /* ignore */ }
    setNewDecision('');
  }

  function handleDeleteDecision(decId: string) {
    const updated = decisions.filter(d => d.id !== decId);
    setDecisions(updated);
    try { localStorage.setItem(decisionsKey, JSON.stringify(updated)); } catch { /* ignore */ }
  }

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load meeting ──────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getMeeting(id)
      .then(data => { setMeeting(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  // ── Load attachments ──────────────────────────────────────
  const loadAttachments = useCallback(async (wsId: string, meetingId: string) => {
    setAttLoading(true);
    try {
      const docs = await getDocuments(wsId);
      // Filter by type and tag containing this meeting's id
      setAttachments(docs.filter(d =>
        d.type === 'Meeting Minutes' && (d.tags ?? []).includes(meetingId)
      ));
    } catch { /* ignore */ }
    finally { setAttLoading(false); }
  }, []);

  useEffect(() => {
    if (meeting?.workspace_id && meeting?.id) {
      loadAttachments(meeting.workspace_id, meeting.id);
    }
  }, [meeting, loadAttachments]);

  // ── Upload handler ─────────────────────────────────────────
  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !meeting) return;
    const file = files[0];
    setUploading(true);
    setUploadError('');
    setUploadSuccess('');
    setUploadPct(0);

    try {
      // 1. Upload file to Supabase storage
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${meeting.workspace_id}/meetings/${timestamp}_${safeName}`;

      // Simulate progress during upload (Supabase JS v2 doesn't give progress natively)
      const progressTimer = setInterval(() => {
        setUploadPct(p => Math.min(p + 12, 85));
      }, 200);

      const { error: storageError } = await supabase.storage
        .from('workspace-docs')
        .upload(storagePath, file, { cacheControl: '3600', upsert: false });

      clearInterval(progressTimer);

      if (storageError) throw new Error(storageError.message);

      setUploadPct(90);

      // 2. Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('workspace-docs')
        .getPublicUrl(storagePath);

      // 3. Save document record
      const docId = `doc-${timestamp}`;
      await upsertDocument({
        id: docId,
        name: `${meeting.title} – Minutes`,
        type: 'Meeting Minutes',
        type_color: '#10B981',
        workspace: meeting.workspace,
        workspace_id: meeting.workspace_id,
        date: new Date().toISOString().slice(0, 10),
        language: 'EN',
        status: 'Draft',
        size: fmtSize(file.size),
        author: 'AM',
        pages: 1,
        summary: `Meeting minutes for ${meeting.title} (${meeting.date})`,
        tags: [meeting.id, 'meeting-minutes'],
        file_url: publicUrl,
      });

      setUploadPct(100);

      // 4. Mark meeting as having minutes
      await updateMeeting(meeting.id, { minutes_generated: true });
      setMeeting(prev => prev ? { ...prev, minutes_generated: true } : prev);

      // 5. Refresh list
      await loadAttachments(meeting.workspace_id, meeting.id);
      setUploadSuccess(`"${file.name}" uploaded successfully.`);
      setTimeout(() => setUploadSuccess(''), 4000);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      setUploadPct(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Download handler ───────────────────────────────────────
  async function handleDownload(doc: DocumentRow) {
    if (!doc.file_url) return;
    try {
      const parts = doc.file_url.split('/workspace-docs/');
      if (parts.length >= 2) {
        const path = decodeURIComponent(parts[1]);
        const { data: signed, error } = await supabase.storage
          .from('workspace-docs')
          .createSignedUrl(path, 300);
        if (!error && signed?.signedUrl) {
          const a = document.createElement('a');
          a.href = signed.signedUrl;
          a.download = doc.name;
          a.target = '_blank';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          return;
        }
      }
    } catch { /* fall through */ }
    window.open(doc.file_url!, '_blank');
  }

  // ── Delete handler ─────────────────────────────────────────
  async function handleDelete(doc: DocumentRow) {
    if (!meeting) return;
    setDeletingId(doc.id);
    try {
      // Remove from storage
      if (doc.file_url) {
        const parts = doc.file_url.split('/workspace-docs/');
        if (parts.length >= 2) {
          await supabase.storage
            .from('workspace-docs')
            .remove([decodeURIComponent(parts[1])]);
        }
      }
      await deleteDocument(doc.id);
      setAttachments(prev => prev.filter(d => d.id !== doc.id));
      // If no more minutes, un-flag the meeting
      if (attachments.length <= 1) {
        await updateMeeting(meeting.id, { minutes_generated: false });
        setMeeting(prev => prev ? { ...prev, minutes_generated: false } : prev);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  }

  // ── Drag & drop ────────────────────────────────────────────
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }
  function onDragLeave() { setDragging(false); }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    handleUpload(e.dataTransfer.files);
  }

  // ── Render guards ──────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: '0.75rem' }}>
        <Loader2 size={24} style={{ color: '#38BDF8' }} className="animate-spin" />
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Loading meeting…</span>
      </div>
    );
  }
  if (!meeting) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: '0.75rem' }}>
        <AlertCircle size={24} style={{ color: '#EF4444' }} />
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Meeting not found.</span>
        <button className="btn-ghost" style={{ fontSize: '0.78rem' }} onClick={() => navigate('/meetings')}>
          <ArrowLeft size={13} /> Back to Meetings
        </button>
      </div>
    );
  }

  const tc = TYPE_COLORS[meeting.type] ?? '#94A3B8';
  const sc = STATUS_COLORS[meeting.status] ?? STATUS_COLORS.Upcoming;

  return (
    <div style={{ padding: isMobile ? '0.875rem' : '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '900px' }}>

      {/* ── Back ───────────────────────────────────────────── */}
      <button
        onClick={() => navigate('/meetings')}
        style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 500, padding: 0, fontFamily: 'inherit', width: 'fit-content', transition: 'color 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        aria-label="Back to Meetings"
      >
        <ArrowLeft size={13} /> Back to Meetings
      </button>

      {/* ── Meeting Header ─────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(14,22,40,0.98) 0%, var(--bg-elevated) 60%, rgba(15,29,48,0.95) 100%)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.5rem',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${tc}, transparent)` }} />
        <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: `radial-gradient(circle, ${tc}08 0%, transparent 70%)`, pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
          {/* Icon */}
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', flexShrink: 0, background: `${tc}18`, border: `1px solid ${tc}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Video size={20} style={{ color: tc }} />
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Badges */}
            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px', background: `${tc}18`, color: tc, border: `1px solid ${tc}28`, fontWeight: 600 }}>
                {meeting.type}
              </span>
              <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px', background: sc.bg, color: sc.text, fontWeight: 600 }}>
                {meeting.status}
              </span>
              {meeting.minutes_generated && (
                <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(16,185,129,0.1)', color: '#34D399', border: '1px solid rgba(16,185,129,0.22)', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
                  <CheckCircle size={9} /> Minutes Uploaded
                </span>
              )}
            </div>

            {/* Title */}
            <h1 style={{ fontSize: isMobile ? '1.05rem' : '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, marginBottom: '0.625rem' }}>
              {meeting.title}
            </h1>

            {/* Meta row */}
            <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
              {[
                { icon: <Calendar size={11} />, text: fmtDate(meeting.date) },
                { icon: <Clock size={11} />, text: `${meeting.time} · ${meeting.duration}` },
                meeting.location ? { icon: <MapPin size={11} />, text: meeting.location } : null,
                { icon: <Users size={11} />, text: `${meeting.participants.length} participants` },
              ].filter(Boolean).map((item, i) => (
                <span key={i} style={{ fontSize: '0.73rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  {(item as { icon: React.ReactNode; text: string }).icon}
                  {(item as { icon: React.ReactNode; text: string }).text}
                </span>
              ))}
            </div>
          </div>

          {/* Workspace chip */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-end' }}>
            <div style={{ padding: '0.375rem 0.75rem', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)', fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {meeting.workspace}
            </div>
            <button
              onClick={handleCopyMeetingInfo}
              aria-label="Copy meeting info to clipboard"
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                fontSize: '0.62rem', fontWeight: 600, padding: '3px 8px', borderRadius: '5px',
                background: copiedInfo ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)',
                color: copiedInfo ? '#34D399' : '#64748B',
                border: copiedInfo ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(255,255,255,0.08)',
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s', whiteSpace: 'nowrap',
              }}
            >
              <ClipboardCopy size={10} /> {copiedInfo ? 'Copied!' : 'Copy Info'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Participants Section ───────────────────────────── */}
      {meeting.participants.length > 0 && (
        <div className="section-card" style={{ overflow: 'hidden' }}>
          <div className="section-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={14} style={{ color: '#8B5CF6' }} />
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Participants</span>
              <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: '9999px', background: 'rgba(139,92,246,0.12)', color: '#A78BFA', border: '1px solid rgba(139,92,246,0.22)' }}>
                {meeting.participants.length}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.7rem', color: '#64748B' }}>
                {checkedIn.size}/{meeting.participants.length} checked in
              </span>
              <button
                onClick={handleExportAttendanceCSV}
                disabled={meeting.participants.length === 0}
                aria-label="Export attendance to CSV"
                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '2px 8px', background: attendanceCsvExported ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)', border: attendanceCsvExported ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: attendanceCsvExported ? '#34D399' : '#475569', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.7rem' }}
              >
                <Download size={11} /> {attendanceCsvExported ? 'Exported!' : 'Export CSV'}
              </button>
              <button
                onClick={handleCopyAttendance}
                aria-label="Copy attendance summary to clipboard"
                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '2px 8px', background: attendanceCopied ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)', border: attendanceCopied ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: attendanceCopied ? '#34D399' : '#475569', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.7rem' }}
              >
                <ClipboardCopy size={11} /> {attendanceCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
          <div style={{ padding: '1rem 1.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }} aria-label="Participants list">
            {meeting.participants.map((p, i) => (
              <button
                key={i}
                onClick={() => toggleAttendance(p)}
                aria-label={checkedIn.has(p) ? `Mark ${p} absent` : `Check in ${p}`}
                aria-pressed={checkedIn.has(p)}
                style={{
                  fontSize: '0.78rem', fontWeight: 500,
                  padding: '0.25rem 0.75rem', borderRadius: '9999px',
                  background: checkedIn.has(p) ? 'rgba(16,185,129,0.12)' : 'rgba(139,92,246,0.08)',
                  border: checkedIn.has(p) ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(139,92,246,0.2)',
                  color: checkedIn.has(p) ? '#34D399' : '#C4B5FD',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem',
                  transition: 'all 0.15s',
                }}
              >
                {checkedIn.has(p) && <CheckCircle size={10} />}
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Meeting Notes Section ──────────────────────────── */}
      <div className="section-card" style={{ overflow: 'hidden' }}>
        <div className="section-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={14} style={{ color: '#0EA5E9' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Meeting Notes</span>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              aria-label="Copy meeting notes to clipboard"
              onClick={handleCopyMeetingNotes}
              disabled={!meetingNotes.trim()}
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', cursor: meetingNotes.trim() ? 'pointer' : 'default', color: notesCopied ? '#34D399' : '#475569', fontSize: '0.68rem', padding: '2px 8px', fontFamily: 'inherit', transition: 'color 0.2s', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
            >
              <ClipboardCopy size={11} /> {notesCopied ? 'Copied!' : 'Copy Notes'}
            </button>
            <button
              aria-label="Export meeting notes as TXT"
              onClick={handleExportNotesAsTxt}
              disabled={!meetingNotes.trim()}
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', cursor: meetingNotes.trim() ? 'pointer' : 'default', color: notesExported ? '#34D399' : '#475569', fontSize: '0.68rem', padding: '2px 8px', fontFamily: 'inherit', transition: 'color 0.2s', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
            >
              <Download size={11} /> {notesExported ? 'Exported!' : 'Export TXT'}
            </button>
            <button
              aria-label="Save meeting notes"
              onClick={handleSaveNotes}
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', cursor: 'pointer', color: notesSaved ? '#34D399' : '#475569', fontSize: '0.68rem', padding: '2px 8px', fontFamily: 'inherit', transition: 'color 0.2s' }}
            >
              {notesSaved ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>
        <div style={{ padding: '1rem 1.25rem' }}>
          <textarea
            aria-label="Meeting notes input"
            placeholder="Add your meeting notes, action items, key decisions..."
            value={meetingNotes}
            onChange={e => setMeetingNotes(e.target.value)}
            style={{
              width: '100%', minHeight: '100px', padding: '0.625rem 0.75rem',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '0.5rem', color: '#94A3B8', fontSize: '0.8rem',
              fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* ── Decision Log ───────────────────────────────────── */}
      <div className="section-card" style={{ overflow: 'hidden' }}>
        <div className="section-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={14} style={{ color: '#F59E0B' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Decision Log</span>
            {decisions.length > 0 && (
              <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: '9999px', background: 'rgba(245,158,11,0.12)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.22)' }}>
                {decisions.length}
              </span>
            )}
          </div>
        </div>
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              className="input-field"
              aria-label="New decision input"
              placeholder="Log a decision made in this meeting..."
              value={newDecision}
              onChange={e => setNewDecision(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddDecision(); }}
              style={{ flex: 1, height: '36px', fontSize: '0.8rem' }}
            />
            <button
              onClick={handleAddDecision}
              aria-label="Add decision"
              disabled={!newDecision.trim()}
              style={{ padding: '0 1rem', height: '36px', borderRadius: '0.375rem', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#FCD34D', fontSize: '0.8rem', cursor: newDecision.trim() ? 'pointer' : 'default', fontFamily: 'inherit', fontWeight: 500 }}
            >
              Add
            </button>
          </div>
          {decisions.length > 2 && (
            <>
              <input
                className="input-field"
                aria-label="Search decisions"
                placeholder="Search decisions..."
                value={decisionSearch}
                onChange={e => setDecisionSearch(e.target.value)}
                style={{ height: '30px', fontSize: '0.75rem', marginBottom: '0.5rem', width: '100%' }}
              />
              <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.5rem' }}>
                {(['default', 'text'] as const).map(s => (
                  <button key={s} onClick={() => setDecisionSort(s)} aria-label={`Sort decisions by ${s}`} aria-pressed={decisionSort === s}
                    style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border)', background: decisionSort === s ? 'var(--accent)' : 'transparent', color: decisionSort === s ? '#fff' : 'var(--text-secondary)', cursor: 'pointer' }}>
                    {s === 'default' ? 'Default' : 'A–Z'}
                  </button>
                ))}
              </div>
            </>
          )}
          {decisions.length === 0 ? (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-faint)', textAlign: 'center', padding: '0.75rem 0' }}>No decisions logged yet.</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {(decisionSort === 'text' ? [...decisions].sort((a, b) => a.text.localeCompare(b.text)) : decisions).filter(dec => !decisionSearch.trim() || dec.text.toLowerCase().includes(decisionSearch.toLowerCase())).map(dec => (
                <li key={dec.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.12)' }}>
                  <CheckCircle size={12} style={{ color: '#F59E0B', flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ flex: 1, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{dec.text}</span>
                  <button
                    onClick={() => handleDeleteDecision(dec.id)}
                    aria-label={`Delete decision: ${dec.text}`}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '0', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                  >
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Action Items ───────────────────────────────────── */}
      <div className="section-card" style={{ overflow: 'hidden' }}>
        <div className="section-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <CheckCircle size={14} style={{ color: '#10B981' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Action Items</span>
            {actionItems.length > 0 && (
              <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: '9999px', background: 'rgba(16,185,129,0.12)', color: '#34D399', border: '1px solid rgba(16,185,129,0.22)' }}>
                {actionItems.filter(a => a.done).length}/{actionItems.length}
              </span>
            )}
            <button
              onClick={() => setPendingActionsOnly(p => !p)}
              aria-label="Show pending action items only"
              aria-pressed={pendingActionsOnly}
              style={{ marginLeft: 'auto', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '0.25rem', border: `1px solid ${pendingActionsOnly ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.1)'}`, background: pendingActionsOnly ? 'rgba(16,185,129,0.1)' : 'transparent', color: pendingActionsOnly ? '#34D399' : 'var(--text-faint)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
            >
              Pending Only
            </button>
            {actionItems.length > 0 && (
              <>
                <button
                  onClick={handleCopyActionItemsSummary}
                  aria-label="Copy action items summary to clipboard"
                  style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '0.25rem', border: '1px solid rgba(255,255,255,0.1)', background: actionItemsCopied ? 'rgba(16,185,129,0.1)' : 'transparent', color: actionItemsCopied ? '#34D399' : 'var(--text-faint)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '3px' }}
                >
                  <ClipboardCopy size={10} />
                  {actionItemsCopied ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={handleExportActionItemsCSV}
                  aria-label="Export action items to CSV"
                  style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '0.25rem', border: '1px solid rgba(255,255,255,0.1)', background: actionItemsCsvExported ? 'rgba(16,185,129,0.1)' : 'transparent', color: actionItemsCsvExported ? '#34D399' : 'var(--text-faint)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '3px' }}
                >
                  <Download size={10} />
                  {actionItemsCsvExported ? 'Exported!' : 'CSV'}
                </button>
              </>
            )}
          </div>
        </div>
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              className="input-field"
              aria-label="New action item text"
              placeholder="Describe the action item..."
              value={newActionText}
              onChange={e => setNewActionText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddActionItem(); }}
              style={{ flex: 2, minWidth: '140px', height: '36px', fontSize: '0.8rem' }}
            />
            <input
              className="input-field"
              aria-label="Action item owner"
              placeholder="Owner"
              value={newActionOwner}
              onChange={e => setNewActionOwner(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddActionItem(); }}
              style={{ flex: 1, minWidth: '80px', height: '36px', fontSize: '0.8rem' }}
            />
            <button
              onClick={handleAddActionItem}
              aria-label="Add action item"
              disabled={!newActionText.trim()}
              style={{ padding: '0 1rem', height: '36px', borderRadius: '0.375rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#34D399', fontSize: '0.8rem', cursor: newActionText.trim() ? 'pointer' : 'default', fontFamily: 'inherit', fontWeight: 500 }}
            >
              Add
            </button>
          </div>
          {actionItems.length > 0 && (
            <>
              <input
                type="text"
                aria-label="Search action items"
                placeholder="Search actions…"
                value={actionSearch}
                onChange={e => setActionSearch(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', marginBottom: '0.375rem', padding: '0.25rem 0.5rem', borderRadius: '0.375rem', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: 'var(--text-primary)', fontSize: '0.75rem', fontFamily: 'inherit', outline: 'none' }}
              />
              <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.5rem' }}>
                {(['default', 'owner', 'pending', 'text'] as const).map(s => (
                  <button key={s} onClick={() => setActionSort(s)} aria-label={`Sort actions by ${s}`} aria-pressed={actionSort === s}
                    style={{ fontSize: '0.62rem', padding: '1px 7px', borderRadius: '4px', background: actionSort === s ? 'rgba(16,185,129,0.1)' : 'transparent', color: actionSort === s ? '#34D399' : '#475569', border: actionSort === s ? '1px solid rgba(16,185,129,0.25)' : '1px solid transparent', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize' }}>
                    {s === 'default' ? 'Default' : s === 'owner' ? 'Owner' : s === 'pending' ? 'Pending First' : 'A–Z'}
                  </button>
                ))}
              </div>
            </>
          )}
          {actionItems.length === 0 ? (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-faint)', textAlign: 'center', padding: '0.75rem 0' }}>No action items yet.</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {(() => {
                const filtered = actionItems.filter(act =>
                  (!pendingActionsOnly || !act.done) &&
                  (!actionSearch.trim() || act.text.toLowerCase().includes(actionSearch.toLowerCase()) || act.owner.toLowerCase().includes(actionSearch.toLowerCase()))
                );
                if (actionSort === 'owner') filtered.sort((a, b) => (a.owner ?? '').localeCompare(b.owner ?? ''));
                else if (actionSort === 'pending') filtered.sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0));
                else if (actionSort === 'text') filtered.sort((a, b) => a.text.localeCompare(b.text));
                return filtered;
              })().map(act => (
                <li key={act.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', background: act.done ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.03)', border: `1px solid ${act.done ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.07)'}` }}>
                  <button
                    onClick={() => handleToggleActionDone(act.id)}
                    aria-label={`${act.done ? 'Reopen' : 'Complete'} action item: ${act.text}`}
                    aria-pressed={act.done}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: act.done ? '#34D399' : '#475569', padding: 0, display: 'flex', alignItems: 'center', flexShrink: 0 }}
                  >
                    <CheckCircle size={14} />
                  </button>
                  <span style={{ flex: 1, fontSize: '0.8rem', color: act.done ? '#475569' : 'var(--text-secondary)', textDecoration: act.done ? 'line-through' : 'none' }}>{act.text}</span>
                  {act.owner && (
                    <span style={{ fontSize: '0.68rem', color: '#475569', background: 'rgba(255,255,255,0.04)', padding: '1px 6px', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>{act.owner}</span>
                  )}
                  <button
                    onClick={() => handleDeleteActionItem(act.id)}
                    aria-label={`Delete action item: ${act.text}`}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '0', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                  >
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Upload Section ─────────────────────────────────── */}
      <div className="section-card" style={{ overflow: 'hidden' }}>
        <div className="section-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Upload size={14} style={{ color: '#38BDF8' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Upload Meeting Minutes</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-faint)' }}>PDF, DOCX, PPTX, XLSX, TXT accepted</span>
        </div>

        <div style={{ padding: '1.25rem' }}>
          {/* Drop Zone */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => !uploading && fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? '#38BDF8' : uploading ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 'var(--radius-lg)',
              padding: '2.5rem 1.5rem',
              textAlign: 'center',
              cursor: uploading ? 'default' : 'pointer',
              transition: 'all 0.2s',
              background: dragging ? 'rgba(14,165,233,0.05)' : uploading ? 'rgba(139,92,246,0.04)' : 'rgba(255,255,255,0.02)',
            }}
          >
            {uploading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.875rem' }}>
                <Loader2 size={28} style={{ color: '#8B5CF6' }} className="animate-spin" />
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Uploading…</div>
                {/* Progress bar */}
                <div style={{ width: '220px', height: '4px', background: 'rgba(255,255,255,0.07)', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${uploadPct}%`, background: 'linear-gradient(90deg, #8B5CF6, #38BDF8)', borderRadius: '9999px', transition: 'width 0.2s' }} />
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>{uploadPct}%</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: dragging ? 'rgba(14,165,233,0.12)' : 'rgba(255,255,255,0.05)', border: `1px solid ${dragging ? 'rgba(14,165,233,0.3)' : 'rgba(255,255,255,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                  <Upload size={20} style={{ color: dragging ? '#38BDF8' : 'var(--text-muted)' }} />
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: dragging ? '#38BDF8' : 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    {dragging ? 'Drop to upload' : 'Drag & drop your minutes file here'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>
                    or <span style={{ color: '#38BDF8', textDecoration: 'underline' }}>click to browse</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
            style={{ display: 'none' }}
            onChange={e => handleUpload(e.target.files)}
          />

          {/* Feedback messages */}
          {uploadSuccess && (
            <div style={{ marginTop: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 0.875rem', borderRadius: 'var(--radius-md)', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.22)' }} className="animate-fade-in">
              <CheckCircle size={14} style={{ color: '#34D399', flexShrink: 0 }} />
              <span style={{ fontSize: '0.78rem', color: '#34D399', fontWeight: 500 }}>{uploadSuccess}</span>
            </div>
          )}
          {uploadError && (
            <div style={{ marginTop: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.625rem 0.875rem', borderRadius: 'var(--radius-md)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)' }} className="animate-fade-in">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={14} style={{ color: '#FCA5A5', flexShrink: 0 }} />
                <span style={{ fontSize: '0.78rem', color: '#FCA5A5' }}>{uploadError}</span>
              </div>
              <button onClick={() => setUploadError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FCA5A5', display: 'flex', alignItems: 'center', padding: 0 }} aria-label="Dismiss upload error">
                <X size={13} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Attachments List ───────────────────────────────── */}
      <div className="section-card" style={{ overflow: 'hidden' }}>
        <div className="section-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={14} style={{ color: '#10B981' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Uploaded Minutes</span>
            {attachments.length > 0 && (
              <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: '9999px', background: 'rgba(16,185,129,0.12)', color: '#34D399', border: '1px solid rgba(16,185,129,0.22)' }}>
                {attachments.length}
              </span>
            )}
          </div>
          <button
            className="btn-ghost"
            style={{ height: '28px', fontSize: '0.72rem' }}
            onClick={() => meeting && loadAttachments(meeting.workspace_id, meeting.id)}
            disabled={attLoading}
            aria-label="Refresh attachments"
          >
            <RefreshCw size={11} className={attLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {attLoading ? (
          <div style={{ padding: '2.5rem', textAlign: 'center' }}>
            <Loader2 size={20} style={{ color: '#38BDF8' }} className="animate-spin" />
          </div>
        ) : attachments.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
              <FileText size={18} style={{ color: 'var(--text-faint)' }} />
            </div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>No minutes uploaded yet</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>Upload a file above to save it to this meeting's workspace folder</div>
          </div>
        ) : (
          <div>
            {attachments.map((doc, i) => {
              const ext = fileExt(doc.name.split('/').pop() ?? doc.name);
              const ec = EXT_COLOR[ext] ?? EXT_COLOR.TXT;
              const isDeleting = deletingId === doc.id;
              return (
                <div
                  key={doc.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.875rem',
                    padding: '0.875rem 1.25rem',
                    borderBottom: i < attachments.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* File type badge */}
                  <div style={{ width: '38px', height: '38px', flexShrink: 0, borderRadius: '8px', background: ec.bg, border: `1px solid ${ec.text}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 800, color: ec.text, letterSpacing: '0.03em' }}>
                    {ext || 'FILE'}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-faint)', marginTop: '2px', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <span>{doc.size}</span>
                      <span>·</span>
                      <span>Uploaded {fmtDateTime(doc.created_at)}</span>
                      <span>·</span>
                      <span style={{ color: '#34D399' }}>Saved to workspace</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                    <button
                      onClick={() => handleDownload(doc)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.625rem', borderRadius: '6px', background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.22)', color: '#38BDF8', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(14,165,233,0.18)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(14,165,233,0.1)')}
                      aria-label={`Download ${doc.name}`}
                    >
                      <Download size={11} /> Download
                    </button>
                    <button
                      onClick={() => handleDelete(doc)}
                      disabled={isDeleting}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.5rem', borderRadius: '6px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#FCA5A5', fontSize: '0.72rem', cursor: isDeleting ? 'default' : 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', opacity: isDeleting ? 0.5 : 1 }}
                      onMouseEnter={e => { if (!isDeleting) (e.currentTarget.style.background = 'rgba(239,68,68,0.14)'); }}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                      aria-label={`Delete ${doc.name}`}
                    >
                      {isDeleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
