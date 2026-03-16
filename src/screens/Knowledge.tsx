import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLayout } from '../hooks/useLayout';
import {
  Search, Sparkles, ExternalLink, Send, Loader2,
  FileText, Brain, ArrowRight, Plus, Upload, X,
  BookOpen, Tag, Clock, ChevronDown, Grid3X3, List,
  RefreshCw, Filter,
} from 'lucide-react';
import { getDocuments, getWorkspaces, upsertDocument } from '../lib/db';
import type { DocumentRow, WorkspaceRow } from '../lib/db';
import { supabase } from '../lib/supabase';
import { chatWithDocument } from '../lib/openrouter';
import type { ChatMsg } from '../lib/openrouter';

// ── Constants ──────────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  BRD: '#0EA5E9', FRD: '#8B5CF6', 'Meeting Minutes': '#10B981',
  Proposals: '#F59E0B', Evaluations: '#EC4899', Contracts: '#EF4444',
  Policies: '#14B8A6', 'Technical Specs': '#6366F1', Reports: '#F97316',
  Charters: '#84CC16', Other: '#94A3B8',
};
const DOC_TYPES = ['BRD', 'FRD', 'Meeting Minutes', 'Proposals', 'Evaluations', 'Contracts', 'Policies', 'Technical Specs', 'Reports', 'Charters', 'Other'];
const STATUS_OPTIONS = ['Draft', 'Under Review', 'Approved', 'Final'] as const;
const LANG_OPTIONS = ['EN', 'AR', 'Bilingual'] as const;

const STATUS_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  Approved: { color: '#34D399', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.22)' },
  Final: { color: '#00D4FF', bg: 'rgba(0,212,255,0.1)', border: 'rgba(0,212,255,0.22)' },
  'Under Review': { color: '#FCD34D', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.22)' },
  Draft: { color: '#94A3B8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.15)' },
};

const SYSTEM_PROMPT = `You are an expert AI consultant assistant embedded in Consultant OS.
You help users find answers across a portfolio of consulting documents. Guidelines:
- Be concise and direct — professional consulting tone
- Structure answers with bullet points or sections when helpful
- Reference specific documents by name when relevant
- If information is insufficient, say so clearly
- Format with **bold** for key terms`;

function buildSearchPrompt(query: string, docs: DocumentRow[]): string {
  const docContext = docs.slice(0, 6).map((d, i) =>
    `[Doc ${i + 1}] "${d.name}" (${d.type}, ${d.workspace}, ${d.date})\nSummary: ${d.summary || 'No summary available'}\nTags: ${d.tags?.join(', ') || 'None'}`
  ).join('\n\n');
  return `${SYSTEM_PROMPT}\n\nUser searched: "${query}"\n\nRelevant documents:\n${docContext || 'No documents found.'}\n\nAnswer based on these documents. Be specific about which documents contain the relevant information.`;
}

function scoreDoc(doc: DocumentRow, query: string): number {
  const q = query.toLowerCase();
  const terms = q.split(/\s+/).filter(t => t.length > 2);
  let score = 0;
  const name = doc.name.toLowerCase();
  const summary = (doc.summary || '').toLowerCase();
  const tags = (doc.tags || []).join(' ').toLowerCase();
  const workspace = doc.workspace.toLowerCase();
  const type = doc.type.toLowerCase();
  for (const term of terms) {
    if (name.includes(term)) score += 10;
    if (summary.includes(term)) score += 5;
    if (tags.includes(term)) score += 8;
    if (workspace.includes(term)) score += 3;
    if (type.includes(term)) score += 4;
  }
  if (name.includes(q)) score += 20;
  if (summary.includes(q)) score += 15;
  return score;
}

