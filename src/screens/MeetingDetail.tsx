import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLayout } from '../hooks/useLayout';
import {
  ArrowLeft, Upload, FileText, Download, Trash2,
  Calendar, Clock, MapPin, Users, Video,
  CheckCircle, AlertCircle, Loader2, X, RefreshCw, Sparkles,
} from 'lucide-react';
import { getMeeting, updateMeeting, upsertDocument, getDocuments, deleteDocument } from '../lib/db';
import type { MeetingRow, DocumentRow } from '../lib/db';
import { supabase } from '../lib/supabase';
import { chatWithDocument } from '../lib/openrouter';

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
  PDF:  { bg: 'rgba(255,107,107,0.12)',   text: '#FCA5A5' },
  DOCX: { bg: 'rgba(120,119,198,0.12)',  text: '#7DD3FC' },
  DOC:  { bg: 'rgba(120,119,198,0.12)',  text: '#7DD3FC' },
  XLSX: { bg: 'rgba(52,211,153,0.12)',  text: '#34D399' },
  XLS:  { bg: 'rgba(52,211,153,0.12)',  text: '#34D399' },
  PPTX: { bg: 'rgba(245,181,68,0.12)',  text: '#FDCE78' },
  PPT:  { bg: 'rgba(245,181,68,0.12)',  text: '#FDCE78' },
  TXT:  { bg: 'rgba(148,163,184,0.1)',  text: '#8790A8' },
};

