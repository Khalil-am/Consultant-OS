import { useState, useEffect } from 'react';
import { useLayout } from '../hooks/useLayout';
import {
  Download, Calendar, Sparkles, Clock, FileText,
  Search, X, Zap, MoreHorizontal, CheckSquare, Square, Trash2, Pause, Play, Mail, ClipboardCopy,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { getReports, getWorkspaces, getTasks, getRisks, getMilestones, upsertReport, deleteReport } from '../lib/db';
import type { ReportRow } from '../lib/db';
import { chatWithDocument } from '../lib/openrouter';

const reportTypeOptions = [
  'Status Report',
  'Weekly Status Report',
  'Monthly Progress Report',
  'Steering Committee Pack',
  'Procurement Summary',
  'Board Executive Summary',
  'Risk Report',
  'KPI Dashboard',
];

const reportVolumeData = [
  { month: 'Jan', count: 62 },
  { month: 'Feb', count: 78 },
  { month: 'Mar', count: 85 },
  { month: 'Apr', count: 92 },
  { month: 'May', count: 105 },
  { month: 'Jun', count: 98 },
  { month: 'Jul', count: 110 },
  { month: 'Aug', count: 88 },
  { month: 'Sep', count: 115 },
  { month: 'Oct', count: 135 },
  { month: 'Nov', count: 148 },
  { month: 'Dec', count: 168 },
];

const statsData = [
  { label: 'Total Generated', value: '1,284', trend: '\u2191 12%', trendUp: true, color: '#0EA5E9', icon: 'file' as const },
  { label: 'Scheduled', value: '42', trend: '\u2191 5%', trendUp: true, color: '#10B981', icon: 'calendar' as const },
  { label: 'Avg. Gen Time', value: '1.2s', trend: '\u2193 0.3s', trendUp: true, color: '#8B5CF6', icon: 'zap' as const },
];

const boardPackChecks = [
  { label: 'Executive Summary', color: '#0EA5E9' },
  { label: 'Financial Overview', color: '#0EA5E9' },
  { label: 'Risk Register', color: '#94A3B8' },
];

const initialScheduledReports = [
  { id: 'sr-1', title: 'Weekly PMO Status', schedule: 'Every Monday at 9:00 AM', status: 'Active' as 'Active' | 'Paused' },
  { id: 'sr-2', title: 'Monthly Financial', schedule: '1st of month at 8:00 AM', status: 'Active' as 'Active' | 'Paused' },
  { id: 'sr-3', title: 'Risk Review', schedule: 'Every Friday at 3:00 PM', status: 'Paused' as 'Active' | 'Paused' },
];

const iconMap = {
  file: FileText,
  calendar: Calendar,
  zap: Zap,
};

function ReportStatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; border: string; dot: string }> = {
    'Final':     { bg: 'rgba(16,185,129,0.1)',   color: '#34D399', border: 'rgba(16,185,129,0.22)', dot: '#34D399' },
    'Generated': { bg: 'rgba(16,185,129,0.1)',   color: '#34D399', border: 'rgba(16,185,129,0.22)', dot: '#34D399' },
    'Signed':    { bg: 'transparent',             color: '#34D399', border: 'rgba(16,185,129,0.4)',  dot: '' },
    'Draft':     { bg: 'rgba(100,116,139,0.1)',  color: '#94A3B8', border: 'rgba(100,116,139,0.2)', dot: '#94A3B8' },
    'Scheduled': { bg: 'rgba(14,165,233,0.1)',   color: '#38BDF8', border: 'rgba(14,165,233,0.22)', dot: '#38BDF8' },
  };
  const s = map[status] || map['Draft'];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      fontSize: '0.67rem', fontWeight: 700, padding: '2px 8px',
      borderRadius: '9999px', background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      whiteSpace: 'nowrap', letterSpacing: '0.02em',
    }}>
      {s.dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, display: 'inline-block' }} />}
      {status}
    </span>
  );
}

