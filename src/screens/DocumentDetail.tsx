import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileText, Sparkles, Check,
  Download, Clock, User, Calendar, Tag, Link as LinkIcon,
  Send, Loader2, ExternalLink, RefreshCw, AlertCircle, ClipboardCopy,
} from 'lucide-react';
import { getDocument, updateDocument, getTasks, updateTask } from '../lib/db';
import type { DocumentRow, TaskRow } from '../lib/db';
import { supabase } from '../lib/supabase';
import { chatWithDocument, buildDocumentSystemPrompt } from '../lib/openrouter';
import type { ChatMsg } from '../lib/openrouter';

const tabs = ['Overview', 'Summary', 'Tasks', 'Versions', 'AI Chat'];
const STATUS_OPTIONS = ['Draft', 'Under Review', 'Approved', 'Final'] as const;
const TASK_STATUS_OPTIONS = ['Backlog', 'In Progress', 'In Review', 'Completed', 'Overdue'] as const;

function statusBadge(s: string) {
  const map: Record<string, { bg: string; color: string }> = {
    Approved: { bg: 'rgba(52,211,153,0.12)', color: '#34D399' },
    Final: { bg: 'rgba(120,119,198,0.1)', color: '#A78BFA' },
    'Under Review': { bg: 'rgba(245,181,68,0.12)', color: '#FDCE78' },
    Draft: { bg: 'rgba(148,163,184,0.07)', color: '#8790A8' },
  };
  const c = map[s] ?? map.Draft;
  return (
    <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px', background: c.bg, color: c.color, border: `1px solid ${c.color}25`, fontWeight: 600 }}>
      {s}
    </span>
  );
}

async function downloadFromStorage(fileUrl: string, filename: string) {
  try {
    // Extract path after /workspace-docs/
    const parts = fileUrl.split('/workspace-docs/');
    if (parts.length >= 2) {
      const path = decodeURIComponent(parts[1]);
      const { data: signed, error } = await supabase.storage
        .from('workspace-docs')
        .createSignedUrl(path, 300);
      if (!error && signed?.signedUrl) {
        const a = document.createElement('a');
        a.href = signed.signedUrl;
        a.download = filename;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }
    }
  } catch { /* fall through */ }
  // Fallback: open directly
  window.open(fileUrl, '_blank');
}

