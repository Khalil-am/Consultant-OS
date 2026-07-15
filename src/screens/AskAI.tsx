import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, Sparkles, ChevronDown, Share2, History, Plus, Check,
  MessageSquare, X, ChevronRight, Bot, User as UserIcon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLayout } from '../hooks/useLayout';
import {
  getWorkspaces, getTasks, getRisks, getMilestones, getDocuments, getReports,
  getChatThreads, upsertChatThread,
} from '../lib/db';
import type {
  WorkspaceRow, TaskRow, RiskRow, MilestoneRow, DocumentRow, ReportRow,
} from '../lib/db';
import { cn, fadeUp, spring } from '../components/ui';

// ── Models ───────────────────────────────────────────────────
const MODELS = [
  { id: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash' },
  { id: 'google/gemini-2.5-flash-preview-05-20', label: 'Gemini 2.5 Flash' },
  { id: 'deepseek/deepseek-chat-v3-0324:free', label: 'DeepSeek V3' },
  { id: 'meta-llama/llama-4-maverick:free', label: 'Llama 4 Maverick' },
] as const;

// ── Personas ─────────────────────────────────────────────────
const PERSONAS = [
  { id: 'risk',     name: 'Risk Analyst',    initials: 'RA', color: '#63E6BE', desc: 'Project risk assessment & mitigation' },
  { id: 'data',     name: 'Data Scientist',  initials: 'DS', color: '#A78BFA', desc: 'Advanced analytics & predictive modeling' },
  { id: 'strategy', name: 'Strategy Advisor',initials: 'SA', color: '#C4B5FD', desc: 'Business strategy & transformation' },
  { id: 'tech',     name: 'Tech Architect',  initials: 'TA', color: '#7DD3FC', desc: 'Enterprise architecture & system design' },
  { id: 'change',   name: 'Change Manager',  initials: 'CM', color: '#F0A875', desc: 'Organizational change & adoption' },
] as const;

const SUGGESTED_PROMPTS = [
  { emoji: '📊', label: 'Summarize portfolio risks this week' },
  { emoji: '⚡', label: 'Which milestones are most at risk?' },
  { emoji: '💡', label: 'Draft a status update for NCA' },
  { emoji: '🎯', label: 'What should I focus on today?' },
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

function loadThreadsLocal(): StoredThread[] {
  try {
    const raw = localStorage.getItem(THREAD_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as StoredThread[];
  } catch { /* ignore */ }
  return [];
}

function saveThreadsLocal(threads: StoredThread[]) {
  try { localStorage.setItem(THREAD_STORAGE_KEY, JSON.stringify(threads.slice(0, 20))); } catch { /* ignore */ }
}

async function saveThreadToSupabase(thread: StoredThread): Promise<void> {
  await upsertChatThread({
    id: thread.id,
    title: thread.title,
    persona_id: thread.personaId,
    model_id: thread.modelId,
    messages: thread.messages.map((m) => ({
      ...m,
      timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : String(m.timestamp),
    })),
    time: thread.time,
  });
}

async function loadThreadsFromSupabase(): Promise<StoredThread[]> {
  const rows = await getChatThreads();
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    time: row.time,
    personaId: row.persona_id,
    modelId: row.model_id,
    messages: (row.messages as Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: string; persona?: string; model?: string }>).map((m) => ({
      ...m,
      timestamp: new Date(m.timestamp),
    })),
  }));
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

// ── RAG context builder ────────────────────────────────────────
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
    if (workspaces.length) {
      ctx += '=== WORKSPACES ===\n';
      workspaces.forEach((w) => { ctx += `- ${w.name} | ${w.client} | ${w.status} | ${w.progress}%\n`; });
      ctx += '\n';
    }
    if (tasks.length) {
      ctx += `=== TASKS ===\nTotal: ${tasks.length}\n`;
      const overdue = tasks.filter((t) => t.status === 'Overdue');
      if (overdue.length) overdue.forEach((t) => { ctx += `  Overdue: ${t.title} (${t.workspace}) — ${t.assignee}\n`; });
      ctx += '\n';
    }
    if (risks.length) {
      ctx += `=== RISKS ===\nTotal: ${risks.length}\n`;
      const critical = risks.filter((r) => r.severity === 'Critical' && r.status === 'Open');
      if (critical.length) critical.forEach((r) => { ctx += `  Critical: ${r.title} (${r.workspace})\n`; });
      ctx += '\n';
    }
    if (milestones.length) {
      ctx += '=== MILESTONES ===\n';
      milestones.slice(0, 12).forEach((m) => { ctx += `- ${m.title} | ${m.due_date} | ${m.status}\n`; });
      ctx += '\n';
    }
    if (documents.length) ctx += `Documents: ${documents.length} total across portfolio.\n`;
    if (reports.length) ctx += `Reports: ${reports.length} generated.\n`;
  } catch {
    ctx += '[Unable to fetch some portfolio data]\n';
  }
  return ctx;
}

