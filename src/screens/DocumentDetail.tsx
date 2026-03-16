import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileText, Sparkles, Check,
  Download, Clock, User, Calendar, Tag, Link, Send, Loader2,
  Trash2, ExternalLink,
} from 'lucide-react';
import { getDocument, updateDocument, getTasks, updateTask } from '../lib/db';
import type { DocumentRow, TaskRow } from '../lib/db';

const tabs = ['Overview', 'Summary', 'Tasks', 'Versions', 'AI Chat'];

const STATUS_OPTIONS = ['Draft', 'Under Review', 'Approved', 'Final'] as const;

function statusBadge(s: string) {
  const map: Record<string, { bg: string; color: string }> = {
    Approved: { bg: 'rgba(16,185,129,0.12)', color: '#34D399' },
    Final: { bg: 'rgba(0,212,255,0.1)', color: '#00D4FF' },
    'Under Review': { bg: 'rgba(245,158,11,0.12)', color: '#FCD34D' },
    Draft: { bg: 'rgba(148,163,184,0.07)', color: '#94A3B8' },
  };
  const c = map[s] ?? map.Draft;
  return (
    <span style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: '4px', background: c.bg, color: c.color, border: `1px solid ${c.color}25` }}>
      {s}
    </span>
  );
}

const TASK_STATUS_OPTIONS = ['Backlog', 'In Progress', 'In Review', 'Completed', 'Overdue'] as const;

const chatSeed = [
  { role: 'user', text: 'What are the main topics covered in this document?' },
  { role: 'ai', text: 'Based on the document metadata and summary, this document covers the core scope, requirements, and stakeholder expectations for the associated workspace initiative. Use the Upload feature to attach the actual file for deeper AI analysis.' },
];