export default function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [doc, setDoc] = useState<DocumentRow | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeTab, setActiveTab] = useState('Overview');
  const [statusSaving, setStatusSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Tasks tab
  const [taskStatusChanging, setTaskStatusChanging] = useState<string | null>(null);

  // AI Chat
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // AI Summarize
  const [summarizing, setSummarizing] = useState(false);

  // Copy summary
  const [summaryCopied, setSummaryCopied] = useState(false);
  function handleCopySummary() {
    if (!doc) return;
    const text = doc.summary || 'No summary available.';
    navigator.clipboard.writeText(text).then(() => {
      setSummaryCopied(true);
      setTimeout(() => setSummaryCopied(false), 2000);
    }).catch(() => {});
  }

  // Document star rating (persisted to localStorage)
  const ratingKey = `doc_rating_${id ?? 'unknown'}`;
  const [docRating, setDocRating] = useState<number>(() => {
    try { return Number(localStorage.getItem(ratingKey) ?? '0'); } catch { return 0; }
  });
  const [ratingHover, setRatingHover] = useState(0);

  function handleSetRating(stars: number) {
    const next = docRating === stars ? 0 : stars;
    setDocRating(next);
    try { localStorage.setItem(ratingKey, String(next)); } catch { /* ignore */ }
  }

  // Version changelog (persisted to localStorage)
  const changelogKey = `doc_changelog_${id ?? 'unknown'}`;
  interface ChangelogEntry { id: string; note: string; author: string; date: string; }
  const [changelog, setChangelog] = useState<ChangelogEntry[]>(() => {
    try {
      const raw = localStorage.getItem(`doc_changelog_${id ?? 'unknown'}`);
      return raw ? JSON.parse(raw) as ChangelogEntry[] : [];
    } catch { return []; }
  });
  const [newChangeNote, setNewChangeNote] = useState('');
  const [newChangeAuthor, setNewChangeAuthor] = useState('');
  const [changelogExported, setChangelogExported] = useState(false);
  const [changelogTxtExported, setChangelogTxtExported] = useState(false);
  const [docInfoCopied, setDocInfoCopied] = useState(false);
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<'All' | 'High' | 'Medium' | 'Low'>('All');
  const [taskSearch, setTaskSearch] = useState('');
  const [taskSort, setTaskSort] = useState<'default' | 'title' | 'priority'>('default');
  const [changelogSort, setChangelogSort] = useState<'newest' | 'oldest' | 'author'>('newest');

  const reviewerCommentsKey = `doc_comments_${id ?? 'unknown'}`;
  interface ReviewerComment { id: string; text: string; reviewer: string; resolved: boolean; }
  const [reviewerComments, setReviewerComments] = useState<ReviewerComment[]>(() => {
    try { return JSON.parse(localStorage.getItem(reviewerCommentsKey) ?? 'null') ?? []; } catch { return []; }
  });
  const [newCommentText, setNewCommentText] = useState('');
  const [newCommentReviewer, setNewCommentReviewer] = useState('');
  const [unresolvedCommentsOnly, setUnresolvedCommentsOnly] = useState(false);
  const [commentSearch, setCommentSearch] = useState('');
  const [commentSort, setCommentSort] = useState<'default' | 'reviewer' | 'unresolved'>('default');

  function handleAddComment() {
    if (!newCommentText.trim()) return;
    const entry: ReviewerComment = { id: `cmt-${Date.now()}`, text: newCommentText.trim(), reviewer: newCommentReviewer.trim(), resolved: false };
    const updated = [entry, ...reviewerComments];
    setReviewerComments(updated);
    try { localStorage.setItem(reviewerCommentsKey, JSON.stringify(updated)); } catch { /* ignore */ }
    setNewCommentText('');
    setNewCommentReviewer('');
  }

  function handleToggleCommentResolved(cmtId: string) {
    const updated = reviewerComments.map(c => c.id === cmtId ? { ...c, resolved: !c.resolved } : c);
    setReviewerComments(updated);
    try { localStorage.setItem(reviewerCommentsKey, JSON.stringify(updated)); } catch { /* ignore */ }
  }

  function handleDeleteComment(cmtId: string) {
    const updated = reviewerComments.filter(c => c.id !== cmtId);
    setReviewerComments(updated);
    try { localStorage.setItem(reviewerCommentsKey, JSON.stringify(updated)); } catch { /* ignore */ }
  }

  function handleCopyDocInfo() {
    if (!doc) return;
    const lines = [
      `Document: ${doc.name}`,
      `Type: ${doc.type}`,
      `Status: ${doc.status}`,
      `Workspace: ${doc.workspace}`,
      `Author: ${doc.author ?? 'Unknown'}`,
      `Language: ${doc.language}`,
      `Tags: ${Array.isArray(doc.tags) ? doc.tags.join(', ') : doc.tags ?? 'None'}`,
    ].join('\n');
    navigator.clipboard.writeText(lines).then(() => {
      setDocInfoCopied(true);
      setTimeout(() => setDocInfoCopied(false), 2000);
    }).catch(() => {});
  }

  function handleExportChangelog() {
    if (changelog.length === 0) return;
    const headers = ['Date', 'Author', 'Note'];
    const rows = changelog.map(e => [
      `"${e.date}"`,
      `"${e.author.replace(/"/g, '""')}"`,
      `"${e.note.replace(/"/g, '""')}"`,
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `changelog_${doc?.title?.replace(/\s+/g, '_') ?? 'document'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setChangelogExported(true);
    setTimeout(() => setChangelogExported(false), 2000);
  }

  function handleExportChangelogTxt() {
    if (changelog.length === 0) return;
    const lines = [
      `Change Log – ${doc?.name ?? 'Document'}`,
      `Total Entries: ${changelog.length}`,
      ``,
      ...changelog.map(e => `  [${e.date}] ${e.author}: ${e.note}`),
    ].join('\n');
    const blob = new Blob([lines], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `changelog_${doc?.name?.replace(/\s+/g, '_') ?? 'document'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setChangelogTxtExported(true);
    setTimeout(() => setChangelogTxtExported(false), 2000);
  }

  function handleAddChangelogEntry() {
    if (!newChangeNote.trim()) return;
    const entry: ChangelogEntry = {
      id: crypto.randomUUID(),
      note: newChangeNote.trim(),
      author: newChangeAuthor.trim() || 'Anonymous',
      date: new Date().toLocaleDateString('en-GB'),
    };
    setChangelog(prev => {
      const next = [entry, ...prev];
      try { localStorage.setItem(changelogKey, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    setNewChangeNote('');
    setNewChangeAuthor('');
  }

  function handleDeleteChangelogEntry(entryId: string) {
    setChangelog(prev => {
      const next = prev.filter(e => e.id !== entryId);
      try { localStorage.setItem(changelogKey, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  async function load() {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [d, allTasks] = await Promise.all([
        getDocument(id),
        getTasks(),
      ]);
      if (!d) { setError('Document not found.'); return; }
      setDoc(d);
      setTasks(allTasks.filter(t => t.linked_doc === id || t.linked_doc === d.id));
      // Seed AI chat with document context
      setMessages([{
        role: 'assistant',
        content: `Hi! I'm ready to help you with **${d.name}**. I have the document's metadata and summary as context. Ask me anything about this document — its scope, requirements, recommendations, or anything related to the **${d.type}** in the **${d.workspace}** workspace.`,
      }]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load document');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  // Scroll to bottom of chat on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleStatusChange(status: string) {
    if (!doc) return;
    setStatusSaving(true);
    try {
      await updateDocument(doc.id, { status: status as DocumentRow['status'] });
      setDoc(d => d ? { ...d, status: status as DocumentRow['status'] } : d);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to update status');
    }
    setStatusSaving(false);
  }

  async function handleTaskStatusChange(taskId: string, status: string) {
    setTaskStatusChanging(taskId);
    try {
      await updateTask(taskId, { status: status as TaskRow['status'] });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: status as TaskRow['status'] } : t));
    } catch { /* ignore */ }
    setTaskStatusChanging(null);
  }

  async function handleDownload() {
    if (!doc?.file_url) {
      alert('No file is attached to this document. Upload a file from the Documents list.');
      return;
    }
    setDownloading(true);
    try {
      await downloadFromStorage(doc.file_url, doc.name);
    } finally {
      setDownloading(false);
    }
  }

  async function handleSendMessage() {
    if (!chatInput.trim() || !doc) return;
    const userMsg: ChatMsg = { role: 'user', content: chatInput.trim() };
    setChatInput('');
    setMessages(prev => [...prev, userMsg]);
    setAiLoading(true);
    setAiError('');
    try {
      const systemPrompt = buildDocumentSystemPrompt({
        name: doc.name,
        type: doc.type,
        author: doc.author,
        date: doc.date,
        workspace: doc.workspace,
        status: doc.status,
        language: doc.language,
        summary: doc.summary ?? '',
        tags: doc.tags ?? [],
      });
      // Pass only non-system messages
      const history: ChatMsg[] = messages
        .filter(m => m.role !== 'system')
        .concat(userMsg);
      const reply = await chatWithDocument(history, systemPrompt);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : 'AI error');
      setMessages(prev => prev.slice(0, -0)); // keep user message
    } finally {
      setAiLoading(false);
    }
  }

  async function handleAiSummarize() {
    if (!doc) return;
    setSummarizing(true);
    setAiError('');
    try {
      const systemPrompt = buildDocumentSystemPrompt({
        name: doc.name,
        type: doc.type,
        author: doc.author,
        date: doc.date,
        workspace: doc.workspace,
        status: doc.status,
        language: doc.language,
        summary: doc.summary ?? '',
        tags: doc.tags ?? [],
      });
      const reply = await chatWithDocument(
        [{ role: 'user', content: `Generate a comprehensive professional summary for this ${doc.type} document. Include: purpose, key contents, scope, and any important notes based on the available metadata.` }],
        systemPrompt
      );
      // Save AI summary to DB
      await updateDocument(doc.id, { summary: reply });
      setDoc(d => d ? { ...d, summary: reply } : d);
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : 'AI error');
    } finally {
      setSummarizing(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 60px)', color: '#4E566E', gap: '0.5rem' }}>
        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Loading document…
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 60px)', color: '#4E566E', gap: '1rem' }}>
        <AlertCircle size={36} style={{ color: '#FF6B6B' }} />
        <div style={{ color: '#FCA5A5', fontSize: '0.9rem', fontWeight: 600 }}>{error || 'Document not found.'}</div>
        <button className="btn-ghost" onClick={() => navigate('/documents')}>
          <ArrowLeft size={14} /> Back to Documents
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', background: '#0C0F1A', flexShrink: 0 }}>
        <button
          onClick={() => navigate('/documents')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: 'none', border: 'none', cursor: 'pointer', color: '#4E566E', fontSize: '0.8rem', padding: 0, marginBottom: '0.75rem', fontFamily: 'inherit' }}
        >
          <ArrowLeft size={14} /> Documents
        </button>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
            <div style={{ padding: '0.625rem', borderRadius: '10px', background: `${doc.type_color}18`, color: doc.type_color, flexShrink: 0, border: `1px solid ${doc.type_color}25` }}>
              <FileText size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.7rem', padding: '2px 7px', borderRadius: '4px', background: `${doc.type_color}15`, color: doc.type_color, border: `1px solid ${doc.type_color}25` }}>
                  {doc.type}
                </span>
                <span style={{ color: '#4E566E', fontSize: '0.75rem' }}>·</span>
                <span style={{ fontSize: '0.75rem', color: '#4E566E' }}>{doc.workspace}</span>
                {statusBadge(doc.status)}
              </div>
              <h1 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#F8FAFC', margin: 0, marginBottom: '0.25rem' }}>{doc.name}</h1>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.72rem', color: '#4E566E', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <User size={11} /> {doc.author}
                </span>
                <span style={{ fontSize: '0.72rem', color: '#4E566E', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Calendar size={11} /> {doc.date}
                </span>
                {doc.size && doc.size !== '—' && <span style={{ fontSize: '0.72rem', color: '#4E566E' }}>{doc.size}</span>}
                {doc.pages > 0 && <span style={{ fontSize: '0.72rem', color: '#4E566E' }}>{doc.pages} pages</span>}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              value={doc.status}
              onChange={e => handleStatusChange(e.target.value)}
              disabled={statusSaving}
              style={{ fontSize: '0.78rem', height: '32px', cursor: 'pointer', color: '#8790A8', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.5rem', padding: '0 0.625rem', fontFamily: 'inherit', outline: 'none' }}
            >
              {STATUS_OPTIONS.map(s => <option key={s} value={s} style={{ background: '#0C0F1A', color: '#F8FAFC' }}>{s}</option>)}
            </select>
            <button
              className="btn-primary"
              style={{ fontSize: '0.78rem', height: '32px', background: doc.status === 'Approved' ? 'rgba(52,211,153,0.15)' : undefined }}
              onClick={() => handleStatusChange('Approved')}
              disabled={statusSaving || doc.status === 'Approved'}
              aria-label="Mark Approved"
            >
              {statusSaving ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={13} />}
              {doc.status === 'Approved' ? 'Approved ✓' : 'Mark Approved'}
            </button>
            <button
              className="btn-ghost"
              style={{ fontSize: '0.78rem', height: '32px', padding: '0 0.75rem', opacity: doc.file_url ? 1 : 0.4 }}
              onClick={handleDownload}
              disabled={downloading || !doc.file_url}
              title={doc.file_url ? 'Download attached file' : 'No file attached'}
              aria-label={doc.file_url ? 'Download file' : 'No file attached'}
            >
              {downloading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={13} />}
              {doc.file_url ? 'Download' : 'No File'}
            </button>
            <button
              className="btn-ghost"
              style={{ fontSize: '0.78rem', height: '32px', padding: '0 0.625rem', display: 'flex', alignItems: 'center', gap: '0.3rem', color: docInfoCopied ? '#10B981' : undefined }}
              onClick={handleCopyDocInfo}
              aria-label="Copy document info to clipboard"
            >
              <ClipboardCopy size={13} /> {docInfoCopied ? 'Copied!' : 'Copy Info'}
            </button>
            <button className="btn-ghost" style={{ fontSize: '0.78rem', height: '32px', padding: '0 0.5rem' }} onClick={load} title="Refresh" aria-label="Refresh document">
              <RefreshCw size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, padding: '0 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', background: '#07080F', flexShrink: 0 }}>
        {tabs.map(tab => (
          <button
            key={tab}
            className={`tab-underline ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
            aria-label={`Document tab: ${tab}`}
            aria-pressed={activeTab === tab}
            style={{ marginRight: '1.25rem', fontSize: '0.82rem' }}
          >
            {tab === 'AI Chat' && <Sparkles size={12} style={{ marginRight: '0.25rem', color: activeTab === tab ? '#A78BFA' : '#4E566E' }} />}
            {tab}
            {tab === 'Tasks' && tasks.length > 0 && (
              <span style={{ marginLeft: '0.375rem', fontSize: '0.65rem', padding: '1px 5px', borderRadius: '9999px', background: 'rgba(120,119,198,0.12)', color: '#A78BFA' }}>
                {tasks.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>

        {/* ── Overview ── */}
        {activeTab === 'Overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="section-card">
                <div className="section-card-header">
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F8FAFC' }}>Document Summary</span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {statusBadge(doc.status)}
                    <button
                      className="btn-ai"
                      style={{ fontSize: '0.72rem', height: '26px', padding: '0 0.625rem' }}
                      onClick={handleAiSummarize}
                      disabled={summarizing}
                      aria-label="AI Summarize document"
                    >
                      {summarizing ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={11} />}
                      {summarizing ? 'Generating…' : 'AI Summarize'}
                    </button>
                    <button
                      className="btn-ghost"
                      style={{ fontSize: '0.72rem', height: '26px', padding: '0 0.625rem', display: 'flex', alignItems: 'center', gap: '4px', color: summaryCopied ? '#34D399' : undefined }}
                      onClick={handleCopySummary}
                      aria-label="Copy summary to clipboard"
                    >
                      <ClipboardCopy size={11} />
                      {summaryCopied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
                <div style={{ padding: '1.25rem' }}>
                  {aiError && (
                    <div style={{ padding: '0.625rem 0.875rem', background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.2)', borderRadius: '6px', fontSize: '0.78rem', color: '#FCA5A5', marginBottom: '0.75rem' }}>
                      {aiError}
                    </div>
                  )}
                  <p style={{ fontSize: '0.875rem', color: '#8790A8', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>
                    {doc.summary || 'No summary provided. Click "AI Summarize" to generate one automatically.'}
                  </p>
                </div>
              </div>

              {tasks.length > 0 && (
                <div className="section-card">
                  <div className="section-card-header">
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F8FAFC' }}>Linked Tasks</span>
                    <button className="btn-ghost" style={{ fontSize: '0.72rem', height: '26px', padding: '0 0.625rem' }} onClick={() => setActiveTab('Tasks')}>
                      View all ({tasks.length})
                    </button>
                  </div>
                  <div>
                    {tasks.slice(0, 3).map((task, i) => (
                      <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1.25rem', borderBottom: i < Math.min(tasks.length, 3) - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: task.priority === 'High' ? '#FF6B6B' : task.priority === 'Medium' ? '#F5B544' : '#34D399', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#F8FAFC', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</div>
                          <div style={{ fontSize: '0.7rem', color: '#4E566E' }}>{task.assignee} · Due {task.due_date}</div>
                        </div>
                        <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: task.priority === 'High' ? 'rgba(255,107,107,0.1)' : 'rgba(245,181,68,0.1)', color: task.priority === 'High' ? '#FCA5A5' : '#FDCE78', flexShrink: 0 }}>
                          {task.priority}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Reviewer Comments */}
              <div className="section-card">
                <div className="section-card-header">
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Reviewer Comments</span>
                  {reviewerComments.length > 0 && (
                    <span style={{ fontSize: '0.65rem', color: '#475569' }}>{reviewerComments.filter(c => c.resolved).length}/{reviewerComments.length} resolved</span>
                  )}
                  <button
                    onClick={() => setUnresolvedCommentsOnly(p => !p)}
                    aria-label="Show unresolved comments only"
                    aria-pressed={unresolvedCommentsOnly}
                    style={{ marginLeft: 'auto', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '0.25rem', border: `1px solid ${unresolvedCommentsOnly ? 'rgba(0,212,255,0.5)' : 'rgba(255,255,255,0.1)'}`, background: unresolvedCommentsOnly ? 'rgba(0,212,255,0.1)' : 'transparent', color: unresolvedCommentsOnly ? '#00D4FF' : '#475569', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
                  >
                    Unresolved
                  </button>
                </div>
                <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <input
                      className="input-field"
                      aria-label="New reviewer comment"
                      placeholder="Add a review comment..."
                      value={newCommentText}
                      onChange={e => setNewCommentText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddComment(); }}
                      style={{ flex: 2, minWidth: '140px', height: '34px', fontSize: '0.78rem' }}
                    />
                    <input
                      className="input-field"
                      aria-label="Reviewer name"
                      placeholder="Reviewer"
                      value={newCommentReviewer}
                      onChange={e => setNewCommentReviewer(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddComment(); }}
                      style={{ flex: 1, minWidth: '80px', height: '34px', fontSize: '0.78rem' }}
                    />
                    <button
                      onClick={handleAddComment}
                      aria-label="Add reviewer comment"
                      disabled={!newCommentText.trim()}
                      style={{ padding: '0 0.875rem', height: '34px', borderRadius: '0.375rem', background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.25)', color: '#00D4FF', fontSize: '0.78rem', cursor: newCommentText.trim() ? 'pointer' : 'default', fontFamily: 'inherit', fontWeight: 500 }}
                    >
                      Add
                    </button>
                  </div>
                  {reviewerComments.length > 0 && (
                    <>
                      <input
                        className="input-field"
                        type="text"
                        aria-label="Search comments"
                        placeholder="Search comments…"
                        value={commentSearch}
                        onChange={e => setCommentSearch(e.target.value)}
                        style={{ height: '32px', fontSize: '0.75rem' }}
                      />
                      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.25rem' }}>
                        {(['default', 'reviewer', 'unresolved'] as const).map(s => (
                          <button
                            key={s}
                            onClick={() => setCommentSort(s)}
                            aria-label={`Sort comments by ${s}`}
                            aria-pressed={commentSort === s}
                            style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '0.25rem', border: `1px solid ${commentSort === s ? 'rgba(0,212,255,0.5)' : 'rgba(255,255,255,0.1)'}`, background: commentSort === s ? 'rgba(0,212,255,0.1)' : 'transparent', color: commentSort === s ? '#00D4FF' : '#475569', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
                          >
                            {s === 'default' ? 'Default' : s === 'reviewer' ? 'Reviewer' : 'Unresolved First'}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {reviewerComments.length === 0 ? (
                    <div style={{ fontSize: '0.78rem', color: '#334155', textAlign: 'center', padding: '0.5rem 0' }}>No comments yet.</div>
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {(() => {
                        const filtered = reviewerComments.filter(cmt =>
                          (!unresolvedCommentsOnly || !cmt.resolved) &&
                          (!commentSearch.trim() || cmt.text.toLowerCase().includes(commentSearch.toLowerCase()) || cmt.reviewer.toLowerCase().includes(commentSearch.toLowerCase()))
                        );
                        if (commentSort === 'reviewer') filtered.sort((a, b) => (a.reviewer ?? '').localeCompare(b.reviewer ?? ''));
                        else if (commentSort === 'unresolved') filtered.sort((a, b) => (a.resolved ? 1 : 0) - (b.resolved ? 1 : 0));
                        return filtered;
                      })().map(cmt => (
                        <li key={cmt.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', background: cmt.resolved ? 'rgba(16,185,129,0.04)' : 'rgba(255,255,255,0.03)', border: `1px solid ${cmt.resolved ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.07)'}` }}>
                          <button
                            onClick={() => handleToggleCommentResolved(cmt.id)}
                            aria-label={`${cmt.resolved ? 'Reopen' : 'Resolve'} comment: ${cmt.text}`}
                            aria-pressed={cmt.resolved}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: cmt.resolved ? '#34D399' : '#475569', padding: 0, display: 'flex', alignItems: 'center', flexShrink: 0, marginTop: '2px' }}
                          >
                            <Check size={13} />
                          </button>
                          <span style={{ flex: 1, fontSize: '0.78rem', color: cmt.resolved ? '#475569' : '#94A3B8', textDecoration: cmt.resolved ? 'line-through' : 'none' }}>{cmt.text}</span>
                          {cmt.reviewer && (
                            <span style={{ fontSize: '0.65rem', color: '#475569', background: 'rgba(255,255,255,0.04)', padding: '1px 5px', borderRadius: 3, border: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>{cmt.reviewer}</span>
                          )}
                          <button
                            onClick={() => handleDeleteComment(cmt.id)}
                            aria-label={`Delete comment: ${cmt.text}`}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#334155', padding: 0, display: 'flex', alignItems: 'center', flexShrink: 0 }}
                          >
                            <AlertCircle size={11} style={{ transform: 'rotate(45deg)' }} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {/* Right meta */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="section-card" style={{ padding: '1.125rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#4E566E', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Document Info</div>
                {[
                  { icon: <Tag size={12} />, label: 'Type', value: doc.type, color: doc.type_color },
                  { icon: <User size={12} />, label: 'Author', value: doc.author, color: undefined },
                  { icon: <Calendar size={12} />, label: 'Created', value: doc.date, color: undefined },
                  { icon: <Clock size={12} />, label: 'Language', value: doc.language, color: '#7DD3FC' },
                  { icon: <LinkIcon size={12} />, label: 'Workspace', value: doc.workspace, color: undefined },
                  { icon: <FileText size={12} />, label: 'Size', value: doc.size || '—', color: undefined },
                  { icon: <Download size={12} />, label: 'File', value: doc.file_url ? 'Attached ✓' : 'No file', color: doc.file_url ? '#34D399' : undefined },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.375rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: '#4E566E' }}>
                      {item.icon}
                      <span style={{ fontSize: '0.72rem' }}>{item.label}</span>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: item.color ?? '#8790A8', fontWeight: item.color ? 600 : 400, maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>
                      {item.value}
                    </span>
                  </div>
                ))}
                {doc.tags?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.625rem' }}>
                    {doc.tags.map(tag => (
                      <span key={tag} style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: '4px', background: 'rgba(255,255,255,0.04)', color: '#8790A8', border: '1px solid rgba(255,255,255,0.07)' }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="section-card" style={{ padding: '1.125rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#4E566E', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Quick Actions</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <button
                    className="btn-primary"
                    style={{ width: '100%', justifyContent: 'center', fontSize: '0.78rem', opacity: doc.file_url ? 1 : 0.5 }}
                    onClick={handleDownload}
                    disabled={downloading || !doc.file_url}
                    aria-label="Download document file"
                  >
                    {downloading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={13} />}
                    {doc.file_url ? 'Download File' : 'No File Attached'}
                  </button>
                  <button className="btn-ai" style={{ width: '100%', justifyContent: 'center', fontSize: '0.78rem' }} onClick={() => setActiveTab('AI Chat')} aria-label="Ask AI about this document">
                    <Sparkles size={13} /> Ask AI About This Doc
                  </button>
                  <button
                    className="btn-ghost"
                    style={{ width: '100%', justifyContent: 'center', fontSize: '0.78rem', background: doc.status === 'Approved' ? 'rgba(52,211,153,0.08)' : undefined, borderColor: doc.status === 'Approved' ? 'rgba(52,211,153,0.2)' : undefined, color: doc.status === 'Approved' ? '#34D399' : undefined }}
                    onClick={() => handleStatusChange('Approved')}
                    disabled={doc.status === 'Approved' || statusSaving}
                    aria-label="Mark document as approved"
                  >
                    <Check size={13} /> {doc.status === 'Approved' ? 'Already Approved' : 'Mark Approved'}
                  </button>
                </div>
                {/* Star Rating */}
                <div style={{ marginTop: '0.875rem', paddingTop: '0.875rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#475569', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your Rating</div>
                  <div style={{ display: 'flex', gap: '0.25rem' }} aria-label="Document star rating">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                        aria-pressed={docRating >= star}
                        onClick={() => handleSetRating(star)}
                        onMouseEnter={() => setRatingHover(star)}
                        onMouseLeave={() => setRatingHover(0)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
                          fontSize: '1.1rem', color: (ratingHover || docRating) >= star ? '#F59E0B' : '#334155',
                          transition: 'color 0.15s', lineHeight: 1,
                        }}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  {docRating > 0 && (
                    <div style={{ fontSize: '0.68rem', color: '#F59E0B', marginTop: '2px' }}>{docRating}/5 stars</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Summary ── */}
        {activeTab === 'Summary' && (
          <div className="section-card">
            <div className="section-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={14} style={{ color: '#A78BFA' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F8FAFC' }}>Document Summary</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {statusBadge(doc.status)}
                <button
                  className="btn-ai"
                  style={{ fontSize: '0.72rem', height: '26px', padding: '0 0.625rem' }}
                  onClick={handleAiSummarize}
                  disabled={summarizing}
                  aria-label="Generate AI document summary"
                >
                  {summarizing ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={11} />}
                  {summarizing ? 'Generating…' : doc.summary ? 'Regenerate' : 'AI Generate Summary'}
                </button>
              </div>
            </div>
            <div style={{ padding: '1.25rem' }}>
              {aiError && (
                <div style={{ padding: '0.625rem 0.875rem', background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.2)', borderRadius: '6px', fontSize: '0.78rem', color: '#FCA5A5', marginBottom: '0.75rem' }}>
                  {aiError}
                </div>
              )}
              <p style={{ fontSize: '0.875rem', color: '#8790A8', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-wrap' }}>
                {doc.summary || 'No summary available. Click "AI Generate Summary" to automatically generate one using AI based on the document metadata.'}
              </p>
              {doc.tags?.length > 0 && (
                <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                  {doc.tags.map(tag => (
                    <span key={tag} style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: '#8790A8', border: '1px solid rgba(255,255,255,0.08)' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tasks ── */}
        {activeTab === 'Tasks' && (
          <div className="section-card">
            <div className="section-card-header">
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F8FAFC' }}>Linked Tasks</span>
              <span style={{ fontSize: '0.72rem', color: '#4E566E' }}>{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
            </div>
            {tasks.length > 0 && (
              <>
                <div style={{ padding: '0.5rem 1.25rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {(['All', 'High', 'Medium', 'Low'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setTaskPriorityFilter(p)}
                      aria-label={`Filter tasks by priority: ${p}`}
                      aria-pressed={taskPriorityFilter === p}
                      style={{ padding: '0.2rem 0.6rem', fontSize: '0.7rem', borderRadius: '4px', border: `1px solid ${taskPriorityFilter === p ? '#00D4FF' : 'rgba(255,255,255,0.1)'}`, background: taskPriorityFilter === p ? 'rgba(0,212,255,0.1)' : 'transparent', color: taskPriorityFilter === p ? '#00D4FF' : '#94A3B8', cursor: 'pointer', fontFamily: 'inherit' }}
                    >{p}</button>
                  ))}
                </div>
                <div style={{ padding: '0 1.25rem 0.5rem' }}>
                  <input type="text" aria-label="Search tasks" placeholder="Search tasks…" value={taskSearch} onChange={e => setTaskSearch(e.target.value)}
                    style={{ width: '100%', height: '28px', fontSize: '0.72rem', padding: '0 0.5rem', borderRadius: '5px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#F1F5F9', fontFamily: 'inherit', outline: 'none' }} />
                </div>
                <div style={{ padding: '0 1.25rem 0.5rem', display: 'flex', gap: '0.3rem' }}>
                  {(['default', 'title', 'priority'] as const).map(s => (
                    <button key={s} onClick={() => setTaskSort(s)} aria-label={`Sort tasks by ${s}`} aria-pressed={taskSort === s}
                      style={{ fontSize: '0.62rem', padding: '1px 7px', borderRadius: '4px', background: taskSort === s ? 'rgba(0,212,255,0.1)' : 'transparent', color: taskSort === s ? '#00D4FF' : '#475569', border: taskSort === s ? '1px solid rgba(0,212,255,0.25)' : '1px solid transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
                      {s === 'default' ? 'Default' : s === 'title' ? 'Title A–Z' : 'Priority'}
                    </button>
                  ))}
                </div>
              </>
            )}
            {tasks.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: '#4E566E', fontSize: '0.82rem', lineHeight: 1.6 }}>
                No tasks are linked to this document.<br />
                <span style={{ fontSize: '0.75rem' }}>Link a task by setting its "Linked Doc" field to this document's ID in the workspace Tasks tab.</span>
              </div>
            ) : (
              <div>
                {tasks.map((task, i) => (
                  <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.875rem 1.25rem', borderBottom: i < tasks.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: task.priority === 'High' ? '#FF6B6B' : task.priority === 'Medium' ? '#F5B544' : '#34D399', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 500, color: '#F8FAFC', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</div>
                      <div style={{ fontSize: '0.7rem', color: '#4E566E', marginTop: '0.125rem' }}>{task.assignee} · Due {task.due_date} · {task.workspace}</div>
                    </div>
                    <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: task.priority === 'High' ? 'rgba(255,107,107,0.1)' : task.priority === 'Medium' ? 'rgba(245,181,68,0.1)' : 'rgba(148,163,184,0.07)', color: task.priority === 'High' ? '#FCA5A5' : task.priority === 'Medium' ? '#FDCE78' : '#8790A8', flexShrink: 0 }}>
                      {task.priority}
                    </span>
                    {taskStatusChanging === task.id ? (
                      <Loader2 size={12} style={{ animation: 'spin 1s linear infinite', color: '#4E566E', flexShrink: 0 }} />
                    ) : (
                      <select
                        value={task.status}
                        onChange={e => handleTaskStatusChange(task.id, e.target.value)}
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none', fontSize: '0.68rem', color: task.status === 'Completed' ? '#34D399' : task.status === 'In Progress' ? '#7DD3FC' : task.status === 'Overdue' ? '#FCA5A5' : '#8790A8', cursor: 'pointer', fontFamily: 'inherit', padding: '3px 6px', borderRadius: '4px', flexShrink: 0 }}
                      >
                        {TASK_STATUS_OPTIONS.map(s => <option key={s} value={s} style={{ background: '#0C0F1A', color: '#F8FAFC' }}>{s}</option>)}
                      </select>
                    )}
                    <button
                      onClick={() => navigate(`/workspaces/${task.workspace_id}`)}
                      style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: '#4E566E', borderRadius: '4px', flexShrink: 0 }}
                      title="Open workspace"
                      aria-label="Open workspace"
                    >
                      <ExternalLink size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Versions ── */}
        {activeTab === 'Versions' && (
          <div className="section-card">
            <div className="section-card-header">
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F8FAFC' }}>Version History</span>
            </div>
            <div style={{ padding: '1.25rem 1.5rem' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '9999px', background: '#A78BFA', border: '2px solid #A78BFA', flexShrink: 0, marginTop: '3px', boxShadow: '0 0 8px rgba(120,119,198,0.5)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#A78BFA' }}>v1.0 — Current</span>
                    <span className="status-active" style={{ fontSize: '0.65rem' }}>Latest</span>
                    <span style={{ fontSize: '0.72rem', color: '#4E566E' }}>{doc.date}</span>
                    <span style={{ fontSize: '0.72rem', color: '#4E566E' }}>by {doc.author}</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#4E566E', margin: 0 }}>{doc.name} · {doc.status}</p>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button
                      className="btn-ghost"
                      style={{ fontSize: '0.72rem', height: '26px', padding: '0 0.625rem', opacity: doc.file_url ? 1 : 0.4 }}
                      onClick={handleDownload}
                      disabled={!doc.file_url || downloading}
                    >
                      <Download size={11} /> Download
                    </button>
                  </div>
                </div>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#4E566E', marginTop: '1.5rem', textAlign: 'center' }}>
                Version history will appear here as new versions are uploaded.
              </p>
              {/* ── Changelog ── */}
              <div style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.25rem' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#94A3B8', marginBottom: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><RefreshCw size={13} /> Change Log</span>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      onClick={handleExportChangelog}
                      disabled={changelog.length === 0}
                      aria-label="Export change log to CSV"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '2px 8px', background: changelogExported ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)', border: changelogExported ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: changelogExported ? '#34D399' : '#475569', cursor: changelog.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '0.7rem', opacity: changelog.length === 0 ? 0.4 : 1 }}
                    >
                      <Download size={11} /> {changelogExported ? 'Exported!' : 'Export CSV'}
                    </button>
                    <button
                      onClick={handleExportChangelogTxt}
                      disabled={changelog.length === 0}
                      aria-label="Export change log to TXT"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '2px 8px', background: changelogTxtExported ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)', border: changelogTxtExported ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: changelogTxtExported ? '#34D399' : '#475569', cursor: changelog.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '0.7rem', opacity: changelog.length === 0 ? 0.4 : 1 }}
                    >
                      <FileText size={11} /> {changelogTxtExported ? 'Exported!' : 'Export TXT'}
                    </button>
                  </div>
                </div>
                {/* Add entry form */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.875rem', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    aria-label="Change log note"
                    placeholder="Describe the change…"
                    value={newChangeNote}
                    onChange={e => setNewChangeNote(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddChangelogEntry()}
                    style={{ flex: '2 1 200px', padding: '0.4rem 0.625rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: '#F1F5F9', fontSize: '0.78rem', fontFamily: 'inherit', outline: 'none' }}
                  />
                  <input
                    type="text"
                    aria-label="Change log author"
                    placeholder="Author"
                    value={newChangeAuthor}
                    onChange={e => setNewChangeAuthor(e.target.value)}
                    style={{ flex: '1 1 100px', padding: '0.4rem 0.625rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: '#F1F5F9', fontSize: '0.78rem', fontFamily: 'inherit', outline: 'none' }}
                  />
                  <button
                    onClick={handleAddChangelogEntry}
                    disabled={!newChangeNote.trim()}
                    aria-label="Add change log entry"
                    style={{ padding: '0.4rem 0.875rem', background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: '6px', color: '#00D4FF', fontSize: '0.78rem', cursor: newChangeNote.trim() ? 'pointer' : 'not-allowed', opacity: newChangeNote.trim() ? 1 : 0.5, fontFamily: 'inherit' }}
                  >
                    Add
                  </button>
                </div>
                {/* Sort */}
                {changelog.length > 1 && (
                  <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.5rem' }}>
                    {(['newest', 'oldest', 'author'] as const).map(s => (
                      <button key={s} onClick={() => setChangelogSort(s)} aria-label={`Sort changelog by ${s}`} aria-pressed={changelogSort === s}
                        style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '0.25rem', border: '1px solid rgba(255,255,255,0.08)', background: changelogSort === s ? 'rgba(0,212,255,0.1)' : 'transparent', color: changelogSort === s ? '#00D4FF' : '#475569', cursor: 'pointer', fontFamily: 'inherit' }}>
                        {s === 'newest' ? 'Newest' : s === 'oldest' ? 'Oldest' : 'Author A–Z'}
                      </button>
                    ))}
                  </div>
                )}
                {/* Entries */}
                {changelog.length === 0 ? (
                  <p style={{ fontSize: '0.75rem', color: '#334155', margin: 0 }}>No change notes yet. Add one above.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {(changelogSort === 'oldest' ? [...changelog].reverse() : changelogSort === 'author' ? [...changelog].sort((a, b) => a.author.localeCompare(b.author)) : changelog).map(entry => (
                      <div key={entry.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', padding: '0.625rem 0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.8rem', color: '#CBD5E1' }}>{entry.note}</div>
                          <div style={{ fontSize: '0.68rem', color: '#475569', marginTop: '0.25rem' }}>{entry.author} · {entry.date}</div>
                        </div>
                        <button
                          onClick={() => handleDeleteChangelogEntry(entry.id)}
                          aria-label={`Delete change log entry: ${entry.note}`}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#334155', padding: '2px', borderRadius: '4px', flexShrink: 0 }}
                        >
                          <AlertCircle size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── AI Chat ── */}
        {activeTab === 'AI Chat' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 290px)', minHeight: '400px' }}>
            <div className="section-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className="section-card-header" style={{ flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg, #635BFF, #A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Sparkles size={13} style={{ color: 'white' }} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F8FAFC' }}>AI Document Chat</span>
                    <div style={{ fontSize: '0.68rem', color: '#4E566E' }}>Powered by OpenRouter · Free model</div>
                  </div>
                </div>
                <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(167,139,250,0.1)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.2)' }}>
                  {doc.type} context loaded
                </span>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {messages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.75rem', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    {msg.role === 'assistant' && (
                      <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg, #635BFF, #A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                        <Sparkles size={13} style={{ color: 'white' }} />
                      </div>
                    )}
                    <div style={{
                      maxWidth: '78%', padding: '0.75rem 1rem',
                      borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '4px 12px 12px 12px',
                      background: msg.role === 'user' ? 'rgba(120,119,198,0.15)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${msg.role === 'user' ? 'rgba(120,119,198,0.2)' : 'rgba(255,255,255,0.07)'}`,
                      fontSize: '0.82rem', color: msg.role === 'user' ? '#BAE6FD' : '#8790A8',
                      lineHeight: 1.65, whiteSpace: 'pre-wrap',
                    }}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {aiLoading && (
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg, #635BFF, #A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Sparkles size={13} style={{ color: 'white' }} />
                    </div>
                    <div style={{ padding: '0.75rem 1rem', borderRadius: '4px 12px 12px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#A78BFA', animation: `bounce 1s ease-in-out ${i * 0.2}s infinite` }} />
                      ))}
                    </div>
                  </div>
                )}
                {aiError && (
                  <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.2)', borderRadius: '8px', fontSize: '0.78rem', color: '#FCA5A5' }}>
                    {aiError}
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '0.75rem', flexShrink: 0 }}>
                <input
                  type="text"
                  placeholder="Ask anything about this document…"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  className="input-field"
                  style={{ flex: 1 }}
                  disabled={aiLoading}
                />
                <button
                  className="btn-ai"
                  style={{ height: '38px', padding: '0 1rem', flexShrink: 0 }}
                  onClick={handleSendMessage}
                  disabled={aiLoading || !chatInput.trim()}
                  aria-label="Send message"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
