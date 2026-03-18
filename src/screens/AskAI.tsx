import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, Mic, Plus, Sparkles, ChevronDown, Share2, History,
  User, Image, FileText, Code2, MessageSquare, Bot, Menu, X,
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

// ── Thread stubs ─────────────────────────────────────────────
const THREADS = [
  { id: '1', title: 'Risk Analysis Q1 2026', time: '2 hours ago' },
  { id: '2', title: 'Migration Strategy Review', time: 'Yesterday' },
  { id: '3', title: 'Budget Forecast Analysis', time: '3 days ago' },
  { id: '4', title: 'Stakeholder Mapping', time: '1 week ago' },
  { id: '5', title: 'Technical Architecture', time: '2 weeks ago' },
];

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
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [selectedPersona, setSelectedPersona] = useState(PERSONAS[0]);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [ragContext, setRagContext] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

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

      setMessages(prev => [...prev, aiMsg]);
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

  const handleNewThread = () => {
    setMessages([]);
    setSelectedThread(null);
    setRagContext(null);
    buildRAGContext().then(setRagContext);
  };

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
            <button style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
              color: '#94A3B8', fontSize: '0.8rem', cursor: 'pointer',
            }}>
              <History size={14} /> History
            </button>
            <button style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
              color: '#94A3B8', fontSize: '0.8rem', cursor: 'pointer',
            }}>
              <Share2 size={14} /> Share
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
              >
                <X size={14} />
              </button>
            </div>
          )}
          {/* Recent Threads */}
          <div style={{ padding: '16px 14px 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', color: '#64748B', textTransform: 'uppercase' }}>Recent Threads</span>
              <button
                onClick={handleNewThread}
                style={{
                  width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)',
                  color: '#10B981', cursor: 'pointer',
                }}
              >
                <Plus size={13} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {THREADS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedThread(t.id)}
                  style={{
                    textAlign: 'left', padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                    background: selectedThread === t.id ? 'rgba(16,185,129,0.10)' : 'transparent',
                    border: selectedThread === t.id ? '1px solid rgba(16,185,129,0.2)' : '1px solid transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: '0.8rem', fontWeight: 500, color: selectedThread === t.id ? '#F1F5F9' : '#CBD5E1', lineHeight: 1.3 }}>{t.title}</div>
                  <div style={{ fontSize: '0.65rem', color: '#475569', marginTop: 2 }}>{t.time}</div>
                </button>
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

            {messages.map(msg => (
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
              <button style={{
                width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                color: '#64748B', cursor: 'pointer', flexShrink: 0,
              }}>
                <Mic size={15} />
              </button>

              {/* Model selector */}
              <div ref={modelDropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
                <button
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
