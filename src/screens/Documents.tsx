import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLayout } from '../hooks/useLayout';
import {
  Search, Upload, FileText, Download,
  ExternalLink, Sparkles, Eye, Trash2, Plus, X, Loader2, Star, FolderInput, ClipboardCopy,
} from 'lucide-react';
import {
  getDocuments, upsertDocument, deleteDocument, updateDocument,
  getWorkspaces,
} from '../lib/db';
import type { DocumentRow, WorkspaceRow } from '../lib/db';
import { supabase } from '../lib/supabase';
import { chatWithDocument } from '../lib/openrouter';

async function downloadFile(doc: DocumentRow) {
  if (!doc.file_url) {
    alert('No file attached to this document.');
    return;
  }
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
  window.open(doc.file_url, '_blank');
}

const DOC_TYPES = [
  'BRD', 'FRD', 'Meeting Minutes', 'Proposals', 'Evaluations',
  'Contracts', 'Policies', 'Technical Specs', 'Reports', 'Charters', 'Other',
];
const TYPE_COLORS: Record<string, string> = {
  BRD: '#0EA5E9', FRD: '#8B5CF6', 'Meeting Minutes': '#10B981',
  Proposals: '#F59E0B', Evaluations: '#EC4899', Contracts: '#EF4444',
  Policies: '#14B8A6', 'Technical Specs': '#6366F1', Reports: '#F97316',
  Charters: '#84CC16', Other: '#94A3B8',
};
const STATUS_OPTIONS = ['Draft', 'Under Review', 'Approved', 'Final'] as const;
const LANG_OPTIONS = ['EN', 'AR', 'Bilingual'] as const;

function statusClass(s: string) {
  if (s === 'Approved') return 'status-approved';
  if (s === 'Under Review') return 'status-review';
  if (s === 'Final') return 'status-active';
  return 'status-draft';
}

