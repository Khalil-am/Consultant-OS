import { useState, useEffect, useMemo } from 'react';
import {
  Download, Calendar, Sparkles, Clock, FileText, Search, X, Zap,
  Trash2, CheckSquare, Square, Loader2,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useLayout } from '../hooks/useLayout';
import {
  getReports, getWorkspaces, getTasks, getRisks, getMilestones, upsertReport, deleteReport,
} from '../lib/db';
import type { ReportRow } from '../lib/db';
import { chatWithDocument } from '../lib/openrouter';
import { Badge, cn, fadeUp, stagger } from '../components/ui';

const REPORT_TYPES = [
  'Status Report', 'Weekly Status Report', 'Monthly Progress Report',
  'Steering Committee Pack', 'Procurement Summary', 'Board Executive Summary',
  'Risk Report', 'KPI Dashboard',
] as const;

const FILTER_TABS = ['All Reports', 'Weekly Status', 'Monthly Reports', 'Board Summaries'] as const;

const BOARD_PACK_CHECKS = [
  { label: 'Executive Summary' },
  { label: 'Financial Overview' },
  { label: 'Risk Register' },
] as const;

function formatReportDate(dateStr: string) {
  const today = new Date();
  const d = new Date(dateStr);
  const diff = Math.floor((today.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff} days ago`;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusTone(s: string): 'success' | 'review' | 'neutral' | 'brand' {
  if (s === 'Generated' || s === 'Final' || s === 'Signed') return 'success';
  if (s === 'Scheduled') return 'review';
  if (s === 'Draft') return 'neutral';
  return 'brand';
}

export default function Reports() {
  const { isMobile } = useLayout();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [workspaceList, setWorkspaceList] = useState<{ id: string; name: string }[]>([]);

  const [reportType, setReportType] = useState<string>('Status Report');
  const [selectedWorkspace, setSelectedWorkspace] = useState('All Workspaces');
  const [reportPeriod, setReportPeriod] = useState('This Week (W10)');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [generatedReport, setGeneratedReport] = useState('');
  const [reportError, setReportError] = useState('');
  const [savingReport, setSavingReport] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [generatingPack, setGeneratingPack] = useState<string | null>(null);
  const [boardPackChecked, setBoardPackChecked] = useState<Set<number>>(new Set([0, 1]));

  const [search, setSearch] = useState('');
  const [reportFilter, setReportFilter] = useState<string>('All Reports');

  useEffect(() => {
    getReports().then(setReports).catch(() => {});
    getWorkspaces().then((ws) => setWorkspaceList(ws.map((w) => ({ id: w.id, name: w.name })))).catch(() => {});
  }, []);

  const stats = useMemo(() => [
    { label: 'Total Generated', value: reports.filter((r) => r.status === 'Generated').length, color: '#A78BFA', Icon: FileText },
    { label: 'Scheduled',       value: reports.filter((r) => r.status === 'Scheduled').length, color: '#63E6BE', Icon: Calendar },
    { label: 'Total Reports',   value: reports.length,                                          color: '#7DD3FC', Icon: Zap },
  ], [reports]);

  async function handleGenerateReport() {
    setGeneratingReport(true);
    setGeneratedReport('');
    setReportError('');
    try {
      const [workspaces, tasks, risks, milestones] = await Promise.all([
        getWorkspaces(), getTasks(), getRisks(), getMilestones(),
      ]);
      const wsFilter = selectedWorkspace === 'All Workspaces'
        ? workspaces
        : workspaces.filter((w) => w.name === selectedWorkspace);
      const ctx = wsFilter.slice(0, 4).map((ws) => {
        const wsT = tasks.filter((t) => t.workspace_id === ws.id);
        const wsR = risks.filter((r) => r.workspace_id === ws.id);
        const wsM = milestones.filter((m) => m.workspace_id === ws.id);
        return `**${ws.name}** (${ws.status}, ${ws.progress}%)\n  Tasks: ${wsT.length} total, ${wsT.filter((t) => t.status === 'Overdue').length} overdue\n  Risks: ${wsR.filter((r) => r.severity === 'Critical').length} critical, ${wsR.filter((r) => r.status === 'Open').length} open\n  Milestones: ${wsM.filter((m) => m.status === 'On Track').length} on track, ${wsM.filter((m) => m.status === 'At Risk').length} at risk`;
      }).join('\n\n');

      const result = await chatWithDocument(
        [{ role: 'user', content: `Generate a ${reportType} for ${selectedWorkspace}, period: ${reportPeriod}.\n\nPortfolio Data:\n${ctx || 'No data available.'}` }],
        `You are a senior consultant generating a ${reportType}. Produce a professional structured report (Executive Summary · Highlights · Concerns · Recommendations) using markdown.`,
      );
      setGeneratedReport(result);
    } catch (e: unknown) {
      setReportError(e instanceof Error ? e.message : 'Report generation failed');
    } finally {
      setGeneratingReport(false);
    }
  }

  async function handleSaveReport() {
    if (!generatedReport) return;
    setSavingReport(true);
    try {
      const wsMatch = workspaceList.find((w) => w.name === selectedWorkspace);
      const saved = await upsertReport({
        id: crypto.randomUUID(),
        title: `${reportType} — ${reportPeriod}`,
        type: reportType.replace(' Report', '').replace(' Pack', '').replace(' Summary', ''),
        type_color: '#A78BFA',
        workspace: selectedWorkspace,
        workspace_id: wsMatch?.id ?? null,
        date: new Date().toISOString().slice(0, 10),
        status: 'Generated',
        pages: Math.ceil(generatedReport.length / 2000),
        period: reportPeriod,
        author: 'Consultant OS AI',
      });
      setReports((prev) => [saved, ...prev]);
      setGeneratedReport('');
    } catch (e: unknown) {
      setReportError(e instanceof Error ? e.message : 'Failed to save report');
    } finally {
      setSavingReport(false);
    }
  }

  async function handleGeneratePack(title: string) {
    setGeneratingPack(title);
    try {
      const [workspaces, tasks, risks] = await Promise.all([getWorkspaces(), getTasks(), getRisks()]);
      const ctx = workspaces.slice(0, 6).map((ws) => {
        const wsT = tasks.filter((t) => t.workspace_id === ws.id);
        const wsR = risks.filter((r) => r.workspace_id === ws.id);
        return `${ws.name}: ${ws.status}, ${ws.progress}%, ${wsT.filter((t) => t.status === 'Overdue').length} overdue, ${wsR.filter((r) => r.severity === 'Critical').length} critical risks`;
      }).join('\n');
      const result = await chatWithDocument(
        [{ role: 'user', content: `Generate a ${title} board pack.\n\nPortfolio summary:\n${ctx}` }],
        `You are a senior consultant. Generate a professional ${title} in structured markdown including KPIs, RAG, decisions needed, recommendations.`,
      );
      const saved = await upsertReport({
        id: crypto.randomUUID(),
        title, type: 'Board Summary', type_color: '#A78BFA',
        workspace: 'All Workspaces', workspace_id: null,
        date: new Date().toISOString().slice(0, 10), status: 'Generated',
        pages: Math.ceil(result.length / 2000), period: 'Current', author: 'Consultant OS AI',
      });
      setReports((prev) => [saved, ...prev]);
    } catch { /* silent */ }
    finally { setGeneratingPack(null); }
  }

  function handleDownloadReport(r: ReportRow) {
    const content = `${r.title}\n${'='.repeat(r.title.length)}\n\nType: ${r.type}\nWorkspace: ${r.workspace}\nPeriod: ${r.period}\nDate: ${r.date}\nAuthor: ${r.author}\nStatus: ${r.status}\n`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${r.title.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteReport(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch { /* ignore */ }
    finally { setDeletingId(null); }
  }

  const filtered = reports.filter((r) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || r.title.toLowerCase().includes(q) || (r.workspace ?? '').toLowerCase().includes(q);
    const matchesFilter =
      reportFilter === 'All Reports' ? true :
      reportFilter === 'Weekly Status' ? (r.type === 'Weekly Status' || (r.type ?? '').toLowerCase().includes('weekly')) :
      reportFilter === 'Monthly Reports' ? ((r.type ?? '').toLowerCase().includes('monthly')) :
      reportFilter === 'Board Summaries' ? (r.type === 'Board Summary') :
      true;
    return matchesSearch && matchesFilter;
  });

  return (
    <motion.div
      initial="hidden" animate="show"
      variants={{ hidden: {}, show: { transition: stagger(0.05, 0.08) } }}
      className="screen-container"
    >
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-[1.5rem] md:text-[1.75rem] font-semibold tracking-[-0.025em] leading-tight text-white">Reports</h1>
          <p className="text-[0.78rem] text-[color:var(--text-muted)] mt-1">
            {reports.length} total · {stats[0].value} generated · {stats[1].value} scheduled
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex items-center gap-2 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-md px-3.5 h-[38px] w-full sm:w-[260px]">
            <Search size={14} className="text-[color:var(--text-muted)] flex-shrink-0" />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reports..."
              className="flex-1 bg-transparent border-0 outline-none text-[0.83rem] text-white placeholder:text-[color:var(--text-faint)] min-w-0"
            />
            {search && <button onClick={() => setSearch('')} className="text-[color:var(--text-muted)] hover:text-white"><X size={13} /></button>}
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div
        variants={{ hidden: {}, show: { transition: stagger(0.04, 0.05) } }}
        className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-3')}
      >
        {stats.map((s) => {
          const Icon = s.Icon;
          return (
            <motion.div key={s.label} variants={fadeUp} className="rounded-2xl bg-white/[0.025] border border-white/[0.06] p-3.5">
              <div className="flex items-start justify-between mb-2">
                <div className="text-[0.62rem] font-semibold tracking-[0.1em] uppercase text-[color:var(--text-muted)]">{s.label}</div>
                <Icon size={14} style={{ color: s.color }} className="opacity-70" />
              </div>
              <div className="text-[1.25rem] md:text-[1.4rem] font-bold tabular-nums leading-none" style={{ color: s.color }}>{s.value}</div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Scheduled reports */}
      <motion.div variants={fadeUp} className="section-card">
        <div className="section-card-header">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[rgba(99,230,190,0.16)] text-[#63E6BE] flex items-center justify-center ring-1 ring-[rgba(99,230,190,0.3)]">
              <Calendar size={13} />
            </div>
            <span className="text-[0.9rem] font-bold text-white tracking-tight">Scheduled Reports</span>
          </div>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {[
            { title: 'Weekly PMO Status', schedule: 'Every Monday at 9:00 AM', status: 'Active' },
            { title: 'Monthly Financial', schedule: '1st of month at 8:00 AM', status: 'Active' },
            { title: 'Risk Review',       schedule: 'Every Friday at 3:00 PM', status: 'Paused' },
          ].map((row) => (
            <div key={row.title} className="flex items-center gap-3 px-4 py-3">
              <Clock size={14} className="text-[color:var(--text-muted)] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[0.84rem] font-semibold text-white">{row.title}</div>
                <div className="text-[0.7rem] text-[color:var(--text-muted)] mt-0.5">{row.schedule}</div>
              </div>
              <Badge tone={row.status === 'Active' ? 'success' : 'pending'}>{row.status}</Badge>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Two columns: generator + list */}
      <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'grid-cols-[340px_1fr]')}>

        {/* Generator + Board Pack */}
        <motion.div variants={fadeUp} className="section-card overflow-visible">
          <div className="section-card-header">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#7877C6] to-[#A78BFA] flex items-center justify-center shadow-[0_2px_8px_rgba(120,119,198,0.4)]">
                <Sparkles size={13} className="text-white" />
              </div>
              <span className="text-[0.9rem] font-bold text-white tracking-tight">Generate Report</span>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <Field label="Type">
              <select className="input-field" value={reportType} onChange={(e) => setReportType(e.target.value)}>
                {REPORT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Workspace">
              <select className="input-field" value={selectedWorkspace} onChange={(e) => setSelectedWorkspace(e.target.value)}>
                <option value="All Workspaces">All Workspaces</option>
                {workspaceList.map((w) => <option key={w.id} value={w.name}>{w.name}</option>)}
              </select>
            </Field>
            <Field label="Period">
              <input className="input-field" value={reportPeriod} onChange={(e) => setReportPeriod(e.target.value)} placeholder="e.g. This Week (W10)" />
            </Field>
            <button type="button" className="btn-primary w-full justify-center" onClick={handleGenerateReport} disabled={generatingReport}>
              {generatingReport ? (<><Loader2 size={14} className="animate-spin" /> Generating…</>) : (<><Sparkles size={14} /> Generate Report</>)}
            </button>

            {reportError && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[rgba(255,107,107,0.08)] border border-[rgba(255,107,107,0.22)] text-[#FCA5A5] text-[0.75rem]">
                {reportError}
              </div>
            )}

            {generatedReport && (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3 max-h-[220px] overflow-y-auto text-[0.75rem] text-[color:var(--text-secondary)] whitespace-pre-wrap">
                {generatedReport}
              </div>
            )}
            {generatedReport && (
              <div className="flex items-center gap-2">
                <button type="button" className="btn-primary flex-1 justify-center" onClick={handleSaveReport} disabled={savingReport}>
                  {savingReport ? 'Saving…' : 'Save to Reports'}
                </button>
                <button type="button" className="btn-ghost flex-1 justify-center" onClick={() => setGeneratedReport('')}>Close</button>
              </div>
            )}
          </div>

          {/* Board Pack */}
          <div className="border-t border-white/[0.05] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[0.78rem] font-semibold text-white">Board Pack</span>
              <Sparkles size={12} className="text-[#63E6BE]" />
            </div>
            <div className="space-y-1.5">
              {BOARD_PACK_CHECKS.map((item, idx) => {
                const checked = boardPackChecked.has(idx);
                return (
                  <button
                    type="button"
                    key={item.label}
                    onClick={() => setBoardPackChecked((prev) => {
                      const next = new Set(prev);
                      if (next.has(idx)) next.delete(idx); else next.add(idx);
                      return next;
                    })}
                    className="w-full flex items-center gap-2 text-left text-[0.78rem] text-[color:var(--text-secondary)] hover:text-white"
                  >
                    {checked ? <CheckSquare size={14} className="text-[#A78BFA]" /> : <Square size={14} className="text-[color:var(--text-muted)]" />}
                    {item.label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => handleGeneratePack('Board Pack')}
              disabled={generatingPack === 'Board Pack'}
              className="btn-primary w-full justify-center"
            >
              {generatingPack === 'Board Pack' ? (<><Clock size={13} className="animate-spin" /> Generating…</>) : 'Generate Pack →'}
            </button>
          </div>
        </motion.div>

        {/* Reports list */}
        <motion.div variants={fadeUp} className="section-card">
          <div className="section-card-header flex-wrap gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {FILTER_TABS.map((tab) => {
                const isActive = reportFilter === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    aria-label={tab}
                    onClick={() => setReportFilter(tab)}
                    className={cn(
                      'px-3 py-1 rounded-full text-[0.74rem] font-medium transition-colors border',
                      isActive
                        ? 'bg-[rgba(120,119,198,0.18)] text-white border-[rgba(120,119,198,0.35)]'
                        : 'bg-white/[0.025] border-white/[0.06] text-[color:var(--text-muted)] hover:text-white',
                    )}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <FileText size={24} className="text-[color:var(--text-faint)]" />
                <div className="text-[0.9rem] font-semibold text-white">No reports yet</div>
                <div className="text-[0.76rem] text-[color:var(--text-muted)]">Generate your first report from the panel on the left.</div>
              </div>
            ) : (
              filtered.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${r.type_color}20`, color: r.type_color }}>
                    <FileText size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[0.86rem] font-semibold text-white truncate">{r.title}</div>
                    <div className="text-[0.7rem] text-[color:var(--text-muted)] mt-0.5 truncate">
                      {r.workspace} · {formatReportDate(r.date)} · {r.pages} page{r.pages !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                  <div className="flex items-center gap-1">
                    <button
                      type="button" onClick={() => handleDownloadReport(r)}
                      className="p-1.5 rounded-lg text-[color:var(--text-muted)] hover:text-white hover:bg-white/[0.05] transition-colors"
                      title="Download"
                    >
                      <Download size={12} />
                    </button>
                    <button
                      type="button" onClick={() => handleDelete(r.id)}
                      disabled={deletingId === r.id}
                      className="p-1.5 rounded-lg text-[color:var(--text-muted)] hover:text-[#FCA5A5] hover:bg-[rgba(255,107,107,0.08)] transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[0.68rem] font-semibold tracking-[0.08em] uppercase text-[color:var(--text-muted)] mb-1.5">{label}</label>
      {children}
    </div>
  );
}