export default function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [doc, setDoc] = useState<DocumentRow | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeTab, setActiveTab] = useState('Overview');
  const [statusSaving, setStatusSaving] = useState(false);

  // Tasks tab
  const [taskStatusChanging, setTaskStatusChanging] = useState<string | null>(null);

  // AI Chat
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState(chatSeed);

  async function load() {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [d, allTasks] = await Promise.all([
        getDocument(id),
        getTasks(),
      ]);
      setDoc(d);
      // Tasks linked to this doc
      setTasks(allTasks.filter(t => t.linked_doc === id || t.linked_doc === (d?.name ?? '')));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load document');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function handleStatusChange(status: string) {
    if (!doc) return;
    setStatusSaving(true);
    try {
      await updateDocument(doc.id, { status: status as DocumentRow['status'] });
      setDoc(d => d ? { ...d, status: status as DocumentRow['status'] } : d);
    } catch { /* ignore */ }
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

  function handleDownload() {
    if (doc?.file_url) {
      window.open(doc.file_url, '_blank');
    } else {
      alert('No file is attached to this document. Upload a file in the Documents list.');
    }
  }

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    setMessages(prev => [...prev, { role: 'user', text: chatInput }]);
    setChatInput('');
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'ai',
        text: `Based on the document "${doc?.name ?? ''}", your query relates to the core scope and requirements. Attach the actual document file for deeper contextual analysis.`,
      }]);
    }, 700);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 60px)', color: '#475569', gap: '0.5rem' }}>
        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Loading document…
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 60px)', color: '#475569', gap: '1rem' }}>
        <div style={{ color: '#FCA5A5' }}>{error || 'Document not found.'}</div>
        <button className="btn-ghost" onClick={() => navigate('/documents')}>
          <ArrowLeft size={14} /> Back to Documents
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', background: '#0C1220', flexShrink: 0 }}>
        <button
          onClick={() => navigate('/documents')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: '0.8rem', padding: 0, marginBottom: '0.75rem', fontFamily: 'inherit' }}
        >
          <ArrowLeft size={14} /> Documents
        </button>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
            <div style={{ padding: '0.625rem', borderRadius: '10px', background: `${doc.type_color}18`, color: doc.type_color, flexShrink: 0 }}>
              <FileText size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.7rem', padding: '2px 7px', borderRadius: '4px', background: `${doc.type_color}15`, color: doc.type_color, border: `1px solid ${doc.type_color}25` }}>
                  {doc.type}
                </span>
                <span style={{ color: '#334155', fontSize: '0.75rem' }}>·</span>
                <span style={{ fontSize: '0.75rem', color: '#475569' }}>{doc.workspace}</span>
                {statusBadge(doc.status)}
              </div>
              <h1 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#F1F5F9', margin: 0, marginBottom: '0.25rem' }}>{doc.name}</h1>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.72rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <User size={11} /> {doc.author}
                </span>
                <span style={{ fontSize: '0.72rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Calendar size={11} /> {doc.date}
                </span>
                <span style={{ fontSize: '0.72rem', color: '#475569' }}>{doc.size}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {/* Status selector */}
            <select
              value={doc.status}
              onChange={e => handleStatusChange(e.target.value)}
              disabled={statusSaving}
              className="btn-ghost"
              style={{ fontSize: '0.78rem', height: '32px', cursor: 'pointer', color: '#94A3B8', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.5rem', padding: '0 0.625rem', fontFamily: 'inherit' }}
            >
              {STATUS_OPTIONS.map(s => <option key={s} value={s} style={{ background: '#1E2A45', color: '#F1F5F9' }}>{s}</option>)}
            </select>
            <button
              className="btn-primary"
              style={{ fontSize: '0.78rem', height: '32px' }}
              onClick={() => handleStatusChange('Approved')}
              disabled={statusSaving || doc.status === 'Approved'}
            >
              <Check size={13} /> Mark Approved
            </button>
            <button
              className="btn-ghost"
              style={{ fontSize: '0.78rem', height: '32px', padding: '0 0.625rem', opacity: doc.file_url ? 1 : 0.5 }}
              onClick={handleDownload}
              title={doc.file_url ? 'Download attached file' : 'No file attached'}
            >
              <Download size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, padding: '0 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', background: '#080C18', flexShrink: 0 }}>
        {tabs.map(tab => (
          <button
            key={tab}
            className={`tab-underline ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
            style={{ marginRight: '1.25rem', fontSize: '0.82rem' }}
          >
            {tab}
            {tab === 'Tasks' && tasks.length > 0 && (
              <span style={{ marginLeft: '0.375rem', fontSize: '0.65rem', padding: '1px 5px', borderRadius: '9999px', background: 'rgba(0,212,255,0.12)', color: '#00D4FF' }}>
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
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Document Summary</span>
                  {statusBadge(doc.status)}
                </div>
                <div style={{ padding: '1.25rem' }}>
                  <p style={{ fontSize: '0.875rem', color: '#94A3B8', lineHeight: 1.7, margin: 0 }}>
                    {doc.summary || 'No summary provided for this document.'}
                  </p>
                </div>
              </div>

              {/* Linked tasks preview */}
              {tasks.length > 0 && (
                <div className="section-card">
                  <div className="section-card-header">
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Linked Tasks</span>
                    <button className="btn-ghost" style={{ fontSize: '0.72rem', height: '26px', padding: '0 0.625rem' }} onClick={() => setActiveTab('Tasks')}>
                      View all ({tasks.length})
                    </button>
                  </div>
                  <div>
                    {tasks.slice(0, 3).map((task, i) => (
                      <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1.25rem', borderBottom: i < Math.min(tasks.length, 3) - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</div>
                          <div style={{ fontSize: '0.7rem', color: '#475569' }}>{task.assignee} · Due {task.due_date}</div>
                        </div>
                        <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: task.priority === 'High' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', color: task.priority === 'High' ? '#FCA5A5' : '#FCD34D', flexShrink: 0 }}>
                          {task.priority}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right meta */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="section-card" style={{ padding: '1.125rem' }}>
                <div style={{ marginBottom: '0.875rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', marginBottom: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Document Info</div>
                  {[
                    { icon: <Tag size={12} />, label: 'Type', value: doc.type },
                    { icon: <User size={12} />, label: 'Author', value: doc.author },
                    { icon: <Calendar size={12} />, label: 'Created', value: doc.date },
                    { icon: <Link size={12} />, label: 'Workspace', value: doc.workspace },
                    { icon: <Clock size={12} />, label: 'Language', value: doc.language },
                    { icon: <FileText size={12} />, label: 'File', value: doc.file_url ? 'Attached' : 'No file' },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.375rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: '#334155' }}>
                        {item.icon}
                        <span style={{ fontSize: '0.72rem' }}>{item.label}</span>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: item.label === 'File' && doc.file_url ? '#34D399' : '#94A3B8' }}>{item.value}</span>
                    </div>
                  ))}
                </div>
                {doc.tags?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                    {doc.tags.map(tag => (
                      <span key={tag} style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: '4px', background: 'rgba(255,255,255,0.04)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.07)' }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="section-card" style={{ padding: '1.125rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quick Actions</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <button
                    className="btn-primary"
                    style={{ width: '100%', justifyContent: 'center', fontSize: '0.78rem', opacity: doc.file_url ? 1 : 0.5 }}
                    onClick={handleDownload}
                  >
                    <Download size={13} /> {doc.file_url ? 'Download File' : 'No File Attached'}
                  </button>
                  <button className="btn-ai" style={{ width: '100%', justifyContent: 'center', fontSize: '0.78rem' }} onClick={() => setActiveTab('AI Chat')}>
                    <Sparkles size={13} /> Ask AI
                  </button>
                  <button
                    className="btn-ghost"
                    style={{ width: '100%', justifyContent: 'center', fontSize: '0.78rem' }}
                    onClick={() => handleStatusChange('Approved')}
                    disabled={doc.status === 'Approved' || statusSaving}
                  >
                    <Check size={13} /> Mark Approved
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Summary ── */}
        {activeTab === 'Summary' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="section-card">
              <div className="section-card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sparkles size={14} style={{ color: '#8B5CF6' }} />
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Document Summary</span>
                </div>
                {statusBadge(doc.status)}
              </div>
              <div style={{ padding: '1.25rem' }}>
                <p style={{ fontSize: '0.875rem', color: '#94A3B8', lineHeight: 1.7, margin: 0 }}>
                  {doc.summary || 'No summary has been provided. Add a summary when uploading or editing the document.'}
                </p>
                {doc.tags?.length > 0 && (
                  <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                    {doc.tags.map(tag => (
                      <span key={tag} style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.08)' }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Tasks ── */}
        {activeTab === 'Tasks' && (
          <div className="section-card">
            <div className="section-card-header">
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Linked Tasks</span>
              <span style={{ fontSize: '0.72rem', color: '#475569' }}>{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
            </div>
            {tasks.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: '#334155', fontSize: '0.82rem' }}>
                No tasks are linked to this document.<br />
                <span style={{ fontSize: '0.75rem' }}>Link a task by setting its "Linked Doc" field in the workspace Tasks tab.</span>
              </div>
            ) : (
              <div>
                {tasks.map((task, i) => (
                  <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.875rem 1.25rem', borderBottom: i < tasks.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 500, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</div>
                      <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: '0.125rem' }}>
                        {task.assignee} · Due {task.due_date} · {task.workspace}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: task.priority === 'High' ? 'rgba(239,68,68,0.1)' : task.priority === 'Medium' ? 'rgba(245,158,11,0.1)' : 'rgba(148,163,184,0.07)', color: task.priority === 'High' ? '#FCA5A5' : task.priority === 'Medium' ? '#FCD34D' : '#94A3B8', flexShrink: 0 }}>
                      {task.priority}
                    </span>
                    {taskStatusChanging === task.id ? (
                      <Loader2 size={12} style={{ animation: 'spin 1s linear infinite', color: '#475569', flexShrink: 0 }} />
                    ) : (
                      <select
                        value={task.status}
                        onChange={e => handleTaskStatusChange(task.id, e.target.value)}
                        style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', outline: 'none', fontSize: '0.68rem', color: task.status === 'Completed' ? '#34D399' : task.status === 'In Progress' ? '#38BDF8' : task.status === 'Overdue' ? '#FCA5A5' : '#94A3B8', cursor: 'pointer', fontFamily: 'inherit', padding: '2px 6px', borderRadius: '4px', flexShrink: 0 }}
                      >
                        {TASK_STATUS_OPTIONS.map(s => <option key={s} value={s} style={{ background: '#1E2A45', color: '#F1F5F9' }}>{s}</option>)}
                      </select>
                    )}
                    <button
                      onClick={() => navigate(`/workspaces/${task.workspace_id}`)}
                      style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: '#475569', borderRadius: '4px', flexShrink: 0 }}
                      title="Open workspace"
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
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Version History</span>
            </div>
            <div style={{ padding: '1.25rem 1.5rem' }}>
              {/* Current version as single entry */}
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '9999px', background: '#00D4FF', border: '2px solid #00D4FF', flexShrink: 0, marginTop: '3px', boxShadow: '0 0 8px rgba(0,212,255,0.5)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#00D4FF' }}>Current</span>
                    <span className="status-active" style={{ fontSize: '0.65rem' }}>Latest</span>
                    <span style={{ fontSize: '0.72rem', color: '#334155' }}>{doc.date}</span>
                    <span style={{ fontSize: '0.72rem', color: '#475569' }}>by {doc.author}</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#475569', margin: 0 }}>{doc.name}</p>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button
                      className="btn-ghost"
                      style={{ fontSize: '0.72rem', height: '26px', padding: '0 0.625rem', opacity: doc.file_url ? 1 : 0.4 }}
                      onClick={handleDownload}
                    >
                      <Download size={11} /> Download
                    </button>
                  </div>
                </div>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#334155', marginTop: '1.5rem', textAlign: 'center' }}>
                Version history will appear here as new versions are uploaded.
              </p>
            </div>
          </div>
        )}

        {/* ── AI Chat ── */}
        {activeTab === 'AI Chat' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: 'calc(100vh - 280px)' }}>
            <div className="section-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className="section-card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sparkles size={15} style={{ color: '#8B5CF6' }} />
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>AI Document Chat</span>
                </div>
                <span style={{ fontSize: '0.72rem', color: '#475569' }}>Document context</span>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {messages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.75rem', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    {msg.role === 'ai' && (
                      <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg, #7C3AED, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Sparkles size={13} style={{ color: 'white' }} />
                      </div>
                    )}
                    <div style={{ maxWidth: '75%', padding: '0.75rem 1rem', borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '4px 12px 12px 12px', background: msg.role === 'user' ? 'rgba(14,165,233,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${msg.role === 'user' ? 'rgba(14,165,233,0.2)' : 'rgba(255,255,255,0.07)'}`, fontSize: '0.82rem', color: '#94A3B8', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '0.75rem' }}>
                <input
                  type="text"
                  placeholder="Ask anything about this document…"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                  className="input-field"
                  style={{ flex: 1 }}
                />
                <button className="btn-ai" style={{ height: '38px', padding: '0 1rem' }} onClick={handleSendMessage}>
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
