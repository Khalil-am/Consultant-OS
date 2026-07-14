import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, Mic, Plus, Sparkles, ChevronDown, Share2, History,
  User, Image, FileText, Code2, MessageSquare, Bot, Menu, X, Download, Eraser, ClipboardCopy, Search,
  ThumbsUp, ThumbsDown,
} from 'lucide-react';
import { useLayout } from '../hooks/useLayout';
import {
  getWorkspaces, getTasks, getRisks, getMilestones, getDocuments, getReports,
} from '../lib/db';
import type {
  WorkspaceRow, TaskRow, RiskRow, MilestoneRow, DocumentRow, ReportRow,
} from '../lib/db';

// ── Models ───────────────────────────────────────────────────
const MODELS = [
  { id: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash', badge: 'Free' },
  { id: 'google/gemini-2.5-flash-preview-05-20', label: 'Gemini 2.5 Flash', badge: 'Free' },
  { id: 'deepseek/deepseek-chat-v3-0324:free', label: 'DeepSeek V3', badge: 'Free' },
  { id: 'meta-llama/llama-4-maverick:free', label: 'Llama 4 Maverick', badge: 'Free' },
];

// ── Personas ─────────────────────────────────────────────────
const PERSONAS = [
  { id: 'risk', name: 'Risk Analyst', initials: 'RA', color: '#10B981', desc: 'Specialized in project risk assessment and mitigation strategies' },
  { id: 'data', name: 'Data Scientist', initials: 'DS', color: '#0EA5E9', desc: 'Advanced analytics and predictive modeling expert' },
  { id: 'strategy', name: 'Strategy Advisor', initials: 'SA', color: '#8B5CF6', desc: 'Business strategy and transformation consultant' },
  { id: 'tech', name: 'Tech Architect', initials: 'TA', color: '#00D4FF', desc: 'Enterprise architecture and system design specialist' },
  { id: 'change', name: 'Change Manager', initials: 'CM', color: '#F59E0B', desc: 'Organizational change and adoption expert' },
];

// ── Thread storage ────────────────────────────────────────────
interface StoredThread {
  id: string;
  title: string;
  time: string;
  messages: ChatMessage[];
  personaId: string;
  modelId: string;
}

const THREAD_STORAGE_KEY = 'askai_threads';

function loadThreads(): StoredThread[] {
  try {
    const raw = localStorage.getItem(THREAD_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as StoredThread[];
  } catch { /* ignore */ }
  return [];
}

function saveThreads(threads: StoredThread[]) {
  try { localStorage.setItem(THREAD_STORAGE_KEY, JSON.stringify(threads.slice(0, 20))); } catch { /* ignore */ }
}

// ── Types ────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  persona?: string;
  model?: string;
}

// ── Helper: relative time ────────────────────────────────────
function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

// ── Build RAG context ────────────────────────────────────────
async function buildRAGContext(): Promise<string> {
  let ctx = '';
  try {
    const [workspaces, tasks, risks, milestones, documents, reports] = await Promise.all([
      getWorkspaces().catch(() => [] as WorkspaceRow[]),
      getTasks().catch(() => [] as TaskRow[]),
      getRisks().catch(() => [] as RiskRow[]),
      getMilestones().catch(() => [] as MilestoneRow[]),
      getDocuments().catch(() => [] as DocumentRow[]),
      getReports().catch(() => [] as ReportRow[]),
    ]);

    // Workspaces
    if (workspaces.length) {
      ctx += '=== PORTFOLIO WORKSPACES ===\n';
      workspaces.forEach(w => {
        ctx += `- ${w.name} | Client: ${w.client} | Sector: ${w.sector} | Status: ${w.status} | Progress: ${w.progress}% | Type: ${w.type}\n`;
      });
      ctx += '\n';
    }

    // Tasks summary
    if (tasks.length) {
      ctx += '=== TASKS OVERVIEW ===\n';
      const statusCounts: Record<string, number> = {};
      const priorityCounts: Record<string, number> = {};
      tasks.forEach(t => {
        statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
        priorityCounts[t.priority] = (priorityCounts[t.priority] || 0) + 1;
      });
      ctx += `Total tasks: ${tasks.length}\n`;
      ctx += `By status: ${Object.entries(statusCounts).map(([k, v]) => `${k}: ${v}`).join(', ')}\n`;
      ctx += `By priority: ${Object.entries(priorityCounts).map(([k, v]) => `${k}: ${v}`).join(', ')}\n`;
      // Overdue / high-priority
      const overdue = tasks.filter(t => t.status === 'Overdue');
      if (overdue.length) {
        ctx += `Overdue tasks:\n`;
        overdue.forEach(t => { ctx += `  - "${t.title}" (${t.workspace}) assigned to ${t.assignee}, due ${t.due_date}\n`; });
      }
      const highPri = tasks.filter(t => t.priority === 'High' && t.status !== 'Completed');
      if (highPri.length) {
        ctx += `High priority open tasks:\n`;
        highPri.slice(0, 10).forEach(t => { ctx += `  - "${t.title}" (${t.workspace}) — ${t.status}\n`; });
      }
      ctx += '\n';
    }

    // Risks
    if (risks.length) {
      ctx += '=== RISKS ===\n';
      const sevCounts: Record<string, number> = {};
      risks.forEach(r => { sevCounts[r.severity] = (sevCounts[r.severity] || 0) + 1; });
      ctx += `Total risks: ${risks.length} | By severity: ${Object.entries(sevCounts).map(([k, v]) => `${k}: ${v}`).join(', ')}\n`;
      const openCritical = risks.filter(r => r.severity === 'Critical' && r.status === 'Open');
      if (openCritical.length) {
        ctx += `Open critical risks:\n`;
        openCritical.forEach(r => { ctx += `  - "${r.title}" (${r.workspace}) — Impact: ${r.impact}, Probability: ${r.probability}, Mitigation: ${r.mitigation}\n`; });
      }
      const openHigh = risks.filter(r => r.severity === 'High' && r.status === 'Open');
      if (openHigh.length) {
        ctx += `Open high risks:\n`;
        openHigh.slice(0, 8).forEach(r => { ctx += `  - "${r.title}" (${r.workspace}) — ${r.category}\n`; });
      }
      ctx += '\n';
    }

    // Milestones
    if (milestones.length) {
      ctx += '=== MILESTONES ===\n';
      milestones.slice(0, 15).forEach(m => {
        ctx += `- "${m.title}" | Due: ${m.due_date} | Status: ${m.status} | Completion: ${m.completion_pct}% | Owner: ${m.owner}\n`;
      });
      ctx += '\n';
    }

    // Documents
    if (documents.length) {
      ctx += '=== DOCUMENTS ===\n';
      ctx += `Total: ${documents.length} documents\n`;
      documents.slice(0, 12).forEach(d => {
        ctx += `- "${d.name}" (${d.type}) — ${d.workspace} — Status: ${d.status}\n`;
      });
      ctx += '\n';
    }

    // Reports
    if (reports.length) {
      ctx += '=== REPORTS ===\n';
      reports.slice(0, 8).forEach(r => {
        ctx += `- "${r.title}" (${r.type}) — ${r.workspace} — ${r.status} — Period: ${r.period}\n`;
      });
      ctx += '\n';
    }
  } catch {
    ctx += '[Could not fetch some portfolio data]\n';
  }
  return ctx;
}

function buildSystemPrompt(persona: typeof PERSONAS[0], ragContext: string): string {
  return `You are "${persona.name}", an AI assistant embedded in Consultant OS — a professional consulting portfolio management platform.

Your specialty: ${persona.desc}

You have access to the following LIVE portfolio data from the system. Use it to give accurate, data-driven responses. Always reference specific project names, numbers, and statuses when relevant.

${ragContext}

Guidelines:
- Be professional, concise, and actionable
- Reference real data from above when answering
- Use numbered lists, bold text (**bold**), and structured formatting
- If asked about something not in the data, say so honestly
- Provide strategic insights and recommendations where appropriate
- When discussing risks, always mention severity and mitigation status
- Format currency values properly (SAR)
- Keep responses focused — avoid unnecessary preamble`;
}

// ── OpenRouter call ──────────────────────────────────────────
async function callOpenRouter(
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
  model: string,
): Promise<string> {
  const key = import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined;
  if (!key) throw new Error('OpenRouter API key not set. Add VITE_OPENROUTER_API_KEY to .env.local');

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Consultant OS',
    },
    body: JSON.stringify({ model, messages, max_tokens: 2048, temperature: 0.7 }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `OpenRouter error ${res.status}`);
  }

  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() ?? 'No response received.';
}