export default function Documents() {
  const navigate = useNavigate();
  const { isMobile, isTablet } = useLayout();

  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeFolder, setActiveFolder] = useState('All Documents');
  const [activeStatus, setActiveStatus] = useState('All');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [langFilter, setLangFilter] = useState<'All' | 'EN' | 'AR' | 'Bilingual'>('All');
  const [recentOnly, setRecentOnly] = useState(false);
  const [authorFilter, setAuthorFilter] = useState<string>('All');
  const [workspaceFilter, setWorkspaceFilter] = useState<string>('All');
  const [pagesFilter, setPagesFilter] = useState<'All' | 'Short' | 'Medium' | 'Long'>('All');
  const [search, setSearch] = useState('');
  const [docSort, setDocSort] = useState<'newest' | 'oldest' | 'name' | 'type' | 'pages' | 'author' | 'workspace' | 'language'>('newest');
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);

  // Upload modal
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: '', type: 'BRD', workspace_id: '', language: 'EN' as typeof LANG_OPTIONS[number],
    status: 'Draft' as typeof STATUS_OPTIONS[number], author: '', summary: '', tags: '',
  });

  // Delete
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk selection
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Inline status change
  const [statusChanging, setStatusChanging] = useState<string | null>(null);

  // AI Summarize
  const [summarizing, setSummarizing] = useState(false);

  // Move to Workspace
  const [movingDoc, setMovingDoc] = useState<DocumentRow | null>(null);
  const [moveTargetWsId, setMoveTargetWsId] = useState('');
  const [movingSaving, setMovingSaving] = useState(false);
  const [moveToast, setMoveToast] = useState<string | null>(null);
  const [docSummaryCopied, setDocSummaryCopied] = useState(false);
  const [docsCsvExported, setDocsCsvExported] = useState(false);
  const [docsTxtExported, setDocsTxtExported] = useState(false);

  function handleExportDocsCSV(docsToExport: DocumentRow[]) {
    if (docsToExport.length === 0) return;
    const headers = ['Name', 'Type', 'Status', 'Author', 'Workspace', 'Language', 'Tags'];
    const rows = docsToExport.map(d => [
      `"${d.name.replace(/"/g, '""')}"`,
      d.type ?? '',
      d.status ?? '',
      `"${(d.author ?? '').replace(/"/g, '""')}"`,
      `"${(d.workspace ?? '').replace(/"/g, '""')}"`,
      d.language ?? '',
      `"${(Array.isArray(d.tags) ? d.tags.join('; ') : d.tags ?? '').replace(/"/g, '""')}"`,
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `documents_export.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDocsCsvExported(true);
    setTimeout(() => setDocsCsvExported(false), 2000);
  }

  function handleExportDocsTxt(docsToExport: DocumentRow[]) {
    if (docsToExport.length === 0) return;
    const lines = [
      `Documents Export – Consultant OS`,
      `Total: ${docsToExport.length}`,
      '',
      ...docsToExport.map(d => [
        `Name: ${d.name}`,
        `Type: ${d.type ?? 'Unknown'} | Status: ${d.status ?? 'Unknown'}`,
        `Author: ${d.author ?? 'Unknown'}`,
        d.workspace ? `Workspace: ${d.workspace}` : null,
        d.tags && (Array.isArray(d.tags) ? d.tags.length > 0 : d.tags) ? `Tags: ${Array.isArray(d.tags) ? d.tags.join(', ') : d.tags}` : null,
        '',
      ].filter(Boolean).join('\n')),
    ].join('\n');
    const blob = new Blob([lines], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `documents_export.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDocsTxtExported(true);
    setTimeout(() => setDocsTxtExported(false), 2000);
  }

  async function handleMoveToWorkspace() {
    if (!movingDoc || !moveTargetWsId) return;
    setMovingSaving(true);
    try {
      const targetWs = workspaces.find(w => w.id === moveTargetWsId);
      const updated = await updateDocument(movingDoc.id, {
        workspace_id: moveTargetWsId,
        workspace: targetWs?.name ?? movingDoc.workspace,
      });
      setDocs(prev => prev.map(d => d.id === movingDoc.id ? updated : d));
      setMoveToast(`"${movingDoc.name}" moved to ${targetWs?.name ?? 'workspace'}`);
      setTimeout(() => setMoveToast(null), 3000);
    } catch { /* silently fail */ }
    finally {
      setMovingSaving(false);
      setMovingDoc(null);
      setMoveTargetWsId('');
    }
  }

  function handleCopyDocSummary() {
    const lines = [
      `Document Summary – Consultant OS`,
      `Total Documents: ${docs.length}`,
      `Visible (filtered): ${filtered.length}`,
      `Draft: ${docs.filter(d => d.status === 'Draft').length}`,
      `Under Review: ${docs.filter(d => d.status === 'Under Review').length}`,
      `Approved: ${docs.filter(d => d.status === 'Approved').length}`,
    ].join('\n');
    navigator.clipboard.writeText(lines).then(() => {
      setDocSummaryCopied(true);
      setTimeout(() => setDocSummaryCopied(false), 2000);
    }).catch(() => {});
  }

  // Pinned documents
  const PINNED_DOCS_KEY = 'pinned_documents';
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(PINNED_DOCS_KEY) ?? '[]') as string[]); } catch { return new Set(); }
  });

  function togglePin(docId: string) {
    setPinnedIds(prev => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId); else next.add(docId);
      try { localStorage.setItem(PINNED_DOCS_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

  async function load() {
    setLoading(true);
    try {
      const [d, w] = await Promise.all([getDocuments(), getWorkspaces()]);
      setDocs(d);
      setWorkspaces(w);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Build folder counts from real data
  const folderCounts: Record<string, number> = { 'All Documents': docs.length };
  docs.forEach(d => {
    folderCounts[d.type] = (folderCounts[d.type] || 0) + 1;
  });
  const pinnedCount = docs.filter(d => pinnedIds.has(d.id)).length;
  const folders = [
    { label: 'All Documents', count: docs.length },
    { label: 'Pinned', count: pinnedCount },
    ...DOC_TYPES.map(t => ({ label: t, count: folderCounts[t] || 0 })),
  ];

  // Collect all unique tags across documents
  const allTags = Array.from(new Set(docs.flatMap(d => d.tags ?? []))).sort();

  const authorOptions = useMemo(() =>
    ['All', ...Array.from(new Set(docs.map(d => d.author).filter(Boolean))).sort()],
    [docs]
  );

  const docWorkspaceOptions = useMemo(() =>
    ['All', ...Array.from(new Set(docs.map(d => d.workspace).filter(Boolean))).sort()],
    [docs]
  );

  const filtered = (() => {
    const base = docs.filter(doc => {
      const matchFolder = activeFolder === 'All Documents'
        ? true
        : activeFolder === 'Pinned'
        ? pinnedIds.has(doc.id)
        : doc.type === activeFolder;
      const matchStatus = activeStatus === 'All' || doc.status === activeStatus;
      const matchLang = langFilter === 'All' || doc.language === langFilter;
      const matchTag = !activeTag || (doc.tags ?? []).includes(activeTag);
      const matchAuthor = authorFilter === 'All' || doc.author === authorFilter;
      const matchWorkspace = workspaceFilter === 'All' || doc.workspace === workspaceFilter;
      const matchPages = pagesFilter === 'All' ? true : pagesFilter === 'Short' ? (doc.pages ?? 0) < 10 : pagesFilter === 'Medium' ? (doc.pages ?? 0) >= 10 && (doc.pages ?? 0) <= 30 : (doc.pages ?? 0) > 30;
      const matchSearch =
        doc.name.toLowerCase().includes(search.toLowerCase()) ||
        doc.workspace.toLowerCase().includes(search.toLowerCase()) ||
        doc.author.toLowerCase().includes(search.toLowerCase());
      const matchRecent = (() => {
        if (!recentOnly) return true;
        if (!doc.date) return false;
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return new Date(doc.date) >= sevenDaysAgo;
      })();
      return matchFolder && matchStatus && matchLang && matchTag && matchSearch && matchRecent && matchAuthor && matchWorkspace && matchPages;
    });
    if (docSort === 'name') return [...base].sort((a, b) => a.name.localeCompare(b.name));
    if (docSort === 'type') return [...base].sort((a, b) => a.type.localeCompare(b.type));
    if (docSort === 'oldest') return [...base].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
    if (docSort === 'pages') return [...base].sort((a, b) => (b.pages ?? 0) - (a.pages ?? 0));
    if (docSort === 'author') return [...base].sort((a, b) => (a.author ?? '').localeCompare(b.author ?? ''));
    if (docSort === 'workspace') return [...base].sort((a, b) => (a.workspace ?? '').localeCompare(b.workspace ?? ''));
    if (docSort === 'language') return [...base].sort((a, b) => (a.language ?? '').localeCompare(b.language ?? ''));
    return [...base].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  })();

  const selected = docs.find(d => d.id === selectedDoc);

  async function handleUpload() {
    if (!form.name.trim()) { setUploadError('Document name is required.'); return; }
    if (!form.workspace_id) { setUploadError('Please select a workspace.'); return; }
    setUploading(true);
    setUploadError('');
    try {
      const file = fileRef.current?.files?.[0];
      let file_url: string | null = null;
      let size = '—';

      if (file) {
        const ext = file.name.split('.').pop();
        const path = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const { error: upErr } = await supabase.storage
          .from('workspace-docs')
          .upload(path, file, { upsert: false });
        if (upErr) throw new Error(upErr.message);
        const { data: urlData } = supabase.storage.from('workspace-docs').getPublicUrl(path);
        file_url = urlData.publicUrl;
        size = file.size > 1_000_000
          ? `${(file.size / 1_000_000).toFixed(1)} MB`
          : `${(file.size / 1_000).toFixed(0)} KB`;
      }

      const ws = workspaces.find(w => w.id === form.workspace_id);
      await upsertDocument({
        id: crypto.randomUUID(),
        name: form.name.trim(),
        type: form.type,
        type_color: TYPE_COLORS[form.type] ?? '#94A3B8',
        workspace: ws?.name ?? '',
        workspace_id: form.workspace_id,
        date: new Date().toISOString().slice(0, 10),
        language: form.language,
        status: form.status,
        size,
        author: form.author.trim() || 'Unknown',
        pages: 0,
        summary: form.summary.trim(),
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        file_url,
      });
      setShowUpload(false);
      setForm({ name: '', type: 'BRD', workspace_id: '', language: 'EN', status: 'Draft', author: '', summary: '', tags: '' });
      if (fileRef.current) fileRef.current.value = '';
      await load();
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      const doc = docs.find(d => d.id === id);
      if (doc?.file_url) {
        const path = doc.file_url.split('/workspace-docs/')[1];
        if (path) await supabase.storage.from('workspace-docs').remove([path]).catch(() => {});
      }
      await deleteDocument(id);
      if (selectedDoc === id) setSelectedDoc(null);
      setConfirmDelete(null);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  async function handleBulkDelete() {
    if (bulkSelected.size === 0) return;
    setBulkDeleting(true);
    try {
      await Promise.all([...bulkSelected].map(id => deleteDocument(id)));
      setBulkSelected(new Set());
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Bulk delete failed');
    } finally {
      setBulkDeleting(false);
    }
  }

  async function handleStatusChange(id: string, status: string) {
    setStatusChanging(id);
    try {
      await updateDocument(id, { status: status as DocumentRow['status'] });
      setDocs(prev => prev.map(d => d.id === id ? { ...d, status: status as DocumentRow['status'] } : d));
    } catch { /* silently fail */ }
    setStatusChanging(null);
  }

  function handleDownload(doc: DocumentRow) {
    downloadFile(doc);
  }

  async function handleSummarize() {
    if (!selected) return;
    setSummarizing(true);
    try {
      const systemPrompt = `You are a professional document analyst. Generate a concise 3-5 sentence executive summary for the given document. Focus on purpose, scope, key findings or requirements, and intended audience.`;
      const userMsg = `Generate a summary for this document:\n\nName: ${selected.name}\nType: ${selected.type}\nWorkspace: ${selected.workspace}\nAuthor: ${selected.author}\nStatus: ${selected.status}\nDate: ${selected.date}\nExisting Summary: ${selected.summary || 'None'}\nTags: ${selected.tags?.join(', ') || 'None'}`;
      const result = await chatWithDocument([{ role: 'user', content: userMsg }], systemPrompt);
      await updateDocument(selected.id, { summary: result });
      setDocs(prev => prev.map(d => d.id === selected.id ? { ...d, summary: result } : d));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Summarize failed');
    } finally {
      setSummarizing(false);
    }
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', overflow: 'hidden', position: 'relative' }}>
      {/* Left sidebar */}
      {!isTablet && (
        <div style={{
          width: '200px', minWidth: '200px', borderRight: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', flexDirection: 'column', overflowY: 'auto', background: '#0C1220',
          padding: '1rem 0.75rem',
        }}>
          <div style={{ fontSize: '0.68rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.625rem', paddingLeft: '0.25rem' }}>
            Folders
          </div>
          {folders.map(folder => (
            <div
              key={folder.label}
              onClick={() => setActiveFolder(folder.label)}
              role="button"
              aria-label={`Folder: ${folder.label}`}
              aria-pressed={activeFolder === folder.label}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.5rem 0.625rem', borderRadius: '0.5rem', cursor: 'pointer',
                background: activeFolder === folder.label ? 'rgba(0,212,255,0.08)' : 'transparent',
                borderLeft: activeFolder === folder.label ? '2px solid #00D4FF' : '2px solid transparent',
                transition: 'all 0.15s', marginBottom: '1px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={13} style={{ color: activeFolder === folder.label ? '#00D4FF' : '#475569' }} />
                <span style={{ fontSize: '0.78rem', color: activeFolder === folder.label ? '#00D4FF' : '#475569', fontWeight: activeFolder === folder.label ? 500 : 400 }}>
                  {folder.label}
                </span>
              </div>
              {folder.label === 'All Documents' ? (
                <span style={{ fontSize: '0.65rem', color: '#00D4FF', background: 'rgba(0,212,255,0.12)', padding: '1px 7px', borderRadius: '9999px', fontWeight: 600 }}>{folder.count}</span>
              ) : (
                <span style={{ fontSize: '0.65rem', color: '#334155' }}>{folder.count || ''}</span>
              )}
            </div>
          ))}

          {/* Tags section */}
          {allTags.length > 0 && (
            <>
              <div style={{ fontSize: '0.68rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '1rem', marginBottom: '0.4rem', paddingLeft: '0.25rem' }}>
                Tags
              </div>
              {activeTag && (
                <div
                  onClick={() => setActiveTag(null)}
                  role="button"
                  aria-label="Clear tag filter"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '3px 0.625rem 3px 0.375rem', borderRadius: '9999px', background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.25)', cursor: 'pointer', marginBottom: '0.375rem', width: 'fit-content' }}
                >
                  <X size={10} style={{ color: '#00D4FF' }} />
                  <span style={{ fontSize: '0.7rem', color: '#00D4FF', fontWeight: 500 }}>{activeTag}</span>
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                    aria-label={`Tag: ${tag}`}
                    aria-pressed={activeTag === tag}
                    style={{
                      fontSize: '0.65rem', padding: '2px 8px', borderRadius: '9999px',
                      background: activeTag === tag ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.04)',
                      color: activeTag === tag ? '#00D4FF' : '#475569',
                      border: activeTag === tag ? '1px solid rgba(0,212,255,0.3)' : '1px solid rgba(255,255,255,0.06)',
                      cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                      transition: 'all 0.15s',
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Toolbar */}
        <div style={{
          padding: '0.875rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0,
          background: '#080C18', flexWrap: 'wrap',
        }}>
          <button className="btn-primary" aria-label="Upload Document" style={{ height: '34px', fontSize: '0.8rem', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#34D399' }} onClick={() => setShowUpload(true)}>
            <Upload size={13} /> Upload
          </button>
          <button className="btn-ai" aria-label="AI Summarize" style={{ height: '34px', fontSize: '0.8rem' }} onClick={handleSummarize} disabled={!selected || summarizing}>
            <Sparkles size={13} /> {summarizing ? 'Summarizing…' : 'AI Summarize'}
          </button>
          {bulkSelected.size > 0 && (
            <button
              className="btn-primary"
              style={{ height: '34px', fontSize: '0.8rem', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5' }}
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              aria-label={`Delete ${bulkSelected.size} selected`}
            >
              <Trash2 size={13} /> {bulkDeleting ? 'Deleting…' : `Delete ${bulkSelected.size} selected`}
            </button>
          )}

          <div style={{ flex: 1 }} />

          {/* Status filters */}
          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
            {['All', 'Draft', 'Under Review', 'Approved'].map(s => (
              <button
                key={s}
                className={`tab-item ${activeStatus === s ? 'active' : ''}`}
                onClick={() => setActiveStatus(s)}
                aria-label={`Status: ${s}`}
                aria-pressed={activeStatus === s}
                style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Language filters */}
          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
            {(['All', 'EN', 'AR', 'Bilingual'] as const).map(lf => (
              <button
                key={lf}
                className={`tab-item ${langFilter === lf ? 'active' : ''}`}
                onClick={() => setLangFilter(lf)}
                aria-label={`Language: ${lf}`}
                aria-pressed={langFilter === lf}
                style={{ padding: '0.25rem 0.625rem', fontSize: '0.72rem' }}
              >
                {lf}
              </button>
            ))}
          </div>

          {/* Recent toggle */}
          <button
            onClick={() => setRecentOnly(v => !v)}
            aria-label="Show recent documents only"
            aria-pressed={recentOnly}
            className={`tab-item${recentOnly ? ' active' : ''}`}
            style={{ padding: '0.25rem 0.625rem', fontSize: '0.72rem', whiteSpace: 'nowrap' }}
          >
            Recent (7d)
          </button>

          {/* Author filter */}
          {authorOptions.length > 1 && (
            <select
              aria-label="Filter documents by author"
              value={authorFilter}
              onChange={e => setAuthorFilter(e.target.value)}
              style={{ height: '34px', fontSize: '0.72rem', padding: '0 0.5rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.08)', background: authorFilter !== 'All' ? 'rgba(0,212,255,0.07)' : 'rgba(255,255,255,0.04)', color: authorFilter !== 'All' ? '#00D4FF' : '#64748B', fontFamily: 'inherit', cursor: 'pointer', outline: 'none', whiteSpace: 'nowrap' }}
            >
              <option value="All">All Authors</option>
              {authorOptions.slice(1).map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          )}

          {/* Workspace filter */}
          {docWorkspaceOptions.length > 1 && (
            <select
              aria-label="Filter documents by workspace"
              value={workspaceFilter}
              onChange={e => setWorkspaceFilter(e.target.value)}
              style={{ height: '34px', fontSize: '0.72rem', padding: '0 0.5rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.08)', background: workspaceFilter !== 'All' ? 'rgba(0,212,255,0.07)' : 'rgba(255,255,255,0.04)', color: workspaceFilter !== 'All' ? '#00D4FF' : '#64748B', fontFamily: 'inherit', cursor: 'pointer', outline: 'none', whiteSpace: 'nowrap' }}
            >
              <option value="All">All Workspaces</option>
              {docWorkspaceOptions.slice(1).map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          )}

          {/* Pages filter */}
          <select
            aria-label="Filter documents by pages"
            value={pagesFilter}
            onChange={e => setPagesFilter(e.target.value as typeof pagesFilter)}
            style={{ height: '34px', fontSize: '0.72rem', padding: '0 0.5rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.08)', background: pagesFilter !== 'All' ? 'rgba(0,212,255,0.07)' : 'rgba(255,255,255,0.04)', color: pagesFilter !== 'All' ? '#00D4FF' : '#64748B', fontFamily: 'inherit', cursor: 'pointer', outline: 'none', whiteSpace: 'nowrap' }}
          >
            <option value="All">All Lengths</option>
            <option value="Short">Short (&lt;10 pages)</option>
            <option value="Medium">Medium (10–30)</option>
            <option value="Long">Long (&gt;30 pages)</option>
          </select>

          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 0.75rem',
            height: '34px', borderRadius: '0.5rem', background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)', width: isMobile ? '100%' : '200px',
          }}>
            <Search size={13} style={{ color: '#475569' }} />
            <input
              type="text"
              aria-label="Search documents"
              placeholder="Filter docs..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '0.78rem', color: '#F1F5F9', width: '100%', fontFamily: 'inherit' }}
            />
          </div>

          {/* Sort */}
          <select
            aria-label="Sort documents"
            value={docSort}
            onChange={e => setDocSort(e.target.value as typeof docSort)}
            style={{
              height: '34px', borderRadius: '0.5rem', background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.75rem', color: '#94A3B8',
              paddingLeft: '0.5rem', paddingRight: '1.25rem', fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="name">Name</option>
            <option value="type">Type</option>
            <option value="pages">Pages</option>
            <option value="author">Author</option>
            <option value="workspace">Workspace</option>
            <option value="language">Language</option>
          </select>

          {/* Export Documents CSV */}
          <button
            onClick={() => handleExportDocsCSV(filtered)}
            disabled={filtered.length === 0}
            aria-label="Export documents to CSV"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem',
              height: '34px', padding: '0 0.75rem', borderRadius: '0.5rem',
              background: docsCsvExported ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
              border: docsCsvExported ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.08)',
              color: docsCsvExported ? '#34D399' : '#475569',
              cursor: filtered.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '0.78rem',
            }}
          >
            <Download size={13} /> {docsCsvExported ? 'Exported!' : 'Export CSV'}
          </button>

          {/* Export Documents TXT */}
          <button
            onClick={() => handleExportDocsTxt(filtered)}
            disabled={filtered.length === 0}
            aria-label="Export documents to TXT"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem',
              height: '34px', padding: '0 0.75rem', borderRadius: '0.5rem',
              background: docsTxtExported ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
              border: docsTxtExported ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.08)',
              color: docsTxtExported ? '#34D399' : '#475569',
              cursor: filtered.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '0.78rem',
            }}
          >
            <FileText size={13} /> {docsTxtExported ? 'Exported!' : 'Export TXT'}
          </button>

          {/* Copy Document Summary */}
          <button
            onClick={handleCopyDocSummary}
            aria-label="Copy document summary to clipboard"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem',
              height: '34px', padding: '0 0.75rem', borderRadius: '0.5rem',
              background: docSummaryCopied ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
              border: docSummaryCopied ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.08)',
              color: docSummaryCopied ? '#34D399' : '#475569',
              cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.78rem',
            }}
          >
            <ClipboardCopy size={13} /> {docSummaryCopied ? 'Copied!' : 'Copy Stats'}
          </button>
        </div>

        {error && (
          <div style={{ padding: '0.625rem 1.25rem', background: 'rgba(239,68,68,0.1)', borderBottom: '1px solid rgba(239,68,68,0.2)', fontSize: '0.78rem', color: '#FCA5A5' }}>
            {error}
          </div>
        )}

        {/* Document List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#475569', gap: '0.5rem' }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
            </div>
          ) : (
            <table className="data-table" style={{ tableLayout: 'fixed' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#080C18', zIndex: 1 }}>
                <tr>
                  <th style={{ width: '28px', padding: '0 0.5rem' }}>
                    <input
                      type="checkbox"
                      aria-label="Select all documents"
                      checked={filtered.length > 0 && filtered.every(d => bulkSelected.has(d.id))}
                      onChange={e => {
                        if (e.target.checked) {
                          setBulkSelected(new Set(filtered.map(d => d.id)));
                        } else {
                          setBulkSelected(new Set());
                        }
                      }}
                      style={{ cursor: 'pointer', accentColor: '#0EA5E9' }}
                    />
                  </th>
                  <th style={{ width: '30%' }}>Document</th>
                  <th style={{ width: '15%' }}>Workspace</th>
                  <th style={{ width: '11%' }}>Type</th>
                  <th style={{ width: '10%' }}>Date</th>
                  <th style={{ width: '14%' }}>Status</th>
                  <th style={{ width: '14%' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc) => (
                  <tr
                    key={doc.id}
                    onClick={() => setSelectedDoc(selectedDoc === doc.id ? null : doc.id)}
                    style={{
                      cursor: 'pointer',
                      background: bulkSelected.has(doc.id) ? 'rgba(14,165,233,0.07)' : selectedDoc === doc.id ? 'rgba(0,212,255,0.05)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '0 0.5rem' }} onClick={e => {
                      e.stopPropagation();
                      setBulkSelected(prev => {
                        const next = new Set(prev);
                        if (next.has(doc.id)) next.delete(doc.id); else next.add(doc.id);
                        return next;
                      });
                    }}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${doc.name}`}
                        checked={bulkSelected.has(doc.id)}
                        onChange={() => {}}
                        style={{ cursor: 'pointer', accentColor: '#0EA5E9' }}
                      />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <div style={{ padding: '0.375rem', borderRadius: '6px', background: `${doc.type_color}15`, color: doc.type_color, flexShrink: 0 }}>
                          <FileText size={13} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {doc.name}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: '#334155' }}>{doc.author}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.72rem', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                        {doc.workspace.split(' ').slice(0, 3).join(' ')}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.7rem', padding: '3px 10px', borderRadius: '9999px', background: `${doc.type_color}18`, color: doc.type_color, fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {doc.type}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.72rem' }}>{doc.date}</td>
                    <td onClick={e => e.stopPropagation()}>
                      {statusChanging === doc.id ? (
                        <Loader2 size={12} style={{ animation: 'spin 1s linear infinite', color: '#475569' }} />
                      ) : (
                        <span
                          onClick={() => {
                            const idx = STATUS_OPTIONS.indexOf(doc.status as typeof STATUS_OPTIONS[number]);
                            const next = STATUS_OPTIONS[(idx + 1) % STATUS_OPTIONS.length];
                            handleStatusChange(doc.id, next);
                          }}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            fontSize: '0.7rem', padding: '3px 10px', borderRadius: '9999px', cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap',
                            background: doc.status === 'Approved' ? 'rgba(52,211,153,0.12)' : doc.status === 'Under Review' ? 'rgba(251,191,36,0.12)' : doc.status === 'Final' ? 'rgba(0,212,255,0.12)' : 'rgba(148,163,184,0.12)',
                            color: doc.status === 'Approved' ? '#34D399' : doc.status === 'Under Review' ? '#FBBF24' : doc.status === 'Final' ? '#00D4FF' : '#94A3B8',
                          }}
                        >
                          <span style={{
                            width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                            background: doc.status === 'Approved' ? '#34D399' : doc.status === 'Under Review' ? '#FBBF24' : doc.status === 'Final' ? '#00D4FF' : '#94A3B8',
                          }} />
                          {doc.status}
                        </span>
                      )}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                        <button
                          onClick={() => togglePin(doc.id)}
                          style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: pinnedIds.has(doc.id) ? '#F59E0B' : '#475569', borderRadius: '4px' }}
                          title={pinnedIds.has(doc.id) ? 'Unpin document' : 'Pin document'}
                          aria-label={pinnedIds.has(doc.id) ? `Unpin ${doc.name}` : `Pin ${doc.name}`}
                          aria-pressed={pinnedIds.has(doc.id)}
                        >
                          <Star size={12} />
                        </button>
                        <button
                          onClick={() => navigate(`/documents/${doc.id}`)}
                          style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: '#475569', borderRadius: '4px' }}
                          title="Open"
                          aria-label={`Open ${doc.name}`}
                        >
                          <ExternalLink size={12} />
                        </button>
                        <button
                          onClick={() => handleDownload(doc)}
                          style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: doc.file_url ? '#00D4FF' : '#334155', borderRadius: '4px' }}
                          title={doc.file_url ? 'Download file' : 'No file attached'}
                          aria-label={`Download ${doc.name}`}
                        >
                          <Download size={12} />
                        </button>
                        <button
                          onClick={() => { setMovingDoc(doc); setMoveTargetWsId(doc.workspace_id ?? ''); }}
                          style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: '#A78BFA', borderRadius: '4px' }}
                          title="Move to workspace"
                          aria-label={`Move ${doc.name} to workspace`}
                        >
                          <FolderInput size={12} />
                        </button>
                        {confirmDelete === doc.id ? (
                          <>
                            <button
                              onClick={() => handleDelete(doc.id)}
                              disabled={deleting}
                              style={{ fontSize: '0.68rem', padding: '2px 6px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', borderRadius: '4px', cursor: 'pointer' }}
                              aria-label={`Confirm delete ${doc.name}`}
                            >
                              {deleting ? '…' : 'Delete'}
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              style={{ fontSize: '0.68rem', padding: '2px 6px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#475569', borderRadius: '4px', cursor: 'pointer' }}
                              aria-label={`Cancel delete ${doc.name}`}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(doc.id)}
                            style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: '#475569', borderRadius: '4px' }}
                            title="Delete"
                            aria-label={`Delete ${doc.name}`}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#334155' }}>
                      {docs.length === 0 ? 'No documents yet — upload your first document.' : 'No documents match your filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Right Preview Panel */}
      {selected && (
        <div style={{
          ...(isTablet
            ? { position: 'absolute' as const, top: 0, right: 0, bottom: 0, width: '100%', zIndex: 20 }
            : { width: '280px', minWidth: '280px' }),
          borderLeft: isTablet ? 'none' : '1px solid rgba(255,255,255,0.05)',
          display: 'flex', flexDirection: 'column', overflowY: 'auto', background: '#0C1220',
          padding: '1rem', animation: 'fadeIn 0.2s ease-out',
        }}>
          {isTablet && (
            <button
              onClick={() => setSelectedDoc(null)}
              style={{
                alignSelf: 'flex-end', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px', padding: '0.25rem 0.5rem', cursor: 'pointer', color: '#94A3B8',
                fontSize: '0.75rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem',
              }}
            >
              <X size={14} /> Close
            </button>
          )}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ padding: '0.5rem', borderRadius: '8px', background: `${selected.type_color}15`, color: selected.type_color, display: 'inline-flex', marginBottom: '0.5rem' }}>
              <FileText size={18} />
            </div>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#F1F5F9', margin: 0, marginBottom: '0.25rem', lineHeight: 1.3 }}>
              {selected.name}
            </h3>
            <p style={{ fontSize: '0.72rem', color: '#475569', margin: 0 }}>{selected.workspace}</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '1rem', padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
            {[
              { label: 'Type', value: selected.type },
              { label: 'Author', value: selected.author },
              { label: 'Date', value: selected.date },
              { label: 'Size', value: selected.size },
              { label: 'Language', value: selected.language },
              { label: 'Status', value: selected.status },
            ].map(m => (
              <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.7rem', color: '#334155' }}>{m.label}</span>
                <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 500 }}>{m.value}</span>
              </div>
            ))}
          </div>

          {selected.summary && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.5rem' }}>
                <Sparkles size={13} style={{ color: '#8B5CF6' }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8' }}>Summary</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#475569', lineHeight: 1.5, margin: 0 }}>{selected.summary}</p>
            </div>
          )}

          {selected.tags?.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#334155', marginBottom: '0.375rem' }}>Tags</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                {selected.tags.map(tag => (
                  <span key={tag} style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: 'auto' }}>
            <button className="btn-primary" style={{ fontSize: '0.78rem', justifyContent: 'center' }} onClick={() => navigate(`/documents/${selected.id}`)}>
              <Eye size={13} /> Open Document
            </button>
            <button
              className="btn-ghost"
              style={{ fontSize: '0.78rem', justifyContent: 'center', opacity: selected.file_url ? 1 : 0.4 }}
              onClick={() => handleDownload(selected)}
            >
              <Download size={13} /> {selected.file_url ? 'Download File' : 'No File Attached'}
            </button>
            {confirmDelete === selected.id ? (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => handleDelete(selected.id)}
                  disabled={deleting}
                  style={{ flex: 1, fontSize: '0.78rem', padding: '0.5rem', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', borderRadius: '0.5rem', cursor: 'pointer' }}
                >
                  {deleting ? '…' : 'Confirm Delete'}
                </button>
                <button
                  onClick={() => setConfirmDelete(null)}
                  style={{ flex: 1, fontSize: '0.78rem', padding: '0.5rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#475569', borderRadius: '0.5rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(selected.id)}
                style={{ fontSize: '0.78rem', padding: '0.5rem', background: 'transparent', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}
              >
                <Trash2 size={13} /> Delete Document
              </button>
            )}
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div style={{ background: '#0C1220', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', padding: '1.5rem', width: '100%', maxWidth: isMobile ? 'calc(100% - 1rem)' : '520px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#F1F5F9' }}>Upload Document</h2>
              <button onClick={() => { setShowUpload(false); setUploadError(''); }} aria-label="Close upload modal" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569' }}>
                <X size={18} />
              </button>
            </div>

            {uploadError && (
              <div style={{ marginBottom: '1rem', padding: '0.625rem 0.875rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '0.5rem', fontSize: '0.78rem', color: '#FCA5A5' }}>
                {uploadError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Document Name *</span>
                <input
                  className="input-field"
                  aria-label="Document name"
                  placeholder="e.g. Project Charter v1.0"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Type</span>
                  <select className="input-field" aria-label="Document type" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={{ cursor: 'pointer' }}>
                    {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Workspace *</span>
                  <select className="input-field" aria-label="Document workspace" value={form.workspace_id} onChange={e => setForm(f => ({ ...f, workspace_id: e.target.value }))} style={{ cursor: 'pointer' }}>
                    <option value="">Select workspace…</option>
                    {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Language</span>
                  <select className="input-field" aria-label="Document language" value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value as typeof LANG_OPTIONS[number] }))} style={{ cursor: 'pointer' }}>
                    {LANG_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Status</span>
                  <select className="input-field" aria-label="Document status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as typeof STATUS_OPTIONS[number] }))} style={{ cursor: 'pointer' }}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              </div>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Author</span>
                <input className="input-field" aria-label="Document author" placeholder="e.g. Ahmed Al-Mahmoud" value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Summary</span>
                <textarea
                  className="input-field"
                  aria-label="Document summary"
                  placeholder="Brief description of the document…"
                  value={form.summary}
                  onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Tags (comma separated)</span>
                <input className="input-field" aria-label="Document tags" placeholder="e.g. BRD, Phase 1, NCA" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Attach File (optional)</span>
                <input
                  ref={fileRef}
                  type="file"
                  style={{ fontSize: '0.78rem', color: '#94A3B8', padding: '0.375rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', cursor: 'pointer' }}
                />
              </label>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowUpload(false); setUploadError(''); }}
                style={{ padding: '0.5rem 1.125rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleUpload}
                disabled={uploading}
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
              >
                {uploading ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Uploading…</> : <><Plus size={14} /> Save Document</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move to Workspace toast */}
      {moveToast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 2000,
            background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.35)',
            borderRadius: '10px', padding: '0.75rem 1.25rem',
            color: '#A78BFA', fontSize: '0.82rem', fontWeight: 600,
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}
        >
          <FolderInput size={13} /> {moveToast}
        </div>
      )}

      {/* Move to Workspace modal */}
      {movingDoc && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(4px)' }}
          onClick={() => { setMovingDoc(null); setMoveTargetWsId(''); }}
        >
          <div
            role="dialog"
            aria-label="Move to Workspace"
            style={{ background: '#0C1220', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '1.5rem', width: '100%', maxWidth: '400px', margin: '1rem' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FolderInput size={15} style={{ color: '#A78BFA' }} />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Move to Workspace</h3>
              </div>
              <button className="btn-ghost" style={{ padding: '0.25rem' }} onClick={() => { setMovingDoc(null); setMoveTargetWsId(''); }} aria-label="Close move dialog">
                <X size={16} />
              </button>
            </div>
            <p style={{ margin: '0 0 1rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Move <strong style={{ color: 'var(--text-secondary)' }}>{movingDoc.name}</strong> to:
            </p>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', display: 'block', marginBottom: '0.375rem' }}>Target Workspace</label>
              <select
                className="input-field"
                value={moveTargetWsId}
                onChange={e => setMoveTargetWsId(e.target.value)}
                style={{ width: '100%', padding: '0.625rem 0.75rem', fontSize: '0.85rem', background: '#080C18' }}
                aria-label="Target workspace"
              >
                <option value="">Select workspace…</option>
                {workspaces.map(ws => (
                  <option key={ws.id} value={ws.id}>{ws.name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => { setMovingDoc(null); setMoveTargetWsId(''); }}>Cancel</button>
              <button
                className="btn-primary"
                onClick={handleMoveToWorkspace}
                disabled={!moveTargetWsId || movingSaving}
                style={{ padding: '0.5rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                aria-label="Move document"
              >
                <FolderInput size={13} />
                {movingSaving ? 'Moving…' : 'Move Document'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
