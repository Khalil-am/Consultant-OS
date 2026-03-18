import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Upload, FileText, CheckCircle, AlertCircle, Clock,
  ChevronRight, Download, Eye, RefreshCw, BarChart2, X, Loader,
  Zap, Shield, GitCompare, RotateCcw, Play,
  Inbox, Search, Brain, PenLine, Package, Trophy, Globe, Code2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type RunStatus =
  | 'idle' | 'queued' | 'parsing' | 'quality_check' | 'analyzing_sample'
  | 'extracting_requirements' | 'generating_sections' | 'validating'
  | 'exporting' | 'completed' | 'needs_review' | 'failed';

type OutputTab = 'preview' | 'compare' | 'validation' | 'download' | 'regenerate';

interface UploadedFile {
  name: string;
  size: number;
  type: string;
}

interface RunState {
  runId: string;
  status: RunStatus;
  currentStage: number;
  qualityScore: number;
  coverageScore: number;
  sectionsGenerated: number;
  totalSections: number;
  warnings: string[];
  outputs: {
    previewUrl?: string;
    docxUrl?: string;
    pdfUrl?: string;
  };
  comparison: {
    sampleCoverage: number;
    styleAlignment: number;
    missingBefore: number;
    resolved: number;
    remainingGaps: string[];
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { id: 'queued',                   label: 'Intake',              icon: <Inbox size={13} />,        wf: 'WF01' },
  { id: 'parsing',                  label: 'Parsing',             icon: <FileText size={13} />,     wf: 'WF02' },
  { id: 'quality_check',            label: 'Quality Gate',        icon: <Shield size={13} />,       wf: 'WF03' },
  { id: 'analyzing_sample',         label: 'Sample Analysis',     icon: <Search size={13} />,       wf: 'WF04' },
  { id: 'extracting_requirements',  label: 'BRD Extraction',      icon: <Brain size={13} />,        wf: 'WF05' },
  { id: 'generating_sections',      label: 'Draft Generation',    icon: <PenLine size={13} />,      wf: 'WF07' },
  { id: 'validating',               label: 'QA Validation',       icon: <CheckCircle size={13} />,  wf: 'WF08' },
  { id: 'exporting',                label: 'Export',              icon: <Package size={13} />,      wf: 'WF09' },
  { id: 'completed',                label: 'Complete',            icon: <Trophy size={13} />,       wf: 'WF10' },
];

const PROMPT_TEMPLATES = [
  { id: 'brd_standard_v1',    name: 'BRD Standard Generator',       badge: 'Recommended' },
  { id: 'brd_government_v1',  name: 'BRD Government / Public Sector', badge: 'Gov' },
  { id: 'brd_agile_v1',       name: 'BRD Agile / Product Format',   badge: 'Agile' },
];

const CANONICAL_SECTIONS = [
  'Executive Summary', 'Background & Business Context', 'Business Need & Problem Statement',
  'Objectives & Success Criteria', 'Scope', 'Stakeholder Register',
  'Functional Requirements', 'Non-Functional Requirements', 'Process Flows & Use Cases',
  'Integration Requirements', 'Reporting & Data Requirements',
  'Assumptions & Constraints', 'Risks & Mitigation', 'Dependencies',
  'Acceptance Criteria', 'Appendices & Open Questions',
];

const STATUS_ORDER: RunStatus[] = [
  'queued', 'parsing', 'quality_check', 'analyzing_sample',
  'extracting_requirements', 'generating_sections', 'validating', 'exporting', 'completed',
];

function stageIndex(status: RunStatus): number {
  return STATUS_ORDER.indexOf(status);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DropZone({
  label, accept, file, onFile, onClear,
}: {
  label: string; accept: string; file: UploadedFile | null;
  onFile: (f: UploadedFile) => void; onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile({ name: f.name, size: f.size, type: f.type });
  };

  return (
    <div
      onClick={() => !file && ref.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      style={{
        border: `1.5px dashed ${dragging ? '#00D4FF' : file ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.12)'}`,
        borderRadius: '0.625rem',
        padding: '1rem 1.25rem',
        background: dragging ? 'rgba(0,212,255,0.05)' : file ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.02)',
        cursor: file ? 'default' : 'pointer',
        transition: 'all 0.2s',
        display: 'flex', alignItems: 'center', gap: '0.75rem',
      }}
    >
      <input ref={ref} type="file" accept={accept} style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile({ name: f.name, size: f.size, type: f.type }); }} />
      {file ? (
        <>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FileText size={16} style={{ color: '#34D399' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#F1F5F9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</div>
            <div style={{ fontSize: '0.68rem', color: '#475569' }}>{(file.size / 1024).toFixed(1)} KB · {label}</div>
          </div>
          <button onClick={e => { e.stopPropagation(); onClear(); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex', padding: '0.25rem' }}>
            <X size={14} />
          </button>
        </>
      ) : (
        <>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Upload size={16} style={{ color: '#475569' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.82rem', color: '#94A3B8' }}>{label}</div>
            <div style={{ fontSize: '0.68rem', color: '#475569' }}>PDF, DOCX, TXT, MD · Drag & drop or click</div>
          </div>
        </>
      )}
    </div>
  );
}

function ScoreBadge({ score, label }: { score: number; label: string }) {
  const pct = Math.round(score * 100);
  const color = pct >= 85 ? '#10B981' : pct >= 65 ? '#F59E0B' : '#EF4444';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem' }}>
      <div style={{ width: 52, height: 52, borderRadius: '50%', border: `3px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color }}>{pct}%</span>
      </div>
      <span style={{ fontSize: '0.65rem', color: '#475569', textAlign: 'center' }}>{label}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BrdRunPage() {
  const navigate = useNavigate();

  // Config state
  const [brdFile, setBrdFile] = useState<UploadedFile | null>(null);
  const [sampleFiles, setSampleFiles] = useState<UploadedFile[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('brd_standard_v1');
  const [outputFormat, setOutputFormat] = useState<'docx' | 'pdf' | 'both'>('both');
  const [language, setLanguage] = useState<'en' | 'ar' | 'bilingual'>('en');
  const [compareMode, setCompareMode] = useState(true);
  const [strictMatch, setStrictMatch] = useState(false);
  const [notes, setNotes] = useState('');

  // Run state
  const [screen, setScreen] = useState<'config' | 'progress' | 'output'>('config');
  const [run, setRun] = useState<RunState | null>(null);
  const [outputTab, setOutputTab] = useState<OutputTab>('preview');
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Simulate pipeline progression for demo
  const simulateRun = () => {
    const runId = `run-${Date.now()}`;
    const initialRun: RunState = {
      runId,
      status: 'queued',
      currentStage: 0,
      qualityScore: 0,
      coverageScore: 0,
      sectionsGenerated: 0,
      totalSections: CANONICAL_SECTIONS.length,
      warnings: [],
      outputs: {},
      comparison: { sampleCoverage: 0, styleAlignment: 0, missingBefore: 0, resolved: 0, remainingGaps: [] },
    };
    setRun(initialRun);
    setScreen('progress');

    let stage = 0;
    progressIntervalRef.current = setInterval(() => {
      stage++;
      const status = STATUS_ORDER[Math.min(stage, STATUS_ORDER.length - 1)] as RunStatus;
      const isGenerating = status === 'generating_sections';
      const isCompleted = status === 'completed';

      setRun(prev => {
        if (!prev) return prev;
        const sectionsGenerated = isGenerating
          ? Math.min(prev.sectionsGenerated + 3, CANONICAL_SECTIONS.length)
          : isCompleted ? CANONICAL_SECTIONS.length : prev.sectionsGenerated;

        return {
          ...prev,
          status,
          currentStage: stage,
          sectionsGenerated,
          qualityScore: isCompleted ? 0.91 : prev.qualityScore,
          coverageScore: isCompleted ? 0.87 : prev.coverageScore,
          warnings: status === 'quality_check' && sampleFiles.length === 0
            ? ['No sample documents provided — output will use default blueprint']
            : prev.warnings,
          outputs: isCompleted ? {
            previewUrl: '#preview',
            docxUrl: '#docx',
            pdfUrl: '#pdf',
          } : prev.outputs,
          comparison: isCompleted ? {
            sampleCoverage: sampleFiles.length > 0 ? 0.87 : 0,
            styleAlignment: sampleFiles.length > 0 ? 0.91 : 0,
            missingBefore: 3,
            resolved: 3,
            remainingGaps: [],
          } : prev.comparison,
        };
      });

      if (status === 'completed') {
        clearInterval(progressIntervalRef.current!);
        setTimeout(() => setScreen('output'), 800);
      }
    }, 1800);
  };

  const handleStartRun = () => {
    if (!brdFile) return;
    simulateRun();
  };

  useEffect(() => {
    return () => { if (progressIntervalRef.current) clearInterval(progressIntervalRef.current); };
  }, []);

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
              <h1 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#F1F5F9', margin: 0 }}>BRD Generator from Requirements</h1>
              <p style={{ fontSize: '0.75rem', color: '#475569', margin: 0 }}>BA & Requirements · Powered by n8n + Claude</p>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Upload BRD */}
            <div className="section-card" style={{ padding: '1.125rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.75rem', fontWeight: 600 }}>Source BRD / Requirements</div>
              <DropZone label="Upload BRD or requirements document" accept=".pdf,.docx,.doc,.txt,.md"
                file={brdFile} onFile={setBrdFile} onClear={() => setBrdFile(null)} />
            </div>

            {/* Sample Documents */}
            <div className="section-card" style={{ padding: '1.125rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.72rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Sample / Reference Documents</div>
                <span style={{ fontSize: '0.65rem', color: '#475569' }}>Optional</span>
              </div>
              {sampleFiles.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: 6, background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.15)', marginBottom: '0.5rem' }}>
                  <FileText size={13} style={{ color: '#A78BFA', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.78rem', color: '#94A3B8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  <button onClick={() => setSampleFiles(prev => prev.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569' }}><X size={12} /></button>
                </div>
              ))}
              <DropZone label="Add sample BRD for blueprint alignment" accept=".pdf,.docx,.doc,.txt,.md"
                file={null}
                onFile={f => setSampleFiles(prev => [...prev, f])}
                onClear={() => {}} />
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Prompt Template */}
            <div className="section-card" style={{ padding: '1.125rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.75rem', fontWeight: 600 }}>Prompt Template</div>
              {PROMPT_TEMPLATES.map(t => (
                <div key={t.id} onClick={() => setSelectedTemplate(t.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 0.75rem', borderRadius: 6, background: selectedTemplate === t.id ? 'rgba(0,212,255,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${selectedTemplate === t.id ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.06)'}`, cursor: 'pointer', marginBottom: '0.375rem', transition: 'all 0.15s' }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: selectedTemplate === t.id ? 'rgba(0,212,255,0.3)' : 'transparent', border: `2px solid ${selectedTemplate === t.id ? '#00D4FF' : '#334155'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {selectedTemplate === t.id && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00D4FF' }} />}
                  </div>
                  <span style={{ fontSize: '0.8rem', color: selectedTemplate === t.id ? '#F1F5F9' : '#94A3B8', flex: 1 }}>{t.name}</span>
                  <span style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: 3, background: 'rgba(0,212,255,0.1)', color: '#00D4FF', border: '1px solid rgba(0,212,255,0.2)' }}>{t.badge}</span>
                </div>
              ))}
            </div>

            {/* Options */}
            <div className="section-card" style={{ padding: '1.125rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.75rem', fontWeight: 600 }}>Output Options</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {/* Language */}
                <div>
                  <div style={{ fontSize: '0.68rem', color: '#475569', marginBottom: '3px' }}>Language</div>
                  <select value={language} onChange={e => setLanguage(e.target.value as typeof language)}
                    style={{ width: '100%', padding: '0.375rem 0.5rem', borderRadius: 6, fontSize: '0.78rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8', fontFamily: 'inherit' }}>
                    <option value="en">English</option>
                    <option value="ar">Arabic</option>
                    <option value="bilingual">Bilingual</option>
                  </select>
                </div>
                {/* Format */}
                <div>
                  <div style={{ fontSize: '0.68rem', color: '#475569', marginBottom: '3px' }}>Output Format</div>
                  <select value={outputFormat} onChange={e => setOutputFormat(e.target.value as typeof outputFormat)}
                    style={{ width: '100%', padding: '0.375rem 0.5rem', borderRadius: 6, fontSize: '0.78rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8', fontFamily: 'inherit' }}>
                    <option value="both">DOCX + PDF</option>
                    <option value="docx">DOCX only</option>
                    <option value="pdf">PDF only</option>
                  </select>
                </div>
              </div>

              {/* Toggles */}
              {[
                { label: 'Compare to sample document', sublabel: 'Show alignment scores and diff panel', value: compareMode, set: setCompareMode },
                { label: 'Strict template match', sublabel: 'Enforce exact section structure from sample', value: strictMatch, set: setStrictMatch },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>{item.label}</div>
                    <div style={{ fontSize: '0.68rem', color: '#334155' }}>{item.sublabel}</div>
                  </div>
                  <div onClick={() => item.set(!item.value)}
                    style={{ width: 32, height: 18, borderRadius: 9999, background: item.value ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.08)', border: `1px solid ${item.value ? 'rgba(0,212,255,0.5)' : 'rgba(255,255,255,0.12)'}`, cursor: 'pointer', position: 'relative', flexShrink: 0 }}>
                    <div style={{ position: 'absolute', width: 12, height: 12, borderRadius: '50%', background: item.value ? '#00D4FF' : '#475569', top: 2, left: item.value ? 17 : 2, transition: 'left 0.2s' }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Notes */}
            <div className="section-card" style={{ padding: '1.125rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem', fontWeight: 600 }}>Special Instructions</div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any specific requirements, focus areas, or constraints for the LLM..."
                style={{ width: '100%', minHeight: 70, padding: '0.625rem 0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: '#94A3B8', fontSize: '0.78rem', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
          </div>
        </div>

        {/* Run Button */}
        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button className="btn-ghost" onClick={() => navigate('/automations')} style={{ height: 40, fontSize: '0.85rem' }}>Cancel</button>
          <button className="btn-primary" onClick={handleStartRun} disabled={!brdFile}
            style={{ height: 40, fontSize: '0.85rem', opacity: brdFile ? 1 : 0.4, cursor: brdFile ? 'pointer' : 'not-allowed', gap: '0.5rem', padding: '0 1.5rem' }}>
            <Play size={14} /> Run BRD Generation
          </button>
        </div>
      </div>
    );
  }

  // ── Screen: Progress ────────────────────────────────────────────────────────
  if (screen === 'progress' && run) {
    const currentStageIdx = stageIndex(run.status);
    const progressPct = Math.round((currentStageIdx / (STATUS_ORDER.length - 1)) * 100);
    const isFailed = run.status === 'failed' || run.status === 'needs_review';

    return (
      <div style={{ padding: '1.5rem', maxWidth: 700, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.78rem', color: '#475569', marginBottom: '0.5rem' }}>Run ID: <span style={{ color: '#94A3B8', fontFamily: 'monospace' }}>{run.runId}</span></div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#F1F5F9', margin: '0 0 0.375rem' }}>
            {run.status === 'completed' ? 'BRD Generated Successfully' :
              isFailed ? 'Run Needs Review' :
                'Generating BRD...'}
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#475569', margin: 0 }}>
            {run.status === 'completed' ? `${run.sectionsGenerated} sections · Powered by n8n + Claude` :
              isFailed ? 'The document did not pass quality checks' :
                'n8n pipeline is processing your document'}
          </p>
        </div>

        {/* Progress bar */}
        <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.05)', marginBottom: '2rem', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progressPct}%`, background: isFailed ? '#EF4444' : 'linear-gradient(90deg, #00D4FF, #8B5CF6)', borderRadius: 2, transition: 'width 0.8s ease' }} />
        </div>

        {/* Pipeline stages */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem' }}>
          {PIPELINE_STAGES.map((stage, i) => {
            const sIdx = STATUS_ORDER.indexOf(stage.id as RunStatus);
            const isDone = currentStageIdx > sIdx;
            const isActive = currentStageIdx === sIdx;
            const isPending = currentStageIdx < sIdx;
            const isError = isFailed && isActive;

            return (
              <div key={stage.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.875rem',
                padding: '0.75rem 1rem', borderRadius: '0.625rem',
                background: isActive ? 'rgba(139,92,246,0.08)' : isDone ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isActive ? 'rgba(139,92,246,0.3)' : isDone ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)'}`,
                transition: 'all 0.3s',
              }}>
                {/* Stage icon */}
                <div style={{ width: 32, height: 32, borderRadius: 8, background: isActive ? 'rgba(139,92,246,0.15)' : isDone ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', flexShrink: 0 }}>
                  {isDone ? <CheckCircle size={14} style={{ color: '#34D399' }} /> :
                    isActive && !isError ? <Loader size={14} style={{ color: '#A78BFA', animation: 'spin 1s linear infinite' }} /> :
                      isError ? <AlertCircle size={14} style={{ color: '#FCA5A5' }} /> :
                        <span style={{ display: 'flex', color: '#475569' }}>{stage.icon}</span>}
                </div>

                {/* Label */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: isActive ? 700 : 500, color: isDone ? '#34D399' : isActive ? '#F1F5F9' : '#475569' }}>
                    {stage.label}
                  </div>
                  <div style={{ fontSize: '0.67rem', color: '#334155' }}>{stage.wf}</div>
                </div>

                {/* Section counter for generating */}
                {isActive && stage.id === 'generating_sections' && (
                  <div style={{ fontSize: '0.72rem', color: '#A78BFA' }}>
                    {run.sectionsGenerated}/{run.totalSections} sections
                  </div>
                )}

                {/* Status dot */}
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: isDone ? '#10B981' : isActive ? '#8B5CF6' : 'rgba(255,255,255,0.1)', boxShadow: isActive ? '0 0 6px rgba(139,92,246,0.8)' : 'none' }} />
              </div>
            );
          })}
        </div>

        {/* Warnings */}
        {run.warnings.length > 0 && (
          <div style={{ padding: '0.875rem 1rem', borderRadius: '0.625rem', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
              <AlertCircle size={13} style={{ color: '#FCD34D' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#FCD34D' }}>Warnings</span>
            </div>
            {run.warnings.map((w, i) => <div key={i} style={{ fontSize: '0.73rem', color: '#D97706' }}>· {w}</div>)}
          </div>
        )}

        {/* Cancel */}
        {run.status !== 'completed' && !isFailed && (
          <div style={{ textAlign: 'center' }}>
            <button className="btn-ghost" onClick={() => { clearInterval(progressIntervalRef.current!); navigate('/automations'); }}
              style={{ fontSize: '0.78rem', height: 34 }}>
              Cancel Run
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Screen: Output ──────────────────────────────────────────────────────────
  if (screen === 'output' && run) {
    const tabs: { id: OutputTab; label: string; icon: React.ReactNode }[] = [
      { id: 'preview',    label: 'Preview',    icon: <Eye size={13} /> },
      { id: 'compare',    label: 'Compare',    icon: <GitCompare size={13} /> },
      { id: 'validation', label: 'Validation', icon: <Shield size={13} /> },
      { id: 'download',   label: 'Download',   icon: <Download size={13} /> },
      { id: 'regenerate', label: 'Regenerate', icon: <RotateCcw size={13} /> },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '0.875rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', background: '#0C1220', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={() => navigate('/automations')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', fontFamily: 'inherit' }}>
              <ArrowLeft size={14} /> Automations
            </button>
            <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.08)' }} />
            <div>
              <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#F1F5F9', margin: 0 }}>BRD Generated · {brdFile?.name}</h2>
              <p style={{ fontSize: '0.68rem', color: '#475569', margin: 0 }}>Run {run.runId} · {CANONICAL_SECTIONS.length} sections · n8n + Claude</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <ScoreBadge score={run.qualityScore} label="Quality" />
            {run.comparison.sampleCoverage > 0 && <ScoreBadge score={run.comparison.sampleCoverage} label="Coverage" />}
            <button className="btn-primary" style={{ height: 34, fontSize: '0.78rem', marginLeft: '0.5rem' }} onClick={() => setScreen('config')}>
              <Play size={12} /> New Run
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '0 1.5rem', background: '#0C1220', flexShrink: 0 }}>
          {tabs.map(tab => (
            <button key={tab.id} className={`tab-underline ${outputTab === tab.id ? 'active' : ''}`}
              onClick={() => setOutputTab(tab.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.78rem', padding: '0.625rem 0.625rem', marginRight: '1rem' }}>
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>

          {/* Preview */}
          {outputTab === 'preview' && (
            <div>
              <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', color: '#475569' }}>{CANONICAL_SECTIONS.length} sections generated · {Math.round(run.qualityScore * 100)}% quality score</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '1.25rem' }}>
                {/* TOC */}
                <div className="section-card" style={{ padding: '1rem', alignSelf: 'start', position: 'sticky', top: 0 }}>
                  <div style={{ fontSize: '0.7rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.75rem', fontWeight: 600 }}>Table of Contents</div>
                  {CANONICAL_SECTIONS.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.375rem', borderRadius: 4, cursor: 'pointer', marginBottom: 1 }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)' )}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <span style={{ fontSize: '0.62rem', color: '#334155', minWidth: 16 }}>{i + 1}.</span>
                      <span style={{ fontSize: '0.72rem', color: '#64748B' }}>{s}</span>
                    </div>
                  ))}
                </div>

                {/* Sections */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {CANONICAL_SECTIONS.map((sectionName, i) => {
                    const confidence = 0.85 + (Math.random() * 0.12 - 0.06);
                    return (
                      <div key={i} className="section-card" style={{ padding: '1.125rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                          <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#F1F5F9', margin: 0 }}>{sectionName}</h3>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.65rem', color: '#34D399', background: 'rgba(16,185,129,0.08)', padding: '1px 6px', borderRadius: 3, border: '1px solid rgba(16,185,129,0.15)' }}>
                              {Math.round(confidence * 100)}% conf.
                            </span>
                            <button className="btn-ghost" style={{ height: 24, padding: '0 0.5rem', fontSize: '0.65rem' }}
                              onClick={() => { setRegeneratingSection(sectionName); setOutputTab('regenerate'); }}>
                              <RotateCcw size={10} /> Regen
                            </button>
                          </div>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748B', lineHeight: 1.7 }}>
                          <em style={{ color: '#334155', fontSize: '0.73rem' }}>
                            [Generated content for "{sectionName}" will appear here after the n8n pipeline runs. Content is stored in <code>automation_run_sections</code> in Supabase and fetched via WF09.]
                          </em>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Compare */}
          {outputTab === 'compare' && (
            <div>
              {sampleFiles.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#334155' }}>
                  <GitCompare size={32} style={{ marginBottom: '0.75rem', opacity: 0.3 }} />
                  <div style={{ fontSize: '0.875rem', color: '#475569' }}>No sample documents were provided</div>
                  <div style={{ fontSize: '0.78rem', color: '#334155', marginTop: '0.375rem' }}>Run again with sample documents to enable comparison</div>
                </div>
              ) : (
                <div style={{ maxWidth: 700 }}>
                  {/* Scores */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.875rem', marginBottom: '1.5rem' }}>
                    {[
                      { label: 'Sample Coverage', value: run.comparison.sampleCoverage, icon: <BarChart2 size={15} /> },
                      { label: 'Style Alignment', value: run.comparison.styleAlignment, icon: <CheckCircle size={15} /> },
                      { label: 'Gaps Resolved', value: run.comparison.resolved, isCount: true },
                      { label: 'Remaining Gaps', value: run.comparison.remainingGaps.length, isCount: true, danger: true },
                    ].map(m => (
                      <div key={m.label} className="metric-card">
                        <div style={{ fontSize: '1.25rem', fontWeight: 900, color: m.danger && (m.value as number) > 0 ? '#FCA5A5' : '#F1F5F9', letterSpacing: '-0.02em' }}>
                          {m.isCount ? m.value : `${Math.round((m.value as number) * 100)}%`}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#475569', marginTop: 2 }}>{m.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Section coverage table */}
                  <div className="section-card" style={{ padding: '1.125rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8', marginBottom: '0.875rem' }}>Section Coverage vs Sample Blueprint</div>
                    {CANONICAL_SECTIONS.map((s, i) => {
                      const covered = i < CANONICAL_SECTIONS.length - 1;
                      const wasGap = i === 7 || i === 11;
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <div style={{ width: 16, height: 16, borderRadius: '50%', background: covered ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${covered ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {covered ? <CheckCircle size={9} style={{ color: '#34D399' }} /> : <X size={9} style={{ color: '#FCA5A5' }} />}
                          </div>
                          <span style={{ fontSize: '0.78rem', color: '#64748B', flex: 1 }}>{s}</span>
                          {wasGap && <span style={{ fontSize: '0.62rem', color: '#34D399', background: 'rgba(16,185,129,0.08)', padding: '1px 5px', borderRadius: 3 }}>Added from sample</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Validation */}
          {outputTab === 'validation' && (
            <div style={{ maxWidth: 680 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                {[
                  { label: 'Quality Score', value: `${Math.round(run.qualityScore * 100)}%`, color: '#34D399' },
                  { label: 'Consistency', value: '88%', color: '#34D399' },
                  { label: 'Unsupported Claims', value: '0', color: '#34D399' },
                  { label: 'Open Questions', value: '4', color: '#FCD34D' },
                ].map(m => (
                  <div key={m.label} className="metric-card" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 900, color: m.color, letterSpacing: '-0.02em' }}>{m.value}</div>
                      <div style={{ fontSize: '0.68rem', color: '#475569' }}>{m.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="section-card" style={{ padding: '1.125rem', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#34D399', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={13} /> QA Summary
                </div>
                <p style={{ fontSize: '0.8rem', color: '#64748B', lineHeight: 1.6, margin: 0 }}>
                  BRD meets enterprise quality standards. All {CANONICAL_SECTIONS.length} sections generated with high confidence.
                  No hallucinated facts detected. {sampleFiles.length > 0 ? 'Sample blueprint alignment confirmed.' : 'No sample provided — default template applied.'}
                  {' '}4 open questions flagged for client review.
                </p>
              </div>

              <div className="section-card" style={{ padding: '1.125rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#FCD34D', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertCircle size={13} /> Open Questions for Client Review
                </div>
                {[
                  'Confirm integration scope with legacy ERP system',
                  'Approval matrix roles to be confirmed with project sponsor',
                  'Data retention policy — regulatory requirement TBC',
                  'Performance SLA for peak load scenarios not specified in source',
                ].map((q, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.5rem', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.78rem', color: '#D97706' }}>
                    <span style={{ color: '#475569', fontSize: '0.7rem', minWidth: 18 }}>Q{i + 1}.</span>
                    {q}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Download */}
          {outputTab === 'download' && (
            <div style={{ maxWidth: 520 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[
                  { label: 'BRD Document (Word)', sublabel: 'Branded .docx with TOC, title page, tables', icon: <FileText size={18} />, color: '#0EA5E9', format: 'docx' },
                  { label: 'BRD Document (PDF)', sublabel: 'Print-ready PDF with Consultant OS branding', icon: <Download size={18} />, color: '#8B5CF6', format: 'pdf' },
                  { label: 'HTML Preview', sublabel: 'Web-based interactive preview', icon: <Globe size={18} />, color: '#10B981', format: 'html' },
                  { label: 'BRD Model (JSON)', sublabel: 'Structured semantic model — for integrations', icon: <Code2 size={18} />, color: '#F59E0B', format: 'json' },
                ].map(item => (
                  <div key={item.format} className="section-card"
                    style={{ padding: '1rem 1.125rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: `${item.color}12`, border: `1px solid ${item.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color, flexShrink: 0 }}>
                      {item.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>{item.label}</div>
                      <div style={{ fontSize: '0.72rem', color: '#475569' }}>{item.sublabel}</div>
                    </div>
                    <button className="btn-primary" style={{ height: 32, fontSize: '0.75rem', padding: '0 0.875rem' }}>
                      <Download size={12} /> Download
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Regenerate */}
          {outputTab === 'regenerate' && (
            <div style={{ maxWidth: 600 }}>
              <div style={{ fontSize: '0.8rem', color: '#475569', marginBottom: '1.25rem' }}>
                Select a section to regenerate independently. The pipeline will re-run only WF07 for the selected section with updated instructions.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {CANONICAL_SECTIONS.map(s => (
                  <div key={s} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem',
                    borderRadius: '0.625rem', background: regeneratingSection === s ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${regeneratingSection === s ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.05)'}`,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }} onClick={() => setRegeneratingSection(regeneratingSection === s ? null : s)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: regeneratingSection === s ? '#8B5CF6' : '#334155' }} />
                      <span style={{ fontSize: '0.82rem', color: regeneratingSection === s ? '#F1F5F9' : '#94A3B8' }}>{s}</span>
                    </div>
                    {regeneratingSection === s && (
                      <button className="btn-primary" style={{ height: 28, fontSize: '0.72rem', padding: '0 0.75rem' }}>
                        <RotateCcw size={11} /> Regenerate
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