// ── Markdown-lite renderer ───────────────────────────────────
function renderMarkdown(text: string) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listType: 'ol' | 'ul' | null = null;

  const flushList = () => {
    if (listItems.length === 0) return;
    const items = listItems.map((item, i) => <li key={i} style={{ marginBottom: 4 }}>{renderInline(item)}</li>);
    if (listType === 'ol') elements.push(<ol key={elements.length} style={{ margin: '8px 0', paddingLeft: 20 }}>{items}</ol>);
    else elements.push(<ul key={elements.length} style={{ margin: '8px 0', paddingLeft: 20 }}>{items}</ul>);
    listItems = [];
    listType = null;
  };

  const renderInline = (t: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    const regex = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(t)) !== null) {
      if (match.index > lastIndex) parts.push(t.slice(lastIndex, match.index));
      parts.push(<strong key={match.index} style={{ color: '#F1F5F9' }}>{match[1]}</strong>);
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < t.length) parts.push(t.slice(lastIndex));
    return parts.length === 1 ? parts[0] : <>{parts}</>;
  };

  lines.forEach((line, i) => {
    const olMatch = line.match(/^(\d+)\.\s+(.+)/);
    const ulMatch = line.match(/^[-*]\s+(.+)/);
    if (olMatch) {
      if (listType !== 'ol') flushList();
      listType = 'ol';
      listItems.push(olMatch[2]);
    } else if (ulMatch) {
      if (listType !== 'ul') flushList();
      listType = 'ul';
      listItems.push(ulMatch[1]);
    } else {
      flushList();
      if (line.startsWith('### ')) {
        elements.push(<h4 key={i} style={{ margin: '12px 0 4px', fontSize: '0.95rem', fontWeight: 700, color: '#F1F5F9' }}>{renderInline(line.slice(4))}</h4>);
      } else if (line.startsWith('## ')) {
        elements.push(<h3 key={i} style={{ margin: '14px 0 6px', fontSize: '1rem', fontWeight: 700, color: '#F1F5F9' }}>{renderInline(line.slice(3))}</h3>);
      } else if (line.trim() === '') {
        elements.push(<div key={i} style={{ height: 8 }} />);
      } else {
        elements.push(<p key={i} style={{ margin: '4px 0', lineHeight: 1.6 }}>{renderInline(line)}</p>);
      }
    }
  });
  flushList();
  return <>{elements}</>;
}