// ── Sub-components ─────────────────────────────────────────────────────────
function DocCard({ doc, onOpen }: { doc: DocumentRow; onOpen: (id: string) => void }) {
  const color = TYPE_COLORS[doc.type] ?? '#94A3B8';
  const sc = STATUS_COLORS[doc.status] ?? STATUS_COLORS.Draft;
  return (
    <div
      onClick={() => onOpen(doc.id)}
      style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
        borderRadius: '12px', padding: '1rem', cursor: 'pointer',
        transition: 'all 0.18s', position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', gap: '0.625rem',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = color + '45';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 28px rgba(0,0,0,0.3), 0 0 0 1px ${color}20`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
      }}
    >
      {/* Top accent */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${color} 0%, ${color}44 60%, transparent 100%)` }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
        <div style={{ padding: '0.5rem', borderRadius: '8px', background: `${color}15`, color, flexShrink: 0 }}>
          <FileText size={14} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '2px' }}>
            {doc.name}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {doc.workspace}
          </div>
        </div>
        <ExternalLink size={11} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
      </div>

      {/* Badges */}
      <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: `${color}15`, color, border: `1px solid ${color}25` }}>
          {doc.type}
        </span>
        <span style={{ fontSize: '0.62rem', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
          {doc.status}
        </span>
        {doc.language && (
          <span style={{ fontSize: '0.62rem', color: '#38BDF8', background: 'rgba(14,165,233,0.08)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(14,165,233,0.15)' }}>
            {doc.language}
          </span>
        )}
        <span style={{ fontSize: '0.62rem', color: 'var(--text-faint)', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '3px' }}>
          <Clock size={9} /> {doc.date}
        </span>
      </div>

      {/* Summary */}
      {doc.summary && (
        <p style={{ margin: 0, fontSize: '0.73rem', color: 'var(--text-muted)', lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {doc.summary}
        </p>
      )}

      {/* Tags */}
      {doc.tags && doc.tags.length > 0 && (
        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
          {doc.tags.slice(0, 3).map(tag => (
            <span key={tag} style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: '3px', background: 'rgba(255,255,255,0.04)', color: 'var(--text-faint)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '2px' }}>
              <Tag size={8} /> {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function DocRow({ doc, onOpen, relevancePct }: { doc: DocumentRow; onOpen: (id: string) => void; relevancePct?: number }) {
  const color = TYPE_COLORS[doc.type] ?? '#94A3B8';
  const sc = STATUS_COLORS[doc.status] ?? STATUS_COLORS.Draft;
  return (
    <div
      onClick={() => onOpen(doc.id)}
      style={{
        padding: '0.875rem 1rem', borderRadius: '10px', cursor: 'pointer',
        border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)',
        display: 'flex', alignItems: 'center', gap: '0.875rem',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = color + '35';
        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)';
        (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)';
      }}
    >
      <div style={{ padding: '0.5rem', borderRadius: '8px', background: `${color}15`, color, flexShrink: 0 }}>
        <FileText size={14} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {doc.name}
        </div>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {doc.workspace} · {doc.author} · {doc.date}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
        <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: `${color}15`, color, border: `1px solid ${color}25` }}>
          {doc.type}
        </span>
        <span style={{ fontSize: '0.62rem', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
          {doc.status}
        </span>
        {relevancePct !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <div style={{ width: '40px', height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${relevancePct}%`, background: '#8B5CF6', borderRadius: '2px' }} />
            </div>
            <span style={{ fontSize: '0.62rem', color: '#A78BFA', fontWeight: 700, minWidth: '30px' }}>{relevancePct}%</span>
          </div>
        )}
        <ExternalLink size={11} style={{ color: 'var(--text-faint)' }} />
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function Knowledge() {
  const navigate = useNavigate();
  const { isTablet } = useLayout();

  // Data
  const [allDocs, setAllDocs] = useState<DocumentRow[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Browse filters
  const [activeWorkspace, setActiveWorkspace] = useState('All');
  const [activeType, setActiveType] = useState('All');
  const [activeStatus, setActiveStatus] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);

  // Search
  const [query, setQuery] = useState('');
  const [searchedQuery, setSearchedQuery] = useState('');
  const [searchResults, setSearchResults] = useState<(DocumentRow & { score: number })[]>([]);
  const [isSearchMode, setIsSearchMode] = useState(false);

  // AI
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiSources, setAiSources] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Upload modal
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadForm, setUploadForm] = useState({
    name: '', type: 'BRD', workspace_id: '', language: 'EN' as typeof LANG_OPTIONS[number],
    status: 'Draft' as typeof STATUS_OPTIONS[number], author: '', summary: '', tags: '',
  });

  useEffect(() => {
    Promise.all([getDocuments(), getWorkspaces()])
      .then(([docs, ws]) => { setAllDocs(docs); setWorkspaces(ws); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, chatLoading]);

  // Filtered browse docs
  const browseDocs = allDocs.filter(d => {
    const matchWs = activeWorkspace === 'All' || d.workspace === activeWorkspace;
    const matchType = activeType === 'All' || d.type === activeType;
    const matchStatus = activeStatus === 'All' || d.status === activeStatus;
    return matchWs && matchType && matchStatus;
  });

  const uniqueWorkspaces = Array.from(new Set(allDocs.map(d => d.workspace))).sort();

  async function handleSearch() {
    if (!query.trim()) return;
    const q = query.trim();
    setSearchedQuery(q);
    setIsSearchMode(true);
    setAiAnswer(''); setAiSources([]); setAiError(''); setChatHistory([]);

    const scored = allDocs.map(d => ({ ...d, score: scoreDoc(d, q) }))
      .filter(d => d.score > 0).sort((a, b) => b.score - a.score);
    setSearchResults(scored.slice(0, 10));

    setAiLoading(true);
    try {
      const systemPrompt = buildSearchPrompt(q, scored.slice(0, 6));
      const answer = await chatWithDocument([{ role: 'user', content: q }], systemPrompt);
      setAiAnswer(answer);
      setAiSources(scored.slice(0, 3).map(d => d.name));
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : 'AI answer failed');
    } finally {
      setAiLoading(false);
    }
  }

  function clearSearch() {
    setQuery(''); setSearchedQuery(''); setIsSearchMode(false);
    setSearchResults([]); setAiAnswer(''); setAiError(''); setChatHistory([]);
  }

  async function handleFollowUp(msg?: string) {
    const text = msg ?? chatInput;
    if (!text.trim() || chatLoading) return;
    setChatInput('');
    const newMsg: ChatMsg = { role: 'user', content: text };
    const updated = [...chatHistory, newMsg];
    setChatHistory(updated);
    setChatLoading(true);
    try {
      const systemPrompt = buildSearchPrompt(searchedQuery || text, searchResults.slice(0, 5));
      const reply = await chatWithDocument(updated.filter(m => m.role !== 'system'), systemPrompt);
      setChatHistory([...updated, { role: 'assistant', content: reply }]);
    } catch (e: unknown) {
      setChatHistory([...updated, { role: 'assistant', content: `Error: ${e instanceof Error ? e.message : 'Request failed'}` }]);
    } finally {
      setChatLoading(false);
    }
  }

  const relevancePct = (score: number): number => {
    const maxScore = searchResults[0]?.score || 1;
    return Math.min(99, Math.round((score / maxScore) * 95) + 5);
  };

  async function handleUpload() {
    if (!uploadForm.name.trim() || !uploadForm.workspace_id) {
      setUploadError('Name and workspace are required.');
      return;
    }
    setUploading(true); setUploadError('');
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
      const ws = workspaces.find(w => w.id === uploadForm.workspace_id);
      const newDoc = await upsertDocument({
        id: crypto.randomUUID(),
        name: uploadForm.name.trim(),
        type: uploadForm.type,
        type_color: TYPE_COLORS[uploadForm.type] ?? '#94A3B8',
        workspace: ws?.name ?? '',
        workspace_id: uploadForm.workspace_id,
        date: new Date().toISOString().slice(0, 10),
        language: uploadForm.language,
        status: uploadForm.status,
        size,
        author: uploadForm.author.trim() || 'Unknown',
        pages: 0,
        summary: uploadForm.summary.trim(),
        tags: uploadForm.tags.split(',').map(t => t.trim()).filter(Boolean),
        file_url,
      });
      setAllDocs(prev => [newDoc, ...prev]);
      setShowUpload(false);
      setUploadForm({ name: '', type: 'BRD', workspace_id: '', language: 'EN', status: 'Draft', author: '', summary: '', tags: '' });
      if (fileRef.current) fileRef.current.value = '';
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  const displayDocs = isSearchMode ? searchResults : browseDocs;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', overflow: 'hidden', background: '#080C18' }}>

      {/* ── Left Sidebar ──────────────────────────────────────────── */}
      {!isTablet && (
        <div style={{
          width: '228px', minWidth: '228px',
          borderRight: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', flexDirection: 'column', overflowY: 'auto', background: '#0C1220',
        }}>
          {/* Header */}
          <div style={{ padding: '1rem 1rem 0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
              <div style={{ padding: '0.4rem', borderRadius: '7px', background: 'rgba(139,92,246,0.15)', color: '#8B5CF6' }}>
                <Brain size={14} />
              </div>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>Knowledge Base</div>
                <div style={{ fontSize: '0.62rem', color: 'var(--text-faint)' }}>{allDocs.length} documents indexed</div>
              </div>
            </div>
            <button
              onClick={() => setShowUpload(true)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                padding: '0.55rem 0', borderRadius: '8px', cursor: 'pointer',
                background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(0,212,255,0.12))',
                border: '1px solid rgba(139,92,246,0.3)', color: '#C4B5FD',
                fontSize: '0.78rem', fontWeight: 700, fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(0,212,255,0.2))'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(0,212,255,0.12))'; }}
            >
              <Plus size={13} /> Add to Knowledge Base
            </button>
          </div>

          {/* Browse by Workspace */}
          <div style={{ padding: '0.75rem 1rem' }}>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.375rem' }}>
              Workspaces
            </div>
            {['All', ...uniqueWorkspaces].map(ws => {
              const count = ws === 'All' ? allDocs.length : allDocs.filter(d => d.workspace === ws).length;
              const active = activeWorkspace === ws;
              return (
                <div
                  key={ws}
                  onClick={() => { setActiveWorkspace(ws); setIsSearchMode(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.4rem 0.5rem', borderRadius: '6px', cursor: 'pointer', marginBottom: '1px',
                    background: active ? 'rgba(0,212,255,0.08)' : 'transparent',
                    borderLeft: active ? '2px solid #00D4FF' : '2px solid transparent',
                    transition: 'all 0.12s',
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <span style={{ fontSize: '0.73rem', color: active ? '#00D4FF' : 'var(--text-muted)', fontWeight: active ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ws}
                  </span>
                  <span style={{ fontSize: '0.62rem', color: active ? '#00D4FF' : 'var(--text-faint)', fontWeight: 600, flexShrink: 0, marginLeft: '4px' }}>
                    {count}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Filter by Type */}
          <div style={{ padding: '0 1rem 0.75rem' }}>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.375rem' }}>
              Document Type
            </div>
            {['All', ...DOC_TYPES].map(t => {
              const color = t === 'All' ? '#64748B' : (TYPE_COLORS[t] ?? '#94A3B8');
              const active = activeType === t;
              const count = t === 'All' ? allDocs.length : allDocs.filter(d => d.type === t).length;
              if (count === 0 && t !== 'All') return null;
              return (
                <div
                  key={t}
                  onClick={() => { setActiveType(t); setIsSearchMode(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.5rem',
                    borderRadius: '6px', cursor: 'pointer', marginBottom: '1px',
                    background: active ? `${color}12` : 'transparent',
                    transition: 'all 0.12s',
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = active ? `${color}12` : 'transparent'; }}
                >
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.73rem', color: active ? color : 'var(--text-muted)', fontWeight: active ? 600 : 400, flex: 1 }}>{t}</span>
                  <span style={{ fontSize: '0.62rem', color: 'var(--text-faint)' }}>{count}</span>
                </div>
              );
            })}
          </div>

          {/* Stats */}
          <div style={{ marginTop: 'auto', padding: '0.75rem 1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            {[
              { label: 'Total indexed', value: allDocs.length },
              { label: 'Workspaces', value: uniqueWorkspaces.length },
              { label: 'With AI summary', value: allDocs.filter(d => d.summary).length },
              { label: 'Approved', value: allDocs.filter(d => d.status === 'Approved' || d.status === 'Final').length },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-faint)' }}>{s.label}</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Main Content ──────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Search Bar */}
        <div style={{
          padding: '0.875rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)',
          background: '#080C18', flexShrink: 0,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.625rem 1rem', borderRadius: '10px',
            background: 'rgba(255,255,255,0.04)',
            border: isSearchMode ? '1px solid rgba(139,92,246,0.4)' : '1px solid rgba(255,255,255,0.08)',
            boxShadow: isSearchMode ? '0 0 20px rgba(139,92,246,0.08)' : 'none',
            transition: 'all 0.2s',
          }}>
            <Brain size={16} style={{ color: '#8B5CF6', flexShrink: 0 }} />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search your knowledge base with AI... (e.g. 'NCA integration requirements' or 'risk mitigation strategies')"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '0.875rem', color: 'var(--text-primary)', fontFamily: 'inherit' }}
            />
            {isSearchMode && (
              <button onClick={clearSearch} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: '2px', display: 'flex', alignItems: 'center' }}>
                <X size={14} />
              </button>
            )}
            <button className="btn-primary" style={{ height: '30px', fontSize: '0.75rem', flexShrink: 0 }} onClick={handleSearch}>
              <Search size={12} /> Search
            </button>
          </div>

          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginTop: '0.625rem', flexWrap: 'wrap' }}>
            {isSearchMode ? (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                <span style={{ color: '#A78BFA', fontWeight: 700 }}>{searchResults.length}</span> results for &ldquo;{searchedQuery}&rdquo; ·
                <button onClick={clearSearch} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', fontSize: '0.72rem', fontFamily: 'inherit', padding: '0 4px', textDecoration: 'underline' }}>
                  Browse all
                </button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Showing <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{browseDocs.length}</span> of {allDocs.length} documents
                </div>
                <div style={{ flex: 1 }} />
                {/* Status filter pills */}
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  {['All', 'Draft', 'Under Review', 'Approved', 'Final'].map(s => (
                    <button key={s} onClick={() => setActiveStatus(s)} style={{
                      padding: '3px 10px', borderRadius: '99px', border: 'none', cursor: 'pointer',
                      fontSize: '0.68rem', fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.12s',
                      background: activeStatus === s ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.04)',
                      color: activeStatus === s ? '#00D4FF' : 'var(--text-faint)',
                    }}>
                      {s}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowFilters(f => !f)} style={{
                  display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '3px 8px',
                  borderRadius: '6px', border: '1px solid var(--border-subtle)', cursor: 'pointer',
                  background: 'transparent', color: 'var(--text-faint)', fontSize: '0.68rem', fontFamily: 'inherit',
                }}>
                  <Filter size={10} /> Filter <ChevronDown size={10} />
                </button>
                <div style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.04)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                  <button onClick={() => setViewMode('grid')} style={{ padding: '4px 6px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: viewMode === 'grid' ? 'rgba(0,212,255,0.12)' : 'transparent', color: viewMode === 'grid' ? '#00D4FF' : 'var(--text-faint)' }}>
                    <Grid3X3 size={12} />
                  </button>
                  <button onClick={() => setViewMode('list')} style={{ padding: '4px 6px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: viewMode === 'list' ? 'rgba(0,212,255,0.12)' : 'transparent', color: viewMode === 'list' ? '#00D4FF' : 'var(--text-faint)' }}>
                    <List size={12} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Document Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem' }}>

          {/* Loading */}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading knowledge base…
            </div>
          )}

          {/* Empty states */}
          {!loading && allDocs.length === 0 && (
            <div style={{ textAlign: 'center', padding: '5rem 2rem' }}>
              <div style={{ width: 64, height: 64, borderRadius: '16px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                <BookOpen size={28} style={{ color: '#8B5CF6' }} />
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Knowledge base is empty</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                Add documents to start building your AI-powered knowledge base
              </div>
              <button onClick={() => setShowUpload(true)} style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.625rem 1.25rem', borderRadius: '8px', cursor: 'pointer',
                background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(0,212,255,0.12))',
                border: '1px solid rgba(139,92,246,0.3)', color: '#C4B5FD',
                fontSize: '0.82rem', fontWeight: 700, fontFamily: 'inherit',
              }}>
                <Plus size={14} /> Add First Document
              </button>
            </div>
          )}

          {/* Search mode: no results */}
          {!loading && isSearchMode && searchResults.length === 0 && (
            <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
              <Search size={32} style={{ color: 'var(--text-faint)', margin: '0 auto 0.875rem', display: 'block' }} />
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>No matching documents</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Try different keywords or add more documents</div>
            </div>
          )}

          {/* Browse mode: empty filter */}
          {!loading && !isSearchMode && browseDocs.length === 0 && allDocs.length > 0 && (
            <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>No documents match filters</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Try adjusting the workspace or type filters</div>
            </div>
          )}

          {/* Browse mode: section header */}
          {!loading && !isSearchMode && browseDocs.length > 0 && (
            <div style={{ marginBottom: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <BookOpen size={11} />
                {activeWorkspace === 'All' ? 'All Documents' : activeWorkspace}
                {activeType !== 'All' && ` · ${activeType}`}
              </div>
              <button onClick={() => setShowUpload(true)} style={{
                display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '4px 10px',
                borderRadius: '6px', cursor: 'pointer', border: '1px solid rgba(139,92,246,0.25)',
                background: 'rgba(139,92,246,0.08)', color: '#A78BFA',
                fontSize: '0.7rem', fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.12s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.15)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.08)'; }}
              >
                <Plus size={11} /> Add Document
              </button>
            </div>
          )}

          {/* Document grid / list */}
          {!loading && displayDocs.length > 0 && (
            <>
              {viewMode === 'grid' && !isSearchMode ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem' }}>
                  {displayDocs.map(doc => (
                    <DocCard key={doc.id} doc={doc} onOpen={id => navigate(`/documents/${id}`)} />
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {displayDocs.map(doc => (
                    <DocRow
                      key={doc.id}
                      doc={doc}
                      onOpen={id => navigate(`/documents/${id}`)}
                      relevancePct={isSearchMode ? relevancePct((doc as DocumentRow & { score: number }).score ?? 0) : undefined}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Right AI Panel ────────────────────────────────────────── */}
      {!isTablet && (
        <div style={{
          width: '300px', minWidth: '300px',
          borderLeft: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', flexDirection: 'column', background: '#0C1220',
        }}>
          {/* AI Header */}
          <div style={{
            padding: '0.875rem 1rem', borderBottom: '1px solid rgba(139,92,246,0.12)',
            background: 'linear-gradient(160deg, #0C1220, #130D2A)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
              <div style={{ padding: '0.35rem', borderRadius: '6px', background: 'rgba(139,92,246,0.15)' }}>
                <Sparkles size={13} style={{ color: '#8B5CF6' }} />
              </div>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>AI Knowledge Assistant</span>
              {aiLoading && <Loader2 size={12} style={{ color: '#8B5CF6', animation: 'spin 1s linear infinite', marginLeft: 'auto' }} />}
            </div>

            {!isSearchMode && !aiLoading && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', lineHeight: 1.55, padding: '0.625rem 0.75rem', background: 'rgba(139,92,246,0.04)', borderRadius: '8px', border: '1px solid rgba(139,92,246,0.1)' }}>
                Search your knowledge base — AI will read your documents and synthesize a direct answer.
              </div>
            )}

            {aiLoading && (
              <div style={{ fontSize: '0.75rem', color: '#A78BFA', padding: '0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '3px' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#8B5CF6', animation: `bounce 1.2s ease-in-out ${i * 0.15}s infinite` }} />
                  ))}
                </div>
                Analyzing {searchResults.length} documents…
              </div>
            )}

            {aiError && (
              <div style={{ fontSize: '0.72rem', color: '#FCA5A5', padding: '0.5rem 0.625rem', background: 'rgba(239,68,68,0.06)', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.15)', lineHeight: 1.5 }}>
                {aiError}
              </div>
            )}

            {aiAnswer && !aiLoading && (
              <div>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8', lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: '240px', overflowY: 'auto', marginBottom: '0.625rem' }}>
                  {aiAnswer}
                </div>
                {aiSources.length > 0 && (
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>Sources</div>
                    {aiSources.map((s, i) => (
                      <div key={i} style={{ display: 'flex', gap: '0.375rem', padding: '2px 0' }}>
                        <FileText size={10} style={{ color: '#64748B', flexShrink: 0, marginTop: '3px' }} />
                        <div style={{ fontSize: '0.68rem', color: '#64748B', lineHeight: 1.4 }}>{s}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Follow-up Chat */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0.875rem', minHeight: 0 }}>
            {!isSearchMode && (
              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-faint)', lineHeight: 1.6 }}>
                  After searching, you can ask follow-up questions to dig deeper into your documents.
                </div>
              </div>
            )}

            {isSearchMode && (
              <>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  Ask a Follow-up
                </div>

                {chatHistory.length === 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.625rem' }}>
                    {['What are the key risks?', 'Summarize the main requirements', 'What decisions were made?', 'Who are the key stakeholders?'].map((s, i) => (
                      <button key={i} onClick={() => handleFollowUp(s)} style={{
                        textAlign: 'left', padding: '0.45rem 0.625rem', borderRadius: '6px', fontSize: '0.73rem',
                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
                        color: 'var(--text-faint)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
                        display: 'flex', alignItems: 'center', gap: '0.375rem',
                      }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(139,92,246,0.08)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(139,92,246,0.2)'; (e.currentTarget as HTMLElement).style.color = '#A78BFA'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)'; }}
                      >
                        <ArrowRight size={9} style={{ flexShrink: 0 }} /> {s}
                      </button>
                    ))}
                  </div>
                )}

                {chatHistory.length > 0 && (
                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.625rem' }}>
                    {chatHistory.map((msg, i) => (
                      <div key={i} style={{
                        padding: '0.5rem 0.625rem', borderRadius: '8px', fontSize: '0.73rem', lineHeight: 1.55,
                        background: msg.role === 'user' ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${msg.role === 'user' ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.06)'}`,
                        color: msg.role === 'user' ? '#C4B5FD' : '#94A3B8',
                        alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '92%', whiteSpace: 'pre-wrap',
                      }}>
                        {msg.content}
                      </div>
                    ))}
                    {chatLoading && (
                      <div style={{ display: 'flex', gap: '4px', padding: '0.4rem 0.75rem', alignSelf: 'flex-start' }}>
                        {[0, 1, 2].map(i => (
                          <div key={i} style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#8B5CF6', animation: `bounce 1.2s ease-in-out ${i * 0.15}s infinite` }} />
                        ))}
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                  <input
                    type="text"
                    placeholder="Ask anything…"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleFollowUp()}
                    className="input-field"
                    style={{ flex: 1, fontSize: '0.75rem' }}
                  />
                  <button className="btn-ai" style={{ height: '36px', padding: '0 0.75rem' }} onClick={() => handleFollowUp()} disabled={chatLoading}>
                    <Send size={12} />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Quick Actions */}
          <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setShowUpload(true)} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
              padding: '0.5rem', borderRadius: '7px', border: '1px solid rgba(139,92,246,0.2)',
              background: 'rgba(139,92,246,0.08)', color: '#A78BFA',
              fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.15)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.08)'; }}
            >
              <Upload size={11} /> Upload
            </button>
            <button onClick={() => { setLoading(true); Promise.all([getDocuments(), getWorkspaces()]).then(([d, w]) => { setAllDocs(d); setWorkspaces(w); setLoading(false); }).catch(() => setLoading(false)); }} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
              padding: '0.5rem', borderRadius: '7px', border: '1px solid var(--border-subtle)',
              background: 'transparent', color: 'var(--text-faint)',
              fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}
            >
              <RefreshCw size={11} /> Refresh
            </button>
          </div>
        </div>
      )}

      {/* ── Upload Modal ──────────────────────────────────────────── */}
      {showUpload && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }} onClick={() => { setShowUpload(false); setUploadError(''); }}>
          <div style={{
            background: '#0C1220', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px', padding: '1.75rem', width: '100%', maxWidth: '520px',
            boxShadow: '0 24px 64px rgba(0,0,0,0.65)', maxHeight: '90vh', overflowY: 'auto',
            position: 'relative', overflow: 'hidden',
          }} onClick={e => e.stopPropagation()}>
            {/* Glow orb */}
            <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

            {/* Header */}
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '4px' }}>
                  <div style={{ padding: '0.375rem', borderRadius: '7px', background: 'rgba(139,92,246,0.15)', color: '#8B5CF6' }}>
                    <Plus size={14} />
                  </div>
                  <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Add to Knowledge Base</h2>
                </div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Upload a document to make it searchable by AI</p>
              </div>
              <button onClick={() => { setShowUpload(false); setUploadError(''); }} style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px', cursor: 'pointer', color: '#64748B', padding: '6px',
                display: 'flex', alignItems: 'center', transition: 'all 0.15s',
              }}>
                <X size={16} />
              </button>
            </div>

            {uploadError && (
              <div style={{ marginBottom: '1rem', padding: '0.625rem 0.875rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', fontSize: '0.75rem', color: '#FCA5A5' }}>
                {uploadError}
              </div>
            )}

            {/* File drop zone */}
            <div
              style={{
                border: '2px dashed rgba(139,92,246,0.25)', borderRadius: '10px',
                padding: '1.5rem', textAlign: 'center', cursor: 'pointer',
                background: 'rgba(139,92,246,0.04)', marginBottom: '1.25rem',
                transition: 'all 0.15s',
              }}
              onClick={() => fileRef.current?.click()}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(139,92,246,0.5)'; (e.currentTarget as HTMLElement).style.background = 'rgba(139,92,246,0.08)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(139,92,246,0.25)'; (e.currentTarget as HTMLElement).style.background = 'rgba(139,92,246,0.04)'; }}
            >
              <Upload size={22} style={{ color: '#8B5CF6', margin: '0 auto 0.5rem', display: 'block' }} />
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#C4B5FD', marginBottom: '0.25rem' }}>
                {fileRef.current?.files?.[0]?.name || 'Click to browse files'}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-faint)' }}>PDF, DOCX, XLSX, PPTX — up to 50MB</div>
              <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={() => { /* trigger re-render */ }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', position: 'relative' }}>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>Document Name *</label>
                <input className="input-field" placeholder="e.g. NCA Integration BRD v2.0" value={uploadForm.name} onChange={e => setUploadForm(f => ({ ...f, name: e.target.value }))} style={{ width: '100%' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>Type</label>
                  <select className="input-field" value={uploadForm.type} onChange={e => setUploadForm(f => ({ ...f, type: e.target.value }))} style={{ width: '100%' }}>
                    {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>Workspace *</label>
                  <select className="input-field" value={uploadForm.workspace_id} onChange={e => setUploadForm(f => ({ ...f, workspace_id: e.target.value }))} style={{ width: '100%' }}>
                    <option value="">Select workspace…</option>
                    {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>Language</label>
                  <select className="input-field" value={uploadForm.language} onChange={e => setUploadForm(f => ({ ...f, language: e.target.value as typeof LANG_OPTIONS[number] }))} style={{ width: '100%' }}>
                    {LANG_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>Status</label>
                  <select className="input-field" value={uploadForm.status} onChange={e => setUploadForm(f => ({ ...f, status: e.target.value as typeof STATUS_OPTIONS[number] }))} style={{ width: '100%' }}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>Author</label>
                  <input className="input-field" placeholder="e.g. AM" value={uploadForm.author} onChange={e => setUploadForm(f => ({ ...f, author: e.target.value }))} style={{ width: '100%' }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>Summary (helps AI search)</label>
                <textarea className="input-field" placeholder="Brief description of the document's purpose and contents…" value={uploadForm.summary} onChange={e => setUploadForm(f => ({ ...f, summary: e.target.value }))} style={{ width: '100%', minHeight: '70px', resize: 'vertical' }} />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>Tags (comma-separated)</label>
                <input className="input-field" placeholder="e.g. integration, phase 1, security, NCA" value={uploadForm.tags} onChange={e => setUploadForm(f => ({ ...f, tags: e.target.value }))} style={{ width: '100%' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setShowUpload(false); setUploadError(''); }}>
                Cancel
              </button>
              <button className="btn-primary" style={{ flex: 2, justifyContent: 'center' }} onClick={handleUpload} disabled={uploading || !uploadForm.name || !uploadForm.workspace_id}>
                {uploading ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Uploading…</> : <><Plus size={13} /> Add to Knowledge Base</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
      `}</style>
    </div>
  );
}