const TYPE_COLORS: Record<string, string> = {
  Workshop: '#7877C6', Committee: '#A78BFA', Steering: '#FF6B6B',
  Review: '#34D399', Kickoff: '#A78BFA', Standup: '#4E566E',
};
const STATUS_COLORS: Record<string, { text: string; bg: string }> = {
  Upcoming:    { text: '#7DD3FC', bg: 'rgba(120,119,198,0.1)' },
  'In Progress': { text: '#FDCE78', bg: 'rgba(245,181,68,0.1)' },
  Completed:   { text: '#34D399', bg: 'rgba(52,211,153,0.1)' },
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

  // AI generation state
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');

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
        type_color: '#34D399',
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

  // ── AI Generate Minutes ────────────────────────────────────
  async function handleGenerateMinutes() {
    if (!meeting) return;
    setGenerating(true);
    setGenerateError('');
    try {
      const agendaText = (meeting.agenda ?? []).length > 0
        ? (meeting.agenda as string[]).map((item, i) => `${i + 1}. ${item}`).join('\n')
        : 'No agenda provided';
      const participantList = meeting.participants.join(', ') || 'Not specified';
      const systemPrompt = `You are a professional meeting minute writer for a consulting firm. Generate formal, structured meeting minutes in markdown format.`;
      const userMsg = `Generate professional meeting minutes for the following meeting:\n\n**Meeting Title:** ${meeting.title}\n**Date:** ${meeting.date}\n**Time:** ${meeting.time} (${meeting.duration})\n**Type:** ${meeting.type}\n**Workspace/Client:** ${meeting.workspace}\n**Location:** ${meeting.location ?? 'Virtual'}\n**Participants:** ${participantList}\n\n**Agenda:**\n${agendaText}\n\nPlease generate structured meeting minutes with:\n1. Meeting details header\n2. Attendees\n3. Agenda items with discussion notes (mark as [To be filled by attendees])\n4. Key decisions (mark as [To be confirmed])\n5. Action items table with Owner and Due Date columns\n6. Next meeting placeholder\n\nUse professional consulting language.`;

      const result = await chatWithDocument([{ role: 'user', content: userMsg }], systemPrompt);

      // Download as .md file immediately — before any async Supabase saves
      const blob = new Blob([result], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${meeting.title.replace(/[^a-zA-Z0-9]/g, '_')}_minutes.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Save as document in Supabase (best-effort — don't block download on failure)
      const timestamp = Date.now();
      const docId = `doc-gen-${timestamp}`;
      const newActionsCount = (result.match(/action item/gi) ?? []).length;
      const newDecisionsCount = (result.match(/decision|decided|agreed/gi) ?? []).length;
      try {
        await upsertDocument({
          id: docId,
          name: `${meeting.title} – AI Generated Minutes`,
          type: 'Meeting Minutes',
          type_color: '#34D399',
          workspace: meeting.workspace,
          workspace_id: meeting.workspace_id,
          date: new Date().toISOString().slice(0, 10),
          language: 'EN',
          status: 'Draft',
          size: `${Math.ceil(result.length / 1000)}KB`,
          author: 'AI',
          pages: 1,
          summary: result.slice(0, 300),
          tags: [meeting.id, 'meeting-minutes', 'ai-generated'],
          file_url: null,
        });
        await updateMeeting(meeting.id, {
          minutes_generated: true,
          actions_extracted: Math.max(meeting.actions_extracted, newActionsCount),
          decisions_logged: Math.max(meeting.decisions_logged, newDecisionsCount),
        });
        setMeeting(prev => prev ? {
          ...prev,
          minutes_generated: true,
          actions_extracted: Math.max(prev.actions_extracted, newActionsCount),
          decisions_logged: Math.max(prev.decisions_logged, newDecisionsCount),
        } : prev);
        await loadAttachments(meeting.workspace_id, meeting.id);
      } catch {
        // Supabase save failed — minutes were still downloaded successfully
      }

      setUploadSuccess('AI minutes generated and downloaded successfully.');
      setTimeout(() => setUploadSuccess(''), 5000);
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : 'AI generation failed.');
    } finally {
      setGenerating(false);
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
        <Loader2 size={24} style={{ color: '#7DD3FC' }} className="animate-spin" />
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Loading meeting…</span>
      </div>
    );
  }
  if (!meeting) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: '0.75rem' }}>
        <AlertCircle size={24} style={{ color: '#FF6B6B' }} />
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Meeting not found.</span>
        <button className="btn-ghost" style={{ fontSize: '0.78rem' }} onClick={() => navigate('/meetings')}>
          <ArrowLeft size={13} /> Back to Meetings
        </button>
      </div>
    );
  }

  const tc = TYPE_COLORS[meeting.type] ?? '#8790A8';
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
                <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(52,211,153,0.1)', color: '#34D399', border: '1px solid rgba(52,211,153,0.22)', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
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
            <button
              onClick={() => setStarredActionsOnly(s => !s)}
              aria-label="Show starred action items only"
              aria-pressed={starredActionsOnly}
              style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '0.25rem', border: `1px solid ${starredActionsOnly ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.1)'}`, background: starredActionsOnly ? 'rgba(245,158,11,0.1)' : 'transparent', color: starredActionsOnly ? '#F59E0B' : 'var(--text-faint)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
            >
              Starred
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
                {(['default', 'owner', 'pending', 'text', 'starred'] as const).map(s => (
                  <button key={s} onClick={() => setActionSort(s)} aria-label={`Sort actions by ${s}`} aria-pressed={actionSort === s}
                    style={{ fontSize: '0.62rem', padding: '1px 7px', borderRadius: '4px', background: actionSort === s ? 'rgba(16,185,129,0.1)' : 'transparent', color: actionSort === s ? '#34D399' : '#475569', border: actionSort === s ? '1px solid rgba(16,185,129,0.25)' : '1px solid transparent', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize' }}>
                    {s === 'default' ? 'Default' : s === 'owner' ? 'Owner' : s === 'pending' ? 'Pending First' : s === 'starred' ? 'Starred First' : 'A–Z'}
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
                  (!starredActionsOnly || act.starred) &&
                  (!actionSearch.trim() || act.text.toLowerCase().includes(actionSearch.toLowerCase()) || act.owner.toLowerCase().includes(actionSearch.toLowerCase()))
                );
                if (actionSort === 'owner') filtered.sort((a, b) => (a.owner ?? '').localeCompare(b.owner ?? ''));
                else if (actionSort === 'pending') filtered.sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0));
                else if (actionSort === 'text') filtered.sort((a, b) => a.text.localeCompare(b.text));
                else if (actionSort === 'starred') filtered.sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0));
                return filtered;
              })().map(act => (
                <li key={act.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', background: act.starred ? 'rgba(245,158,11,0.04)' : act.done ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.03)', border: `1px solid ${act.starred ? 'rgba(245,158,11,0.18)' : act.done ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.07)'}` }}>
                  <button
                    onClick={() => handleToggleActionDone(act.id)}
                    aria-label={`${act.done ? 'Reopen' : 'Complete'} action item: ${act.text}`}
                    aria-pressed={act.done}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: act.done ? '#34D399' : '#475569', padding: 0, display: 'flex', alignItems: 'center', flexShrink: 0 }}
                  >
                    <CheckCircle size={14} />
                  </button>
                  <button
                    onClick={() => handleToggleActionStar(act.id)}
                    aria-label={act.starred ? `Unstar action item: ${act.text}` : `Star action item: ${act.text}`}
                    aria-pressed={act.starred ?? false}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: act.starred ? '#F59E0B' : '#334155', padding: 0, display: 'flex', alignItems: 'center', flexShrink: 0, fontSize: '0.75rem' }}
                  >
                    ★
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
            <Upload size={14} style={{ color: '#7DD3FC' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Meeting Minutes</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-faint)' }}>PDF, DOCX accepted</span>
            <button
              onClick={handleGenerateMinutes}
              disabled={generating}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                fontSize: '0.72rem', padding: '0.375rem 0.75rem', borderRadius: '0.5rem', cursor: generating ? 'default' : 'pointer',
                background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)', color: '#A78BFA',
                fontFamily: 'inherit', opacity: generating ? 0.7 : 1,
              }}
            >
              {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {generating ? 'Generating…' : 'Generate with AI'}
            </button>
          </div>
        </div>
        {generateError && (
          <div style={{ margin: '0 1.25rem', padding: '0.5rem 0.75rem', background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.2)', borderRadius: '0.5rem', fontSize: '0.72rem', color: '#FCA5A5' }}>
            {generateError}
          </div>
        )}

        <div style={{ padding: '1.25rem' }}>
          {/* Drop Zone */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => !uploading && fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? '#7DD3FC' : uploading ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 'var(--radius-lg)',
              padding: '2.5rem 1.5rem',
              textAlign: 'center',
              cursor: uploading ? 'default' : 'pointer',
              transition: 'all 0.2s',
              background: dragging ? 'rgba(120,119,198,0.05)' : uploading ? 'rgba(167,139,250,0.04)' : 'rgba(255,255,255,0.02)',
            }}
          >
            {uploading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.875rem' }}>
                <Loader2 size={28} style={{ color: '#A78BFA' }} className="animate-spin" />
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Uploading…</div>
                {/* Progress bar */}
                <div style={{ width: '220px', height: '4px', background: 'rgba(255,255,255,0.07)', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${uploadPct}%`, background: 'linear-gradient(90deg, #A78BFA, #7DD3FC)', borderRadius: '9999px', transition: 'width 0.2s' }} />
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>{uploadPct}%</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: dragging ? 'rgba(120,119,198,0.12)' : 'rgba(255,255,255,0.05)', border: `1px solid ${dragging ? 'rgba(120,119,198,0.3)' : 'rgba(255,255,255,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                  <Upload size={20} style={{ color: dragging ? '#7DD3FC' : 'var(--text-muted)' }} />
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: dragging ? '#7DD3FC' : 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    {dragging ? 'Drop to upload' : 'Drag & drop your minutes file here'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>
                    or <span style={{ color: '#7DD3FC', textDecoration: 'underline' }}>click to browse</span>
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
            <div style={{ marginTop: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 0.875rem', borderRadius: 'var(--radius-md)', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.22)' }} className="animate-fade-in">
              <CheckCircle size={14} style={{ color: '#34D399', flexShrink: 0 }} />
              <span style={{ fontSize: '0.78rem', color: '#34D399', fontWeight: 500 }}>{uploadSuccess}</span>
            </div>
          )}
          {uploadError && (
            <div style={{ marginTop: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.625rem 0.875rem', borderRadius: 'var(--radius-md)', background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.22)' }} className="animate-fade-in">
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
            <FileText size={14} style={{ color: '#34D399' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Uploaded Minutes</span>
            {attachments.length > 0 && (
              <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: '9999px', background: 'rgba(52,211,153,0.12)', color: '#34D399', border: '1px solid rgba(52,211,153,0.22)' }}>
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
            <Loader2 size={20} style={{ color: '#7DD3FC' }} className="animate-spin" />
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
                      style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.625rem', borderRadius: '6px', background: 'rgba(120,119,198,0.1)', border: '1px solid rgba(120,119,198,0.22)', color: '#7DD3FC', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(120,119,198,0.18)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(120,119,198,0.1)')}
                    >
                      <Download size={11} /> Download
                    </button>
                    <button
                      onClick={() => handleDelete(doc)}
                      disabled={isDeleting}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.5rem', borderRadius: '6px', background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.15)', color: '#FCA5A5', fontSize: '0.72rem', cursor: isDeleting ? 'default' : 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', opacity: isDeleting ? 0.5 : 1 }}
                      onMouseEnter={e => { if (!isDeleting) (e.currentTarget.style.background = 'rgba(255,107,107,0.14)'); }}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,107,107,0.08)')}
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