// ══════════════════════════════════════════════════════════════
// AskAI Component
// ══════════════════════════════════════════════════════════════
export default function AskAI() {
  const { isMobile } = useLayout();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threads, setThreads] = useState<StoredThread[]>(() => loadThreads());
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [selectedPersona, setSelectedPersona] = useState(PERSONAS[0]);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [ragContext, setRagContext] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [shareLabel, setShareLabel] = useState('Share');
  const [threadSearch, setThreadSearch] = useState('');
  const [threadPersonaFilter, setThreadPersonaFilter] = useState<string>('All');
  const [threadSort, setThreadSort] = useState<'newest' | 'oldest' | 'messages' | 'title' | 'persona' | 'model'>('newest');
  const [starredThreads, setStarredThreads] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('askai_starred_threads') ?? '[]')); } catch { return new Set(); }
  });
  const [starredOnly, setStarredOnly] = useState(false);
  const [activeThreadsOnly, setActiveThreadsOnly] = useState(false);
  const [copiedLastResponse, setCopiedLastResponse] = useState(false);
  const [copiedFullConversation, setCopiedFullConversation] = useState(false);
  const [txtExported, setTxtExported] = useState(false);
  const [messageSearch, setMessageSearch] = useState('');

  // Message reactions
  const REACTIONS_KEY = 'askai_message_reactions';
  const [reactions, setReactions] = useState<Record<string, 'up' | 'down'>>(() => {
    try { return JSON.parse(localStorage.getItem(REACTIONS_KEY) ?? '{}') as Record<string, 'up' | 'down'>; } catch { return {}; }
  });
  function handleReaction(msgId: string, reaction: 'up' | 'down') {
    setReactions(prev => {
      const next = { ...prev };
      if (next[msgId] === reaction) {
        delete next[msgId];
      } else {
        next[msgId] = reaction;
      }
      try { localStorage.setItem(REACTIONS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const historyDropdownRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Close model dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setShowModelDropdown(false);
      }
      if (historyDropdownRef.current && !historyDropdownRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Pre-fetch RAG context on mount
  useEffect(() => {
    buildRAGContext().then(setRagContext);
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Get RAG context (use cached or fetch fresh)
      let ctx = ragContext;
      if (!ctx) {
        ctx = await buildRAGContext();
        setRagContext(ctx);
      }

      const systemPrompt = buildSystemPrompt(selectedPersona, ctx);

      // Build conversation history
      const history: { role: 'user' | 'assistant' | 'system'; content: string }[] = [
        { role: 'system', content: systemPrompt },
      ];
      // Include previous messages for context continuity
      for (const m of [...messages, userMsg]) {
        history.push({ role: m.role, content: m.content });
      }

      const response = await callOpenRouter(history, selectedModel.id);

      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        persona: selectedPersona.name,
        model: selectedModel.label,
      };

      setMessages(prev => {
        const updated = [...prev, aiMsg];
        // Auto-save thread after assistant replies
        saveCurrentThread(updated);
        return updated;
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      const errorChat: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `**Error:** ${errMsg}\n\nPlease check your API key and try again.`,
        timestamp: new Date(),
        persona: selectedPersona.name,
        model: selectedModel.label,
      };
      setMessages(prev => [...prev, errorChat]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, selectedModel, selectedPersona, ragContext]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleShare = useCallback(async () => {
    if (messages.length === 0) return;
    const lines = [`Thread: ${selectedPersona.name}`, ''];
    for (const msg of messages) {
      const label = msg.role === 'user' ? 'User' : 'AI';
      lines.push(`[${label}]: ${msg.content}`, '');
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setShareLabel('Copied!');
      setTimeout(() => setShareLabel('Share'), 2000);
    } catch {
      setShareLabel('Failed');
      setTimeout(() => setShareLabel('Share'), 2000);
    }
  }, [messages, selectedPersona]);

  const handleExportTxt = useCallback(() => {
    if (messages.length === 0) return;
    const date = new Date().toISOString().slice(0, 10);
    const lines: string[] = [
      `AI Conversation – ${selectedPersona.name}`,
      `Exported: ${date} | Model: ${selectedModel.label}`,
      '',
    ];
    for (const msg of messages) {
      const role = msg.role === 'user' ? 'You' : (msg.persona ?? selectedPersona.name);
      lines.push(`${role}:`, msg.content, '');
    }
    const txt = lines.join('\n');
    const blob = new Blob([txt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation_${date}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setTxtExported(true);
    setTimeout(() => setTxtExported(false), 2000);
  }, [messages, selectedPersona, selectedModel]);

  const handleExportMarkdown = useCallback(() => {
    if (messages.length === 0) return;
    const date = new Date().toISOString().slice(0, 10);
    const lines = [
      `# AI Conversation – ${selectedPersona.name}`,
      `> Exported ${date} | Model: ${selectedModel.label}`,
      '',
    ];
    for (const msg of messages) {
      const header = msg.role === 'user' ? '## User' : `## ${msg.persona ?? selectedPersona.name}`;
      lines.push(header, '', msg.content, '');
    }
    const md = lines.join('\n');
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation_${date}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [messages, selectedPersona, selectedModel]);

  const handleClearChat = useCallback(() => {
    if (window.confirm('Clear this conversation?')) {
      setMessages([]);
    }
  }, []);

  const handleCopyFullConversation = useCallback(() => {
    if (messages.length === 0) return;
    const text = messages.map(m => {
      const role = m.role === 'user' ? 'You' : (m.persona ?? selectedPersona.name);
      return `${role}:\n${m.content}`;
    }).join('\n\n---\n\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopiedFullConversation(true);
      setTimeout(() => setCopiedFullConversation(false), 2000);
    }).catch(() => {});
  }, [messages, selectedPersona]);

  const handleCopyLastResponse = useCallback(() => {
    const lastAI = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAI) return;
    navigator.clipboard.writeText(lastAI.content).then(() => {
      setCopiedLastResponse(true);
      setTimeout(() => setCopiedLastResponse(false), 2000);
    }).catch(() => {});
  }, [messages]);

  const saveCurrentThread = useCallback((msgs: ChatMessage[]) => {
    if (msgs.length === 0) return;
    const firstUser = msgs.find(m => m.role === 'user');
    const title = firstUser
      ? firstUser.content.slice(0, 50) + (firstUser.content.length > 50 ? '…' : '')
      : 'New Thread';
    const threadId = selectedThread ?? crypto.randomUUID();
    const thread: StoredThread = {
      id: threadId,
      title,
      time: 'Just now',
      messages: msgs,
      personaId: selectedPersona.id,
      modelId: selectedModel.id,
    };
    setThreads(prev => {
      const filtered = prev.filter(t => t.id !== threadId);
      const updated = [thread, ...filtered];
      saveThreads(updated);
      return updated;
    });
  }, [selectedThread, selectedPersona.id, selectedModel.id]);

  const handleLoadThread = (thread: StoredThread) => {
    saveCurrentThread(messages);
    const persona = PERSONAS.find(p => p.id === thread.personaId) ?? PERSONAS[0];
    const model = MODELS.find(m => m.id === thread.modelId) ?? MODELS[0];
    setSelectedPersona(persona);
    setSelectedModel(model);
    setMessages(thread.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) })));
    setSelectedThread(thread.id);
    setShowHistory(false);
    setShowSidebar(false);
  };

  const handleNewThread = () => {
    saveCurrentThread(messages);
    setMessages([]);
    setSelectedThread(null);
    setRagContext(null);
    buildRAGContext().then(setRagContext);
  };

  const handleDeleteThread = (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = threads.filter(t => t.id !== threadId);
    setThreads(updated);
    saveThreads(updated);
    if (selectedThread === threadId) {
      setMessages([]);
      setSelectedThread(null);
    }
  };

  const handleClearAllThreads = () => {
    setThreads([]);
    saveThreads([]);
    setMessages([]);
    setSelectedThread(null);
  };

  function handleToggleStarThread(threadId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setStarredThreads(prev => {
      const next = new Set(prev);
      if (next.has(threadId)) next.delete(threadId); else next.add(threadId);
      try { localStorage.setItem('askai_starred_threads', JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

  // ── Render ──────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#080C18', color: '#F1F5F9', overflow: 'hidden' }}>

      {/* ── Top bar ──────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isMobile ? '12px 16px' : '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: '#0A0F1C', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isMobile && (
            <button
              onClick={() => setShowSidebar(v => !v)}
              style={{
                width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                color: '#94A3B8', cursor: 'pointer', flexShrink: 0,
              }}
              aria-label="Toggle sidebar"
            >
              <Menu size={16} />
            </button>
          )}
          <div style={{
            width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #10B981, #059669)',
          }}>
            <Sparkles size={18} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#F1F5F9' }}>Ask AI</h1>
            {!isMobile && <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748B' }}>Powered by advanced AI models</p>}
          </div>
        </div>
        {!isMobile && (
          <div style={{ display: 'flex', gap: 8 }}>
            {/* History dropdown */}
            <div ref={historyDropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setShowHistory(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8,
                  background: showHistory ? 'rgba(16,185,129,0.10)' : 'rgba(255,255,255,0.05)',
                  border: showHistory ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(255,255,255,0.08)',
                  color: showHistory ? '#10B981' : '#94A3B8', fontSize: '0.8rem', cursor: 'pointer',
                }}
                aria-label="Toggle history"
                aria-expanded={showHistory}
              >
                <History size={14} /> History
              </button>
              {showHistory && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 6,
                  background: '#0F1629', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
                  padding: 8, minWidth: 240, boxShadow: '0 12px 40px rgba(0,0,0,0.5)', zIndex: 50,
                }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '4px 8px 8px' }}>
                    Recent Threads
                  </div>
                  {threads.length === 0 ? (
                    <div style={{ fontSize: '0.75rem', color: '#475569', padding: '8px 10px' }}>No saved threads yet</div>
                  ) : threads.map(t => (
                    <button
                      key={t.id}
                      onClick={() => handleLoadThread(t)}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                        background: selectedThread === t.id ? 'rgba(16,185,129,0.10)' : 'transparent',
                        border: selectedThread === t.id ? '1px solid rgba(16,185,129,0.2)' : '1px solid transparent',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { if (selectedThread !== t.id) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                      onMouseLeave={e => { if (selectedThread !== t.id) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{ fontSize: '0.8rem', fontWeight: 500, color: selectedThread === t.id ? '#F1F5F9' : '#CBD5E1', lineHeight: 1.3 }}>{t.title}</div>
                      <div style={{ fontSize: '0.65rem', color: '#475569', marginTop: 2 }}>{t.time}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Export buttons */}
            <button
              onClick={handleExportMarkdown}
              disabled={messages.length === 0}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                color: messages.length === 0 ? '#334155' : '#94A3B8', fontSize: '0.8rem',
                cursor: messages.length === 0 ? 'not-allowed' : 'pointer', opacity: messages.length === 0 ? 0.5 : 1,
              }}
              aria-label="Export conversation as Markdown"
            >
              <Download size={14} /> Export MD
            </button>
            <button
              onClick={handleExportTxt}
              disabled={messages.length === 0}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8,
                background: txtExported ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.05)',
                border: txtExported ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(255,255,255,0.08)',
                color: messages.length === 0 ? '#334155' : txtExported ? '#10B981' : '#94A3B8', fontSize: '0.8rem',
                cursor: messages.length === 0 ? 'not-allowed' : 'pointer', opacity: messages.length === 0 ? 0.5 : 1,
              }}
              aria-label="Export conversation as TXT"
            >
              <Download size={14} /> {txtExported ? 'Exported!' : 'Export TXT'}
            </button>
            {/* Copy Last AI Response button */}
            <button
              onClick={handleCopyLastResponse}
              disabled={!messages.some(m => m.role === 'assistant')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8,
                background: copiedLastResponse ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.05)',
                border: copiedLastResponse ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(255,255,255,0.08)',
                color: !messages.some(m => m.role === 'assistant') ? '#334155' : copiedLastResponse ? '#10B981' : '#94A3B8',
                fontSize: '0.8rem',
                cursor: !messages.some(m => m.role === 'assistant') ? 'not-allowed' : 'pointer',
                opacity: !messages.some(m => m.role === 'assistant') ? 0.5 : 1,
              }}
              aria-label="Copy last AI response to clipboard"
            >
              <ClipboardCopy size={14} /> {copiedLastResponse ? 'Copied!' : 'Copy'}
            </button>
            {/* Copy Full Conversation button */}
            <button
              onClick={handleCopyFullConversation}
              disabled={messages.length === 0}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8,
                background: copiedFullConversation ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.05)',
                border: copiedFullConversation ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(255,255,255,0.08)',
                color: messages.length === 0 ? '#334155' : copiedFullConversation ? '#10B981' : '#94A3B8',
                fontSize: '0.8rem',
                cursor: messages.length === 0 ? 'not-allowed' : 'pointer',
                opacity: messages.length === 0 ? 0.5 : 1,
              }}
              aria-label="Copy full conversation to clipboard"
            >
              <ClipboardCopy size={14} /> {copiedFullConversation ? 'Copied!' : 'Copy All'}
            </button>
            {/* Clear Chat button */}
            <button
              onClick={handleClearChat}
              disabled={messages.length === 0}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                color: messages.length === 0 ? '#334155' : '#94A3B8', fontSize: '0.8rem',
                cursor: messages.length === 0 ? 'not-allowed' : 'pointer', opacity: messages.length === 0 ? 0.5 : 1,
              }}
              aria-label="Clear Chat"
            >
              <Eraser size={14} /> Clear
            </button>
            {/* Share button */}
            <button
              onClick={handleShare}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8,
                background: shareLabel === 'Copied!' ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.05)',
                border: shareLabel === 'Copied!' ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(255,255,255,0.08)',
                color: shareLabel === 'Copied!' ? '#10B981' : '#94A3B8', fontSize: '0.8rem', cursor: 'pointer',
              }}
              aria-label="Share conversation"
            >
              <Share2 size={14} /> {shareLabel}
            </button>
          </div>
        )}
      </div>

      {/* ── Body: sidebar + chat ─────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Mobile sidebar overlay backdrop ─────────────────── */}
        {isMobile && showSidebar && (
          <div
            onClick={() => setShowSidebar(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 40,
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
            }}
          />
        )}

        {/* ── Left sidebar ───────────────────────────────────── */}
        <div style={{
          width: 240, minWidth: 240, borderRight: '1px solid rgba(255,255,255,0.07)',
          background: '#0A0F1C', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          ...(isMobile ? {
            position: 'fixed' as const, top: 0, left: 0, bottom: 0, zIndex: 50,
            transform: showSidebar ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.25s ease',
            boxShadow: showSidebar ? '4px 0 24px rgba(0,0,0,0.5)' : 'none',
          } : {}),
        }}>
          {/* Close button on mobile overlay */}
          {isMobile && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 10px 0' }}>
              <button
                onClick={() => setShowSidebar(false)}
                style={{
                  width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#94A3B8', cursor: 'pointer',
                }}
                aria-label="Close sidebar"
              >
                <X size={14} />
              </button>
            </div>
          )}
          {/* Recent Threads */}
          <div style={{ padding: '16px 14px 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', color: '#64748B', textTransform: 'uppercase' }}>Recent Threads</span>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                {threads.length > 0 && (
                  <button
                    onClick={handleClearAllThreads}
                    style={{
                      width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                      color: '#FCA5A5', cursor: 'pointer',
                    }}
                    aria-label="Clear all threads"
                    title="Clear all threads"
                  >
                    <Eraser size={12} />
                  </button>
                )}
                <button
                  onClick={handleNewThread}
                  style={{
                    width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)',
                    color: '#10B981', cursor: 'pointer',
                  }}
                  aria-label="New thread"
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>
            {threads.length > 0 && (
              <input
                type="text"
                aria-label="Search threads"
                placeholder="Search threads…"
                value={threadSearch}
                onChange={e => setThreadSearch(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6, color: '#CBD5E1', fontSize: '0.75rem',
                  padding: '5px 8px', marginBottom: 6, outline: 'none',
                }}
              />
            )}
            {/* Persona filter */}
            <select
              aria-label="Filter threads by persona"
              value={threadPersonaFilter}
              onChange={e => setThreadPersonaFilter(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', fontSize: '0.72rem', padding: '4px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8', fontFamily: 'inherit', marginBottom: 6, outline: 'none', cursor: 'pointer' }}
            >
              <option value="All">All Personas</option>
              {PERSONAS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select
              aria-label="Sort threads"
              value={threadSort}
              onChange={e => setThreadSort(e.target.value as typeof threadSort)}
              style={{ width: '100%', boxSizing: 'border-box', fontSize: '0.72rem', padding: '4px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8', fontFamily: 'inherit', marginBottom: 6, outline: 'none', cursor: 'pointer' }}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="messages">Most Messages</option>
              <option value="title">Title A–Z</option>
              <option value="persona">Persona</option>
              <option value="model">Model A–Z</option>
            </select>
            {threads.length > 0 && (
              <>
                <button
                  onClick={() => setStarredOnly(v => !v)}
                  aria-label="Show starred threads only"
                  aria-pressed={starredOnly}
                  style={{ width: '100%', marginBottom: 4, fontSize: '0.72rem', padding: '4px 8px', borderRadius: 6, background: starredOnly ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)', border: starredOnly ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.08)', color: starredOnly ? '#FCD34D' : '#94A3B8', fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left' }}
                >
                  ⭐ Starred only
                </button>
                <button
                  onClick={() => setActiveThreadsOnly(v => !v)}
                  aria-label="Show active threads only"
                  aria-pressed={activeThreadsOnly}
                  style={{ width: '100%', marginBottom: 6, fontSize: '0.72rem', padding: '4px 8px', borderRadius: 6, background: activeThreadsOnly ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)', border: activeThreadsOnly ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.08)', color: activeThreadsOnly ? '#34D399' : '#94A3B8', fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left' }}
                >
                  ✓ Active only
                </button>
              </>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {threads.length === 0 ? (
                <div style={{ fontSize: '0.75rem', color: '#475569', padding: '8px 10px' }}>No saved threads yet. Start chatting!</div>
              ) : (threadSort === 'oldest'
                  ? [...threads].reverse()
                  : threadSort === 'messages'
                  ? [...threads].sort((a, b) => b.messages.length - a.messages.length)
                  : threadSort === 'title'
                  ? [...threads].sort((a, b) => a.title.localeCompare(b.title))
                  : threadSort === 'persona'
                  ? [...threads].sort((a, b) => (a.personaId ?? '').localeCompare(b.personaId ?? ''))
                  : threadSort === 'model'
                  ? [...threads].sort((a, b) => (a.modelId ?? '').localeCompare(b.modelId ?? ''))
                  : threads
                ).filter(t =>
                  (!threadSearch.trim() || t.title.toLowerCase().includes(threadSearch.toLowerCase())) &&
                  (threadPersonaFilter === 'All' || t.personaId === threadPersonaFilter) &&
                  (!starredOnly || starredThreads.has(t.id)) &&
                  (!activeThreadsOnly || t.messages.length > 0)
                ).map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'stretch', gap: 4 }}>
                  <button
                    onClick={() => handleLoadThread(t)}
                    style={{
                      flex: 1, textAlign: 'left', padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                      background: selectedThread === t.id ? 'rgba(16,185,129,0.10)' : 'transparent',
                      border: selectedThread === t.id ? '1px solid rgba(16,185,129,0.2)' : '1px solid transparent',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: '0.8rem', fontWeight: 500, color: selectedThread === t.id ? '#F1F5F9' : '#CBD5E1', lineHeight: 1.3 }}>{starredThreads.has(t.id) ? '⭐ ' : ''}{t.title}</div>
                    <div style={{ fontSize: '0.65rem', color: '#475569', marginTop: 2 }}>{t.time}</div>
                  </button>
                  <button
                    aria-label={`${starredThreads.has(t.id) ? 'Unstar' : 'Star'} thread: ${t.title}`}
                    aria-pressed={starredThreads.has(t.id)}
                    onClick={(e) => handleToggleStarThread(t.id, e)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: starredThreads.has(t.id) ? '#F59E0B' : '#475569', padding: '4px 4px', borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', fontSize: '0.75rem' }}
                  >
                    ⭐
                  </button>
                  <button
                    aria-label={`Delete thread: ${t.title}`}
                    onClick={(e) => handleDeleteThread(t.id, e)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '4px 6px', borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center' }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '8px 14px' }} />

          {/* AI Personas */}
          <div style={{ padding: '8px 14px 14px', flex: 1, overflowY: 'auto' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>AI Personas</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {PERSONAS.map(p => {
                const active = selectedPersona.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPersona(p)}
                    aria-label={`Persona: ${p.name}`}
                    aria-pressed={active}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px', borderRadius: 10,
                      textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s',
                      background: active ? `${p.color}14` : 'rgba(255,255,255,0.02)',
                      border: active ? `1px solid ${p.color}40` : '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    <div style={{
                      width: 32, height: 32, minWidth: 32, borderRadius: 8,
                      background: `${p.color}22`, color: p.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.7rem', fontWeight: 700, position: 'relative',
                    }}>
                      {p.initials}
                      {active && (
                        <div style={{
                          position: 'absolute', bottom: -2, right: -2, width: 8, height: 8, borderRadius: '50%',
                          background: '#10B981', border: '2px solid #0A0F1C',
                        }} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: active ? '#F1F5F9' : '#CBD5E1', lineHeight: 1.2 }}>{p.name}</div>
                      <div style={{ fontSize: '0.62rem', color: '#64748B', marginTop: 3, lineHeight: 1.35 }}>{p.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Main chat area ─────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px 12px' : '24px 32px' }}>
            {messages.length === 0 && !isLoading && (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                height: '100%', textAlign: 'center', gap: 16,
              }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 18,
                  background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(0,212,255,0.10))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Bot size={30} color="#10B981" />
                </div>
                <div>
                  <h2 style={{ margin: '0 0 6px', fontSize: '1.2rem', fontWeight: 700, color: '#F1F5F9' }}>
                    {selectedPersona.name} is ready
                  </h2>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748B', maxWidth: 420 }}>
                    Ask anything about your projects, risks, tasks, or portfolio data.
                    I have access to your live Consultant OS data.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {['What are the critical risks?', 'Summarize portfolio status', 'Show overdue tasks'].map(q => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); setTimeout(() => inputRef.current?.focus(), 50); }}
                      style={{
                        padding: '8px 16px', borderRadius: 20, fontSize: '0.78rem', cursor: 'pointer',
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                        color: '#94A3B8', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.08)'; e.currentTarget.style.borderColor = 'rgba(16,185,129,0.25)'; e.currentTarget.style.color = '#10B981'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#94A3B8'; }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.length > 0 && (
              <div style={{ marginBottom: 16, position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none' }} />
                <input
                  aria-label="Search messages in this conversation"
                  placeholder="Search messages…"
                  value={messageSearch}
                  onChange={e => setMessageSearch(e.target.value)}
                  style={{ width: '100%', paddingLeft: '2.25rem', paddingRight: messageSearch ? '2rem' : '0.75rem', height: '34px', fontSize: '0.78rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: '#CBD5E1', outline: 'none', boxSizing: 'border-box' }}
                />
                {messageSearch && (
                  <button
                    onClick={() => setMessageSearch('')}
                    aria-label="Clear message search"
                    style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center', padding: 0 }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}

            {(messageSearch ? messages.filter(m => m.content.toLowerCase().includes(messageSearch.toLowerCase())) : messages).map(msg => (
              <div
                key={msg.id}
                style={{
                  display: 'flex', gap: 12, marginBottom: 20,
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  alignItems: 'flex-start',
                }}
              >
                {/* Avatar */}
                {msg.role === 'user' ? (
                  <div style={{
                    width: 32, height: 32, minWidth: 32, borderRadius: 8,
                    background: 'rgba(139,92,246,0.18)', color: '#A78BFA',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <User size={15} />
                  </div>
                ) : (
                  <div style={{
                    width: 32, height: 32, minWidth: 32, borderRadius: 8,
                    background: `${selectedPersona.color}22`, color: selectedPersona.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.7rem', fontWeight: 700,
                  }}>
                    {selectedPersona.initials}
                  </div>
                )}

                {/* Bubble */}
                <div style={{
                  maxWidth: isMobile ? '90%' : '75%', minWidth: 0,
                }}>
                  {/* Header for AI messages */}
                  {msg.role === 'assistant' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#CBD5E1' }}>{msg.persona}</span>
                      {msg.model && (
                        <span style={{
                          fontSize: '0.6rem', fontWeight: 600, padding: '2px 7px', borderRadius: 10,
                          background: 'rgba(16,185,129,0.12)', color: '#10B981',
                        }}>
                          {msg.model}
                        </span>
                      )}
                      <span style={{ fontSize: '0.65rem', color: '#475569' }}>{timeAgo(msg.timestamp)}</span>
                    </div>
                  )}

                  <div style={{
                    padding: '12px 16px', borderRadius: 14,
                    background: msg.role === 'user' ? 'rgba(139,92,246,0.12)' : '#0C1220',
                    border: msg.role === 'user' ? '1px solid rgba(139,92,246,0.18)' : '1px solid rgba(255,255,255,0.06)',
                    fontSize: '0.85rem', lineHeight: 1.65, color: '#E2E8F0',
                  }}>
                    {msg.role === 'user' ? msg.content : renderMarkdown(msg.content)}
                  </div>

                  {/* Reaction buttons for AI messages */}
                  {msg.role === 'assistant' && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                      <button
                        onClick={() => handleReaction(msg.id, 'up')}
                        aria-label={`Thumbs up for message ${msg.id}`}
                        aria-pressed={reactions[msg.id] === 'up'}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 3,
                          padding: '3px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                          background: reactions[msg.id] === 'up' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
                          color: reactions[msg.id] === 'up' ? '#10B981' : '#475569',
                          fontSize: '0.7rem', transition: 'all 0.15s',
                        }}
                      >
                        <ThumbsUp size={11} />
                      </button>
                      <button
                        onClick={() => handleReaction(msg.id, 'down')}
                        aria-label={`Thumbs down for message ${msg.id}`}
                        aria-pressed={reactions[msg.id] === 'down'}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 3,
                          padding: '3px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                          background: reactions[msg.id] === 'down' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
                          color: reactions[msg.id] === 'down' ? '#EF4444' : '#475569',
                          fontSize: '0.7rem', transition: 'all 0.15s',
                        }}
                      >
                        <ThumbsDown size={11} />
                      </button>
                    </div>
                  )}

                  {/* Timestamp for user messages */}
                  {msg.role === 'user' && (
                    <div style={{ textAlign: 'right', fontSize: '0.65rem', color: '#475569', marginTop: 4 }}>
                      {timeAgo(msg.timestamp)}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'flex-start' }}>
                <div style={{
                  width: 32, height: 32, minWidth: 32, borderRadius: 8,
                  background: `${selectedPersona.color}22`, color: selectedPersona.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.7rem', fontWeight: 700,
                }}>
                  {selectedPersona.initials}
                </div>
                <div style={{
                  padding: '12px 16px', borderRadius: 14, background: '#0C1220',
                  border: '1px solid rgba(255,255,255,0.06)', fontSize: '0.85rem', color: '#94A3B8',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ fontWeight: 600, color: selectedPersona.color }}>{selectedPersona.name} AI</span>
                  <span style={{ display: 'inline-block', animation: 'pulse 1.2s ease-in-out infinite', color: selectedPersona.color }}>&#9632;</span>
                  <span>Analyzing...</span>
                  <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* ── Input bar ──────────────────────────────────────── */}
          <div style={{ padding: isMobile ? '0 10px 14px' : '0 32px 20px', flexShrink: 0 }}>
            <div style={{
              display: 'flex', alignItems: 'flex-end', gap: 10, padding: '10px 14px',
              background: '#0C1220', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16, transition: 'border-color 0.2s',
            }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about your projects, risks, data..."
                aria-label="Chat input"
                rows={1}
                style={{
                  flex: 1, resize: 'none', background: 'transparent', border: 'none', outline: 'none',
                  color: '#F1F5F9', fontSize: '0.88rem', lineHeight: 1.5, padding: '6px 0',
                  fontFamily: 'inherit', maxHeight: 120, overflowY: 'auto',
                }}
                onInput={e => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                }}
              />

              {/* Mic */}
              <button
                aria-label="Voice input"
                style={{
                  width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                  color: '#64748B', cursor: 'pointer', flexShrink: 0,
                }}>
                <Mic size={15} />
              </button>

              {/* Model selector */}
              <div ref={modelDropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
                <button
                  aria-label="Select model"
                  aria-expanded={showModelDropdown}
                  onClick={() => setShowModelDropdown(v => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '7px 10px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    color: '#94A3B8', fontSize: '0.72rem', cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  <MessageSquare size={12} />
                  {!isMobile && selectedModel.label}
                  <ChevronDown size={12} style={{ transform: showModelDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                </button>

                {showModelDropdown && (
                  <div style={{
                    position: 'absolute', bottom: '100%', right: 0, marginBottom: 6,
                    background: '#0F1629', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
                    padding: 6, minWidth: isMobile ? 180 : 220, boxShadow: '0 12px 40px rgba(0,0,0,0.5)', zIndex: 50,
                  }}>
                    {MODELS.map(m => (
                      <button
                        key={m.id}
                        aria-label={`Model: ${m.label}`}
                        aria-pressed={selectedModel.id === m.id}
                        onClick={() => { setSelectedModel(m); setShowModelDropdown(false); }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          width: '100%', padding: '9px 12px', borderRadius: 8, cursor: 'pointer',
                          background: selectedModel.id === m.id ? 'rgba(16,185,129,0.10)' : 'transparent',
                          border: 'none', color: selectedModel.id === m.id ? '#10B981' : '#CBD5E1',
                          fontSize: '0.8rem', textAlign: 'left', transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => { if (selectedModel.id !== m.id) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                        onMouseLeave={e => { if (selectedModel.id !== m.id) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <span>{m.label}</span>
                        <span style={{
                          fontSize: '0.6rem', fontWeight: 600, padding: '2px 6px', borderRadius: 6,
                          background: 'rgba(16,185,129,0.12)', color: '#10B981',
                        }}>
                          {m.badge}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Send button */}
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                style={{
                  width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: input.trim() && !isLoading ? 'linear-gradient(135deg, #00D4FF, #10B981)' : 'rgba(255,255,255,0.06)',
                  border: 'none', cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
                  color: input.trim() && !isLoading ? '#fff' : '#475569',
                  transition: 'all 0.2s', flexShrink: 0,
                }}
                aria-label="Send message"
              >
                <Send size={16} />
              </button>
            </div>

            {/* Bottom helper row */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 4px 0', fontSize: '0.68rem', color: '#475569',
            }}>
              <div style={{ display: 'flex', gap: 14 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                  <Image size={12} /> Image
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                  <FileText size={12} /> Document
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                  <Code2 size={12} /> {'</> Code'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#334155' }}>Delay</span>
                <span style={{ color: '#334155' }}>to send</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
