import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, Play, ChevronDown, ChevronRight, Check,
  Code, Filter, Cpu, Upload, AlertCircle, Loader2,
} from 'lucide-react';
import {
  getAutomation, getWorkspaces, upsertDocument,
  createAutomationRun, updateAutomationRun, getAutomationRuns,
  createAutomationRunSection,
} from '../lib/db';
import type { AutomationRow, WorkspaceRow, AutomationRunRow } from '../lib/db';
import { chatWithDocument } from '../lib/openrouter';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabase';

interface FlowNode {
  id: string;
  label: string;
  type: string;
  icon: React.ReactNode;
  color: string;
  status: 'idle' | 'active' | 'done' | 'error';
  description: string;
}

const flowNodes: FlowNode[] = [
  { id: 'n1', label: 'Trigger',      type: 'trigger', icon: <Play size={14} />,       color: '#34D399', status: 'done',   description: 'Document uploaded or manual run' },
  { id: 'n2', label: 'Read File',    type: 'input',   icon: <Upload size={14} />,      color: '#7877C6', status: 'done',   description: 'Parse PDF/Word document' },
  { id: 'n3', label: 'Extract Text', type: 'process', icon: <ChevronRight size={14} />,color: '#7877C6', status: 'done',   description: 'OCR and text extraction' },
  { id: 'n4', label: 'Classify',     type: 'process', icon: <Filter size={14} />,      color: '#A78BFA', status: 'active', description: 'Detect document type & structure' },
  { id: 'n5', label: 'LLM Generate', type: 'ai',      icon: <Cpu size={14} />,         color: '#A78BFA', status: 'idle',   description: 'GPT-4o generation with template' },
  { id: 'n6', label: 'Validate',     type: 'process', icon: <Check size={14} />,       color: '#F5B544', status: 'idle',   description: 'Schema & quality validation' },
  { id: 'n7', label: 'Create Doc',   type: 'output',  icon: <Save size={14} />,        color: '#34D399', status: 'idle',   description: 'Generate Word/PDF output' },
  { id: 'n8', label: 'Notify',       type: 'notify',  icon: <AlertCircle size={14} />, color: '#F5B544', status: 'idle',   description: 'Email/Slack notification' },
];

const rightPanelTabs = ['Prompt', 'Schema', 'Destinations', 'Notifications', 'Logs'];

const DEFAULT_PROMPT = `You are a senior business analyst specializing in government digital transformation projects.

Given the input requirements document, generate a comprehensive Business Requirements Document (BRD) with the following structure:

1. **Executive Summary** (200-300 words)
2. **Project Scope and Objectives**
3. **Stakeholder Register** (extract all mentioned stakeholders)
4. **Functional Requirements** (numbered, with priority)
5. **Non-Functional Requirements**
6. **Use Cases** (for each major function)
7. **Acceptance Criteria**
8. **Assumptions and Constraints**
9. **Glossary of Terms**

Guidelines:
- Use formal consulting language appropriate for government clients
- Number all requirements (e.g., FR-001, NFR-001)
- Assign priority: Must Have / Should Have / Nice to Have
- Extract all implicit requirements, not just explicit ones
- Ensure bilingual readiness where Arabic content is present

Input document:
{{input_document}}`;

function timeAgo(iso: string | null): string {
  if (!iso) return 'N/A';
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function runDuration(run: AutomationRunRow): string {
  if (!run.started_at || !run.completed_at) return '—';
  const s = Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000);
  return `${s}s`;
}

function runStatusLabel(run: AutomationRunRow): { label: string; color: string; bg: string } {
  if (run.status === 'completed') return { label: 'Success', color: '#34D399', bg: 'rgba(52,211,153,0.15)' };
  if (run.status === 'failed')    return { label: 'Error',   color: '#FCA5A5', bg: 'rgba(255,107,107,0.15)' };
  return { label: 'Running', color: '#FDCE78', bg: 'rgba(245,181,68,0.15)' };
}

function parseRunInput(optionsJson: string): string {
  try { return (JSON.parse(optionsJson) as { input?: string }).input?.slice(0, 60) ?? '—'; }
  catch { return '—'; }
}

