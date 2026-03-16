import { useState, useRef, useEffect } from 'react';
import { useLayout } from '../hooks/useLayout';
import {
  Search, Sparkles, ExternalLink, Filter,
  FileText, Brain, ArrowRight, Send, Loader
} from 'lucide-react';
import { getDocuments } from '../lib/db';
import type { DocumentRow } from '../lib/db';
import { chatWithDocument } from '../lib/openrouter';
import type { ChatMsg } from '../lib/openrouter';

const filters = [
  { label: 'Document Type', options: ['All Types', 'BRD', 'FRD', 'Minutes', 'Risk Register', 'Report'] },
  { label: 'Content Type', options: ['All Content', 'Requirements', 'Decisions', 'Risks', 'Actions'] },
  { label: 'Date Range', options: ['All Time', 'Last 7 Days', 'Last 30 Days', 'Last Quarter'] },
];

const SYSTEM_PROMPT = `You are an expert AI consultant assistant embedded in Consultant OS, a professional consulting management platform.

You help users find answers across a portfolio of consulting documents. You'll be given relevant documents and should synthesize a clear, professional answer.

Guidelines:
- Be concise and direct — professional consulting tone
- Structure answers with bullet points or sections when helpful
- Reference specific documents by name when relevant
- If information is insufficient, say so clearly
- Format with **bold** for key terms and section headers`;

function buildSearchPrompt(query: string, docs: DocumentRow[]): string {
  const docContext = docs.slice(0, 6).map((d, i) =>
    `[Doc ${i + 1}] "${d.name}" (${d.type}, ${d.workspace}, ${d.date})
Summary: ${d.summary || 'No summary available'}
Tags: ${d.tags?.join(', ') || 'None'}`
  ).join('\n\n');

  return `${SYSTEM_PROMPT}

The user searched for: "${query}"

Here are the most relevant documents found:

${docContext || 'No documents found matching this query.'}

Answer the user's query based on these documents. Be specific about which documents contain the relevant information.`;
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
  // Exact phrase match bonus
  if (name.includes(q)) score += 20;
  if (summary.includes(q)) score += 15;
  return score;
}

