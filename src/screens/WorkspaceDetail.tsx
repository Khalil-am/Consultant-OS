import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLayout } from '../hooks/useLayout';
import {
  ArrowLeft, FileText, Video, CheckSquare, AlertTriangle,
  TrendingUp, Plus, ExternalLink, Zap, DollarSign, TrendingDown,
  RefreshCw, AlertCircle, X, Upload, Download,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  getWorkspace, getDocuments, getMeetings, getTasks, getRisks,
  getWorkspaceFinancial, getMilestones, getWorkspaceRagStatus,
  upsertTask, updateTask, upsertDocument, upsertMeeting, upsertRisk,
  updateWorkspace,
  type WorkspaceRow, type WorkspaceFinancialRow, type WorkspaceRagStatusRow,
  type MilestoneRow, type DocumentRow, type MeetingRow, type TaskRow, type RiskRow,
} from '../lib/db';

const tabs = ['Overview', 'Documents', 'Meetings', 'Tasks', 'Risks'];

const RAG_COLORS: Record<string, string> = { Green: '#10B981', Amber: '#F59E0B', Red: '#EF4444' };

function fmtSAR(val: number): string {
  if (val >= 1_000_000) return `⃁${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `⃁${(val / 1_000).toFixed(0)}K`;
  return `⃁${val.toLocaleString()}`;
}

const milestoneStatusColor: Record<string, string> = {
  Completed: '#10B981', 'On Track': '#0EA5E9', 'At Risk': '#F59E0B', Delayed: '#EF4444', Upcoming: '#475569',
};

const meetingTypeColors: Record<string, string> = {
  Workshop: '#8B5CF6', Committee: '#F59E0B', Steering: '#0EA5E9',
  Review: '#10B981', Kickoff: '#EC4899', Standup: '#06B6D4',
};

const DOC_TYPES = ['BRD', 'Report', 'Architecture', 'Technical Spec', 'Policy', 'Charter', 'Assessment', 'Project Plan', 'Presentation', 'Other'];
const DOC_TYPE_COLORS: Record<string, string> = {
  BRD: '#0EA5E9', Report: '#10B981', Architecture: '#8B5CF6', 'Technical Spec': '#F59E0B',
  Policy: '#10B981', Charter: '#8B5CF6', Assessment: '#F59E0B', 'Project Plan': '#0EA5E9',
  Presentation: '#EC4899', Other: '#94A3B8',
};
const MEETING_TYPES = ['Workshop', 'Committee', 'Steering', 'Review', 'Kickoff', 'Standup'] as const;
const RISK_CATEGORIES = ['Governance', 'Technical', 'Procurement', 'Delivery', 'Financial', 'Vendor', 'Compliance', 'Other'];

interface WorkspaceData {
  ws: WorkspaceRow;
  fin: WorkspaceFinancialRow | null;
  rag: WorkspaceRagStatusRow | null;
  docs: DocumentRow[];
  meetings: MeetingRow[];
  tasks: TaskRow[];
  risks: RiskRow[];
  milestones: MilestoneRow[];
}

interface NewTaskForm { title: string; priority: 'High' | 'Medium' | 'Low'; due_date: string; assignee: string; description: string; }
interface NewDocForm { name: string; type: string; language: 'EN' | 'AR' | 'Bilingual'; status: 'Draft' | 'Approved' | 'Under Review' | 'Final'; author: string; pages: string; summary: string; file: File | null; }
interface NewMeetingForm { title: string; type: typeof MEETING_TYPES[number]; date: string; time: string; duration: string; participants: string; location: string; }
interface NewRiskForm { title: string; category: string; probability: string; impact: string; severity: 'Critical' | 'High' | 'Medium' | 'Low'; owner: string; mitigation: string; financial_exposure: string; }

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.625rem 0.75rem',
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '0.5rem', color: '#F1F5F9', fontSize: '0.85rem',
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
};
const selectStyle: React.CSSProperties = {
  ...inputStyle, background: '#0A0F1E',
};
const labelStyle: React.CSSProperties = {
  fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', display: 'block', marginBottom: '0.375rem',
};

export default function WorkspaceDetail() {
  const { width, isMobile, isTablet } = useLayout();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Overview');

  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Task modal
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState<NewTaskForm>({ title: '', priority: 'Medium', due_date: '', assignee: '', description: '' });
  const [taskSaving, setTaskSaving] = useState(false);
  const [taskError, setTaskError] = useState('');
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  // Document modal
  const [showDocModal, setShowDocModal] = useState(false);
  const [docForm, setDocForm] = useState<NewDocForm>({ name: '', type: 'BRD', language: 'EN', status: 'Draft', author: '', pages: '1', summary: '', file: null });
  const [docSaving, setDocSaving] = useState(false);
  const [docError, setDocError] = useState('');
  const [docUploadPct, setDocUploadPct] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Meeting modal
  const [showMtgModal, setShowMtgModal] = useState(false);
  const [mtgForm, setMtgForm] = useState<NewMeetingForm>({ title: '', type: 'Review', date: '', time: '10:00', duration: '1h', participants: '', location: '' });
  const [mtgSaving, setMtgSaving] = useState(false);
  const [mtgError, setMtgError] = useState('');

  // Risk modal
  const [showRiskModal, setShowRiskModal] = useState(false);
  const [riskForm, setRiskForm] = useState<NewRiskForm>({ title: '', category: 'Governance', probability: '3', impact: '3', severity: 'High', owner: '', mitigation: '', financial_exposure: '' });
  const [riskSaving, setRiskSaving] = useState(false);
  const [riskError, setRiskError] = useState('');

  const loadData = useCallback(async (isRefresh = false) => {
    if (!id) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const [ws, fin, rag, docs, meetings, tasks, risks, milestones] = await Promise.all([
        getWorkspace(id),
        getWorkspaceFinancial(id).catch(() => null),
        getWorkspaceRagStatus(id).catch(() => null),
        getDocuments(id).catch(() => [] as DocumentRow[]),
        getMeetings(id).catch(() => [] as MeetingRow[]),
        getTasks(id).catch(() => [] as TaskRow[]),
        getRisks(id).catch(() => [] as RiskRow[]),
        getMilestones(id).catch(() => [] as MilestoneRow[]),
      ]);
      if (!ws) { setError('Workspace not found'); return; }
      setData({ ws, fin, rag, docs, meetings, tasks, risks, milestones });
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Failed to load workspace');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Create Task ──────────────────────────────────────────────
  const handleCreateTask = async () => {
    if (!taskForm.title.trim() || !taskForm.due_date || !taskForm.assignee.trim()) {
      setTaskError('Title, due date and assignee are required.'); return;
    }
    if (!id || !data) return;
    setTaskSaving(true); setTaskError('');
    try {
      await upsertTask({
        id: `tsk-${Date.now()}`, title: taskForm.title.trim(),
        workspace: data.ws.name, workspace_id: id,
        priority: taskForm.priority, status: 'Backlog',
        due_date: taskForm.due_date, assignee: taskForm.assignee.trim(),
        linked_doc: null, linked_meeting: null, description: taskForm.description.trim(),
      });
      await updateWorkspace(id, { tasks_count: data.tasks.length + 1, last_activity: 'Just now' });
      setShowTaskModal(false);
      setTaskForm({ title: '', priority: 'Medium', due_date: '', assignee: '', description: '' });
      await loadData(true);
    } catch (e: unknown) {
      setTaskError((e as Error).message ?? 'Failed to create task');
    } finally { setTaskSaving(false); }
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: TaskRow['status']) => {
    setUpdatingTaskId(taskId);
    try {
      await updateTask(taskId, { status: newStatus });
      await loadData(true);
    } catch (_) { /* ignore */ }
    finally { setUpdatingTaskId(null); }
  };

  // ── Create Document ──────────────────────────────────────────
  const handleCreateDoc = async () => {
    if (!docForm.name.trim() || !docForm.author.trim()) {
      setDocError('Name and author are required.'); return;
    }
    if (!id || !data) return;
    setDocSaving(true); setDocError(''); setDocUploadPct(0);
    try {
      let fileUrl: string | null = null;
      let fileSize = '—';

      // Upload file to Supabase Storage if one was selected
      if (docForm.file) {
        const file = docForm.file;
        const ext = file.name.split('.').pop();
        const path = `${id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        setDocUploadPct(10);

        const { error: uploadError } = await supabase.storage
          .from('workspace-docs')
          .upload(path, file, { cacheControl: '3600', upsert: false });

        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
        setDocUploadPct(80);

        const { data: urlData } = supabase.storage
          .from('workspace-docs')
          .getPublicUrl(path);
        fileUrl = urlData.publicUrl;

        // Human-readable size
        const bytes = file.size;
        fileSize = bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB`
          : bytes >= 1024 ? `${(bytes / 1024).toFixed(0)} KB`
          : `${bytes} B`;
        setDocUploadPct(90);
      }

      const today = new Date().toISOString().slice(0, 10);
      await upsertDocument({
        id: `doc-${Date.now()}`, name: docForm.name.trim(),
        type: docForm.type, type_color: DOC_TYPE_COLORS[docForm.type] ?? '#94A3B8',
        workspace: data.ws.name, workspace_id: id,
        date: today, language: docForm.language, status: docForm.status,
        size: fileSize, author: docForm.author.trim(),
        pages: parseInt(docForm.pages) || 1,
        summary: docForm.summary.trim(), tags: [],
        file_url: fileUrl,
      });
      await updateWorkspace(id, { docs_count: data.docs.length + 1, last_activity: 'Just now' });
      setDocUploadPct(100);
      setShowDocModal(false);
      setDocForm({ name: '', type: 'BRD', language: 'EN', status: 'Draft', author: '', pages: '1', summary: '', file: null });
      await loadData(true);
    } catch (e: unknown) {
      setDocError((e as Error).message ?? 'Failed to add document');
    } finally { setDocSaving(false); setDocUploadPct(0); }
  };

  // ── Create Meeting ────────────────────────────────────────────
  const handleCreateMeeting = async () => {
    if (!mtgForm.title.trim() || !mtgForm.date || !mtgForm.time) {
      setMtgError('Title, date and time are required.'); return;
    }
    if (!id || !data) return;
    setMtgSaving(true); setMtgError('');
    try {
      const participants = mtgForm.participants.split(',').map(p => p.trim()).filter(Boolean);
      await upsertMeeting({
        id: `mtg-${Date.now()}`, title: mtgForm.title.trim(),
        date: mtgForm.date, time: mtgForm.time, duration: mtgForm.duration || '1h',
        type: mtgForm.type, status: 'Upcoming',
        participants, workspace: data.ws.name, workspace_id: id,
        minutes_generated: false, actions_extracted: 0, decisions_logged: 0,
        location: mtgForm.location.trim() || null,
        agenda: null, quorum_status: null,
      });
      await updateWorkspace(id, { meetings_count: data.meetings.length + 1, last_activity: 'Just now' });
      setShowMtgModal(false);
      setMtgForm({ title: '', type: 'Review', date: '', time: '10:00', duration: '1h', participants: '', location: '' });
      await loadData(true);
    } catch (e: unknown) {
      setMtgError((e as Error).message ?? 'Failed to create meeting');
    } finally { setMtgSaving(false); }
  };

  // ── Create Risk ───────────────────────────────────────────────
  const handleCreateRisk = async () => {
    if (!riskForm.title.trim() || !riskForm.owner.trim()) {
      setRiskError('Title and owner are required.'); return;
    }
    if (!id || !data) return;
    setRiskSaving(true); setRiskError('');
    try {
      const prob = parseInt(riskForm.probability) || 3;
      const imp = parseInt(riskForm.impact) || 3;
      const today = new Date().toISOString().slice(0, 10);
      await upsertRisk({
        id: `rsk-${Date.now()}`, title: riskForm.title.trim(),
        workspace: data.ws.name, workspace_id: id,
        probability: prob, impact: imp, severity: riskForm.severity,
        status: 'Open', owner: riskForm.owner.trim(),
        mitigation: riskForm.mitigation.trim(),
        date_identified: today, category: riskForm.category,
        financial_exposure: riskForm.financial_exposure ? parseFloat(riskForm.financial_exposure) : null,
      });
      setShowRiskModal(false);
      setRiskForm({ title: '', category: 'Governance', probability: '3', impact: '3', severity: 'High', owner: '', mitigation: '', financial_exposure: '' });
      await loadData(true);
    } catch (e: unknown) {
      setRiskError((e as Error).message ?? 'Failed to create risk');
    } finally { setRiskSaving(false); }
  };

  // ── Render helpers ────────────────────────────────────────────
  const closeModal = (setter: (v: boolean) => void) => setter(false);

  if (loading) {
    return (
      <div style={{ padding: isMobile ? '0.875rem' : '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#475569', fontSize: '0.85rem' }}>
          <div style={{ width: 16, height: 16, border: '2px solid #0EA5E9', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          Loading workspace…
        </div>
        <div style={{ height: '160px', borderRadius: '0.875rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }} />
        <div style={{ height: '40px', borderRadius: '0.5rem', background: 'rgba(255,255,255,0.03)' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ height: '200px', borderRadius: '0.875rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }} />
          <div style={{ height: '200px', borderRadius: '0.875rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }} />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: isMobile ? '0.875rem' : '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', paddingTop: '4rem' }}>
        <AlertCircle size={40} style={{ color: '#EF4444' }} />
        <div style={{ fontSize: '0.9rem', color: '#FCA5A5', fontWeight: 600 }}>{error ?? 'Workspace not found'}</div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn-ghost" onClick={() => navigate('/workspaces')}><ArrowLeft size={14} /> Back</button>
          <button className="btn-primary" onClick={() => loadData()}>Retry</button>
        </div>
      </div>
    );
  }

  const { ws, fin, rag, docs, meetings, tasks, risks, milestones } = data;
  const spentPct = fin && fin.contract_value > 0 ? Math.round((fin.spent / fin.contract_value) * 100) : null;
  const forecastPct = fin && fin.contract_value > 0 ? Math.round((fin.forecast / fin.contract_value) * 100) : null;
  const openTasks = tasks.filter(t => t.status !== 'Completed');
  const upcomingMeetings = meetings.filter(m => m.status === 'Upcoming');

  return (
    <div style={{ padding: isMobile ? '0.875rem' : '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Back */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => navigate('/workspaces')} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: '0.8rem', padding: 0, fontFamily: 'inherit' }}>
          <ArrowLeft size={14} /> Back to Workspaces
        </button>
        <button className="btn-ghost" style={{ padding: '0.375rem', width: '30px', height: '30px' }} onClick={() => loadData(true)} title="Refresh">
          <RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
        </button>
      </div>

      {/* Banner */}
      <div style={{ padding: isMobile ? '1.25rem' : '1.75rem', borderRadius: '0.875rem', background: 'linear-gradient(135deg, #0D1527 0%, #111B35 60%, #0D1B3E 100%)', border: '1px solid rgba(255,255,255,0.08)', borderLeft: `4px solid ${ws.sector_color}`, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: '300px', height: '100%', background: `radial-gradient(ellipse at right, ${ws.sector_color}10 0%, transparent 70%)` }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.7rem', color: '#475569' }}>{ws.type}</span>
              <span style={{ color: '#334155' }}>·</span>
              <span className={ws.status === 'Active' ? 'status-active' : 'status-pending'}>{ws.status}</span>
              {rag && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {([['Budget', rag.budget], ['Schedule', rag.schedule], ['Risk', rag.risk], ['Overall', rag.rag]] as [string, string][]).map(([label, status]) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 7px', borderRadius: '4px', background: `${RAG_COLORS[status]}12`, border: `1px solid ${RAG_COLORS[status]}25` }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: RAG_COLORS[status], boxShadow: `0 0 4px ${RAG_COLORS[status]}80` }} />
                      <span style={{ fontSize: '0.6rem', color: RAG_COLORS[status], fontWeight: 600 }}>{label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <h1 style={{ fontSize: isMobile ? '1.25rem' : '1.625rem', fontWeight: 900, color: '#F1F5F9', margin: 0, marginBottom: '0.375rem', letterSpacing: '-0.02em' }}>{ws.name}</h1>
            <p style={{ fontSize: '0.875rem', color: '#94A3B8', margin: 0, marginBottom: '0.75rem' }}>{ws.client}</p>
            <p style={{ fontSize: '0.8rem', color: '#475569', margin: 0, maxWidth: '600px', lineHeight: 1.5 }}>{ws.description}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <button className="btn-ghost" style={{ fontSize: '0.8rem' }}><Zap size={14} /> Run Automation</button>
            <button className="btn-primary" style={{ fontSize: '0.8rem' }} onClick={() => { setShowTaskModal(true); setActiveTab('Tasks'); }}><Plus size={14} /> Add Task</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: isMobile ? '1rem' : '2rem', marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
          {[
            { icon: <FileText size={13} />, value: docs.length || ws.docs_count, label: 'Documents', onClick: () => setActiveTab('Documents') },
            { icon: <Video size={13} />, value: meetings.length || ws.meetings_count, label: 'Meetings', onClick: () => setActiveTab('Meetings') },
            { icon: <CheckSquare size={13} />, value: tasks.length || ws.tasks_count, label: 'Tasks', onClick: () => setActiveTab('Tasks') },
            { icon: <AlertTriangle size={13} />, value: risks.length, label: 'Risks', onClick: () => setActiveTab('Risks') },
            { icon: <TrendingUp size={13} />, value: `${ws.progress}%`, label: 'Progress', onClick: undefined },
          ].map(stat => (
            <div key={stat.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: stat.onClick ? 'pointer' : 'default' }} onClick={stat.onClick}>
              <span style={{ color: '#475569' }}>{stat.icon}</span>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: '#F1F5F9' }}>{stat.value}</span>
              <span style={{ fontSize: '0.75rem', color: stat.onClick ? '#38BDF8' : '#475569', textDecoration: stat.onClick ? 'underline' : 'none' }}>{stat.label}</span>
            </div>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#475569' }}>Language:</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#38BDF8' }}>{ws.language}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid rgba(255,255,255,0.06)', overflowX: 'auto' }}>
        {tabs.map(tab => (
          <button key={tab} className={`tab-underline ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)} style={{ marginRight: '1.5rem', whiteSpace: 'nowrap' }}>
            {tab}
            {tab === 'Tasks' && openTasks.length > 0 && <span style={{ marginLeft: '5px', background: '#EF4444', color: 'white', borderRadius: '9999px', fontSize: '0.6rem', padding: '1px 5px', fontWeight: 700 }}>{openTasks.length}</span>}
            {tab === 'Risks' && risks.filter(r => r.status === 'Open').length > 0 && <span style={{ marginLeft: '5px', background: '#F59E0B', color: 'white', borderRadius: '9999px', fontSize: '0.6rem', padding: '1px 5px', fontWeight: 700 }}>{risks.filter(r => r.status === 'Open').length}</span>}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'Overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Financial Summary */}
          {fin && (
            <div style={{ background: 'linear-gradient(135deg, #0D1527 0%, #111B35 100%)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '12px', padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <DollarSign size={15} style={{ color: '#F59E0B' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#F1F5F9' }}>Financial Summary</span>
                <span style={{ fontSize: '0.65rem', padding: '1px 7px', borderRadius: '9999px', background: 'rgba(245,158,11,0.12)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.2)', marginLeft: 'auto' }}>
                  {fin.billing_model} · {fin.currency}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${width >= 768 ? 4 : 2}, 1fr)`, gap: '0.875rem', marginBottom: '1rem' }}>
                {[
                  { label: 'Contract Value', value: fmtSAR(fin.contract_value), color: '#00D4FF', icon: <DollarSign size={14} /> },
                  { label: 'Spent to Date', value: fmtSAR(fin.spent), color: spentPct !== null && spentPct >= 95 ? '#EF4444' : spentPct !== null && spentPct >= 80 ? '#F59E0B' : '#10B981', icon: <TrendingUp size={14} /> },
                  { label: 'Forecast at Completion', value: fmtSAR(fin.forecast), color: '#8B5CF6', icon: <TrendingUp size={14} /> },
                  { label: 'Variance', value: fin.variance === 0 ? 'On Budget' : (fin.variance > 0 ? '+' : '') + fmtSAR(Math.abs(fin.variance)), color: fin.variance <= 0 ? '#34D399' : '#FCA5A5', icon: fin.variance > 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} /> },
                ].map(m => (
                  <div key={m.label} style={{ padding: '0.875rem', borderRadius: '8px', background: `${m.color}08`, border: `1px solid ${m.color}20` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.375rem', color: m.color }}>{m.icon}<span style={{ fontSize: '0.65rem', color: '#475569' }}>{m.label}</span></div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>
              {spentPct !== null && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                    <span style={{ fontSize: '0.7rem', color: '#475569' }}>Budget Utilization</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: spentPct >= 95 ? '#FCA5A5' : spentPct >= 80 ? '#FCD34D' : '#34D399' }}>{spentPct}% spent · Forecast {forecastPct}%</span>
                  </div>
                  <div style={{ height: '6px', borderRadius: '9999px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${spentPct}%`, background: `linear-gradient(90deg, ${spentPct >= 95 ? '#EF4444' : spentPct >= 80 ? '#F59E0B' : '#10B981'}, ${spentPct >= 95 ? '#FCA5A5' : spentPct >= 80 ? '#FCD34D' : '#34D399'})`, borderRadius: '9999px', transition: 'width 0.6s ease' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.375rem' }}>
                    <span style={{ fontSize: '0.65rem', color: '#334155' }}>Last Invoice: {fin.last_invoice || '—'}</span>
                    <span style={{ fontSize: '0.65rem', color: '#F59E0B' }}>Next Milestone: {fmtSAR(fin.next_milestone_value)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Milestone Tracker */}
          {milestones.length > 0 && (
            <div className="section-card">
              <div className="section-card-header">
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Milestone Tracker</span>
                <span style={{ fontSize: '0.7rem', color: '#475569' }}>{milestones.filter(m => m.status !== 'Completed').length} active</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ minWidth: '560px' }}>
                  <thead><tr><th>Milestone</th><th>Due Date</th><th>Progress</th><th>Value</th><th>Owner</th><th>Status</th></tr></thead>
                  <tbody>
                    {milestones.map(ms => {
                      const sc = milestoneStatusColor[ms.status] ?? '#475569';
                      return (
                        <tr key={ms.id}>
                          <td><div style={{ fontSize: '0.82rem', fontWeight: 500, color: '#F1F5F9' }}>{ms.title}</div></td>
                          <td style={{ fontSize: '0.78rem', color: '#475569' }}>{ms.due_date}</td>
                          <td style={{ minWidth: '120px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ flex: 1, height: '5px', borderRadius: '9999px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${ms.completion_pct}%`, background: `linear-gradient(90deg, ${sc}, ${sc}cc)`, borderRadius: '9999px' }} />
                              </div>
                              <span style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 600, flexShrink: 0 }}>{ms.completion_pct}%</span>
                            </div>
                          </td>
                          <td style={{ fontSize: '0.78rem', color: '#F59E0B', fontWeight: 600 }}>{fmtSAR(ms.value)}</td>
                          <td><div className="avatar" style={{ width: '22px', height: '22px', fontSize: '0.58rem' }}>{ms.owner}</div></td>
                          <td><span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', background: `${sc}15`, color: sc, border: `1px solid ${sc}25` }}>{ms.status}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 2-col: Recent Docs + Open Actions */}
          <div style={{ display: 'grid', gridTemplateColumns: isTablet ? '1fr' : '1fr 1fr', gap: '1rem' }}>
            <div className="section-card">
              <div className="section-card-header">
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Recent Documents</span>
                <button className="btn-ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }} onClick={() => setActiveTab('Documents')}>View All</button>
              </div>
              <div>
                {docs.slice(0, 4).map((doc, i) => (
                  <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1.25rem', borderBottom: i < Math.min(docs.length, 4) - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', cursor: 'pointer' }}
                    onClick={() => { if (doc.file_url) window.open(doc.file_url, '_blank'); else navigate(`/documents/${doc.id}`); }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ padding: '0.375rem', borderRadius: '6px', background: `${doc.type_color}15`, color: doc.type_color, flexShrink: 0 }}><FileText size={13} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>
                      <div style={{ fontSize: '0.7rem', color: '#475569' }}>{doc.date} · {doc.pages} pages</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <span className={`status-${doc.status === 'Approved' ? 'approved' : doc.status === 'Under Review' ? 'review' : 'draft'}`} style={{ fontSize: '0.65rem' }}>{doc.status}</span>
                      {doc.file_url && <Download size={12} style={{ color: '#38BDF8' }} />}
                    </div>
                  </div>
                ))}
                {docs.length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: '#334155', fontSize: '0.8rem' }}>No documents yet</div>}
              </div>
            </div>

            <div className="section-card">
              <div className="section-card-header">
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Open Actions</span>
                <button className="btn-ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }} onClick={() => setActiveTab('Tasks')}>View All</button>
              </div>
              <div>
                {openTasks.slice(0, 4).map((task, i) => (
                  <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1.25rem', borderBottom: i < Math.min(openTasks.length, 4) - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '9999px', background: task.priority === 'High' ? '#EF4444' : task.priority === 'Medium' ? '#F59E0B' : '#10B981', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</div>
                      <div style={{ fontSize: '0.7rem', color: '#475569' }}>Due: {task.due_date} · {task.assignee}</div>
                    </div>
                    <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: task.status === 'Overdue' ? 'rgba(239,68,68,0.15)' : 'rgba(14,165,233,0.1)', color: task.status === 'Overdue' ? '#FCA5A5' : '#38BDF8', border: `1px solid ${task.status === 'Overdue' ? 'rgba(239,68,68,0.2)' : 'rgba(14,165,233,0.15)'}` }}>
                      {task.status}
                    </span>
                  </div>
                ))}
                {openTasks.length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: '#334155', fontSize: '0.8rem' }}>No open tasks</div>}
              </div>
            </div>
          </div>

          {/* Upcoming Meetings + Open Risks */}
          <div style={{ display: 'grid', gridTemplateColumns: isTablet ? '1fr' : '1fr 1fr', gap: '1rem' }}>
            <div className="section-card">
              <div className="section-card-header">
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Upcoming Meetings</span>
                <button className="btn-ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }} onClick={() => setActiveTab('Meetings')}>View All</button>
              </div>
              <div>
                {upcomingMeetings.slice(0, 3).map((mtg, i) => (
                  <div key={mtg.id} style={{ display: 'flex', gap: '0.75rem', padding: '0.875rem 1.25rem', borderBottom: i < Math.min(upcomingMeetings.length, 3) - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', cursor: 'pointer' }}
                    onClick={() => navigate(`/meetings/${mtg.id}`)}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ padding: '0.375rem', borderRadius: '6px', background: `${meetingTypeColors[mtg.type] ?? '#8B5CF6'}15`, color: meetingTypeColors[mtg.type] ?? '#8B5CF6', flexShrink: 0 }}><Video size={13} /></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#F1F5F9' }}>{mtg.title}</div>
                      <div style={{ fontSize: '0.7rem', color: '#475569' }}>{mtg.date} · {mtg.time} · {mtg.duration}</div>
                    </div>
                    <ExternalLink size={13} style={{ color: '#334155' }} />
                  </div>
                ))}
                {upcomingMeetings.length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: '#334155', fontSize: '0.8rem' }}>No upcoming meetings</div>}
              </div>
            </div>

            <div className="section-card">
              <div className="section-card-header">
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Open Risks</span>
                <button className="btn-ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }} onClick={() => setActiveTab('Risks')}>View All</button>
              </div>
              <div>
                {risks.filter(r => r.status === 'Open' || r.status === 'Monitoring').slice(0, 3).map((risk, i, arr) => {
                  const sc = risk.severity === 'Critical' ? '#EF4444' : risk.severity === 'High' ? '#F59E0B' : '#10B981';
                  return (
                    <div key={risk.id} style={{ display: 'flex', gap: '0.75rem', padding: '0.875rem 1.25rem', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: sc, boxShadow: `0 0 4px ${sc}80`, flexShrink: 0, marginTop: '5px' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{risk.title}</div>
                        <div style={{ fontSize: '0.7rem', color: '#475569' }}>{risk.category} · P{risk.probability}×I{risk.impact}</div>
                      </div>
                      <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: `${sc}15`, color: sc, border: `1px solid ${sc}25`, flexShrink: 0 }}>{risk.severity}</span>
                    </div>
                  );
                })}
                {risks.filter(r => r.status === 'Open' || r.status === 'Monitoring').length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: '#334155', fontSize: '0.8rem' }}>No open risks</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DOCUMENTS TAB ── */}
      {activeTab === 'Documents' && (
        <div className="section-card">
          <div className="section-card-header">
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>All Documents ({docs.length})</span>
            <button className="btn-primary" style={{ fontSize: '0.8rem' }} onClick={() => setShowDocModal(true)}><Plus size={13} /> Add Document</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Document</th><th>Type</th><th>Date</th><th>Language</th><th>Status</th><th>Pages</th><th></th></tr></thead>
              <tbody>
                {docs.map(doc => (
                  <tr key={doc.id} style={{ cursor: doc.file_url ? 'default' : 'pointer' }}
                    onClick={() => { if (!doc.file_url) navigate(`/documents/${doc.id}`); }}>
                    <td>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#F1F5F9' }}>{doc.name}</div>
                      <div style={{ fontSize: '0.7rem', color: '#475569' }}>{doc.author} · {doc.size}</div>
                    </td>
                    <td><span style={{ fontSize: '0.72rem', padding: '2px 7px', borderRadius: '4px', background: `${doc.type_color}15`, color: doc.type_color, border: `1px solid ${doc.type_color}25` }}>{doc.type}</span></td>
                    <td style={{ fontSize: '0.78rem' }}>{doc.date}</td>
                    <td><span style={{ fontSize: '0.72rem', color: '#38BDF8' }}>{doc.language}</span></td>
                    <td><span className={`status-${doc.status === 'Approved' ? 'approved' : doc.status === 'Under Review' ? 'review' : 'draft'}`} style={{ fontSize: '0.65rem' }}>{doc.status}</span></td>
                    <td style={{ fontSize: '0.78rem' }}>{doc.pages}</td>
                    <td>
                      {doc.file_url ? (
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#38BDF8', textDecoration: 'none', padding: '2px 8px', borderRadius: '4px', background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)' }}>
                          <Download size={11} /> Open
                        </a>
                      ) : (
                        <ExternalLink size={13} style={{ color: '#334155' }} />
                      )}
                    </td>
                  </tr>
                ))}
                {docs.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#334155' }}>No documents yet — add the first one</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MEETINGS TAB ── */}
      {activeTab === 'Meetings' && (
        <div className="section-card">
          <div className="section-card-header">
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Meetings ({meetings.length})</span>
            <button className="btn-primary" style={{ fontSize: '0.8rem' }} onClick={() => setShowMtgModal(true)}><Plus size={13} /> Schedule Meeting</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ minWidth: '640px' }}>
              <thead><tr><th>Meeting</th><th>Type</th><th>Date & Time</th><th>Duration</th><th>Participants</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {meetings.map(mtg => {
                  const tc = meetingTypeColors[mtg.type] ?? '#8B5CF6';
                  return (
                    <tr key={mtg.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/meetings/${mtg.id}`)}>
                      <td>
                        <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#F1F5F9' }}>{mtg.title}</div>
                        {mtg.location && <div style={{ fontSize: '0.7rem', color: '#475569' }}>{mtg.location}</div>}
                      </td>
                      <td><span style={{ fontSize: '0.72rem', padding: '2px 7px', borderRadius: '4px', background: `${tc}15`, color: tc, border: `1px solid ${tc}25` }}>{mtg.type}</span></td>
                      <td style={{ fontSize: '0.78rem', color: '#94A3B8' }}>{mtg.date} · {mtg.time}</td>
                      <td style={{ fontSize: '0.78rem', color: '#94A3B8' }}>{mtg.duration}</td>
                      <td>
                        <div style={{ display: 'flex' }}>
                          {mtg.participants.slice(0, 3).map((p, i) => (
                            <div key={i} title={p} style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'linear-gradient(135deg, #0EA5E9, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 700, color: 'white', border: '2px solid #0D1527', marginLeft: i > 0 ? '-5px' : 0 }}>
                              {p.slice(0, 2)}
                            </div>
                          ))}
                          {mtg.participants.length > 3 && <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', color: '#94A3B8', border: '2px solid #0D1527', marginLeft: '-5px' }}>+{mtg.participants.length - 3}</div>}
                        </div>
                      </td>
                      <td>
                        <span className={mtg.status === 'Completed' ? 'status-approved' : mtg.status === 'In Progress' ? 'status-active' : 'status-pending'} style={{ fontSize: '0.65rem' }}>{mtg.status}</span>
                        {mtg.minutes_generated && <span style={{ marginLeft: '4px', fontSize: '0.6rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(16,185,129,0.15)', color: '#34D399', border: '1px solid rgba(16,185,129,0.2)' }}>Minutes</span>}
                      </td>
                      <td><ExternalLink size={13} style={{ color: '#334155' }} /></td>
                    </tr>
                  );
                })}
                {meetings.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#334155' }}>No meetings yet — schedule one</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TASKS TAB ── */}
      {activeTab === 'Tasks' && (
        <div className="section-card">
          <div className="section-card-header">
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Tasks ({tasks.length})</span>
            <button className="btn-primary" style={{ fontSize: '0.8rem' }} onClick={() => setShowTaskModal(true)}><Plus size={13} /> New Task</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Task</th><th>Priority</th><th>Status</th><th>Due Date</th><th>Assignee</th><th>Actions</th></tr></thead>
              <tbody>
                {tasks.map(task => (
                  <tr key={task.id}>
                    <td>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#F1F5F9' }}>{task.title}</div>
                      {task.description && <div style={{ fontSize: '0.7rem', color: '#475569' }}>{task.description.slice(0, 60)}{task.description.length > 60 ? '…' : ''}</div>}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.72rem', padding: '2px 7px', borderRadius: '4px', background: task.priority === 'High' ? 'rgba(239,68,68,0.15)' : task.priority === 'Medium' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)', color: task.priority === 'High' ? '#FCA5A5' : task.priority === 'Medium' ? '#FCD34D' : '#34D399' }}>
                        {task.priority}
                      </span>
                    </td>
                    <td>
                      <span className={task.status === 'Overdue' ? 'status-risk-high' : task.status === 'Completed' ? 'status-approved' : task.status === 'In Progress' ? 'status-active' : 'status-review'} style={{ fontSize: '0.65rem' }}>
                        {task.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.78rem', color: task.status === 'Overdue' ? '#FCA5A5' : '#94A3B8' }}>{task.due_date}</td>
                    <td><div className="avatar" style={{ width: '24px', height: '24px', fontSize: '0.62rem' }}>{task.assignee.slice(0, 2).toUpperCase()}</div></td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.375rem' }}>
                        {task.status !== 'Completed' && (
                          <button
                            className="btn-ghost"
                            style={{ fontSize: '0.68rem', padding: '2px 8px', height: 'auto', opacity: updatingTaskId === task.id ? 0.5 : 1 }}
                            disabled={updatingTaskId === task.id}
                            onClick={() => handleUpdateTaskStatus(
                              task.id,
                              task.status === 'Backlog' ? 'In Progress'
                              : task.status === 'In Progress' ? 'In Review'
                              : 'Completed'
                            )}
                          >
                            {updatingTaskId === task.id ? '…'
                              : task.status === 'Backlog' ? '▶ Start'
                              : task.status === 'In Progress' ? '⟳ Review'
                              : '✓ Complete'}
                          </button>
                        )}
                        {task.status === 'Completed' && (
                          <span style={{ fontSize: '0.68rem', color: '#34D399' }}>✓ Done</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {tasks.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#334155' }}>No tasks yet — create the first one</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── RISKS TAB ── */}
      {activeTab === 'Risks' && (
        <div className="section-card">
          <div className="section-card-header">
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Risk Register ({risks.length})</span>
            <button className="btn-primary" style={{ fontSize: '0.8rem' }} onClick={() => setShowRiskModal(true)}><Plus size={13} /> Log Risk</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>ID</th><th>Risk</th><th>Category</th><th>P×I</th><th>Severity</th><th>Status</th><th>Owner</th>{!isMobile && <th>Exposure</th>}</tr></thead>
              <tbody>
                {risks.map(risk => (
                  <tr key={risk.id}>
                    <td style={{ color: '#EF4444', fontSize: '0.75rem' }}>{risk.id}</td>
                    <td>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#F1F5F9' }}>{risk.title}</div>
                      <div style={{ fontSize: '0.7rem', color: '#475569' }}>{risk.mitigation.slice(0, 60)}{risk.mitigation.length > 60 ? '…' : ''}</div>
                    </td>
                    <td style={{ fontSize: '0.78rem' }}>{risk.category}</td>
                    <td>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                        background: risk.probability * risk.impact >= 17 ? 'rgba(239,68,68,0.15)' : risk.probability * risk.impact >= 10 ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
                        color: risk.probability * risk.impact >= 17 ? '#FCA5A5' : risk.probability * risk.impact >= 10 ? '#FCD34D' : '#34D399',
                      }}>
                        {risk.probability}×{risk.impact}={risk.probability * risk.impact}
                      </span>
                    </td>
                    <td><span className={`status-risk-${risk.severity.toLowerCase()}`}>{risk.severity}</span></td>
                    <td><span className={risk.status === 'Mitigated' || risk.status === 'Closed' ? 'status-approved' : risk.status === 'Monitoring' ? 'status-review' : 'status-pending'} style={{ fontSize: '0.65rem' }}>{risk.status}</span></td>
                    <td><div className="avatar" style={{ width: '24px', height: '24px', fontSize: '0.62rem' }}>{risk.owner.split(' ').map(n => n[0]).join('').slice(0, 2)}</div></td>
                    {!isMobile && <td style={{ fontSize: '0.78rem', color: '#F59E0B', fontWeight: 600 }}>{risk.financial_exposure ? fmtSAR(risk.financial_exposure) : '—'}</td>}
                  </tr>
                ))}
                {risks.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#334155' }}>No risks logged yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── NEW TASK MODAL ── */}
      {showTaskModal && (
        <Modal title="New Task" onClose={() => { closeModal(setShowTaskModal); setTaskError(''); }}>
          {taskError && <ErrorBanner msg={taskError} />}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <Field label="Task Title *">
              <input style={inputStyle} type="text" value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Complete stakeholder analysis" />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Field label="Priority">
                <select style={selectStyle} value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value as 'High' | 'Medium' | 'Low' }))}>
                  <option>High</option><option>Medium</option><option>Low</option>
                </select>
              </Field>
              <Field label="Due Date *">
                <input style={selectStyle} type="date" value={taskForm.due_date} onChange={e => setTaskForm(f => ({ ...f, due_date: e.target.value }))} />
              </Field>
            </div>
            <Field label="Assignee *">
              <input style={inputStyle} type="text" value={taskForm.assignee} onChange={e => setTaskForm(f => ({ ...f, assignee: e.target.value }))} placeholder="e.g. AM" />
            </Field>
            <Field label="Description">
              <textarea style={{ ...inputStyle, resize: 'vertical' }} value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional…" rows={2} />
            </Field>
            <ModalFooter onCancel={() => { closeModal(setShowTaskModal); setTaskError(''); }} onConfirm={handleCreateTask} saving={taskSaving} label="Create Task" />
          </div>
        </Modal>
      )}

      {/* ── NEW DOCUMENT MODAL ── */}
      {showDocModal && (
        <Modal title="Add Document" onClose={() => { closeModal(setShowDocModal); setDocError(''); setDocForm({ name: '', type: 'BRD', language: 'EN', status: 'Draft', author: '', pages: '1', summary: '', file: null }); }}>
          {docError && <ErrorBanner msg={docError} />}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

            {/* File drop zone */}
            <div
              style={{ border: `2px dashed ${docForm.file ? '#10B981' : 'rgba(255,255,255,0.12)'}`, borderRadius: '0.75rem', padding: '1.25rem', textAlign: 'center', cursor: 'pointer', background: docForm.file ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.02)', transition: 'all 0.2s' }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); }}
              onDrop={e => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) {
                  setDocForm(f => ({ ...f, file, name: f.name || file.name.replace(/\.[^.]+$/, '') }));
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: 'none' }}
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.png,.jpg,.jpeg"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) setDocForm(f => ({ ...f, file, name: f.name || file.name.replace(/\.[^.]+$/, '') }));
                }}
              />
              {docForm.file ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.625rem' }}>
                  <FileText size={20} style={{ color: '#10B981' }} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#F1F5F9' }}>{docForm.file.name}</div>
                    <div style={{ fontSize: '0.72rem', color: '#475569' }}>
                      {docForm.file.size >= 1_048_576 ? `${(docForm.file.size / 1_048_576).toFixed(1)} MB` : `${(docForm.file.size / 1024).toFixed(0)} KB`}
                      {' · '}
                      <span style={{ color: '#10B981', cursor: 'pointer' }} onClick={e => { e.stopPropagation(); setDocForm(f => ({ ...f, file: null })); }}>Remove</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <Upload size={24} style={{ color: '#475569', marginBottom: '0.5rem' }} />
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94A3B8' }}>Click or drag & drop a file</div>
                  <div style={{ fontSize: '0.72rem', color: '#334155', marginTop: '0.25rem' }}>PDF, Word, PowerPoint, Excel, images (optional)</div>
                </div>
              )}
            </div>

            {/* Upload progress */}
            {docSaving && docUploadPct > 0 && docUploadPct < 100 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.72rem', color: '#475569' }}>Uploading…</span>
                  <span style={{ fontSize: '0.72rem', color: '#38BDF8' }}>{docUploadPct}%</span>
                </div>
                <div style={{ height: '4px', borderRadius: '9999px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${docUploadPct}%`, background: 'linear-gradient(90deg, #0EA5E9, #00D4FF)', borderRadius: '9999px', transition: 'width 0.3s ease' }} />
                </div>
              </div>
            )}

            <Field label="Document Name *">
              <input style={inputStyle} type="text" value={docForm.name} onChange={e => setDocForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Phase 1 BRD v1.0" />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Field label="Type">
                <select style={selectStyle} value={docForm.type} onChange={e => setDocForm(f => ({ ...f, type: e.target.value }))}>
                  {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select style={selectStyle} value={docForm.status} onChange={e => setDocForm(f => ({ ...f, status: e.target.value as NewDocForm['status'] }))}>
                  <option>Draft</option><option>Under Review</option><option>Approved</option><option>Final</option>
                </select>
              </Field>
              <Field label="Language">
                <select style={selectStyle} value={docForm.language} onChange={e => setDocForm(f => ({ ...f, language: e.target.value as NewDocForm['language'] }))}>
                  <option>EN</option><option>AR</option><option>Bilingual</option>
                </select>
              </Field>
              <Field label="Pages">
                <input style={selectStyle} type="number" min="1" value={docForm.pages} onChange={e => setDocForm(f => ({ ...f, pages: e.target.value }))} />
              </Field>
            </div>
            <Field label="Author *">
              <input style={inputStyle} type="text" value={docForm.author} onChange={e => setDocForm(f => ({ ...f, author: e.target.value }))} placeholder="e.g. Ahmed Al-Mahmoud" />
            </Field>
            <Field label="Summary">
              <textarea style={{ ...inputStyle, resize: 'vertical' }} value={docForm.summary} onChange={e => setDocForm(f => ({ ...f, summary: e.target.value }))} placeholder="Brief description…" rows={2} />
            </Field>
            <ModalFooter onCancel={() => { closeModal(setShowDocModal); setDocError(''); setDocForm({ name: '', type: 'BRD', language: 'EN', status: 'Draft', author: '', pages: '1', summary: '', file: null }); }} onConfirm={handleCreateDoc} saving={docSaving} label={docForm.file ? 'Upload & Save' : 'Save Document'} />
          </div>
        </Modal>
      )}

      {/* ── NEW MEETING MODAL ── */}
      {showMtgModal && (
        <Modal title="Schedule Meeting" onClose={() => { closeModal(setShowMtgModal); setMtgError(''); }}>
          {mtgError && <ErrorBanner msg={mtgError} />}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <Field label="Meeting Title *">
              <input style={inputStyle} type="text" value={mtgForm.title} onChange={e => setMtgForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Steering Committee Review" />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Field label="Type">
                <select style={selectStyle} value={mtgForm.type} onChange={e => setMtgForm(f => ({ ...f, type: e.target.value as NewMeetingForm['type'] }))}>
                  {MEETING_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Date *">
                <input style={selectStyle} type="date" value={mtgForm.date} onChange={e => setMtgForm(f => ({ ...f, date: e.target.value }))} />
              </Field>
              <Field label="Time *">
                <input style={selectStyle} type="time" value={mtgForm.time} onChange={e => setMtgForm(f => ({ ...f, time: e.target.value }))} />
              </Field>
              <Field label="Duration">
                <input style={inputStyle} type="text" value={mtgForm.duration} onChange={e => setMtgForm(f => ({ ...f, duration: e.target.value }))} placeholder="e.g. 1h, 90m, 2h" />
              </Field>
            </div>
            <Field label="Location">
              <input style={inputStyle} type="text" value={mtgForm.location} onChange={e => setMtgForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. HQ Boardroom A, Virtual – Teams" />
            </Field>
            <Field label="Participants (comma-separated)">
              <input style={inputStyle} type="text" value={mtgForm.participants} onChange={e => setMtgForm(f => ({ ...f, participants: e.target.value }))} placeholder="e.g. AM, SK, Client-CEO" />
            </Field>
            <ModalFooter onCancel={() => { closeModal(setShowMtgModal); setMtgError(''); }} onConfirm={handleCreateMeeting} saving={mtgSaving} label="Schedule Meeting" />
          </div>
        </Modal>
      )}

      {/* ── NEW RISK MODAL ── */}
      {showRiskModal && (
        <Modal title="Log Risk" onClose={() => { closeModal(setShowRiskModal); setRiskError(''); }}>
          {riskError && <ErrorBanner msg={riskError} />}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <Field label="Risk Title *">
              <input style={inputStyle} type="text" value={riskForm.title} onChange={e => setRiskForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Key stakeholder unavailability" />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Field label="Category">
                <select style={selectStyle} value={riskForm.category} onChange={e => setRiskForm(f => ({ ...f, category: e.target.value }))}>
                  {RISK_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Severity">
                <select style={selectStyle} value={riskForm.severity} onChange={e => setRiskForm(f => ({ ...f, severity: e.target.value as NewRiskForm['severity'] }))}>
                  <option>Critical</option><option>High</option><option>Medium</option><option>Low</option>
                </select>
              </Field>
              <Field label="Probability (1–5)">
                <select style={selectStyle} value={riskForm.probability} onChange={e => setRiskForm(f => ({ ...f, probability: e.target.value }))}>
                  {['1','2','3','4','5'].map(n => <option key={n}>{n}</option>)}
                </select>
              </Field>
              <Field label="Impact (1–5)">
                <select style={selectStyle} value={riskForm.impact} onChange={e => setRiskForm(f => ({ ...f, impact: e.target.value }))}>
                  {['1','2','3','4','5'].map(n => <option key={n}>{n}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Owner *">
              <input style={inputStyle} type="text" value={riskForm.owner} onChange={e => setRiskForm(f => ({ ...f, owner: e.target.value }))} placeholder="e.g. AM" />
            </Field>
            <Field label="Mitigation Plan">
              <textarea style={{ ...inputStyle, resize: 'vertical' }} value={riskForm.mitigation} onChange={e => setRiskForm(f => ({ ...f, mitigation: e.target.value }))} placeholder="Describe mitigation actions…" rows={2} />
            </Field>
            <Field label="Financial Exposure (SAR)">
              <input style={inputStyle} type="number" min="0" value={riskForm.financial_exposure} onChange={e => setRiskForm(f => ({ ...f, financial_exposure: e.target.value }))} placeholder="e.g. 500000" />
            </Field>
            <ModalFooter onCancel={() => { closeModal(setShowRiskModal); setRiskError(''); }} onConfirm={handleCreateRisk} saving={riskSaving} label="Log Risk" />
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Shared modal sub-components ──────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#0D1527', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1rem', padding: '1.75rem', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#F1F5F9' }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '4px' }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div style={{ padding: '0.75rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: '#FCA5A5', fontSize: '0.8rem', marginBottom: '1rem' }}>{msg}</div>
  );
}

function ModalFooter({ onCancel, onConfirm, saving, label }: { onCancel: () => void; onConfirm: () => void; saving: boolean; label: string }) {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.25rem' }}>
      <button className="btn-ghost" onClick={onCancel}>Cancel</button>
      <button className="btn-primary" onClick={onConfirm} disabled={saving}>{saving ? 'Saving…' : label}</button>
    </div>
  );
}
