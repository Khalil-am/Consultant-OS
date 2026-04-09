import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Play, Loader, CheckCircle, AlertCircle,
  FileText, Download, Copy, Save,
} from 'lucide-react';
import { upsertDocument, getWorkspaces } from '../lib/db';

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen = 'config' | 'progress' | 'output';

const N8N_WEBHOOK_URL = 'https://khalil.app.n8n.cloud/webhook/brd-to-manual';

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BrdToUserstoriesPage() {
  const navigate = useNavigate();

  // Config state
  const [inputText, setInputText] = useState('');
  const [diwanWorkspaceId, setDiwanWorkspaceId] = useState<string | null>(null);

  // Resolve Diwan workspace ID from Supabase on mount
  useEffect(() => {
    getWorkspaces().then(ws => {
      const diwan = ws.find(w => w.name.toLowerCase().includes('diwan'));
      if (diwan) setDiwanWorkspaceId(diwan.id);
    }).catch(() => {});
  }, []);

  // Run state
  const [screen, setScreen] = useState<Screen>('config');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = () => {
    const start = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleRun = async () => {
    if (!inputText.trim()) return;
    setScreen('progress');
    setError('');
    setResult('');
    setSaved(false);
    setElapsed(0);
    startTimer();

    try {
      const res = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText }),
      });

      if (!res.ok) {
        throw new Error(`Webhook returned ${res.status}: ${res.statusText}`);
      }

      // n8n may return JSON or plain text
      const contentType = res.headers.get('content-type') || '';
      let output: string;
      if (contentType.includes('application/json')) {
        const json = await res.json();
        // Handle various response shapes from n8n
        output = typeof json === 'string' ? json
          : json.output ?? json.text ?? json.result ?? json.response ?? JSON.stringify(json, null, 2);
      } else {
        output = await res.text();
      }

      stopTimer();
      setResult(output);
      setScreen('output');

      // Auto-save to Supabase
      try {
        await upsertDocument({
          id: crypto.randomUUID(),
          name: `BRD to Userstories - Diwan - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
          type: 'User Manual',
          type_color: '#0EA5E9',
          workspace: 'Diwan Committee System',
          workspace_id: diwanWorkspaceId ?? '',
          date: new Date().toISOString().slice(0, 10),
          language: 'EN',
          status: 'Draft',
          size: `${(output.length / 1024).toFixed(1)} KB`,
          author: 'AI Automation',
          pages: Math.ceil(output.split('\n').length / 50),
          summary: output,
          tags: ['diwan', 'user-manual', 'automation', 'translated'],
          file_url: null,
        });
        setSaved(true);
      } catch (saveErr) {
        console.error('Failed to save document:', saveErr);
        // Don't block the UI — the result is still shown
      }
    } catch (err) {
      stopTimer();
      setError(err instanceof Error ? err.message : 'Unknown error');
      setScreen('output');
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([result], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'BRD-to-Userstories-Diwan.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Screen: Config ──────────────────────────────────────────────────────────
  if (screen === 'config') {
    return (
      <div style={{ padding: '1.5rem', maxWidth: 820, margin: '0 auto' }}>
        {/* Back */}
        <button onClick={() => navigate('/automations')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', fontFamily: 'inherit', marginBottom: '1.25rem' }}>
          <ArrowLeft size={14} /> Automations
        </button>

        {/* Header */}
        <div style={{ marginBottom: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>📋</div>
            <div>
              <h1 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#F1F5F9', margin: 0 }}>BRD to Userstories (Diwan)</h1>
              <p style={{ fontSize: '0.75rem', color: '#475569', margin: 0 }}>BA & Requirements · Powered by n8n + Claude</p>
            </div>
          </div>
        </div>

        {/* Input Card */}
        <div className="section-card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.75rem', fontWeight: 600 }}>
            Arabic BRD / Requirements Content
          </div>
          <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '0 0 0.875rem', lineHeight: 1.5 }}>
            Paste the Arabic BRD or user manual text from the Diwan committee management system below. The automation will translate and restructure it into professional English user stories and documentation.
          </p>
          <textarea
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder="الصق محتوى وثيقة متطلبات العمل (BRD) باللغة العربية هنا..."
            style={{
              width: '100%', minHeight: 280, padding: '0.875rem 1rem',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8, color: '#E2E8F0', fontSize: '0.82rem',
              fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
              lineHeight: 1.7, direction: 'rtl',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.625rem' }}>
            <span style={{ fontSize: '0.7rem', color: '#334155' }}>
              {inputText.length > 0 ? `${inputText.length.toLocaleString()} characters · ${inputText.split('\n').length} lines` : 'No content yet'}
            </span>
          </div>
        </div>

        {/* How it Works */}
        <div className="section-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.75rem', fontWeight: 600 }}>
            How It Works
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[
              { step: '1', text: 'Paste Arabic BRD content from the Diwan system' },
              { step: '2', text: 'n8n webhook sends content to Claude for translation' },
              { step: '3', text: 'Claude translates, restructures, and formats as English documentation' },
              { step: '4', text: 'Result is displayed and auto-saved as a document' },
            ].map(item => (
              <div key={item.step} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.375rem 0' }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.65rem', fontWeight: 700, color: '#00D4FF', flexShrink: 0,
                }}>{item.step}</div>
                <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Run Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button className="btn-ghost" onClick={() => navigate('/automations')} style={{ height: 40, fontSize: '0.85rem' }}>Cancel</button>
          <button className="btn-primary" onClick={handleRun} disabled={!inputText.trim()}
            style={{ height: 40, fontSize: '0.85rem', opacity: inputText.trim() ? 1 : 0.4, cursor: inputText.trim() ? 'pointer' : 'not-allowed', gap: '0.5rem', padding: '0 1.5rem' }}>
            <Play size={14} /> Run Automation
          </button>
        </div>
      </div>
    );
  }

  // ── Screen: Progress ────────────────────────────────────────────────────────
  if (screen === 'progress') {
    return (
      <div style={{ padding: '1.5rem', maxWidth: 600, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', paddingTop: '4rem' }}>
          {/* Spinner */}
          <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(139,92,246,0.1)', border: '2px solid rgba(139,92,246,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Loader size={28} style={{ color: '#A78BFA', animation: 'spin 1.5s linear infinite' }} />
            </div>
          </div>

          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#F1F5F9', margin: '0 0 0.5rem' }}>
            Translating & Generating...
          </h2>
          <p style={{ fontSize: '0.82rem', color: '#475569', margin: '0 0 2rem' }}>
            n8n is processing your Arabic BRD content through Claude AI
          </p>

          {/* Progress indicators */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', maxWidth: 400, margin: '0 auto' }}>
            {[
              { label: 'Sending to n8n webhook', done: elapsed >= 1 },
              { label: 'Claude processing & translating', done: elapsed >= 3 },
              { label: 'Formatting English documentation', done: false },
            ].map((step, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.625rem 1rem', borderRadius: 8,
                background: step.done ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${step.done ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)'}`,
              }}>
                {step.done
                  ? <CheckCircle size={14} style={{ color: '#34D399', flexShrink: 0 }} />
                  : <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #334155', flexShrink: 0 }} />
                }
                <span style={{ fontSize: '0.8rem', color: step.done ? '#34D399' : '#475569' }}>{step.label}</span>
              </div>
            ))}
          </div>

          {/* Timer */}
          <div style={{ marginTop: '2rem', fontSize: '0.78rem', color: '#334155' }}>
            Elapsed: {elapsed}s · This typically takes 30–120 seconds
          </div>

          {/* Cancel */}
          <button className="btn-ghost" onClick={() => { stopTimer(); setScreen('config'); }}
            style={{ marginTop: '1.5rem', fontSize: '0.78rem', height: 34 }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Screen: Output ──────────────────────────────────────────────────────────
  if (screen === 'output') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          padding: '0.875rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)',
          background: '#0C1220', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={() => navigate('/automations')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', fontFamily: 'inherit' }}>
              <ArrowLeft size={14} /> Automations
            </button>
            <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.08)' }} />
            <div>
              <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#F1F5F9', margin: 0 }}>
                {error ? 'Automation Failed' : 'BRD to Userstories — Diwan'}
              </h2>
              <p style={{ fontSize: '0.68rem', color: '#475569', margin: 0 }}>
                {error ? 'An error occurred' : `Generated in ${elapsed}s · n8n + Claude`}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {saved && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.25rem 0.625rem', borderRadius: 6, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <Save size={11} style={{ color: '#34D399' }} />
                <span style={{ fontSize: '0.7rem', color: '#34D399', fontWeight: 600 }}>Saved to Documents</span>
              </div>
            )}
            {!error && (
              <>
                <button className="btn-ghost" onClick={handleCopy} style={{ height: 32, fontSize: '0.75rem', padding: '0 0.75rem' }}>
                  <Copy size={12} /> {copied ? 'Copied!' : 'Copy'}
                </button>
                <button className="btn-ghost" onClick={handleDownload} style={{ height: 32, fontSize: '0.75rem', padding: '0 0.75rem' }}>
                  <Download size={12} /> Download .md
                </button>
              </>
            )}
            <button className="btn-primary" style={{ height: 32, fontSize: '0.75rem', padding: '0 0.875rem' }}
              onClick={() => { setScreen('config'); setResult(''); setError(''); setSaved(false); }}>
              <Play size={12} /> New Run
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          {error ? (
            <div style={{ maxWidth: 600, margin: '2rem auto', textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <AlertCircle size={24} style={{ color: '#FCA5A5' }} />
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#FCA5A5', margin: '0 0 0.5rem' }}>Automation Failed</h3>
              <p style={{ fontSize: '0.82rem', color: '#EF4444', margin: '0 0 1.5rem', lineHeight: 1.6 }}>{error}</p>
              <button className="btn-primary" onClick={() => { setScreen('config'); setError(''); }}
                style={{ height: 36, fontSize: '0.82rem', padding: '0 1.25rem' }}>
                <Play size={13} /> Try Again
              </button>
            </div>
          ) : (
            <div style={{ maxWidth: 900, margin: '0 auto' }}>
              {/* Stats bar */}
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                {[
                  { label: 'Characters', value: result.length.toLocaleString(), icon: <FileText size={13} />, color: '#0EA5E9' },
                  { label: 'Lines', value: result.split('\n').length.toLocaleString(), icon: <FileText size={13} />, color: '#8B5CF6' },
                  { label: 'Processing Time', value: `${elapsed}s`, icon: <CheckCircle size={13} />, color: '#10B981' },
                ].map(s => (
                  <div key={s.label} className="metric-card" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flex: '1 1 140px' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `${s.color}12`, border: `1px solid ${s.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, flexShrink: 0 }}>
                      {s.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: '#F1F5F9', lineHeight: 1 }}>{s.value}</div>
                      <div style={{ fontSize: '0.65rem', color: '#475569', marginTop: 2 }}>{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Markdown output */}
              <div className="section-card" style={{ padding: '1.5rem' }}>
                <div style={{ fontSize: '0.72rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '1rem', fontWeight: 600 }}>
                  Generated Output
                </div>
                <div
                  style={{
                    fontSize: '0.85rem', color: '#CBD5E1', lineHeight: 1.8,
                    whiteSpace: 'pre-wrap', fontFamily: 'inherit',
                  }}
                >
                  {result.split('\n').map((line, i) => {
                    // Basic markdown rendering
                    if (line.startsWith('# ')) return <h1 key={i} style={{ fontSize: '1.4rem', fontWeight: 800, color: '#F1F5F9', margin: '1.5rem 0 0.75rem', lineHeight: 1.3 }}>{line.slice(2)}</h1>;
                    if (line.startsWith('## ')) return <h2 key={i} style={{ fontSize: '1.15rem', fontWeight: 700, color: '#F1F5F9', margin: '1.25rem 0 0.5rem', lineHeight: 1.3 }}>{line.slice(3)}</h2>;
                    if (line.startsWith('### ')) return <h3 key={i} style={{ fontSize: '0.95rem', fontWeight: 700, color: '#E2E8F0', margin: '1rem 0 0.375rem', lineHeight: 1.3 }}>{line.slice(4)}</h3>;
                    if (line.startsWith('#### ')) return <h4 key={i} style={{ fontSize: '0.88rem', fontWeight: 600, color: '#CBD5E1', margin: '0.75rem 0 0.25rem', lineHeight: 1.3 }}>{line.slice(5)}</h4>;
                    if (line.startsWith('- ') || line.startsWith('* ')) return (
                      <div key={i} style={{ display: 'flex', gap: '0.5rem', paddingLeft: '0.5rem', margin: '0.125rem 0' }}>
                        <span style={{ color: '#00D4FF', flexShrink: 0 }}>•</span>
                        <span>{line.slice(2)}</span>
                      </div>
                    );
                    if (/^\d+\.\s/.test(line)) {
                      const match = line.match(/^(\d+\.)\s(.*)/);
                      return (
                        <div key={i} style={{ display: 'flex', gap: '0.5rem', paddingLeft: '0.5rem', margin: '0.125rem 0' }}>
                          <span style={{ color: '#00D4FF', fontWeight: 600, flexShrink: 0, minWidth: 20 }}>{match?.[1]}</span>
                          <span>{match?.[2]}</span>
                        </div>
                      );
                    }
                    if (line.startsWith('---') || line.startsWith('***')) return <hr key={i} style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', margin: '1rem 0' }} />;
                    if (line.startsWith('> ')) return <blockquote key={i} style={{ borderLeft: '3px solid #00D4FF', paddingLeft: '0.75rem', margin: '0.5rem 0', color: '#94A3B8', fontStyle: 'italic' }}>{line.slice(2)}</blockquote>;
                    if (line.startsWith('**') && line.endsWith('**')) return <div key={i} style={{ fontWeight: 700, color: '#F1F5F9', margin: '0.25rem 0' }}>{line.slice(2, -2)}</div>;
                    if (line.trim() === '') return <div key={i} style={{ height: '0.5rem' }} />;
                    return <div key={i} style={{ margin: '0.125rem 0' }}>{line}</div>;
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