function formatReportDate(dateStr: string) {
  const today = new Date();
  const d = new Date(dateStr);
  const diff = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today, 10:42 AM';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Reports() {
  const { width, isMobile, isTablet } = useLayout();
  const [reportType, setReportType] = useState('Status Report');
  const [selectedWorkspace, setSelectedWorkspace] = useState('All Workspaces');
  const [generatingPack, setGeneratingPack] = useState<string | null>(null);
  const [generatedPacks, setGeneratedPacks] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [reportPeriod, setReportPeriod] = useState('This Week (W10)');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [generatedReport, setGeneratedReport] = useState('');
  const [reportError, setReportError] = useState('');
  const [workspaceList, setWorkspaceList] = useState<{ id: string; name: string }[]>([]);
  const [savingReport, setSavingReport] = useState(false);
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);
  const [boardPackChecked, setBoardPackChecked] = useState<Set<number>>(new Set([0, 1]));
  const [includeAttachments, setIncludeAttachments] = useState(false);
  const [reportFilter, setReportFilter] = useState('All Reports');
  const [reportStatusFilter, setReportStatusFilter] = useState<'All' | 'Draft' | 'Generated' | 'Scheduled'>('All');
  const [reportSort, setReportSort] = useState<'newest' | 'oldest' | 'name' | 'pages' | 'workspace' | 'status' | 'type' | 'author'>('newest');
  const [showAllReports, setShowAllReports] = useState(false);
  const [scheduledReports, setScheduledReports] = useState(() => {
    try {
      const saved = localStorage.getItem('scheduled_reports');
      if (saved) return JSON.parse(saved) as typeof initialScheduledReports;
    } catch { /* ignore */ }
    return initialScheduledReports;
  });
  const [bulkSelectedReports, setBulkSelectedReports] = useState<Set<string>>(new Set());
  const [bulkDeletingReports, setBulkDeletingReports] = useState(false);
  const [runningScheduledId, setRunningScheduledId] = useState<string | null>(null);
  const [runNowToast, setRunNowToast] = useState<string | null>(null);
  const [emailingReport, setEmailingReport] = useState<ReportRow | null>(null);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailToast, setEmailToast] = useState<string | null>(null);
  const [reportCopied, setReportCopied] = useState(false);
  const [starredReports, setStarredReports] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('starred_reports') ?? '[]')); } catch { return new Set(); }
  });
  const [starredOnly, setStarredOnly] = useState(false);
  const [reportsCsvExported, setReportsCsvExported] = useState(false);
  const [reportsTxtExported, setReportsTxtExported] = useState(false);
  const [reportsSummaryCopied, setReportsSummaryCopied] = useState(false);
  const [reportWorkspaceFilter, setReportWorkspaceFilter] = useState<string>('All');
  const [pinnedReports, setPinnedReports] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('pinned_reports') ?? '[]')); } catch { return new Set(); }
  });
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [reportPagesFilter, setReportPagesFilter] = useState<'All' | 'Short' | 'Medium' | 'Long'>('All');

  useEffect(() => {
    getReports().then(setReports).catch(() => {});
    getWorkspaces().then(ws => setWorkspaceList(ws.map(w => ({ id: w.id, name: w.name })))).catch(() => {});
  }, []);

  async function handleGenerateReport() {
    setGeneratingReport(true);
    setGeneratedReport('');
    setReportError('');
    try {
      const [workspaces, tasks, risks, milestones] = await Promise.all([
        getWorkspaces(), getTasks(), getRisks(), getMilestones(),
      ]);
      const wsFilter = selectedWorkspace === 'All Workspaces' ? workspaces : workspaces.filter(w => w.name === selectedWorkspace);
      const contextParts = wsFilter.slice(0, 4).map(ws => {
        const wsTasks = tasks.filter(t => t.workspace_id === ws.id);
        const wsRisks = risks.filter(r => r.workspace_id === ws.id);
        const wsMilestones = milestones.filter(m => m.workspace_id === ws.id);
        return `**${ws.name}** (${ws.status}, ${ws.progress}% progress)
Tasks: ${wsTasks.length} total, ${wsTasks.filter(t => t.status === 'Overdue').length} overdue
Risks: ${wsRisks.filter(r => r.severity === 'Critical').length} critical, ${wsRisks.filter(r => r.status === 'Open').length} open
Milestones: ${wsMilestones.filter(m => m.status === 'On Track').length} on track, ${wsMilestones.filter(m => m.status === 'At Risk').length} at risk`;
      }).join('\n\n');

      const systemPrompt = `You are a senior consultant generating a ${reportType} for a consulting firm.
Generate a professional, structured report based on the live portfolio data below.
Use markdown formatting: **bold** for headers, bullet points for lists.
Be concise but comprehensive. Include: Executive Summary, Key Highlights, Concerns/Risks, Recommendations.`;

      const userMsg = `Generate a ${reportType} for ${selectedWorkspace}, period: ${reportPeriod}.

Portfolio Data:
${contextParts || 'No workspace data available.'}`;

      const result = await chatWithDocument([{ role: 'user', content: userMsg }], systemPrompt);
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
      const wsMatch = workspaceList.find(w => w.name === selectedWorkspace);
      const typeColorMap: Record<string, string> = {
        'Status Report': '#0EA5E9',
        'Weekly Status Report': '#0EA5E9',
        'Monthly Progress Report': '#8B5CF6',
        'Steering Committee Pack': '#10B981',
        'Procurement Summary': '#F59E0B',
        'Board Executive Summary': '#EF4444',
        'Risk Report': '#EF4444',
        'KPI Dashboard': '#00D4FF',
      };
      const saved = await upsertReport({
        id: crypto.randomUUID(),
        title: `${reportType} — ${reportPeriod}`,
        type: reportType.replace(' Report', '').replace(' Pack', '').replace(' Summary', ''),
        type_color: typeColorMap[reportType] ?? '#0EA5E9',
        workspace: selectedWorkspace,
        workspace_id: wsMatch?.id ?? null,
        date: new Date().toISOString().slice(0, 10),
        status: 'Generated',
        pages: Math.ceil(generatedReport.length / 2000),
        period: reportPeriod,
        author: 'Consultant OS AI',
      });
      setReports(prev => [saved, ...prev]);
      setGeneratedReport('');
    } catch (e: unknown) {
      setReportError(e instanceof Error ? e.message : 'Failed to save report');
    } finally {
      setSavingReport(false);
    }
  }

  function handleDownloadReport(report: ReportRow) {
    const content = `${report.title}\n${'='.repeat(report.title.length)}\n\nType: ${report.type}\nWorkspace: ${report.workspace}\nPeriod: ${report.period}\nDate: ${report.date}\nAuthor: ${report.author}\nStatus: ${report.status}\n`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.title.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDownloadGenerated() {
    if (!generatedReport) return;
    const blob = new Blob([generatedReport], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportType.replace(/\s+/g, '_')}_${reportPeriod.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportReportsCSV(reportsToExport: ReportRow[]) {
    if (reportsToExport.length === 0) return;
    const headers = ['Title', 'Type', 'Workspace', 'Period', 'Date', 'Author', 'Status', 'Pages'];
    const rows = reportsToExport.map(r => [
      `"${r.title.replace(/"/g, '""')}"`,
      r.type ?? '',
      `"${(r.workspace ?? '').replace(/"/g, '""')}"`,
      `"${(r.period ?? '').replace(/"/g, '""')}"`,
      r.date ?? '',
      `"${(r.author ?? '').replace(/"/g, '""')}"`,
      r.status ?? '',
      String(r.pages ?? 0),
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reports_export.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setReportsCsvExported(true);
    setTimeout(() => setReportsCsvExported(false), 2000);
  }

  function handleExportReportsTxt(reportsToExport: ReportRow[]) {
    if (reportsToExport.length === 0) return;
    const lines = [
      `Reports Export – Consultant OS`,
      `Total: ${reportsToExport.length}`,
      '',
      ...reportsToExport.map(r => [
        `Title: ${r.title}`,
        `Type: ${r.type ?? 'Unknown'} | Status: ${r.status ?? 'Unknown'}`,
        r.workspace ? `Workspace: ${r.workspace}` : null,
        r.period ? `Period: ${r.period}` : null,
        r.author ? `Author: ${r.author}` : null,
        r.date ? `Date: ${r.date}` : null,
        r.pages ? `Pages: ${r.pages}` : null,
        '',
      ].filter(Boolean).join('\n')),
    ].join('\n');
    const blob = new Blob([lines], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reports_export.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setReportsTxtExported(true);
    setTimeout(() => setReportsTxtExported(false), 2000);
  }

  function handleCopyReportsSummary(reportsToSummarize: ReportRow[]) {
    if (reportsToSummarize.length === 0) return;
    const generated = reportsToSummarize.filter(r => r.status === 'Generated').length;
    const draft = reportsToSummarize.filter(r => r.status === 'Draft').length;
    const scheduled = reportsToSummarize.filter(r => r.status === 'Scheduled').length;
    const lines = [
      `Reports Summary`,
      `Total Reports: ${reportsToSummarize.length}`,
      `Generated: ${generated}`,
      `Draft: ${draft}`,
      `Scheduled: ${scheduled}`,
    ].join('\n');
    navigator.clipboard.writeText(lines).then(() => {
      setReportsSummaryCopied(true);
      setTimeout(() => setReportsSummaryCopied(false), 2000);
    }).catch(() => {});
  }

  function handleCopyGeneratedReport() {
    if (!generatedReport) return;
    navigator.clipboard.writeText(generatedReport).then(() => {
      setReportCopied(true);
      setTimeout(() => setReportCopied(false), 2000);
    }).catch(() => {});
  }

  async function handleDeleteReport(id: string) {
    setDeletingReportId(id);
    try {
      await deleteReport(id);
      setReports(prev => prev.filter(r => r.id !== id));
    } catch {
      // silently fail
    } finally {
      setDeletingReportId(null);
    }
  }

  function toggleScheduledReport(id: string) {
    setScheduledReports(prev => {
      const next = prev.map(sr =>
        sr.id === id ? { ...sr, status: (sr.status === 'Active' ? 'Paused' : 'Active') as 'Active' | 'Paused' } : sr,
      );
      try { localStorage.setItem('scheduled_reports', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  async function handleRunScheduledNow(id: string, title: string) {
    setRunningScheduledId(id);
    try {
      // Simulate sending the scheduled report
      await new Promise(res => setTimeout(res, 800));
      setRunNowToast(`"${title}" sent successfully`);
      setTimeout(() => setRunNowToast(null), 3000);
    } finally {
      setRunningScheduledId(null);
    }
  }

  async function handleSendEmail() {
    if (!emailingReport || !emailRecipient.trim()) return;
    setSendingEmail(true);
    try {
      await new Promise(res => setTimeout(res, 700));
      setEmailToast(`"${emailingReport.title}" emailed to ${emailRecipient.trim()}`);
      setTimeout(() => setEmailToast(null), 3500);
    } finally {
      setSendingEmail(false);
      setEmailingReport(null);
      setEmailRecipient('');
    }
  }

  async function handleBulkDeleteReports() {
    if (bulkSelectedReports.size === 0) return;
    setBulkDeletingReports(true);
    try {
      await Promise.all([...bulkSelectedReports].map(id => deleteReport(id)));
      setReports(prev => prev.filter(r => !bulkSelectedReports.has(r.id)));
      setBulkSelectedReports(new Set());
    } catch { /* silently fail */ }
    setBulkDeletingReports(false);
  }

  function toggleBulkSelectReport(id: string) {
    setBulkSelectedReports(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAllReports() {
    if (bulkSelectedReports.size === recentReports.length && recentReports.length > 0) {
      setBulkSelectedReports(new Set());
    } else {
      setBulkSelectedReports(new Set(recentReports.map(r => r.id)));
    }
  }

  const filtered = (() => {
    const base = reports.filter(r => {
      const matchesSearch = !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.workspace?.toLowerCase().includes(search.toLowerCase());
      const matchesFilter =
        reportFilter === 'All Reports' ? true :
        reportFilter === 'Weekly Status' ? (r.type === 'Weekly Status' || r.type?.toLowerCase().includes('weekly')) :
        reportFilter === 'Monthly Reports' ? (r.type?.toLowerCase().includes('monthly')) :
        reportFilter === 'Board Summaries' ? (r.type === 'Board Summary') :
        true;
      const matchesStatus = reportStatusFilter === 'All' || r.status === reportStatusFilter;
      const matchesStarred = !starredOnly || starredReports.has(r.id ?? '');
      const matchesPinned = !pinnedOnly || pinnedReports.has(r.id ?? '');
      const matchesWorkspace = reportWorkspaceFilter === 'All' || r.workspace === reportWorkspaceFilter;
      const matchesPages = reportPagesFilter === 'All' ? true : reportPagesFilter === 'Short' ? (r.pages ?? 0) < 5 : reportPagesFilter === 'Medium' ? (r.pages ?? 0) >= 5 && (r.pages ?? 0) <= 15 : (r.pages ?? 0) > 15;
      return matchesSearch && matchesFilter && matchesStatus && matchesStarred && matchesPinned && matchesWorkspace && matchesPages;
    });
    const pinSort = (arr: typeof base) => [...arr].sort((a, b) => {
      const ap = pinnedReports.has(a.id ?? '') ? 0 : 1;
      const bp = pinnedReports.has(b.id ?? '') ? 0 : 1;
      return ap - bp;
    });
    if (reportSort === 'name') return pinSort([...base].sort((a, b) => a.title.localeCompare(b.title)));
    if (reportSort === 'oldest') return pinSort([...base].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')));
    if (reportSort === 'pages') return pinSort([...base].sort((a, b) => (b.pages ?? 0) - (a.pages ?? 0)));
    if (reportSort === 'workspace') return pinSort([...base].sort((a, b) => (a.workspace ?? '').localeCompare(b.workspace ?? '')));
    if (reportSort === 'status') return pinSort([...base].sort((a, b) => (a.status ?? '').localeCompare(b.status ?? '')));
    if (reportSort === 'type') return pinSort([...base].sort((a, b) => (a.type ?? '').localeCompare(b.type ?? '')));
    if (reportSort === 'author') return pinSort([...base].sort((a, b) => (a.author ?? '').localeCompare(b.author ?? '')));
    return pinSort([...base].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')));
  })();

  function handleTogglePin(reportId: string) {
    setPinnedReports(prev => {
      const next = new Set(prev);
      if (next.has(reportId)) next.delete(reportId); else next.add(reportId);
      try { localStorage.setItem('pinned_reports', JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

  function handleToggleStar(reportId: string) {
    setStarredReports(prev => {
      const next = new Set(prev);
      if (next.has(reportId)) next.delete(reportId); else next.add(reportId);
      try { localStorage.setItem('starred_reports', JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

  const handleGeneratePack = async (title: string, desc: string) => {
    setGeneratingPack(title);
    try {
      const [workspaces, tasks, risks] = await Promise.all([getWorkspaces(), getTasks(), getRisks()]);
      const contextParts = workspaces.slice(0, 6).map(ws => {
        const wsTasks = tasks.filter(t => t.workspace_id === ws.id);
        const wsRisks = risks.filter(r => r.workspace_id === ws.id);
        return `${ws.name}: ${ws.status}, ${ws.progress}% done, ${wsTasks.filter(t=>t.status==='Overdue').length} overdue tasks, ${wsRisks.filter(r=>r.severity==='Critical').length} critical risks`;
      }).join('\n');
      const result = await chatWithDocument(
        [{ role: 'user', content: `Generate a ${title} board pack. Description: ${desc}\n\nPortfolio summary:\n${contextParts}` }],
        `You are a senior consultant. Generate a professional ${title} in structured markdown. Include KPIs, RAG status summary, key decisions needed, and recommendations.`,
      );
      const saved = await upsertReport({
        id: crypto.randomUUID(),
        title,
        type: 'Board Summary',
        type_color: '#8B5CF6',
        workspace: 'All Workspaces',
        workspace_id: null,
        date: new Date().toISOString().slice(0, 10),
        status: 'Generated',
        pages: Math.ceil(result.length / 2000),
        period: 'Current',
        author: 'Consultant OS AI',
      });
      setReports(prev => [saved, ...prev]);
      setGeneratedPacks(prev => new Set([...prev, title]));
    } catch {
      setGeneratedPacks(prev => new Set([...prev, title]));
    } finally {
      setGeneratingPack(null);
    }
  };

  // suppress unused warning for generatedPacks (used only in setter)
  void generatedPacks;

  const selectStyle: React.CSSProperties = {
    width: '100%', padding: '0.5rem 0.75rem',
    borderRadius: 'var(--radius-md)', fontSize: '0.8rem',
    background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-default)',
    color: 'var(--text-primary)', fontFamily: 'inherit',
    outline: 'none', cursor: 'pointer',
    transition: 'border-color var(--transition-base)',
  };

  const recentReports = showAllReports ? filtered : filtered.slice(0, 4);

  return (
    <div className="screen-container animate-fade-in">

      {/* Run Now toast */}
      {runNowToast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 2000,
            background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)',
            borderRadius: '10px', padding: '0.75rem 1.25rem',
            color: '#34D399', fontSize: '0.82rem', fontWeight: 600,
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}
        >
          <Zap size={13} /> {runNowToast}
        </div>
      )}

      {/* Stats Row - 3 cards */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${width >= 768 ? 3 : 1}, 1fr)`, gap: '0.875rem' }}>
        {statsData.map(s => {
          const Icon = iconMap[s.icon];
          return (
            <div key={s.label} className="metric-card" style={{ position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${s.color}, transparent)` }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.625rem' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{s.label}</div>
                <div style={{
                  width: 28, height: 28, borderRadius: '7px',
                  background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={14} style={{ color: s.color }} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <div className="hero-number" style={{ color: s.color }}>{s.value}</div>
                <span style={{
                  fontSize: '0.65rem', fontWeight: 700,
                  color: s.trendUp ? '#34D399' : '#FCA5A5',
                  background: s.trendUp ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  padding: '1px 5px', borderRadius: '4px',
                  border: s.trendUp ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(239,68,68,0.2)',
                }}>{s.trend}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Layout: Left content + Right sidebar */}
      <div style={{ display: 'grid', gridTemplateColumns: isTablet ? '1fr' : '1fr 320px', gap: '1.25rem', alignItems: 'start' }}>

        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Board Pack + Recent Reports side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: width >= 768 ? '1fr 1.8fr' : '1fr', gap: '1rem' }}>

            {/* Board Pack Card */}
            <div className="section-card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.125rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
                  <span style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--text-primary)' }}>Board Pack</span>
                  <Sparkles size={14} style={{ color: '#10B981' }} />
                </div>
                <p style={{ fontSize: '0.73rem', color: 'var(--text-muted)', lineHeight: 1.55, margin: '0 0 1rem' }}>
                  Compile executive summaries, financials, and project statuses into one cohesive deck.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1.125rem' }}>
                  {boardPackChecks.map((item, idx) => {
                    const checked = boardPackChecked.has(idx);
                    return (
                      <div
                        key={item.label}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                        onClick={() => {
                          setBoardPackChecked(prev => {
                            const next = new Set(prev);
                            if (next.has(idx)) next.delete(idx); else next.add(idx);
                            return next;
                          });
                        }}
                      >
                        {checked ? (
                          <CheckSquare size={15} style={{ color: item.color, flexShrink: 0 }} />
                        ) : (
                          <Square size={15} style={{ color: item.color, flexShrink: 0 }} />
                        )}
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{item.label}</span>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={() => handleGeneratePack('Board Pack', 'Compile executive summaries, financials, and project statuses into one cohesive deck.')}
                  disabled={generatingPack === 'Board Pack'}
                  style={{
                    width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)',
                    border: 'none', background: '#10B981', color: '#fff',
                    cursor: generatingPack === 'Board Pack' ? 'wait' : 'pointer',
                    fontSize: '0.78rem', fontWeight: 700, fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
                    transition: 'all var(--transition-base)',
                  }}
                  onMouseEnter={e => { if (generatingPack !== 'Board Pack') (e.currentTarget as HTMLElement).style.background = '#059669'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#10B981'; }}
                  aria-label="Generate Pack"
                >
                  {generatingPack === 'Board Pack' ? (
                    <><Clock size={13} style={{ animation: 'spin 1s linear infinite' }} /> Generating...</>
                  ) : (
                    <>Generate Pack &rarr;</>
                  )}
                </button>
              </div>
            </div>

            {/* Recent Reports Table */}
            <div className="section-card" style={{ overflow: 'hidden' }}>
              <div className="section-card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>Recent Reports</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {/* Filter tabs */}
                  <div style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.03)', padding: '2px', borderRadius: '7px', border: '1px solid var(--border-subtle)' }}>
                    {(['All Reports', 'Weekly Status', 'Monthly Reports', 'Board Summaries'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setReportFilter(tab)}
                        aria-label={`Filter reports: ${tab}`}
                        aria-pressed={reportFilter === tab}
                        style={{
                          padding: '3px 9px', borderRadius: '5px', fontSize: '0.68rem', fontWeight: 500,
                          background: reportFilter === tab ? 'rgba(14,165,233,0.15)' : 'transparent',
                          color: reportFilter === tab ? '#38BDF8' : '#64748B',
                          border: reportFilter === tab ? '1px solid rgba(14,165,233,0.25)' : '1px solid transparent',
                          cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                        }}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                  {/* Status quick filters */}
                  <div style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.03)', padding: '2px', borderRadius: '7px', border: '1px solid var(--border-subtle)' }}>
                    {(['All', 'Draft', 'Generated', 'Scheduled'] as const).map(sf => (
                      <button
                        key={sf}
                        onClick={() => setReportStatusFilter(sf)}
                        aria-label={`Filter reports by status: ${sf}`}
                        aria-pressed={reportStatusFilter === sf}
                        style={{
                          padding: '3px 9px', borderRadius: '5px', fontSize: '0.68rem', fontWeight: 500,
                          background: reportStatusFilter === sf ? 'rgba(16,185,129,0.15)' : 'transparent',
                          color: reportStatusFilter === sf ? '#34D399' : '#64748B',
                          border: reportStatusFilter === sf ? '1px solid rgba(16,185,129,0.25)' : '1px solid transparent',
                          cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                        }}
                      >
                        {sf}
                      </button>
                    ))}
                  </div>
                  {/* Pinned only toggle */}
                  <button
                    onClick={() => setPinnedOnly(v => !v)}
                    aria-label="Show pinned reports only"
                    aria-pressed={pinnedOnly}
                    style={{
                      padding: '3px 9px', borderRadius: '5px', fontSize: '0.68rem', fontWeight: 500,
                      background: pinnedOnly ? 'rgba(99,102,241,0.15)' : 'transparent',
                      color: pinnedOnly ? '#A5B4FC' : '#64748B',
                      border: pinnedOnly ? '1px solid rgba(99,102,241,0.25)' : '1px solid rgba(255,255,255,0.08)',
                      cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                    }}
                  >
                    📌 Pinned
                  </button>
                  {/* Starred only toggle */}
                  <button
                    onClick={() => setStarredOnly(v => !v)}
                    aria-label="Show starred reports only"
                    aria-pressed={starredOnly}
                    style={{
                      padding: '3px 9px', borderRadius: '5px', fontSize: '0.68rem', fontWeight: 500,
                      background: starredOnly ? 'rgba(245,158,11,0.15)' : 'transparent',
                      color: starredOnly ? '#FBBF24' : '#64748B',
                      border: starredOnly ? '1px solid rgba(245,158,11,0.25)' : '1px solid rgba(255,255,255,0.08)',
                      cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                    }}
                  >
                    ★ Starred
                  </button>
                  <div style={{ position: 'relative' }}>
                    <Search size={12} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    <input
                      className="input-field"
                      aria-label="Search reports"
                      placeholder="Search reports..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      style={{ paddingLeft: '1.8rem', height: '30px', fontSize: '0.72rem', width: isMobile ? '100%' : '140px' }}
                    />
                  </div>
                  <select
                    className="input-field"
                    aria-label="Sort reports"
                    value={reportSort}
                    onChange={e => setReportSort(e.target.value as typeof reportSort)}
                    style={{ height: '30px', fontSize: '0.72rem', paddingRight: '1.5rem', minWidth: '100px' }}
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="name">By name</option>
                    <option value="pages">By pages</option>
                    <option value="workspace">By workspace</option>
                    <option value="status">By status</option>
                    <option value="type">By type</option>
                    <option value="author">By author</option>
                  </select>
                  {workspaceList.length > 0 && (
                    <select
                      className="input-field"
                      aria-label="Filter reports by workspace"
                      value={reportWorkspaceFilter}
                      onChange={e => setReportWorkspaceFilter(e.target.value)}
                      style={{ height: '30px', fontSize: '0.72rem', paddingRight: '1.5rem', minWidth: '110px' }}
                    >
                      <option value="All">All Workspaces</option>
                      {workspaceList.map(ws => <option key={ws.id} value={ws.name}>{ws.name}</option>)}
                    </select>
                  )}
                  <select
                    className="input-field"
                    aria-label="Filter reports by pages"
                    value={reportPagesFilter}
                    onChange={e => setReportPagesFilter(e.target.value as typeof reportPagesFilter)}
                    style={{ height: '30px', fontSize: '0.72rem', paddingRight: '1.5rem', minWidth: '110px' }}
                  >
                    <option value="All">All Lengths</option>
                    <option value="Short">Short (&lt;5 pages)</option>
                    <option value="Medium">Medium (5–15)</option>
                    <option value="Long">Long (&gt;15 pages)</option>
                  </select>
                  <button
                    className="btn-secondary"
                    style={{ padding: '0 0.5rem', height: '28px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    onClick={() => handleCopyReportsSummary(filtered)}
                    disabled={filtered.length === 0}
                    aria-label="Copy reports summary to clipboard"
                  >
                    <ClipboardCopy size={12} /> {reportsSummaryCopied ? 'Copied!' : 'Copy Summary'}
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ padding: '0 0.5rem', height: '28px', fontSize: '0.7rem' }}
                    onClick={() => handleExportReportsCSV(filtered)}
                    disabled={filtered.length === 0}
                    aria-label="Export reports to CSV"
                  >
                    {reportsCsvExported ? 'Exported!' : <><Download size={12} /> Export CSV</>}
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ padding: '0 0.5rem', height: '28px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    onClick={() => handleExportReportsTxt(filtered)}
                    disabled={filtered.length === 0}
                    aria-label="Export reports to TXT"
                  >
                    {reportsTxtExported ? 'Exported!' : <><FileText size={12} /> Export TXT</>}
                  </button>
                  <button
                    className="btn-ghost"
                    style={{ padding: '0 0.5rem', height: '28px', fontSize: '0.7rem', color: '#0EA5E9' }}
                    onClick={() => setShowAllReports(v => !v)}
                    aria-label={showAllReports ? 'Show Less reports' : 'View All reports'}
                  >
                    {showAllReports ? 'Show Less' : `View All${filtered.length > 4 ? ` (${filtered.length})` : ''}`}
                  </button>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                {recentReports.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
                    <FileText size={28} style={{ color: 'var(--text-faint)', margin: '0 auto 0.625rem' }} />
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>No reports yet</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Generate a report to get started</div>
                  </div>
                ) : (
                  <>
                  {bulkSelectedReports.size > 0 && (
                    <div style={{ padding: '0.5rem 1rem', background: 'rgba(239,68,68,0.07)', borderBottom: '1px solid rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#FCA5A5', fontWeight: 500 }}>{bulkSelectedReports.size} selected</span>
                      <button
                        className="btn-ghost"
                        style={{ height: '26px', fontSize: '0.72rem', color: '#EF4444', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onClick={handleBulkDeleteReports}
                        disabled={bulkDeletingReports}
                        aria-label="Delete selected reports"
                      >
                        <Trash2 size={12} /> {bulkDeletingReports ? 'Deleting...' : 'Delete Selected'}
                      </button>
                      <button
                        className="btn-ghost"
                        style={{ height: '26px', fontSize: '0.72rem' }}
                        onClick={() => setBulkSelectedReports(new Set())}
                        aria-label="Clear report selection"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                  <table className="data-table" style={{ minWidth: '460px', fontSize: isMobile ? '0.7rem' : undefined }}>
                    <thead>
                      <tr>
                        <th style={{ width: '32px' }}>
                          <button
                            onClick={toggleSelectAllReports}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--text-muted)' }}
                            aria-label="Select all reports"
                          >
                            {bulkSelectedReports.size === recentReports.length && recentReports.length > 0
                              ? <CheckSquare size={14} style={{ color: '#0EA5E9' }} />
                              : <Square size={14} />}
                          </button>
                        </th>
                        <th style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, color: 'var(--text-muted)' }}>NAME</th>
                        <th style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, color: 'var(--text-muted)' }}>WORKSPACE</th>
                        <th style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, color: 'var(--text-muted)' }}>STATUS</th>
                        <th style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, color: 'var(--text-muted)' }}>DATE</th>
                        <th style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, color: 'var(--text-muted)', width: '72px' }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentReports.map(report => (
                        <tr key={report.id} style={{ cursor: 'pointer', background: bulkSelectedReports.has(report.id) ? 'rgba(14,165,233,0.05)' : undefined }}>
                          <td>
                            <button
                              onClick={e => { e.stopPropagation(); toggleBulkSelectReport(report.id); }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--text-muted)' }}
                              aria-label={`Select report ${report.title}`}
                            >
                              {bulkSelectedReports.has(report.id)
                                ? <CheckSquare size={14} style={{ color: '#0EA5E9' }} />
                                : <Square size={14} />}
                            </button>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{
                                width: 26, height: 26, borderRadius: '6px',
                                background: `${report.type_color}15`, color: report.type_color,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                              }}>
                                <FileText size={13} />
                              </div>
                              <div>
                                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{report.title}</div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{report.author || 'Consultant OS AI'}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: '0.73rem', color: 'var(--text-secondary)' }}>{report.workspace}</span>
                          </td>
                          <td>
                            <ReportStatusBadge status={report.status} />
                          </td>
                          <td>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{formatReportDate(report.date)}</span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <button
                                className="btn-ghost"
                                style={{ padding: '2px 6px', height: '24px', minWidth: 'unset' }}
                                onClick={e => { e.stopPropagation(); handleToggleStar(report.id); }}
                                aria-label={`Star report ${report.title}`}
                                aria-pressed={starredReports.has(report.id)}
                                title={starredReports.has(report.id) ? 'Unstar' : 'Star'}
                              >
                                <span style={{ fontSize: '13px', color: starredReports.has(report.id) ? '#FBBF24' : '#64748B' }}>
                                  {starredReports.has(report.id) ? '★' : '☆'}
                                </span>
                              </button>
                              <button
                                className="btn-ghost"
                                style={{ padding: '2px 6px', height: '24px', minWidth: 'unset' }}
                                onClick={e => { e.stopPropagation(); handleTogglePin(report.id); }}
                                aria-label={`Pin report ${report.title}`}
                                aria-pressed={pinnedReports.has(report.id)}
                                title={pinnedReports.has(report.id) ? 'Unpin' : 'Pin'}
                              >
                                <span style={{ fontSize: '11px', color: pinnedReports.has(report.id) ? '#A5B4FC' : '#64748B' }}>📌</span>
                              </button>
                              <button
                                className="btn-ghost"
                                style={{ padding: '2px 6px', height: '24px', minWidth: 'unset' }}
                                onClick={() => handleDownloadReport(report)}
                                aria-label={`Download ${report.title}`}
                                title="Download"
                              >
                                <Download size={13} />
                              </button>
                              <button
                                className="btn-ghost"
                                style={{ padding: '2px 6px', height: '24px', minWidth: 'unset' }}
                                onClick={() => { setEmailingReport(report); setEmailRecipient(''); }}
                                aria-label={`Email ${report.title}`}
                                title="Email Report"
                              >
                                <Mail size={13} style={{ color: '#38BDF8' }} />
                              </button>
                              <button
                                className="btn-ghost"
                                style={{ padding: '2px 6px', height: '24px', minWidth: 'unset', color: deletingReportId === report.id ? '#EF4444' : undefined }}
                                onClick={() => handleDeleteReport(report.id)}
                                aria-label={`Delete ${report.title}`}
                                title="Delete"
                                disabled={deletingReportId === report.id}
                              >
                                <Trash2 size={13} style={{ color: '#EF4444', opacity: 0.7 }} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Generation Volume Chart */}
          <div className="section-card">
            <div className="section-card-header">
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>Generation Volume</span>
            </div>
            <div style={{ padding: '1.125rem 1rem 0.875rem' }}>
              <ResponsiveContainer width="100%" height={isMobile ? 140 : 180}>
                <BarChart data={reportVolumeData} barCategoryGap="20%">
                  <XAxis dataKey="month" tick={{ fill: '#64748B', fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: '8px', fontSize: '0.75rem', boxShadow: 'var(--shadow-md)' }}
                    labelStyle={{ color: 'var(--text-secondary)', fontWeight: 600 }}
                    itemStyle={{ color: '#8B5CF6', fontWeight: 700 }}
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  />
                  <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                    {reportVolumeData.map((_, index) => (
                      <Cell key={index} fill={index === reportVolumeData.length - 1 ? '#8B5CF6' : 'rgba(139,92,246,0.35)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* AI Insights Card */}
          <div className="section-card" style={{
            background: 'linear-gradient(160deg, rgba(245,158,11,0.06) 0%, var(--bg-elevated) 100%)',
            border: '1px solid rgba(245,158,11,0.15)',
          }}>
            <div style={{ padding: '1rem 1.125rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <div style={{ padding: '5px', borderRadius: '7px', background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>
                  <Sparkles size={13} />
                </div>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>AI Insights</span>
              </div>
              <div style={{
                fontSize: '0.73rem', color: 'var(--text-secondary)', lineHeight: 1.6,
                padding: '0.75rem 0.875rem',
                background: 'rgba(245,158,11,0.06)', borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(245,158,11,0.14)',
              }}>
                <strong style={{ color: '#F59E0B' }}>Suggestion:</strong> Schedule the &lsquo;Weekly PMO Status&rsquo; report for Friday 4PM instead of Monday 9AM to align with stakeholder review habits.
              </div>
            </div>
          </div>

          {/* New Custom Report Form */}
          <div className="section-card" style={{
            background: 'linear-gradient(160deg, rgba(139,92,246,0.05) 0%, var(--bg-elevated) 100%)',
            border: '1px solid rgba(139,92,246,0.15)',
          }}>
            <div className="section-card-header" style={{ borderBottom: '1px solid rgba(139,92,246,0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ padding: '5px', borderRadius: '7px', background: 'rgba(139,92,246,0.15)', color: '#A78BFA' }}>
                  <Sparkles size={14} />
                </div>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>New Custom Report</span>
              </div>
            </div>
            <div style={{ padding: '1rem' }}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Report Type</label>
                <select
                  aria-label="Report type"
                  value={reportType}
                  onChange={e => setReportType(e.target.value)}
                  style={selectStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}
                >
                  {reportTypeOptions.map(opt => <option key={opt}>{opt}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Workspace Source</label>
                <select
                  aria-label="Workspace source"
                  value={selectedWorkspace}
                  onChange={e => setSelectedWorkspace(e.target.value)}
                  style={selectStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}
                >
                  <option value="All Workspaces">All Workspaces</option>
                  {workspaceList.map(ws => (
                    <option key={ws.id} value={ws.name}>{ws.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Period</label>
                <select
                  aria-label="Report period"
                  value={reportPeriod}
                  onChange={e => setReportPeriod(e.target.value)}
                  style={selectStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}
                >
                  <option>This Week (W10)</option>
                  <option>Last Week (W9)</option>
                  <option>This Month (March)</option>
                  <option>Q1 2026</option>
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-secondary)' }}
                  onClick={() => setIncludeAttachments(!includeAttachments)}
                >
                  {includeAttachments ? (
                    <CheckSquare size={15} style={{ color: '#8B5CF6', flexShrink: 0 }} />
                  ) : (
                    <Square size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  )}
                  Include attachments
                </label>
              </div>
              <button
                className="btn-ai"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleGenerateReport}
                disabled={generatingReport}
                aria-label="Generate Report"
              >
                {generatingReport ? <><Clock size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating...</> : <><Sparkles size={14} /> Generate Report</>}
              </button>
              {reportError && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: '#FCA5A5', background: 'rgba(239,68,68,0.06)', padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.15)' }}>
                  {reportError}
                </div>
              )}
            </div>
          </div>

          {/* Scheduled Reports */}
          <div className="section-card">
            <div className="section-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={14} style={{ color: '#8B5CF6' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>Scheduled Reports</span>
              </div>
            </div>
            <div style={{ padding: '0.25rem 0' }}>
              {scheduledReports.map((sr, idx) => (
                <div
                  key={sr.id}
                  style={{
                    padding: '0.75rem 1.125rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    borderBottom: idx < scheduledReports.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>{sr.title}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{sr.schedule}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                      fontSize: '0.62rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px',
                      background: sr.status === 'Active' ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.1)',
                      color: sr.status === 'Active' ? '#34D399' : '#94A3B8',
                      border: `1px solid ${sr.status === 'Active' ? 'rgba(16,185,129,0.22)' : 'rgba(100,116,139,0.2)'}`,
                    }}>
                      {sr.status}
                    </span>
                    <button
                      onClick={() => handleRunScheduledNow(sr.id, sr.title)}
                      disabled={runningScheduledId === sr.id}
                      style={{
                        background: 'rgba(0,212,255,0.07)', border: '1px solid rgba(0,212,255,0.18)', cursor: runningScheduledId === sr.id ? 'wait' : 'pointer',
                        padding: '3px 8px', borderRadius: '5px', color: '#38BDF8', fontSize: '0.65rem', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: '3px', fontFamily: 'inherit',
                        opacity: runningScheduledId === sr.id ? 0.6 : 1,
                      }}
                      aria-label={`Run ${sr.title} now`}
                    >
                      {runningScheduledId === sr.id ? '…' : <><Zap size={10} /> Run Now</>}
                    </button>
                    <button
                      onClick={() => toggleScheduledReport(sr.id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: '3px',
                        color: sr.status === 'Active' ? '#F59E0B' : '#10B981',
                        display: 'flex', alignItems: 'center',
                      }}
                      aria-label={sr.status === 'Active' ? `Pause ${sr.title}` : `Resume ${sr.title}`}
                      title={sr.status === 'Active' ? 'Pause' : 'Resume'}
                    >
                      {sr.status === 'Active' ? <Pause size={13} /> : <Play size={13} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Generated Report Modal */}
      {generatedReport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
          onClick={e => { if (e.target === e.currentTarget) setGeneratedReport(''); }}>
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: '14px', width: '100%', maxWidth: '680px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ padding: '5px', borderRadius: '7px', background: 'rgba(139,92,246,0.15)', color: '#A78BFA' }}><Sparkles size={14} /></div>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>{reportType} — {selectedWorkspace}</span>
              </div>
              <button onClick={() => setGeneratedReport('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', borderRadius: '4px', display: 'flex' }} aria-label="Close generated report">
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
              {generatedReport}
            </div>
            <div style={{ padding: '0.875rem 1.25rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button className="btn-ghost" style={{ fontSize: '0.78rem' }} onClick={() => setGeneratedReport('')}>Close</button>
              <button className="btn-ghost" style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }} onClick={handleCopyGeneratedReport} aria-label="Copy generated report to clipboard">
                <ClipboardCopy size={12} /> {reportCopied ? 'Copied!' : 'Copy to Clipboard'}
              </button>
              <button className="btn-ghost" style={{ fontSize: '0.78rem' }} onClick={handleDownloadGenerated} aria-label="Download report as text file">
                <Download size={12} /> Download .txt
              </button>
              <button className="btn-primary" style={{ fontSize: '0.78rem' }} onClick={handleSaveReport} disabled={savingReport} aria-label="Save report to Reports">
                {savingReport ? 'Saving...' : 'Save to Reports'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email toast */}
      {emailToast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 2001,
            background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.35)',
            borderRadius: '10px', padding: '0.75rem 1.25rem',
            color: '#38BDF8', fontSize: '0.82rem', fontWeight: 600,
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}
        >
          <Mail size={13} /> {emailToast}
        </div>
      )}

      {/* Email Report modal */}
      {emailingReport && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(4px)' }}
          onClick={() => { setEmailingReport(null); setEmailRecipient(''); }}
        >
          <div
            role="dialog"
            aria-label="Email Report"
            style={{ background: '#0C1220', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '1.5rem', width: '100%', maxWidth: '420px', margin: '1rem' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.125rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Mail size={15} style={{ color: '#38BDF8' }} />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Email Report</h3>
              </div>
              <button className="btn-ghost" style={{ padding: '0.25rem' }} onClick={() => { setEmailingReport(null); setEmailRecipient(''); }} aria-label="Close email dialog">
                <X size={16} />
              </button>
            </div>
            <p style={{ margin: '0 0 1rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Send <strong style={{ color: 'var(--text-secondary)' }}>{emailingReport.title}</strong> to:
            </p>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', display: 'block', marginBottom: '0.375rem' }}>Recipient Email</label>
              <input
                className="input-field"
                type="email"
                placeholder="recipient@example.com"
                value={emailRecipient}
                onChange={e => setEmailRecipient(e.target.value)}
                style={{ width: '100%', padding: '0.625rem 0.75rem', fontSize: '0.85rem' }}
                aria-label="Recipient email"
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => { setEmailingReport(null); setEmailRecipient(''); }}>Cancel</button>
              <button
                className="btn-primary"
                onClick={handleSendEmail}
                disabled={!emailRecipient.trim() || sendingEmail}
                style={{ padding: '0.5rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                aria-label="Send email"
              >
                <Mail size={13} />
                {sendingEmail ? 'Sending…' : 'Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