export default function AutomationBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab]       = useState('Prompt');
  const [selectedNode, setSelectedNode] = useState<string>('n4');
  const [running, setRunning]           = useState(false);
  const [runOutput, setRunOutput]       = useState('');
  const [runError, setRunError]         = useState('');
  const fileInputRef = useRef<HTMLTextAreaElement>(null);

  const [auto, setAuto]               = useState<AutomationRow | null>(null);
  const [workspaces, setWorkspaces]   = useState<WorkspaceRow[]>([]);
  const [selectedWsIds, setSelectedWsIds] = useState<Set<string>>(new Set());
  const [editablePrompt, setEditablePrompt] = useState(DEFAULT_PROMPT);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [savedAt, setSavedAt]         = useState<string | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [runsFromDb, setRunsFromDb]   = useState<AutomationRunRow[]>([]);
  const [toast, setToast]             = useState<{ msg: string; ok: boolean } | null>(null);

  // Destination toggles
  const [destToggles, setDestToggles] = useState({
    saveToWorkspace: true,
    exportWord: true,
    exportPdf: true,
    sharePoint: false,
    jira: false,
  });

  // Notification toggles
  const [notifToggles, setNotifToggles] = useState({
    emailSuccess: true,
    emailError: true,
    slack: false,
    teams: true,
    inApp: true,
  });
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');

  useEffect(() => {
    if (!id) return;
    getAutomation(id).then(setAuto).catch(() => {});
    getAutomationRuns(id).then(setRunsFromDb).catch(() => {});

    // Load custom prompt template from Supabase
    Promise.resolve(
      supabase.from('prompt_templates').select('system_prompt').eq('id', `custom_${id}`).single()
    ).then(({ data }) => { if (data?.system_prompt) setEditablePrompt(data.system_prompt as string); })
     .catch(() => {});
  }, [id]);

  useEffect(() => {
    getWorkspaces().then(ws => {
      setWorkspaces(ws);
      setSelectedWsIds(new Set(ws.slice(0, 3).map(w => w.id)));
    }).catch(() => {});
  }, []);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleSave() {
    if (!auto) return;
    setSavingConfig(true);
    try {
      await supabase.from('prompt_templates').upsert({
        id: `custom_${id ?? auto.id}`,
        name: `${auto.name} (Custom)`,
        automation_type: id ?? auto.id,
        version: 'v1',
        system_prompt: editablePrompt,
        user_prompt_template: 'Input: {{input_document}}',
        active: true,
      });
      const time = new Date().toLocaleTimeString();
      setSavedAt(time);
      setIsEditingPrompt(false);
      showToast('Configuration saved to Supabase', true);
    } catch {
      showToast('Save failed – check Supabase connection', false);
    } finally {
      setSavingConfig(false);
    }
  }

  const handleRun = async () => {
    if (running || !auto) return;
    setRunning(true);
    setRunOutput('');
    setRunError('');
    setActiveTab('Logs');

    const runId    = uuidv4();
    const nowIso   = new Date().toISOString();
    const inputText = fileInputRef.current?.value?.trim() || `Sample requirements document for ${auto.name}`;

    // Create run record in Supabase (best-effort)
    let runCreated = false;
    try {
      await createAutomationRun({
        id: runId,
        workspace_id: null,
        user_id: 'system',
        automation_type: id ?? auto.id,
        prompt_template_id: null,
        status: 'running',
        options_json: JSON.stringify({ automation_id: id ?? auto.id, input: inputText.slice(0, 500) }),
        error_message: null,
        started_at: nowIso,
        completed_at: null,
      });
      runCreated = true;
    } catch { /* non-fatal */ }

    try {
      const filledPrompt = editablePrompt.replace('{{input_document}}', inputText);
      const result = await chatWithDocument(
        [{ role: 'user', content: filledPrompt }],
        `You are a senior consulting AI assistant specializing in ${auto.category}.`,
      );
      setRunOutput(result);

      const completedIso = new Date().toISOString();

      // Persist run result
      if (runCreated) {
        try {
          await updateAutomationRun(runId, { status: 'completed', completed_at: completedIso });
          await createAutomationRunSection({
            run_id: runId,
            section_name: 'full_output',
            section_index: 0,
            status: 'draft',
            content: result,
            confidence: 0.85,
            validation_notes: '{}',
          });
          if (id) getAutomationRuns(id).then(setRunsFromDb).catch(() => {});
        } catch { /* non-fatal */ }
      }

      // ── Output Destinations ─────────────────────────────────
      if (destToggles.saveToWorkspace) {
        const wsId = [...selectedWsIds][0];
        const ws   = workspaces.find(w => w.id === wsId);
        if (ws) {
          try {
            await upsertDocument({
              id: uuidv4(),
              name: `${auto.name} – ${new Date().toLocaleDateString('en-GB')}`,
              type: 'BRD',
              type_color: '#7877C6',
              workspace: ws.name,
              workspace_id: ws.id,
              date: new Date().toISOString().split('T')[0],
              language: 'EN',
              status: 'Draft',
              size: `${Math.max(1, Math.ceil(result.length / 1024))}KB`,
              author: 'Automation',
              pages: Math.max(1, Math.ceil(result.split('\n').length / 40)),
              summary: result.slice(0, 200),
              tags: [auto.category, 'Automation', 'BRD'],
              file_url: null,
            });
            showToast('Document saved to workspace', true);
          } catch { showToast('Save to workspace failed', false); }
        }
      }

      if (destToggles.exportWord) {
        const blob = new Blob([result], { type: 'text/plain' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `${auto.name.replace(/\s+/g, '_')}_BRD_${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
      }

      if (destToggles.exportPdf) {
        const win = window.open('', '_blank');
        if (win) {
          win.document.write(
            `<html><head><title>${auto.name} – BRD</title>` +
            `<style>body{font-family:Georgia,serif;max-width:800px;margin:2rem auto;line-height:1.7;color:#111}` +
            `pre{white-space:pre-wrap;font-family:inherit}</style></head>` +
            `<body><pre>${result}</pre></body></html>`,
          );
          win.document.close();
          win.print();
        }
      }

      // ── Notifications ───────────────────────────────────────
      if (notifToggles.slack && slackWebhookUrl.startsWith('https://')) {
        fetch(slackWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: `✅ *${auto.name}* completed successfully in Consultant OS.` }),
        }).catch(() => {});
      }

      if (notifToggles.inApp) showToast(`${auto.name} completed`, true);

    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Run failed';
      setRunError(errMsg);
      if (runCreated) {
        updateAutomationRun(runId, { status: 'failed', error_message: errMsg }).catch(() => {});
        if (id) getAutomationRuns(id).then(setRunsFromDb).catch(() => {});
      }
      showToast('Run failed', false);
    } finally {
      setRunning(false);
    }
  };

  const getNodeBg = (node: FlowNode) => {
    if (node.id === selectedNode)    return `${node.color}20`;
    if (node.status === 'done')      return 'rgba(52,211,153,0.08)';
    if (node.status === 'active')    return `${node.color}12`;
    return 'rgba(255,255,255,0.03)';
  };

  const getNodeBorder = (node: FlowNode) => {
    if (node.id === selectedNode)  return `${node.color}60`;
    if (node.status === 'done')    return 'rgba(52,211,153,0.3)';
    if (node.status === 'active')  return `${node.color}50`;
    return 'rgba(255,255,255,0.08)';
  };

  if (!auto) {
    return <div style={{ padding: '2rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Automation not found.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.875rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: '#0C0F1A', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => navigate('/automations')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4E566E', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', fontFamily: 'inherit' }}
          >
            <ArrowLeft size={14} /> Automations
          </button>
          <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.08)' }} />
          <div>
            <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#F8FAFC', margin: 0 }}>{auto.name}</h2>
            <p style={{ fontSize: '0.7rem', color: '#4E566E', margin: 0 }}>{auto.category} · {auto.run_count} runs</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span className="status-active" style={{ fontSize: '0.72rem' }}>Active</span>
          <button
            className="btn-ghost"
            style={{ height: '32px', fontSize: '0.78rem' }}
            onClick={handleSave}
            disabled={savingConfig}
            title={savedAt ? `Last saved ${savedAt}` : 'Save configuration to Supabase'}
          >
            {savingConfig ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
            {savedAt ? `Saved ${savedAt}` : 'Save'}
          </button>
          <button
            className="btn-primary"
            style={{ height: '32px', fontSize: '0.78rem' }}
            onClick={handleRun}
            disabled={running}
          >
            {running
              ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Running…</>
              : <><Play size={13} /> Run Now</>
            }
          </button>
        </div>
      </div>

      {/* Three Panel Layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Left Panel – Config ── */}
        <div style={{
          width: '280px', minWidth: '280px', borderRight: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', flexDirection: 'column', overflowY: 'auto', background: '#0C0F1A',
        }}>
          <div style={{ padding: '1rem' }}>
            {/* Trigger */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.7rem', color: '#4E566E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.625rem' }}>Trigger</div>
              <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', cursor: 'pointer' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#34D399', marginBottom: '0.375rem' }}>Document Upload</div>
                <div style={{ fontSize: '0.72rem', color: '#4E566E' }}>Fires when a new document is uploaded to workspace</div>
              </div>
            </div>

            {/* Input Settings */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.7rem', color: '#4E566E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.625rem' }}>Input Settings</div>
              {[
                { label: 'Accepted Formats', value: 'PDF, DOCX, TXT' },
                { label: 'Max File Size',    value: '50 MB' },
                { label: 'Language Detection', value: 'Auto (EN/AR)' },
                { label: 'OCR Engine',       value: 'Azure Form Recognizer' },
              ].map(field => (
                <div key={field.label} style={{ marginBottom: '0.625rem' }}>
                  <div style={{ fontSize: '0.68rem', color: '#4E566E', marginBottom: '3px' }}>{field.label}</div>
                  <div style={{
                    padding: '0.375rem 0.625rem', borderRadius: '6px', fontSize: '0.78rem', color: '#8790A8',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span>{field.value}</span>
                    <ChevronDown size={11} style={{ color: '#4E566E' }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Workspace Scope – real workspaces from Supabase */}
            <div>
              <div style={{ fontSize: '0.7rem', color: '#4E566E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.625rem' }}>Workspace Scope</div>
              {workspaces.length === 0
                ? <div style={{ fontSize: '0.72rem', color: '#4E566E' }}>Loading workspaces…</div>
                : workspaces.map(ws => {
                  const checked = selectedWsIds.has(ws.id);
                  return (
                    <div
                      key={ws.id}
                      onClick={() => setSelectedWsIds(prev => {
                        const next = new Set(prev);
                        checked ? next.delete(ws.id) : next.add(ws.id);
                        return next;
                      })}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}
                    >
                      <div style={{
                        width: '14px', height: '14px', borderRadius: '3px',
                        background: checked ? 'rgba(120,119,198,0.2)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${checked ? 'rgba(120,119,198,0.4)' : 'rgba(255,255,255,0.1)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {checked && <Check size={9} style={{ color: '#A78BFA' }} />}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: checked ? '#8790A8' : '#4E566E' }}>{ws.name}</span>
                    </div>
                  );
                })
              }
            </div>
          </div>
        </div>

        {/* ── Center Canvas ── */}
        <div style={{ flex: 1, overflow: 'auto', background: '#07080F', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, minWidth: '280px' }}>
            {flowNodes.map((node, i) => (
              <div key={node.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div
                  onClick={() => setSelectedNode(node.id)}
                  style={{
                    padding: '0.875rem 1.25rem', borderRadius: '0.75rem',
                    background: getNodeBg(node),
                    border: `1px solid ${getNodeBorder(node)}`,
                    cursor: 'pointer', transition: 'all 0.2s', minWidth: '240px',
                    boxShadow: node.id === selectedNode ? `0 0 16px ${node.color}20` : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: `${node.color}18`, color: node.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {node.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#F8FAFC' }}>{node.label}</div>
                      <div style={{ fontSize: '0.7rem', color: '#4E566E' }}>{node.description}</div>
                    </div>
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '9999px', flexShrink: 0,
                      background: node.status === 'done' ? '#34D399' : node.status === 'active' ? node.color : node.status === 'error' ? '#FF6B6B' : 'rgba(255,255,255,0.15)',
                      boxShadow: node.status === 'active' ? `0 0 8px ${node.color}` : 'none',
                    }} />
                  </div>
                </div>
                {i < flowNodes.length - 1 && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0' }}>
                    <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.1)' }} />
                    <ChevronRight size={12} style={{ color: '#4E566E', transform: 'rotate(90deg)' }} />
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '2rem', opacity: 0.7 }}>
            {[
              { color: '#34D399', label: 'Completed' },
              { color: '#A78BFA', label: 'Active' },
              { color: 'rgba(255,255,255,0.2)', label: 'Pending' },
              { color: '#FF6B6B', label: 'Error' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '9999px', background: l.color }} />
                <span style={{ fontSize: '0.72rem', color: '#4E566E' }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right Panel ── */}
        <div style={{
          width: '340px', minWidth: '340px', borderLeft: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', flexDirection: 'column', overflowY: 'auto', background: '#0C0F1A',
        }}>
          {/* Tab Bar */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '0 0.75rem' }}>
            {rightPanelTabs.map(tab => (
              <button
                key={tab}
                className={`tab-underline ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
                style={{ fontSize: '0.78rem', padding: '0.625rem 0.5rem', marginRight: '0.75rem' }}
              >
                {tab}
              </button>
            ))}
          </div>

          <div style={{ padding: '1rem', flex: 1 }}>

            {/* ── PROMPT TAB ── */}
            {activeTab === 'Prompt' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.625rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#8790A8' }}>System Prompt</span>
                  <button
                    className="btn-ghost"
                    style={{ padding: '0.125rem 0.5rem', fontSize: '0.68rem' }}
                    onClick={() => setIsEditingPrompt(e => !e)}
                  >
                    <Code size={11} /> {isEditingPrompt ? 'Preview' : 'Edit'}
                  </button>
                </div>

                {isEditingPrompt ? (
                  <textarea
                    value={editablePrompt}
                    onChange={e => setEditablePrompt(e.target.value)}
                    style={{
                      width: '100%', minHeight: '300px', padding: '0.875rem',
                      background: '#060C1A', border: '1px solid rgba(120,119,198,0.3)',
                      borderRadius: '0.5rem', fontSize: '0.72rem',
                      fontFamily: 'ui-monospace, monospace', color: '#8790A8',
                      lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box',
                    }}
                  />
                ) : (
                  <div style={{
                    background: '#060C1A', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '0.5rem', padding: '0.875rem', fontSize: '0.72rem',
                    fontFamily: 'ui-monospace, monospace', color: '#8790A8',
                    lineHeight: 1.6, whiteSpace: 'pre-wrap', overflow: 'auto', maxHeight: '300px',
                  }}>
                    {editablePrompt}
                  </div>
                )}

                {/* Input for Run Now */}
                <div style={{ marginTop: '0.875rem' }}>
                  <div style={{ fontSize: '0.7rem', color: '#4E566E', marginBottom: '0.375rem' }}>Input (paste document text to test)</div>
                  <textarea
                    ref={fileInputRef}
                    placeholder="Paste requirements text here to test the automation…"
                    style={{
                      width: '100%', minHeight: '80px', padding: '0.625rem 0.75rem',
                      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '0.5rem', color: '#8790A8', fontSize: '0.72rem',
                      fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ marginTop: '0.875rem', display: 'flex', gap: '0.5rem' }}>
                  <select style={{
                    flex: 1, padding: '0.375rem 0.625rem', borderRadius: '6px', fontSize: '0.78rem',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    color: '#8790A8', fontFamily: 'inherit',
                  }}>
                    <option>GPT-4o</option>
                    <option>GPT-4 Turbo</option>
                    <option>Claude 3.5 Sonnet</option>
                  </select>
                  <select style={{
                    width: '80px', padding: '0.375rem 0.625rem', borderRadius: '6px', fontSize: '0.78rem',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    color: '#8790A8', fontFamily: 'inherit',
                  }}>
                    <option>T: 0.3</option>
                    <option>T: 0.5</option>
                    <option>T: 0.7</option>
                  </select>
                </div>
              </div>
            )}

            {/* ── SCHEMA TAB ── */}
            {activeTab === 'Schema' && (
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#8790A8', marginBottom: '0.625rem' }}>Output Schema</div>
                <div style={{
                  background: '#060C1A', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '0.5rem', padding: '0.875rem', fontSize: '0.72rem',
                  fontFamily: 'ui-monospace, monospace', color: '#8790A8', lineHeight: 1.6,
                }}>
{`{
  "title": "string",
  "version": "string",
  "workspace": "string",
  "sections": [
    { "id": "string", "title": "string", "content": "string" }
  ],
  "requirements": [
    { "id": "string", "priority": "Must|Should|Nice", "text": "string", "category": "FR|NFR" }
  ],
  "metadata": {
    "generatedAt": "datetime",
    "sourceDoc": "string",
    "pageCount": "number"
  }
}`}
                </div>
              </div>
            )}

            {/* ── DESTINATIONS TAB ── */}
            {activeTab === 'Destinations' && (
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#8790A8', marginBottom: '0.875rem' }}>Output Destinations</div>
                {([
                  { key: 'saveToWorkspace', label: 'Save to Workspace',  detail: 'Creates a Document in Supabase Documents library', color: '#7877C6', comingSoon: false },
                  { key: 'exportWord',      label: 'Export as Word',      detail: 'Download output as .txt (Word-compatible)',         color: '#7877C6', comingSoon: false },
                  { key: 'exportPdf',       label: 'Export as PDF',       detail: 'Open browser print dialog (Save as PDF)',           color: '#A78BFA', comingSoon: false },
                  { key: 'sharePoint',      label: 'Sync to SharePoint',  detail: 'NCA Programme folder',                              color: '#F5B544', comingSoon: true },
                  { key: 'jira',            label: 'Push to Jira',        detail: 'Create requirements tickets',                       color: '#34D399', comingSoon: true },
                ] as const).map(dest => {
                  const checked = destToggles[dest.key];
                  return (
                    <div
                      key={dest.key}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: dest.comingSoon ? 'default' : 'pointer' }}
                      onClick={() => {
                        if (dest.comingSoon) return;
                        setDestToggles(p => ({ ...p, [dest.key]: !p[dest.key] }));
                      }}
                    >
                      <div style={{
                        width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0,
                        background: checked && !dest.comingSoon ? `${dest.color}20` : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${checked && !dest.comingSoon ? dest.color + '50' : 'rgba(255,255,255,0.1)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {checked && !dest.comingSoon && <Check size={10} style={{ color: dest.color }} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 500, color: dest.comingSoon ? '#4E566E' : (checked ? '#F8FAFC' : '#4E566E') }}>
                            {dest.label}
                          </span>
                          {dest.comingSoon && (
                            <span style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(245,181,68,0.1)', color: '#F5B544', border: '1px solid rgba(245,181,68,0.2)' }}>
                              Soon
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#4E566E' }}>{dest.detail}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── NOTIFICATIONS TAB ── */}
            {activeTab === 'Notifications' && (
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#8790A8', marginBottom: '0.875rem' }}>Notification Rules</div>
                {([
                  { key: 'emailSuccess', label: 'Email on Success', detail: 'Send to assigned consultant' },
                  { key: 'emailError',   label: 'Email on Error',   detail: 'Alert to workspace admin' },
                  { key: 'slack',        label: 'Slack Notification', detail: 'Post to Slack webhook URL' },
                  { key: 'teams',        label: 'Teams Message',    detail: 'Project team channel' },
                  { key: 'inApp',        label: 'In-App Alert',     detail: 'Show toast notification' },
                ] as const).map(notif => {
                  const enabled = notifToggles[notif.key];
                  return (
                    <div key={notif.key}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#8790A8' }}>{notif.label}</div>
                          <div style={{ fontSize: '0.68rem', color: '#4E566E' }}>{notif.detail}</div>
                        </div>
                        <div
                          onClick={() => setNotifToggles(p => ({ ...p, [notif.key]: !p[notif.key] }))}
                          style={{
                            width: '32px', height: '18px', borderRadius: '9999px', cursor: 'pointer',
                            background: enabled ? 'rgba(120,119,198,0.3)' : 'rgba(255,255,255,0.08)',
                            border: `1px solid ${enabled ? 'rgba(120,119,198,0.5)' : 'rgba(255,255,255,0.12)'}`,
                            position: 'relative', transition: 'all 0.2s', flexShrink: 0,
                          }}
                        >
                          <div style={{
                            position: 'absolute', width: '12px', height: '12px', borderRadius: '9999px',
                            background: enabled ? '#A78BFA' : '#4E566E',
                            top: '2px', left: enabled ? '17px' : '2px', transition: 'left 0.2s',
                          }} />
                        </div>
                      </div>
                      {/* Slack webhook URL input */}
                      {notif.key === 'slack' && enabled && (
                        <div style={{ padding: '0.5rem 0 0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ fontSize: '0.68rem', color: '#4E566E', marginBottom: '0.25rem' }}>Webhook URL</div>
                          <input
                            type="url"
                            placeholder="https://hooks.slack.com/services/…"
                            value={slackWebhookUrl}
                            onChange={e => setSlackWebhookUrl(e.target.value)}
                            style={{
                              width: '100%', padding: '0.375rem 0.625rem', borderRadius: '6px',
                              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                              color: '#8790A8', fontSize: '0.72rem', fontFamily: 'inherit', boxSizing: 'border-box',
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── LOGS TAB ── */}
            {activeTab === 'Logs' && (
              <div>
                {/* Live run output */}
                {(running || runOutput || runError) && (
                  <div style={{ marginBottom: '1rem', padding: '0.875rem', borderRadius: '0.5rem', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#A78BFA', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      {running
                        ? <><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Running…</>
                        : runError
                          ? <><AlertCircle size={11} /> Run Failed</>
                          : <><Check size={11} /> Run Complete – saved to Supabase</>
                      }
                    </div>
                    {runError && <div style={{ fontSize: '0.75rem', color: '#FCA5A5' }}>{runError}</div>}
                    {runOutput && (
                      <pre style={{ margin: 0, fontSize: '0.72rem', color: '#C0C6D6', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: '300px', overflowY: 'auto', fontFamily: 'inherit' }}>
                        {runOutput}
                      </pre>
                    )}
                  </div>
                )}

                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#8790A8', marginBottom: '0.875rem' }}>
                  Run History {runsFromDb.length > 0 ? `(${runsFromDb.length})` : ''}
                </div>

                {runsFromDb.length === 0 ? (
                  <div style={{ fontSize: '0.75rem', color: '#4E566E', padding: '1rem 0' }}>
                    No runs recorded yet. Click Run Now to start.
                  </div>
                ) : (
                  runsFromDb.map(run => {
                    const { label, color, bg } = runStatusLabel(run);
                    return (
                      <div key={run.id} style={{
                        padding: '0.75rem', borderRadius: '0.5rem',
                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
                        marginBottom: '0.5rem',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                          <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '3px', background: bg, color }}>{label}</span>
                          <span style={{ fontSize: '0.7rem', color: '#4E566E' }}>{timeAgo(run.created_at)}</span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#4E566E', marginBottom: '2px' }}>
                          <span style={{ color: '#8790A8' }}>In:</span> {parseRunInput(run.options_json)}
                        </div>
                        {run.error_message && (
                          <div style={{ fontSize: '0.72rem', color: '#FCA5A5', marginBottom: '2px' }}>
                            <span style={{ color: '#8790A8' }}>Error:</span> {run.error_message.slice(0, 80)}
                          </div>
                        )}
                        <div style={{ fontSize: '0.68rem', color: '#4E566E', marginTop: '2px' }}>Duration: {runDuration(run)}</div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 999,
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.875rem 1.25rem', borderRadius: '10px',
          background: toast.ok ? 'rgba(52,211,153,0.15)' : 'rgba(255,107,107,0.15)',
          border: `1px solid ${toast.ok ? 'rgba(52,211,153,0.3)' : 'rgba(255,107,107,0.3)'}`,
          color: toast.ok ? '#34D399' : '#FCA5A5',
          fontSize: '0.82rem', fontWeight: 600,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          <Check size={16} /> {toast.msg}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