function buildSystemPrompt(persona: typeof PERSONAS[number], ragContext: string): string {
  return `You are "${persona.name}", an AI assistant embedded in Consultant OS — a professional consulting portfolio management platform.

Your specialty: ${persona.desc}

Here is the live portfolio data:

${ragContext}

Guidelines:
- Be professional, concise, and actionable
- Reference real data from above when answering
- Use numbered lists, bold (**bold**), and structured formatting
- Format currency properly (SAR)
- Keep responses focused — avoid unnecessary preamble`;
}

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

  const renderInline = (t: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    const regex = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(t)) !== null) {
      if (match.index > lastIndex) parts.push(t.slice(lastIndex, match.index));
      parts.push(<strong key={match.index} className="text-white font-semibold">{match[1]}</strong>);
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < t.length) parts.push(t.slice(lastIndex));
    return parts.length === 1 ? parts[0] : <>{parts}</>;
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    const items = listItems.map((item, i) => <li key={i} className="mb-1">{renderInline(item)}</li>);
    if (listType === 'ol') elements.push(<ol key={elements.length} className="my-2 pl-5 list-decimal">{items}</ol>);
    else elements.push(<ul key={elements.length} className="my-2 pl-5 list-disc">{items}</ul>);
    listItems = [];
    listType = null;
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
        elements.push(<h4 key={i} className="mt-3 mb-1 text-[0.95rem] font-bold text-white">{renderInline(line.slice(4))}</h4>);
      } else if (line.startsWith('## ')) {
        elements.push(<h3 key={i} className="mt-4 mb-1 text-[1rem] font-bold text-white">{renderInline(line.slice(3))}</h3>);
      } else if (line.trim() === '') {
        elements.push(<div key={i} className="h-2" />);
      } else {
        elements.push(<p key={i} className="my-1 leading-relaxed">{renderInline(line)}</p>);
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
  const [threads, setThreads] = useState<StoredThread[]>(() => loadThreadsLocal());
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<typeof MODELS[number]>(MODELS[0]);
  const [selectedPersona, setSelectedPersona] = useState<typeof PERSONAS[number]>(PERSONAS[0]);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [ragContext, setRagContext] = useState<string | null>(null);
  const [shareLabel, setShareLabel] = useState<'Share' | 'Copied!' | 'Failed'>('Share');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const personaMenuRef = useRef<HTMLDivElement>(null);
  const historyMenuRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) setShowModelMenu(false);
      if (personaMenuRef.current && !personaMenuRef.current.contains(e.target as Node)) setShowPersonaMenu(false);
      if (historyMenuRef.current && !historyMenuRef.current.contains(e.target as Node)) setShowHistory(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { buildRAGContext().then(setRagContext); }, []);

  useEffect(() => {
    loadThreadsFromSupabase()
      .then((supabaseThreads) => {
        if (supabaseThreads.length > 0) {
          setThreads(supabaseThreads);
          saveThreadsLocal(supabaseThreads);
        }
      })
      .catch(() => { /* fallback to local */ });
  }, []);

  const saveCurrentThread = useCallback((msgs: ChatMessage[]) => {
    if (msgs.length === 0) return;
    const firstUser = msgs.find((m) => m.role === 'user');
    const title = firstUser ? firstUser.content.slice(0, 50) + (firstUser.content.length > 50 ? '…' : '') : 'New Thread';
    const threadId = selectedThread ?? crypto.randomUUID();
    const thread: StoredThread = {
      id: threadId, title, time: 'Just now',
      messages: msgs, personaId: selectedPersona.id, modelId: selectedModel.id,
    };
    setThreads((prev) => {
      const filtered = prev.filter((t) => t.id !== threadId);
      const updated = [thread, ...filtered];
      saveThreadsLocal(updated);
      return updated;
    });
    saveThreadToSupabase(thread).catch(() => {});
    if (!selectedThread) setSelectedThread(threadId);
  }, [selectedThread, selectedPersona.id, selectedModel.id]);

  const handleSend = useCallback(async (presetInput?: string) => {
    const text = (presetInput ?? input).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(), role: 'user', content: text, timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      let ctx = ragContext;
      if (!ctx) {
        ctx = await buildRAGContext();
        setRagContext(ctx);
      }
      const systemPrompt = buildSystemPrompt(selectedPersona, ctx);
      const history: { role: 'user' | 'assistant' | 'system'; content: string }[] = [{ role: 'system', content: systemPrompt }];
      for (const m of [...messages, userMsg]) history.push({ role: m.role, content: m.content });
      const response = await callOpenRouter(history, selectedModel.id);
      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(), role: 'assistant', content: response,
        timestamp: new Date(), persona: selectedPersona.name, model: selectedModel.label,
      };
      setMessages((prev) => {
        const updated = [...prev, aiMsg];
        saveCurrentThread(updated);
        return updated;
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(), role: 'assistant',
        content: `**Error:** ${errMsg}\n\nPlease check your API key and try again.`,
        timestamp: new Date(), persona: selectedPersona.name, model: selectedModel.label,
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, selectedModel, selectedPersona, ragContext, saveCurrentThread]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleShare = useCallback(async () => {
    if (messages.length === 0) return;
    const lines = [`Thread: ${selectedPersona.name} (${selectedModel.label})`, ''];
    for (const msg of messages) {
      lines.push(`[${msg.role === 'user' ? 'You' : 'AI'}]: ${msg.content}`, '');
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setShareLabel('Copied!');
      setTimeout(() => setShareLabel('Share'), 2000);
    } catch {
      setShareLabel('Failed');
      setTimeout(() => setShareLabel('Share'), 2000);
    }
  }, [messages, selectedPersona, selectedModel]);

  const handleNewThread = () => {
    saveCurrentThread(messages);
    setMessages([]);
    setSelectedThread(null);
  };

  const handleLoadThread = (thread: StoredThread) => {
    saveCurrentThread(messages);
    const persona = PERSONAS.find((p) => p.id === thread.personaId) ?? PERSONAS[0];
    const model = MODELS.find((m) => m.id === thread.modelId) ?? MODELS[0];
    setSelectedPersona(persona);
    setSelectedModel(model);
    setMessages(thread.messages.map((m) => ({ ...m, timestamp: new Date(m.timestamp) })));
    setSelectedThread(thread.id);
    setShowHistory(false);
  };

  const isEmpty = messages.length === 0 && !isLoading;

  return (
    <div className="relative flex flex-col h-[calc(100dvh-68px)] overflow-hidden">
      {/* Ambient aurora backdrop */}
      <div aria-hidden className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-[radial-gradient(circle,rgba(120,119,198,0.10)_0%,transparent_70%)] pointer-events-none" />
      <div aria-hidden className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(99,230,190,0.06)_0%,transparent_70%)] pointer-events-none" />

      {/* ── Compact toolbar ───────────────────────── */}
      <div className="relative flex items-center justify-between gap-2 px-4 md:px-6 py-3 border-b border-white/[0.05] flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#7877C6] via-[#A78BFA] to-[#63E6BE] flex items-center justify-center shadow-[0_2px_8px_rgba(120,119,198,0.4),inset_0_1px_0_rgba(255,255,255,0.3)] flex-shrink-0">
            <Sparkles size={14} className="text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-[0.92rem] font-semibold text-white tracking-tight leading-tight">Ask AI</div>
            <div className="text-[0.68rem] text-[color:var(--text-muted)] truncate">Grounded on your portfolio data</div>
          </div>
        </div>

        {/* Persona pill */}
        <div ref={personaMenuRef} className="relative">
          <button
            onClick={() => { setShowPersonaMenu((v) => !v); setShowModelMenu(false); setShowHistory(false); }}
            className="h-[34px] flex items-center gap-2 px-2.5 rounded-full bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] transition-colors"
          >
            <div className="w-5 h-5 rounded-md flex items-center justify-center text-[0.58rem] font-bold" style={{ background: `${selectedPersona.color}28`, color: selectedPersona.color }}>
              {selectedPersona.initials}
            </div>
            {!isMobile && <span className="text-[0.78rem] text-white font-medium truncate max-w-[140px]">{selectedPersona.name}</span>}
            <ChevronDown size={11} className={cn('text-[color:var(--text-muted)] transition-transform', showPersonaMenu && 'rotate-180')} />
          </button>
          <AnimatePresence>
            {showPersonaMenu && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-[calc(100%+8px)] w-[280px] rounded-2xl glass-elevated p-1.5 shadow-[var(--shadow-lg)] z-50"
              >
                <div className="text-[0.62rem] font-bold tracking-[0.12em] uppercase text-[color:var(--text-muted)] px-2 py-1.5">Persona</div>
                {PERSONAS.map((p) => {
                  const active = selectedPersona.id === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedPersona(p); setShowPersonaMenu(false); }}
                      className={cn(
                        'w-full flex items-start gap-2.5 p-2.5 rounded-xl text-left transition-colors',
                        active ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]',
                      )}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[0.68rem] font-bold flex-shrink-0" style={{ background: `${p.color}22`, color: p.color }}>
                        {p.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[0.82rem] font-semibold text-white">{p.name}</span>
                          {active && <Check size={11} className="text-[#63E6BE]" />}
                        </div>
                        <div className="text-[0.7rem] text-[color:var(--text-muted)] leading-snug mt-0.5">{p.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Model pill */}
        <div ref={modelMenuRef} className="relative">
          <button
            onClick={() => { setShowModelMenu((v) => !v); setShowPersonaMenu(false); setShowHistory(false); }}
            className="h-[34px] flex items-center gap-1.5 px-2.5 rounded-full bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#63E6BE] shadow-[0_0_6px_rgba(99,230,190,0.8)]" />
            {!isMobile && <span className="text-[0.76rem] text-white font-medium truncate max-w-[120px]">{selectedModel.label}</span>}
            <ChevronDown size={11} className={cn('text-[color:var(--text-muted)] transition-transform', showModelMenu && 'rotate-180')} />
          </button>
          <AnimatePresence>
            {showModelMenu && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-[calc(100%+8px)] w-[240px] rounded-2xl glass-elevated p-1.5 shadow-[var(--shadow-lg)] z-50"
              >
                <div className="text-[0.62rem] font-bold tracking-[0.12em] uppercase text-[color:var(--text-muted)] px-2 py-1.5">Model</div>
                {MODELS.map((m) => {
                  const active = selectedModel.id === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => { setSelectedModel(m); setShowModelMenu(false); }}
                      className={cn(
                        'w-full flex items-center gap-2 p-2 rounded-xl text-left transition-colors',
                        active ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]',
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[0.82rem] font-medium text-white truncate">{m.label}</span>
                          {active && <Check size={11} className="text-[#63E6BE] flex-shrink-0" />}
                        </div>
                      </div>
                      <span className="text-[0.58rem] font-bold tracking-[0.08em] uppercase text-[#63E6BE] bg-[rgba(99,230,190,0.12)] border border-[rgba(99,230,190,0.24)] px-1.5 py-0.5 rounded">Free</span>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* History */}
        <div ref={historyMenuRef} className="relative">
          <button
            onClick={() => { setShowHistory((v) => !v); setShowModelMenu(false); setShowPersonaMenu(false); }}
            className="w-[34px] h-[34px] rounded-full bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] transition-colors flex items-center justify-center text-[color:var(--text-muted)] hover:text-white"
            title="History"
          >
            <History size={14} />
          </button>
          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-[calc(100%+8px)] w-[320px] max-h-[420px] overflow-hidden rounded-2xl glass-elevated shadow-[var(--shadow-lg)] z-50 flex flex-col"
              >
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.05] flex-shrink-0">
                  <span className="text-[0.82rem] font-bold text-white">Recent threads</span>
                  <button
                    onClick={() => { handleNewThread(); setShowHistory(false); }}
                    className="flex items-center gap-1 text-[0.68rem] font-semibold text-[#A78BFA] hover:text-[#C4B5FD] transition-colors"
                  >
                    <Plus size={11} /> New
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-1.5">
                  {threads.length === 0 ? (
                    <div className="flex flex-col items-center gap-1.5 py-8 text-center">
                      <MessageSquare size={22} className="text-[color:var(--text-faint)]" />
                      <div className="text-[0.78rem] font-semibold text-white">No threads yet</div>
                      <div className="text-[0.68rem] text-[color:var(--text-muted)]">Your conversations show up here.</div>
                    </div>
                  ) : (
                    threads.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleLoadThread(t)}
                        className={cn(
                          'w-full text-left p-2.5 rounded-xl transition-colors',
                          selectedThread === t.id ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]',
                        )}
                      >
                        <div className="text-[0.8rem] font-medium text-white leading-snug truncate">{t.title}</div>
                        <div className="text-[0.66rem] text-[color:var(--text-faint)] mt-0.5">{t.time}</div>
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Share */}
        <button
          onClick={handleShare}
          disabled={messages.length === 0}
          title={shareLabel}
          className={cn(
            'w-[34px] h-[34px] rounded-full border transition-colors flex items-center justify-center',
            shareLabel === 'Copied!'
              ? 'bg-[rgba(99,230,190,0.12)] border-[rgba(99,230,190,0.3)] text-[#63E6BE]'
              : 'bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.07] text-[color:var(--text-muted)] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed',
          )}
        >
          {shareLabel === 'Copied!' ? <Check size={14} /> : <Share2 size={14} />}
        </button>
      </div>

      {/* ── Message area ───────────────────────────── */}
      <div className="relative flex-1 overflow-y-auto">
        <div className="max-w-[760px] mx-auto px-4 md:px-6 py-6 md:py-10 w-full">
          {isEmpty ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center text-center pt-8 md:pt-20 pb-10"
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#7877C6] via-[#A78BFA] to-[#63E6BE] flex items-center justify-center shadow-[0_12px_32px_rgba(120,119,198,0.5),inset_0_1px_0_rgba(255,255,255,0.3)] mb-5 ring-1 ring-white/20"
              >
                <Sparkles size={24} className="text-white drop-shadow" />
              </motion.div>
              <h2 className="text-[1.6rem] md:text-[2rem] font-semibold tracking-[-0.025em] leading-tight mb-2">
                <span className="bg-gradient-to-br from-white to-[#B7BDCE] bg-clip-text text-transparent">What can I help you with, </span>
                <span className="gradient-text-multi">Khalil?</span>
              </h2>
              <p className="text-[0.9rem] text-[color:var(--text-muted)] max-w-md mb-8 leading-relaxed">
                Ask anything about your portfolio — risks, milestones, documents, or financials.
                I'm grounded on <span className="text-white font-semibold">your live Consultant OS data</span>.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-lg">
                {SUGGESTED_PROMPTS.map((s, i) => (
                  <motion.button
                    key={s.label}
                    variants={fadeUp}
                    initial="hidden"
                    animate="show"
                    transition={{ delay: 0.2 + i * 0.06 }}
                    whileHover={{ y: -2, transition: spring }}
                    onClick={() => handleSend(s.label)}
                    className="group flex items-start gap-3 text-left p-3.5 rounded-2xl bg-white/[0.025] border border-white/[0.06] hover:border-white/[0.15] hover:bg-white/[0.05] transition-colors"
                  >
                    <span className="text-[1rem] flex-shrink-0">{s.emoji}</span>
                    <span className="text-[0.82rem] text-[color:var(--text-secondary)] group-hover:text-white transition-colors leading-snug">{s.label}</span>
                    <ChevronRight size={12} className="text-[color:var(--text-faint)] group-hover:text-white opacity-0 group-hover:opacity-100 transition-all ml-auto flex-shrink-0 mt-0.5" />
                  </motion.button>
                ))}
              </div>
            </motion.div>
          ) : (
            <div className="space-y-5">
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className={cn('flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
                  >
                    <div
                      className={cn(
                        'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ring-1',
                        msg.role === 'user'
                          ? 'bg-white/[0.06] ring-white/10 text-[color:var(--text-secondary)]'
                          : 'bg-gradient-to-br from-[#7877C6]/25 to-[#63E6BE]/15 ring-[rgba(120,119,198,0.3)] text-[#A78BFA]',
                      )}
                    >
                      {msg.role === 'user' ? <UserIcon size={14} /> : <Sparkles size={14} />}
                    </div>
                    <div className={cn('flex-1 min-w-0 max-w-[calc(100%-3rem)]', msg.role === 'user' && 'flex justify-end')}>
                      <div
                        className={cn(
                          'rounded-2xl px-4 py-3 text-[0.88rem] leading-relaxed',
                          msg.role === 'user'
                            ? 'bg-gradient-to-br from-[#7877C6] to-[#635BFF] text-white shadow-[0_4px_14px_rgba(99,91,255,0.3)] max-w-[85%]'
                            : 'bg-white/[0.035] border border-white/[0.06] text-[color:var(--text-secondary)] backdrop-blur-sm',
                        )}
                      >
                        {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                      </div>
                      {msg.role === 'assistant' && msg.persona && (
                        <div className="flex items-center gap-1.5 mt-1.5 text-[0.66rem] text-[color:var(--text-faint)]">
                          <span>{msg.persona}</span>
                          <span>·</span>
                          <span>{msg.model}</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3"
                >
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#7877C6]/25 to-[#63E6BE]/15 ring-1 ring-[rgba(120,119,198,0.3)] flex items-center justify-center flex-shrink-0">
                    <Sparkles size={14} className="text-[#A78BFA]" />
                  </div>
                  <div className="bg-white/[0.035] border border-white/[0.06] rounded-2xl px-4 py-3 flex items-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
                        className="w-1.5 h-1.5 rounded-full bg-[#A78BFA]"
                      />
                    ))}
                  </div>
                </motion.div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* ── Composer ─────────────────────────────── */}
      <div className="relative flex-shrink-0 border-t border-white/[0.05] bg-[rgba(7,8,15,0.7)] backdrop-blur-xl">
        <div className="max-w-[760px] mx-auto px-4 md:px-6 py-3 md:py-4">
          <div
            className={cn(
              'flex items-end gap-2 rounded-[24px] bg-white/[0.04] border transition-all p-1.5 pl-4',
              input.trim().length > 0
                ? 'border-[rgba(120,119,198,0.4)] shadow-[0_0_0_3px_rgba(120,119,198,0.12),0_12px_32px_rgba(120,119,198,0.12)]'
                : 'border-white/[0.1]',
            )}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${selectedPersona.name}…`}
              rows={1}
              className="flex-1 bg-transparent border-0 outline-none resize-none py-2.5 text-[0.92rem] text-white placeholder:text-[color:var(--text-faint)] max-h-[200px] leading-relaxed"
            />
            <motion.button
              whileHover={{ scale: input.trim().length > 0 ? 1.05 : 1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className={cn(
                'w-[38px] h-[38px] rounded-full flex items-center justify-center transition-all flex-shrink-0',
                input.trim().length > 0 && !isLoading
                  ? 'bg-gradient-to-br from-[#7877C6] to-[#635BFF] text-white shadow-[0_4px_14px_rgba(99,91,255,0.4),inset_0_1px_0_rgba(255,255,255,0.2)]'
                  : 'bg-white/[0.05] text-[color:var(--text-faint)] cursor-not-allowed',
              )}
            >
              <Send size={14} strokeWidth={2.4} />
            </motion.button>
          </div>
          <div className="flex items-center justify-between mt-2 px-1">
            <div className="text-[0.66rem] text-[color:var(--text-faint)] hidden md:block">
              <kbd className="kbd">Enter</kbd> to send · <kbd className="kbd">⇧ Enter</kbd> for new line
            </div>
            <div className="flex items-center gap-1.5 text-[0.66rem] text-[color:var(--text-faint)] ml-auto">
              <Bot size={10} /> {selectedModel.label}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
