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

      // Save as document in Supabase
      const timestamp = Date.now();
      const docId = `doc-gen-${timestamp}`;
      await upsertDocument({
        id: docId,
        name: `${meeting.title} – AI Generated Minutes`,
        type: 'Meeting Minutes',
        type_color: '#10B981',
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

      // Mark meeting minutes as generated and update counts
      const newActionsCount = (result.match(/action item/gi) ?? []).length;
      const newDecisionsCount = (result.match(/decision|decided|agreed/gi) ?? []).length;
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

      // Download as text file
      const blob = new Blob([result], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${meeting.title.replace(/[^a-zA-Z0-9]/g, '_')}_minutes.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      await loadAttachments(meeting.workspace_id, meeting.id);
      setUploadSuccess('AI minutes generated and saved successfully.');
      setTimeout(() => setUploadSuccess(''), 5000);
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : 'AI generation failed. Check your OpenRouter API key.');
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
          <div style={{ padding: '0.375rem 0.75rem', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)', fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {meeting.workspace}
          </div>
        </div>
      </div>

      {/* ── Upload Section ─────────────────────────────────── */}
      <div className="section-card" style={{ overflow: 'hidden' }}>
        <div className="section-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Upload size={14} style={{ color: '#38BDF8' }} />
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
                background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', color: '#A78BFA',
                fontFamily: 'inherit', opacity: generating ? 0.7 : 1,
              }}
            >
              {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {generating ? 'Generating…' : 'Generate with AI'}
            </button>
          </div>
        </div>
        {generateError && (
          <div style={{ margin: '0 1.25rem', padding: '0.5rem 0.75rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '0.5rem', fontSize: '0.72rem', color: '#FCA5A5' }}>
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
              <button onClick={() => setUploadError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FCA5A5', display: 'flex', alignItems: 'center', padding: 0 }}>
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
                    >
                      <Download size={11} /> Download
                    </button>
                    <button
                      onClick={() => handleDelete(doc)}
                      disabled={isDeleting}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.5rem', borderRadius: '6px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#FCA5A5', fontSize: '0.72rem', cursor: isDeleting ? 'default' : 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', opacity: isDeleting ? 0.5 : 1 }}
                      onMouseEnter={e => { if (!isDeleting) (e.currentTarget.style.background = 'rgba(239,68,68,0.14)'); }}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
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
