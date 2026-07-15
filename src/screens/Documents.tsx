import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Upload, FileText, Download, ExternalLink, Trash2,
  Plus, X, Loader2,
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  getDocuments, upsertDocument, deleteDocument, updateDocument, getWorkspaces,
} from '../lib/db';
import type { DocumentRow, WorkspaceRow } from '../lib/db';
import { supabase } from '../lib/supabase';
import { useLayout } from '../hooks/useLayout';
import { Badge, cn, fadeUp, stagger } from '../components/ui';

async function downloadFile(doc: DocumentRow) {
  if (!doc.file_url) { alert('No file attached to this document.'); return; }
  try {
    const parts = doc.file_url.split('/workspace-docs/');
    if (parts.length >= 2) {
      const path = decodeURIComponent(parts[1]);
      const { data: signed, error } = await supabase.storage.from('workspace-docs').createSignedUrl(path, 300);
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

const DOC_TYPES = ['BRD', 'FRD', 'Meeting Minutes', 'Proposals', 'Evaluations', 'Contracts', 'Policies', 'Technical Specs', 'Reports', 'Charters', 'Other'] as const;
const TYPE_COLORS: Record<string, string> = {
  BRD: '#7877C6', FRD: '#A78BFA', 'Meeting Minutes': '#34D399',
  Proposals: '#F5B544', Evaluations: '#F472B6', Contracts: '#FF6B6B',
  Policies: '#14B8A6', 'Technical Specs': '#6366F1', Reports: '#F0A875',
  Charters: '#84CC16', Other: '#8790A8',
};
const STATUS_OPTIONS = ['Draft', 'Under Review', 'Approved', 'Final'] as const;
const LANG_OPTIONS = ['EN', 'AR', 'Bilingual'] as const;

function statusTone(s: string): 'pending' | 'review' | 'success' | 'brand' | 'neutral' {
  if (s === 'Approved') return 'success';
  if (s === 'Under Review') return 'review';
  if (s === 'Final') return 'brand';
  if (s === 'Draft') return 'neutral';
  return 'pending';
}

export default function Documents() {
  const navigate = useNavigate();
  const { isMobile } = useLayout();

  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeFolder, setActiveFolder] = useState<'All Documents' | typeof DOC_TYPES[number]>('All Documents');
  const [search, setSearch] = useState('');

  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: '', type: 'BRD' as string, workspace_id: '', language: 'EN' as typeof LANG_OPTIONS[number],
    status: 'Draft' as typeof STATUS_OPTIONS[number], author: '', summary: '', tags: '',
  });

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const folders = [
    { label: 'All Documents' as const, count: docs.length },
    ...DOC_TYPES.map((t) => ({ label: t, count: docs.filter((d) => d.type === t).length })),
  ];

  const filtered = docs.filter((doc) => {
    const matchFolder = activeFolder === 'All Documents' || doc.type === activeFolder;
    const q = search.toLowerCase();
    const matchSearch =
      doc.name.toLowerCase().includes(q) ||
      doc.workspace.toLowerCase().includes(q) ||
      doc.author.toLowerCase().includes(q);
    return matchFolder && matchSearch;
  });

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
        const path = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const { error: upErr } = await supabase.storage.from('workspace-docs').upload(path, file, { upsert: false });
        if (upErr) throw new Error(upErr.message);
        const { data: urlData } = supabase.storage.from('workspace-docs').getPublicUrl(path);
        file_url = urlData.publicUrl;
        size = file.size > 1_000_000 ? `${(file.size / 1_000_000).toFixed(1)} MB` : `${(file.size / 1_000).toFixed(0)} KB`;
      }
      const ws = workspaces.find((w) => w.id === form.workspace_id);
      await upsertDocument({
        id: crypto.randomUUID(),
        name: form.name.trim(),
        type: form.type,
        type_color: TYPE_COLORS[form.type] ?? '#8790A8',
        workspace: ws?.name ?? '',
        workspace_id: form.workspace_id,
        date: new Date().toISOString().slice(0, 10),
        language: form.language,
        status: form.status,
        size,
        author: form.author.trim() || 'Unknown',
        pages: 0,
        summary: form.summary.trim(),
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
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
      const doc = docs.find((d) => d.id === id);
      if (doc?.file_url) {
        const path = doc.file_url.split('/workspace-docs/')[1];
        if (path) await supabase.storage.from('workspace-docs').remove([path]).catch(() => {});
      }
      await deleteDocument(id);
      setConfirmDelete(null);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  async function cycleStatus(doc: DocumentRow) {
    const idx = STATUS_OPTIONS.indexOf(doc.status as typeof STATUS_OPTIONS[number]);
    const next = STATUS_OPTIONS[(idx + 1) % STATUS_OPTIONS.length];
    try {
      await updateDocument(doc.id, { status: next });
      setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, status: next } : d)));
    } catch { /* ignore */ }
  }

  return (
    <motion.div
      initial="hidden" animate="show"
      variants={{ hidden: {}, show: { transition: stagger(0.05, 0.08) } }}
      className="screen-container"
    >
      {/* ── Header ───────────────────────────────────── */}
      <motion.div variants={fadeUp} className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-[1.5rem] md:text-[1.75rem] font-semibold tracking-[-0.025em] leading-tight text-white">Documents</h1>
          <p className="text-[0.78rem] text-[color:var(--text-muted)] mt-1">{docs.length} documents across {new Set(docs.map((d) => d.workspace)).size || 0} workspaces</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex items-center gap-2 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-md px-3.5 h-[38px] w-full sm:w-[260px]">
            <Search size={14} className="text-[color:var(--text-muted)] flex-shrink-0" />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter docs…"
              className="flex-1 bg-transparent border-0 outline-none text-[0.83rem] text-white placeholder:text-[color:var(--text-faint)] min-w-0"
            />
            {search && <button onClick={() => setSearch('')} className="text-[color:var(--text-muted)] hover:text-white"><X size={13} /></button>}
          </div>
          <button onClick={() => setShowUpload(true)} className="btn-primary">
            <Upload size={14} /> Upload
          </button>
        </div>
      </motion.div>

      {/* ── Folder pills ─────────────────────────────── */}
      <motion.div variants={fadeUp} className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[0.66rem] font-semibold tracking-[0.1em] uppercase text-[color:var(--text-muted)] mr-1">Folders</span>
        {folders.map((folder) => {
          const isActive = activeFolder === folder.label;
          return (
            <button
              key={folder.label}
              onClick={() => setActiveFolder(folder.label)}
              className={cn(
                'relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.76rem] font-medium transition-colors border',
                isActive
                  ? 'bg-[rgba(120,119,198,0.18)] text-white border-[rgba(120,119,198,0.35)]'
                  : 'bg-white/[0.025] border-white/[0.06] text-[color:var(--text-muted)] hover:text-white hover:bg-white/[0.05]',
              )}
            >
              {folder.label}
              {folder.count > 0 && (
                <span className={cn('text-[0.62rem] tabular-nums font-bold', isActive ? 'text-[#C4B5FD]' : 'text-[color:var(--text-faint)]')}>
                  {folder.count}
                </span>
              )}
            </button>
          );
        })}
      </motion.div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-[rgba(255,107,107,0.08)] border border-[rgba(255,107,107,0.22)] text-[#FCA5A5] text-[0.8rem]">
          {error}
        </div>
      )}

      {/* ── Documents table ─────────────────────────── */}
      <motion.div variants={fadeUp} className="section-card">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-[color:var(--text-muted)] text-[0.82rem]">
            <Loader2 size={15} className="animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <FileText size={26} className="text-[color:var(--text-faint)]" />
            <div className="text-[0.92rem] font-semibold text-white">No documents {docs.length === 0 ? 'yet' : 'match your filter'}</div>
            <div className="text-[0.76rem] text-[color:var(--text-muted)] max-w-md">
              {docs.length === 0 ? 'Upload your first document to get started.' : 'Try adjusting the folder or search.'}
            </div>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Workspace</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc) => (
                  <tr key={doc.id} onClick={() => navigate(`/documents/${doc.id}`)} className="cursor-pointer">
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${doc.type_color}20`, color: doc.type_color }}>
                          <FileText size={13} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[0.82rem] font-semibold text-white truncate">{doc.name}</div>
                          <div className="text-[0.68rem] text-[color:var(--text-faint)]">{doc.author}</div>
                        </div>
                      </div>
                    </td>
                    <td className="truncate">{doc.workspace}</td>
                    <td>
                      <span className="text-[0.7rem] font-semibold px-2 py-0.5 rounded-md" style={{ background: `${doc.type_color}20`, color: doc.type_color }}>
                        {doc.type}
                      </span>
                    </td>
                    <td className="text-[0.72rem]">{doc.date}</td>
                    <td onClick={(e) => { e.stopPropagation(); cycleStatus(doc); }} className="cursor-pointer">
                      <Badge tone={statusTone(doc.status)}>{doc.status}</Badge>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button" onClick={() => navigate(`/documents/${doc.id}`)}
                          className="p-1.5 rounded-lg text-[color:var(--text-muted)] hover:text-white hover:bg-white/[0.05] transition-colors"
                          title="Open"
                        >
                          <ExternalLink size={12} />
                        </button>
                        <button
                          type="button" onClick={() => downloadFile(doc)}
                          className={cn('p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors', doc.file_url ? 'text-[#A78BFA] hover:text-white' : 'text-[color:var(--text-faint)]')}
                          title={doc.file_url ? 'Download file' : 'No file attached'}
                        >
                          <Download size={12} />
                        </button>
                        {confirmDelete === doc.id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleDelete(doc.id)}
                              disabled={deleting}
                              className="text-[0.66rem] font-semibold px-2 py-1 rounded-lg bg-[rgba(255,107,107,0.16)] text-[#FCA5A5] border border-[rgba(255,107,107,0.28)] hover:bg-[rgba(255,107,107,0.25)] transition-colors"
                            >
                              {deleting ? '…' : 'Delete'}
                            </button>
                            <button
                              type="button" onClick={() => setConfirmDelete(null)}
                              className="text-[0.66rem] font-medium px-2 py-1 rounded-lg border border-white/[0.1] text-[color:var(--text-muted)] hover:text-white"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button" onClick={() => setConfirmDelete(doc.id)}
                            className="p-1.5 rounded-lg text-[color:var(--text-muted)] hover:text-[#FCA5A5] hover:bg-[rgba(255,107,107,0.08)] transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* ── Upload Modal ─────────────────────────── */}
      {showUpload && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) { setShowUpload(false); setUploadError(''); } }}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              className="glass-elevated w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between mb-5">
                <div>
                  <div className="text-[1.05rem] font-semibold text-white tracking-tight">Upload Document</div>
                  <div className="text-[0.76rem] text-[color:var(--text-muted)] mt-0.5">Attach a file or save a metadata-only record.</div>
                </div>
                <button
                  type="button" onClick={() => { setShowUpload(false); setUploadError(''); }}
                  className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[color:var(--text-muted)] hover:bg-white/[0.08] hover:text-white transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {uploadError && (
                <div className="flex items-center gap-2 px-3.5 py-2.5 mb-4 rounded-xl bg-[rgba(255,107,107,0.08)] border border-[rgba(255,107,107,0.2)] text-[#FCA5A5] text-[0.78rem]">
                  {uploadError}
                </div>
              )}

              <div className="space-y-3.5">
                <Field label="Document name *">
                  <input className="input-field" placeholder="e.g. Project Charter v1.0" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Type">
                    <select className="input-field" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                      {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="Workspace *">
                    <select className="input-field" value={form.workspace_id} onChange={(e) => setForm((f) => ({ ...f, workspace_id: e.target.value }))}>
                      <option value="">Select workspace…</option>
                      {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Language">
                    <select className="input-field" value={form.language} onChange={(e) => setForm((f) => ({ ...f, language: e.target.value as typeof LANG_OPTIONS[number] }))}>
                      {LANG_OPTIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </Field>
                  <Field label="Status">
                    <select className="input-field" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as typeof STATUS_OPTIONS[number] }))}>
                      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Author">
                  <input className="input-field" placeholder="e.g. Ahmed Al-Mahmoud" value={form.author} onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))} />
                </Field>
                <Field label="Summary">
                  <textarea rows={3} className="input-field resize-y" placeholder="Brief description…" value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} />
                </Field>
                <Field label="Tags (comma separated)">
                  <input className="input-field" placeholder="e.g. BRD, Phase 1, NCA" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} />
                </Field>
                <Field label="Attach file (optional)">
                  <input ref={fileRef} type="file" className="input-field text-[0.78rem] cursor-pointer" />
                </Field>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button type="button" className="btn-ghost" onClick={() => { setShowUpload(false); setUploadError(''); }}>Cancel</button>
                  <button type="button" className="btn-primary min-w-[150px] justify-center" onClick={handleUpload} disabled={uploading}>
                    {uploading ? (<><Loader2 size={13} className="animate-spin" /> Uploading…</>) : (<><Plus size={13} /> Save Document</>)}
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