export default function Knowledge() {
  const { isTablet } = useLayout();
  const [query, setQuery] = useState('');
  const [searchedQuery, setSearchedQuery] = useState('');
  const [results, setResults] = useState<(DocumentRow & { score: number })[]>([]);
  const [allDocs, setAllDocs] = useState<DocumentRow[]>([]);
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiSources, setAiSources] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getDocuments().then(setAllDocs).catch(() => {});
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, chatLoading]);

  async function handleSearch() {
    if (!query.trim()) return;
    setSearchedQuery(query);
    setAiAnswer('');
    setAiSources([]);
    setAiError('');
    setChatHistory([]);

    // Score and sort docs
    const scored = allDocs
      .map(d => ({ ...d, score: scoreDoc(d, query) }))
      .filter(d => d.score > 0)
      .sort((a, b) => b.score - a.score);
    setResults(scored.slice(0, 8));

    // AI answer
    setAiLoading(true);
    try {
      const systemPrompt = buildSearchPrompt(query, scored.slice(0, 6));
      const answer = await chatWithDocument([{ role: 'user', content: query }], systemPrompt);
      setAiAnswer(answer);
      setAiSources(scored.slice(0, 3).map(d => d.name));
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : 'AI answer failed');
    } finally {
      setAiLoading(false);
    }
  }

  async function handleFollowUp(msg?: string) {
    const text = msg ?? chatInput;
    if (!text.trim() || chatLoading) return;
    setChatInput('');
    const newMsg: ChatMsg = { role: 'user', content: text };
    const updatedHistory = [...chatHistory, newMsg];
    setChatHistory(updatedHistory);
    setChatLoading(true);

    try {
      const systemPrompt = buildSearchPrompt(searchedQuery || text, results.slice(0, 5));
      const reply = await chatWithDocument(updatedHistory.filter(m => m.role !== 'system'), systemPrompt);
      setChatHistory([...updatedHistory, { role: 'assistant', content: reply }]);
    } catch (e: unknown) {
      setChatHistory([...updatedHistory, { role: 'assistant', content: `Error: ${e instanceof Error ? e.message : 'Request failed'}` }]);
    } finally {
      setChatLoading(false);
    }
  }

  const relevancePct = (score: number): number => {
    const maxScore = results[0]?.score || 1;
    return Math.min(99, Math.round((score / maxScore) * 95) + 5);
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
      {/* Left Filter Panel */}
      <div style={{
        width: isTablet ? '100%' : '220px', minWidth: isTablet ? undefined : '220px',
        borderRight: isTablet ? 'none' : '1px solid rgba(255,255,255,0.05)',
        display: isTablet ? 'none' : 'block',
        padding: '1rem 0.875rem', overflowY: 'auto', background: '#0C1220',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Filter size={13} style={{ color: '#64748B' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Filters</span>
        </div>

        {filters.map(filter => (
          <div key={filter.label} style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.68rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.375rem' }}>
              {filter.label}
            </div>
            {filter.options.map((opt, i) => (
              <div key={opt} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0', cursor: 'pointer' }}>
                <div style={{
                  width: '13px', height: '13px', borderRadius: '3px', flexShrink: 0,
                  background: i === 0 ? 'rgba(0,212,255,0.2)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${i === 0 ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                }} />
                <span style={{ fontSize: '0.75rem', color: i === 0 ? '#94A3B8' : '#64748B' }}>{opt}</span>
              </div>
            ))}
          </div>
        ))}

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.875rem' }}>
          <div style={{ fontSize: '0.68rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
            Knowledge Stats
          </div>
          {[
            { label: 'Documents indexed', value: String(allDocs.length) },
            { label: 'Workspaces covered', value: String(new Set(allDocs.map(d => d.workspace)).size) },
          ].map(stat => (
            <div key={stat.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0' }}>
              <span style={{ fontSize: '0.72rem', color: '#334155' }}>{stat.label}</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748B' }}>{stat.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Search Bar */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.75rem 1rem', borderRadius: '0.75rem',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(0,212,255,0.2)',
            boxShadow: '0 0 16px rgba(0,212,255,0.06)',
          }}>
            <Brain size={18} style={{ color: '#8B5CF6', flexShrink: 0 }} />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search knowledge base... (e.g. 'integration requirements' or 'risks in smart city')"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '0.9rem', color: '#F1F5F9', fontFamily: 'inherit' }}
            />
            <button className="btn-primary" style={{ height: '34px', fontSize: '0.8rem', flexShrink: 0 }} onClick={handleSearch}>
              <Search size={13} /> Search
            </button>
          </div>
          {searchedQuery && (
            <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '0.5rem', paddingLeft: '0.25rem' }}>
              {results.length > 0
                ? `${results.length} documents matched "${searchedQuery}"`
                : `No documents matched "${searchedQuery}"`}
            </div>
          )}
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {!searchedQuery && (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
              <Brain size={40} style={{ margin: '0 auto 1rem', color: 'var(--text-faint)', display: 'block' }} />
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Search your knowledge base</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Ask any question — AI will search your documents and answer</div>
            </div>
          )}

          {searchedQuery && results.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>No documents found</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Try different keywords or upload more documents</div>
            </div>
          )}

          {results.map(result => (
            <div
              key={result.id}
              className="section-card"
              style={{ padding: '1rem', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.05)'}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <div style={{ padding: '0.3rem', borderRadius: '5px', background: `${result.type_color}15`, color: result.type_color }}>
                    <FileText size={13} />
                  </div>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9', margin: 0 }}>{result.name}</h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <div style={{ width: '48px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${relevancePct(result.score)}%`, background: '#8B5CF6', borderRadius: '2px' }} />
                    </div>
                    <span style={{ fontSize: '0.68rem', color: '#8B5CF6', fontWeight: 600 }}>{relevancePct(result.score)}%</span>
                  </div>
                  <ExternalLink size={12} style={{ color: '#334155' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.625rem' }}>
                <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '3px', background: `${result.type_color}12`, color: result.type_color, border: `1px solid ${result.type_color}20` }}>
                  {result.type}
                </span>
                <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '3px', background: 'rgba(255,255,255,0.04)', color: '#64748B', border: '1px solid rgba(255,255,255,0.05)' }}>
                  {result.workspace}
                </span>
                <span style={{ fontSize: '0.65rem', color: '#334155', marginLeft: 'auto' }}>{result.date}</span>
              </div>

              {result.summary && (
                <p style={{ fontSize: '0.8rem', color: '#64748B', lineHeight: 1.6, margin: 0, marginBottom: '0.5rem' }}>
                  {result.summary.slice(0, 220)}{result.summary.length > 220 ? '…' : ''}
                </p>
              )}

              {result.tags && result.tags.length > 0 && (
                <div style={{ fontSize: '0.68rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                  {result.tags.slice(0, 4).map(tag => (
                    <span key={tag} style={{ padding: '1px 5px', borderRadius: '3px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', color: '#475569' }}>{tag}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right AI Answer Panel */}
      <div style={{
        width: isTablet ? '100%' : '320px', minWidth: isTablet ? undefined : '320px',
        borderLeft: isTablet ? 'none' : '1px solid rgba(255,255,255,0.05)',
        display: isTablet ? 'none' : 'flex', flexDirection: 'column', overflowY: 'auto', background: '#0C1220',
      }}>
        {/* AI Answer */}
        <div style={{
          padding: '1rem',
          borderBottom: '1px solid rgba(139,92,246,0.15)',
          background: 'linear-gradient(160deg, #0C1220, #130D2A)',
          flex: aiAnswer || aiLoading ? '0 0 auto' : '1',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
            <div style={{ padding: '0.3rem', borderRadius: '6px', background: 'rgba(139,92,246,0.15)' }}>
              <Sparkles size={14} style={{ color: '#8B5CF6' }} />
            </div>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#F1F5F9' }}>AI Answer</span>
            {aiLoading && <Loader size={13} style={{ color: '#8B5CF6', animation: 'spin 1s linear infinite', marginLeft: 'auto' }} />}
          </div>

          {!searchedQuery && !aiLoading && (
            <div style={{ fontSize: '0.78rem', color: '#334155', lineHeight: 1.6, padding: '0.75rem', background: 'rgba(139,92,246,0.04)', borderRadius: '8px', border: '1px solid rgba(139,92,246,0.1)' }}>
              Search for anything — AI will read your documents and synthesize an answer.
            </div>
          )}

          {aiLoading && (
            <div style={{ fontSize: '0.78rem', color: '#64748B', padding: '0.5rem 0' }}>
              Analyzing {results.length} documents…
            </div>
          )}

          {aiError && (
            <div style={{ fontSize: '0.75rem', color: '#FCA5A5', padding: '0.625rem', background: 'rgba(239,68,68,0.06)', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.15)', lineHeight: 1.5 }}>
              {aiError}
            </div>
          )}

          {aiAnswer && !aiLoading && (
            <>
              <div style={{ fontSize: '0.78rem', color: '#94A3B8', lineHeight: 1.75, whiteSpace: 'pre-wrap', maxHeight: '300px', overflowY: 'auto', marginBottom: '0.875rem' }}>
                {aiAnswer}
              </div>

              {aiSources.length > 0 && (
                <div style={{ marginBottom: '0.875rem' }}>
                  <div style={{ fontSize: '0.68rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.375rem' }}>Sources</div>
                  {aiSources.map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.5rem', padding: '0.25rem 0', cursor: 'pointer' }}>
                      <FileText size={11} style={{ color: '#64748B', flexShrink: 0, marginTop: '2px' }} />
                      <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{s}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Chat Follow-up */}
        {searchedQuery && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0.875rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', marginBottom: '0.625rem' }}>Ask a Follow-up</div>

            {/* Suggestion chips */}
            {chatHistory.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '0.75rem' }}>
                {[
                  'What are the key risks?',
                  'Summarize the main requirements',
                  'What decisions were made?',
                ].map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleFollowUp(suggestion)}
                    style={{
                      textAlign: 'left', padding: '0.5rem 0.625rem', borderRadius: '6px', fontSize: '0.75rem',
                      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
                      color: '#64748B', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                      display: 'flex', alignItems: 'center', gap: '0.375rem',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(139,92,246,0.08)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(139,92,246,0.2)'; (e.currentTarget as HTMLElement).style.color = '#94A3B8'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = '#64748B'; }}
                  >
                    <ArrowRight size={10} style={{ flexShrink: 0 }} /> {suggestion}
                  </button>
                ))}
              </div>
            )}

            {/* Chat history */}
            {chatHistory.length > 0 && (
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '0.75rem', maxHeight: '220px' }}>
                {chatHistory.map((msg, i) => (
                  <div key={i} style={{
                    padding: '0.5rem 0.625rem', borderRadius: '8px', fontSize: '0.75rem', lineHeight: 1.55,
                    background: msg.role === 'user' ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${msg.role === 'user' ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.05)'}`,
                    color: msg.role === 'user' ? '#A78BFA' : '#94A3B8',
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '90%', whiteSpace: 'pre-wrap',
                  }}>
                    {msg.content}
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ display: 'flex', gap: '4px', padding: '0.5rem 0.75rem', alignSelf: 'flex-start' }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#8B5CF6', animation: `bounce 1.4s ease-in-out ${i * 0.16}s infinite` }} />
                    ))}
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}

            {/* Input */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="Ask anything..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleFollowUp()}
                className="input-field"
                style={{ flex: 1, fontSize: '0.78rem' }}
              />
              <button
                className="btn-ai"
                style={{ height: '36px', padding: '0 0.75rem' }}
                onClick={() => handleFollowUp()}
                disabled={chatLoading}
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
