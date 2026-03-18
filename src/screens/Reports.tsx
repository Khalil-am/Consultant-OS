import { useState, useEffect } from 'react';
import { useLayout } from '../hooks/useLayout';
import {
  Download, Calendar, Sparkles, Clock, FileText,
  Search, X, Zap, MoreHorizontal, CheckSquare, Square, Trash2,
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

const scheduledReportsData = [
  { title: 'Weekly PMO Status', schedule: 'Every Monday at 9:00 AM', status: 'Active' as const },
  { title: 'Monthly Financial', schedule: '1st of month at 8:00 AM', status: 'Active' as const },
  { title: 'Risk Review', schedule: 'Every Friday at 3:00 PM', status: 'Paused' as const },
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

  const filtered = reports.filter(r => {
    const matchesSearch = !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.workspace?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      reportFilter === 'All Reports' ? true :
      reportFilter === 'Weekly Status' ? (r.type === 'Weekly Status' || r.type?.toLowerCase().includes('weekly')) :
      reportFilter === 'Monthly Reports' ? (r.type?.toLowerCase().includes('monthly')) :
      reportFilter === 'Board Summaries' ? (r.type === 'Board Summary') :
      true;
    return matchesSearch && matchesFilter;
  });

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

  const recentReports = filtered.slice(0, 4);

  return (
    <div className="screen-container animate-fade-in">

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
                  <div style={{ position: 'relative' }}>
                    <Search size={12} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    <input
                      className="input-field"
                      placeholder="Search reports..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      style={{ paddingLeft: '1.8rem', height: '30px', fontSize: '0.72rem', width: isMobile ? '100%' : '140px' }}
                    />
                  </div>
                  <button className="btn-ghost" style={{ padding: '0 0.5rem', height: '28px', fontSize: '0.7rem', color: '#0EA5E9' }}>
                    View All
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
                  <table className="data-table" style={{ minWidth: '460px', fontSize: isMobile ? '0.7rem' : undefined }}>
                    <thead>
                      <tr>
                        <th style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, color: 'var(--text-muted)' }}>NAME</th>
                        <th style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, color: 'var(--text-muted)' }}>WORKSPACE</th>
                        <th style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, color: 'var(--text-muted)' }}>STATUS</th>
                        <th style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, color: 'var(--text-muted)' }}>DATE</th>
                        <th style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, color: 'var(--text-muted)', width: '72px' }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentReports.map(report => (
                        <tr key={report.id} style={{ cursor: 'pointer' }}>
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
                                onClick={() => handleDownloadReport(report)}
                                title="Download"
                              >
                                <Download size={13} />
                              </button>
                              <button
                                className="btn-ghost"
                                style={{ padding: '2px 6px', height: '24px', minWidth: 'unset', color: deletingReportId === report.id ? '#EF4444' : undefined }}
                                onClick={() => handleDeleteReport(report.id)}
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
              {scheduledReportsData.map((sr, idx) => (
                <div
                  key={sr.title}
                  style={{
                    padding: '0.75rem 1.125rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    borderBottom: idx < scheduledReportsData.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>{sr.title}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{sr.schedule}</div>
                  </div>
                  <span style={{
                    fontSize: '0.62rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px',
                    background: sr.status === 'Active' ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.1)',
                    color: sr.status === 'Active' ? '#34D399' : '#94A3B8',
                    border: `1px solid ${sr.status === 'Active' ? 'rgba(16,185,129,0.22)' : 'rgba(100,116,139,0.2)'}`,
                  }}>
                    {sr.status}
                  </span>
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
              <button onClick={() => setGeneratedReport('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', borderRadius: '4px', display: 'flex' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
              {generatedReport}
            </div>
            <div style={{ padding: '0.875rem 1.25rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button className="btn-ghost" style={{ fontSize: '0.78rem' }} onClick={() => setGeneratedReport('')}>Close</button>
              <button className="btn-ghost" style={{ fontSize: '0.78rem' }} onClick={() => { navigator.clipboard.writeText(generatedReport); }}>
                Copy to Clipboard
              </button>
              <button className="btn-ghost" style={{ fontSize: '0.78rem' }} onClick={handleDownloadGenerated}>
                <Download size={12} /> Download .txt
              </button>
              <button className="btn-primary" style={{ fontSize: '0.78rem' }} onClick={handleSaveReport} disabled={savingReport}>
                {savingReport ? 'Saving...' : 'Save to Reports'}
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
