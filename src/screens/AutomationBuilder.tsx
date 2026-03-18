import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, Play, ChevronDown, ChevronRight, Check,
  Bell, List, Code, Settings, Database, FileOutput, MessageSquare,
  Filter, Cpu, Upload, AlertCircle
} from 'lucide-react';
import { automations } from '../data/mockData';
import { chatWithDocument } from '../lib/openrouter';

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
  { id: 'n1', label: 'Trigger', type: 'trigger', icon: <Play size={14} />, color: '#10B981', status: 'done', description: 'Document uploaded or manual run' },
  { id: 'n2', label: 'Read File', type: 'input', icon: <Upload size={14} />, color: '#0EA5E9', status: 'done', description: 'Parse PDF/Word document' },
  { id: 'n3', label: 'Extract Text', type: 'process', icon: <FileOutput size={14} />, color: '#0EA5E9', status: 'done', description: 'OCR and text extraction' },
  { id: 'n4', label: 'Classify', type: 'process', icon: <Filter size={14} />, color: '#8B5CF6', status: 'active', description: 'Detect document type & structure' },
  { id: 'n5', label: 'LLM Generate', type: 'ai', icon: <Cpu size={14} />, color: '#8B5CF6', status: 'idle', description: 'GPT-4o generation with template' },
  { id: 'n6', label: 'Validate', type: 'process', icon: <Check size={14} />, color: '#F59E0B', status: 'idle', description: 'Schema & quality validation' },
  { id: 'n7', label: 'Create Doc', type: 'output', icon: <Database size={14} />, color: '#10B981', status: 'idle', description: 'Generate Word/PDF output' },
  { id: 'n8', label: 'Notify', type: 'notify', icon: <Bell size={14} />, color: '#F59E0B', status: 'idle', description: 'Email/Slack notification' },
];

const rightPanelTabs = ['Prompt', 'Schema', 'Destinations', 'Notifications', 'Logs'];

const recentLogs = [
  { time: '2h ago', status: 'Success', input: 'NCA_Requirements_v2.docx', output: 'BRD_NCA_EA_v2.3.docx', duration: '42s' },
  { time: '1d ago', status: 'Success', input: 'ADNOC_Scope.pdf', output: 'BRD_ADNOC_SC.docx', duration: '38s' },
  { time: '2d ago', status: 'Warning', input: 'Healthcare_Req.xlsx', output: 'BRD_partial.docx', duration: '61s' },
  { time: '3d ago', status: 'Success', input: 'MOCI_Requirements.docx', output: 'BRD_MOCI_v1.docx', duration: '45s' },
  { time: '5d ago', status: 'Error', input: 'corrupt_file.pdf', output: 'N/A', duration: '12s' },
];

const promptTemplate = `You are a senior business analyst specializing in government digital transformation projects.

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

export default function AutomationBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Prompt');
  const [selectedNode, setSelectedNode] = useState<string>('n4');
  const [running, setRunning] = useState(false);
  const [runOutput, setRunOutput] = useState('');
  const [runError, setRunError] = useState('');
  const fileInputRef = useRef<HTMLTextAreaElement>(null);

  const auto = automations.find(a => a.id === id) ?? automations[0];
  const storageKey = `ab_cfg_${id ?? auto?.id ?? 'default'}`;
  const [savedAt, setSavedAt] = useState<string | null>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) ?? 'null')?.savedAt ?? null; } catch { return null; }
  });

  if (!auto) {
    return <div style={{ padding: '2rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Automation not found.</div>;
  }

  function handleSave() {
    const cfg = { savedAt: new Date().toLocaleTimeString(), automationId: id ?? auto.id };
    localStorage.setItem(storageKey, JSON.stringify(cfg));
    setSavedAt(cfg.savedAt);
  }

  const handleRun = async () => {
    setRunning(true);
    setRunOutput('');
    setRunError('');
    setActiveTab('Logs');
    try {
      const inputText = fileInputRef.current?.value?.trim() || `Sample requirements document for ${auto.name}`;
      const filledPrompt = promptTemplate.replace('{{input_document}}', inputText);
      const result = await chatWithDocument(
        [{ role: 'user', content: filledPrompt }],
        `You are a senior consulting AI assistant specializing in ${auto.category}.`
      );
      setRunOutput(result);
    } catch (e) {
      setRunError(e instanceof Error ? e.message : 'Run failed');
    } finally {
      setRunning(false);
    }
  };

  const getNodeBg = (node: FlowNode) => {
    if (node.id === selectedNode) return `${node.color}20`;
    if (node.status === 'done') return 'rgba(16,185,129,0.08)';
    if (node.status === 'active') return `${node.color}12`;
    return 'rgba(255,255,255,0.03)';
  };

  const getNodeBorder = (node: FlowNode) => {
    if (node.id === selectedNode) return `${node.color}60`;
    if (node.status === 'done') return 'rgba(16,185,129,0.3)';
    if (node.status === 'active') return `${node.color}50`;
    return 'rgba(255,255,255,0.08)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.875rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: '#0C1220', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => navigate('/automations')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', fontFamily: 'inherit' }}
          >
            <ArrowLeft size={14} /> Automations
          </button>
          <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.08)' }} />
          <div>
            <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#F1F5F9', margin: 0 }}>{auto.name}</h2>
            <p style={{ fontSize: '0.7rem', color: '#475569', margin: 0 }}>{auto.category} · {auto.runCount} runs</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span className="status-active" style={{ fontSize: '0.72rem' }}>Active</span>
          <button className="btn-ghost" style={{ height: '32px', fontSize: '0.78rem' }} onClick={handleSave} title={savedAt ? `Last saved ${savedAt}` : 'Save configuration'}>
            <Save size={13} /> {savedAt ? `Saved ${savedAt}` : 'Save'}
          </button>
          <button
            className="btn-primary"
            style={{ height: '32px', fontSize: '0.78rem' }}
            onClick={handleRun}
          >
            <Play size={13} /> {running ? 'Running...' : 'Run Now'}
          </button>
        </div>
      </div>

      {/* Three Panel Layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Panel – Config */}
        <div style={{
          width: '280px', minWidth: '280px', borderRight: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', flexDirection: 'column', overflowY: 'auto', background: '#0C1220',
        }}>
          <div style={{ padding: '1rem' }}>
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.7rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.625rem' }}>Trigger</div>
              <div style={{
                padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.2)', cursor: 'pointer',
              }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#34D399', marginBottom: '0.375rem' }}>Document Upload</div>
                <div style={{ fontSize: '0.72rem', color: '#475569' }}>Fires when a new document is uploaded to workspace</div>
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.7rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.625rem' }}>Input Settings</div>
              {[
                { label: 'Accepted Formats', value: 'PDF, DOCX, TXT' },
                { label: 'Max File Size', value: '50 MB' },
                { label: 'Language Detection', value: 'Auto (EN/AR)' },
                { label: 'OCR Engine', value: 'Azure Form Recognizer' },
              ].map(field => (
                <div key={field.label} style={{ marginBottom: '0.625rem' }}>
                  <div style={{ fontSize: '0.68rem', color: '#475569', marginBottom: '3px' }}>{field.label}</div>
                  <div style={{
                    padding: '0.375rem 0.625rem', borderRadius: '6px', fontSize: '0.78rem', color: '#94A3B8',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span>{field.value}</span>
                    <ChevronDown size={11} style={{ color: '#475569' }} />
                  </div>
                </div>
              ))}
            </div>

            <div>
              <div style={{ fontSize: '0.7rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.625rem' }}>Workspace Scope</div>
              {['NCA Digital Transformation', 'ADNOC Supply Chain', 'MOCI Procurement', 'Healthcare Digital'].map((ws, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <div style={{
                    width: '14px', height: '14px', borderRadius: '3px',
                    background: i < 3 ? 'rgba(0,212,255,0.2)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${i < 3 ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.1)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {i < 3 && <Check size={9} style={{ color: '#00D4FF' }} />}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: i < 3 ? '#94A3B8' : '#475569' }}>{ws}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center Canvas */}
        <div style={{ flex: 1, overflow: 'auto', background: '#080C18', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Flow nodes */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, minWidth: '280px' }}>
            {flowNodes.map((node, i) => (
              <div key={node.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {/* Node */}
                <div
                  onClick={() => setSelectedNode(node.id)}
                  style={{
                    padding: '0.875rem 1.25rem',
                    borderRadius: '0.75rem',
                    background: getNodeBg(node),
                    border: `1px solid ${getNodeBorder(node)}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    minWidth: '240px',
                    boxShadow: node.id === selectedNode ? `0 0 16px ${node.color}20` : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '8px',
                      background: `${node.color}18`, color: node.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {node.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#F1F5F9' }}>{node.label}</div>
                      <div style={{ fontSize: '0.7rem', color: '#475569' }}>{node.description}</div>
                    </div>
                    {/* Status indicator */}
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '9999px', flexShrink: 0,
                      background: node.status === 'done' ? '#10B981' : node.status === 'active' ? node.color : node.status === 'error' ? '#EF4444' : 'rgba(255,255,255,0.15)',
                      boxShadow: node.status === 'active' ? `0 0 8px ${node.color}` : 'none',
                    }} />
                  </div>
                </div>

                {/* Connector arrow */}
                {i < flowNodes.length - 1 && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0' }}>
                    <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.1)' }} />
                    <ChevronRight size={12} style={{ color: '#334155', transform: 'rotate(90deg)' }} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '2rem', opacity: 0.7 }}>
            {[
              { color: '#10B981', label: 'Completed' },
              { color: '#8B5CF6', label: 'Active' },
              { color: 'rgba(255,255,255,0.2)', label: 'Pending' },
              { color: '#EF4444', label: 'Error' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '9999px', background: l.color }} />
                <span style={{ fontSize: '0.72rem', color: '#475569' }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel */}
        <div style={{
          width: '320px', minWidth: '320px', borderLeft: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', flexDirection: 'column', overflowY: 'auto', background: '#0C1220',
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
            {/* Prompt Template */}
            {activeTab === 'Prompt' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#94A3B8' }}>System Prompt</span>
                  <button className="btn-ghost" style={{ padding: '0.125rem 0.5rem', fontSize: '0.68rem' }}>
                    <Code size={11} /> Format
                  </button>
                </div>
                <div style={{
                  background: '#060C1A', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '0.5rem', padding: '0.875rem', fontSize: '0.72rem',
                  fontFamily: 'ui-monospace, monospace', color: '#94A3B8',
                  lineHeight: 1.6, whiteSpace: 'pre-wrap', overflow: 'auto',
                  maxHeight: '400px',
                }}>
                  {promptTemplate}
                </div>
                {/* Input document for Run Now */}
                <div style={{ marginTop: '0.875rem' }}>
                  <div style={{ fontSize: '0.7rem', color: '#475569', marginBottom: '0.375rem' }}>Input (paste document text or requirements to test)</div>
                  <textarea
                    ref={fileInputRef}
                    placeholder="Paste requirements text here to test the automation with real AI output…"
                    style={{
                      width: '100%', minHeight: '80px', padding: '0.625rem 0.75rem',
                      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '0.5rem', color: '#94A3B8', fontSize: '0.72rem',
                      fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ marginTop: '0.875rem', display: 'flex', gap: '0.5rem' }}>
                  <select style={{
                    flex: 1, padding: '0.375rem 0.625rem', borderRadius: '6px', fontSize: '0.78rem',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    color: '#94A3B8', fontFamily: 'inherit',
                  }}>
                    <option>GPT-4o</option>
                    <option>GPT-4 Turbo</option>
                    <option>Claude 3.5 Sonnet</option>
                  </select>
                  <select style={{
                    width: '80px', padding: '0.375rem 0.625rem', borderRadius: '6px', fontSize: '0.78rem',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    color: '#94A3B8', fontFamily: 'inherit',
                  }}>
                    <option>T: 0.3</option>
                    <option>T: 0.5</option>
                    <option>T: 0.7</option>
                  </select>
                </div>
              </div>
            )}

            {/* Schema */}
            {activeTab === 'Schema' && (
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#94A3B8', marginBottom: '0.625rem' }}>Output Schema</div>
                <div style={{
                  background: '#060C1A', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '0.5rem', padding: '0.875rem', fontSize: '0.72rem',
                  fontFamily: 'ui-monospace, monospace', color: '#94A3B8', lineHeight: 1.6,
                }}>
{`{
  "title": "string",
  "version": "string",
  "workspace": "string",
  "sections": [
    {
      "id": "string",
      "title": "string",
      "content": "string"
    }
  ],
  "requirements": [
    {
      "id": "string",
      "priority": "Must|Should|Nice",
      "text": "string",
      "category": "FR|NFR"
    }
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

            {/* Destinations */}
            {activeTab === 'Destinations' && (
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#94A3B8', marginBottom: '0.875rem' }}>Output Destinations</div>
                {[
                  { label: 'Save to Workspace', detail: 'Documents library', checked: true, color: '#0EA5E9' },
                  { label: 'Export as Word', detail: 'Microsoft Word .docx', checked: true, color: '#0EA5E9' },
                  { label: 'Export as PDF', detail: 'PDF with Consultant OS branding', checked: true, color: '#8B5CF6' },
                  { label: 'Sync to SharePoint', detail: 'NCA Programme folder', checked: false, color: '#F59E0B' },
                  { label: 'Push to Jira', detail: 'Create requirements tickets', checked: false, color: '#10B981' },
                ].map((dest, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.625rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}>
                    <div style={{
                      width: '16px', height: '16px', borderRadius: '4px',
                      background: dest.checked ? `${dest.color}20` : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${dest.checked ? dest.color + '50' : 'rgba(255,255,255,0.1)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {dest.checked && <Check size={10} style={{ color: dest.color }} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500, color: dest.checked ? '#F1F5F9' : '#475569' }}>{dest.label}</div>
                      <div style={{ fontSize: '0.68rem', color: '#334155' }}>{dest.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Notifications */}
            {activeTab === 'Notifications' && (
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#94A3B8', marginBottom: '0.875rem' }}>Notification Rules</div>
                {[
                  { label: 'Email on Success', detail: 'Send to assigned consultant', enabled: true },
                  { label: 'Email on Error', detail: 'Alert to workspace admin', enabled: true },
                  { label: 'Slack Notification', detail: '#automation-runs channel', enabled: false },
                  { label: 'Teams Message', detail: 'Project team channel', enabled: true },
                  { label: 'In-App Alert', detail: 'Show in notification centre', enabled: true },
                ].map((notif, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.625rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94A3B8' }}>{notif.label}</div>
                      <div style={{ fontSize: '0.68rem', color: '#334155' }}>{notif.detail}</div>
                    </div>
                    <div style={{
                      width: '32px', height: '18px', borderRadius: '9999px',
                      background: notif.enabled ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.08)',
                      border: `1px solid ${notif.enabled ? 'rgba(0,212,255,0.5)' : 'rgba(255,255,255,0.12)'}`,
                      cursor: 'pointer', position: 'relative',
                    }}>
                      <div style={{
                        position: 'absolute',
                        width: '12px', height: '12px', borderRadius: '9999px',
                        background: notif.enabled ? '#00D4FF' : '#475569',
                        top: '2px',
                        left: notif.enabled ? '17px' : '2px',
                        transition: 'left 0.2s',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Logs */}
            {activeTab === 'Logs' && (
              <div>
                {/* Live run output */}
                {(running || runOutput || runError) && (
                  <div style={{ marginBottom: '1rem', padding: '0.875rem', borderRadius: '0.5rem', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#A78BFA', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      {running ? <AlertCircle size={11} /> : <Check size={11} />}
                      {running ? 'Running…' : runError ? 'Run Failed' : 'Run Complete'}
                    </div>
                    {runError && <div style={{ fontSize: '0.75rem', color: '#FCA5A5' }}>{runError}</div>}
                    {runOutput && (
                      <pre style={{ margin: 0, fontSize: '0.72rem', color: '#CBD5E1', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: '300px', overflowY: 'auto', fontFamily: 'inherit' }}>{runOutput}</pre>
                    )}
                  </div>
                )}
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#94A3B8', marginBottom: '0.875rem' }}>Recent Runs</div>
                {recentLogs.map((log, i) => (
                  <div key={i} style={{
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    marginBottom: '0.5rem',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                      <span style={{
                        fontSize: '0.7rem', padding: '1px 6px', borderRadius: '3px',
                        background: log.status === 'Success' ? 'rgba(16,185,129,0.15)' : log.status === 'Warning' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                        color: log.status === 'Success' ? '#34D399' : log.status === 'Warning' ? '#FCD34D' : '#FCA5A5',
                      }}>
                        {log.status}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#334155' }}>{log.time}</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#475569', marginBottom: '2px' }}>
                      <span style={{ color: '#94A3B8' }}>In:</span> {log.input}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#475569' }}>
                      <span style={{ color: '#94A3B8' }}>Out:</span> {log.output}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#334155', marginTop: '2px' }}>Duration: {log.duration}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
