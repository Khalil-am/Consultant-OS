import { useState, useEffect } from 'react';
import { useLayout } from '../hooks/useLayout';
import {
  BarChart3, Download, Share, Eye, Plus, Calendar,
  TrendingUp, AlertTriangle, CheckCircle, Sparkles, Clock, FileText,
  Search, X,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { getReports, getWorkspaces, getTasks, getRisks, getMilestones } from '../lib/db';
import type { ReportRow } from '../lib/db';
import { chatWithDocument } from '../lib/openrouter';

const categoryTabs = ['All Reports', 'Weekly Status', 'Monthly', 'Steering Committee', 'Procurement', 'Board Summaries'];

const reportTypeOptions = [
  'Weekly Status Report',
  'Monthly Progress Report',
  'Steering Committee Pack',
  'Procurement Summary',
  'Board Executive Summary',
  'Risk Report',
  'KPI Dashboard',
];

const aiNarrative = {
  highlights: [
    'ENB Core Banking transformation is 91% complete – on track for Go-Live in April 2026',
    'MOCI Procurement Reform successfully shortlisted 3 qualified vendors this week',
    'Smart City Infrastructure PMO delivered 7 of 8 Q1 milestones on schedule',
  ],
  concerns: [
    'Smart City Package 3 showing AED 240K budget variance – escalation recommended',
    'ADNOC contract review is 3 days overdue – blocking vendor mobilisation',
    'NCA has 3 critical unmitigated risks approaching review deadline',
  ],
  recommendations: [
    'Prioritise Smart City budget variance review before next SC meeting (5 days)',
    'Assign interim resource to ADNOC contract review to unblock ERP timeline',
    'Schedule emergency risk review for NCA critical risks with CTO',
  ],
};

const reportVolumeData = [
  { month: 'Oct', count: 12 },
  { month: 'Nov', count: 18 },
  { month: 'Dec', count: 9 },
  { month: 'Jan', count: 22 },
  { month: 'Feb', count: 19 },
  { month: 'Mar', count: 28 },
];

const boardPackTypes = [
  {
    title: 'Executive Dashboard',
    desc: 'C-suite portfolio overview with KPIs, RAG status and financial summary',
    icon: <BarChart3 size={20} />,
    color: '#00D4FF',
  },
  {
    title: 'Steering Committee Pack',
    desc: 'Milestone tracker, decisions log, risk register and budget variance',
    icon: <FileText size={20} />,
    color: '#8B5CF6',
  },
  {
    title: 'Portfolio Status Report',
    desc: 'All 8 engagements health matrix with delivery trend analysis',
    icon: <TrendingUp size={20} />,
    color: '#10B981',
  },
  {
    title: 'Risk & Issues Summary',
    desc: 'RAID log consolidated view with AED financial exposure by severity',
    icon: <AlertTriangle size={20} />,
    color: '#EF4444',
  },
];

const scheduledReports = [
  { title: 'Weekly Portfolio Status', schedule: 'Every Monday 08:00', nextRun: '16 Mar 2026', recipients: 'Steering Committee (8)', type: 'Weekly Status' },
  { title: 'Monthly Board Pack',       schedule: '1st of each month',   nextRun: '01 Apr 2026', recipients: 'Board Members (5)',      type: 'Board Summary' },
  { title: 'Procurement Dashboard',    schedule: 'Every Wednesday',     nextRun: '18 Mar 2026', recipients: 'PMO Team (12)',          type: 'Procurement' },
];

const statsData = [
  { label: 'Reports This Month', value: '28',  trend: '+6',   trendUp: true,  color: '#0EA5E9' },
  { label: 'Pending Sign-offs',  value: '3',   trend: '-2',   trendUp: false, color: '#F59E0B' },
  { label: 'Total Downloads',    value: '847', trend: '+124', trendUp: true,  color: '#10B981' },
  { label: 'Avg Generation Time',value: '42s', trend: '-8s',  trendUp: true,  color: '#8B5CF6' },
];

function ReportStatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    'Generated': { bg: 'rgba(16,185,129,0.1)',   color: '#34D399', border: 'rgba(16,185,129,0.22)' },
    'Scheduled': { bg: 'rgba(14,165,233,0.1)',   color: '#38BDF8', border: 'rgba(14,165,233,0.22)' },
    'Draft':     { bg: 'rgba(100,116,139,0.1)',  color: '#94A3B8', border: 'rgba(100,116,139,0.2)' },
  };
  const s = map[status] || map['Draft'];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      fontSize: '0.67rem', fontWeight: 700, padding: '2px 8px',
      borderRadius: '9999px', background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      whiteSpace: 'nowrap', letterSpacing: '0.02em',
    }}>
      {status}
    </span>
  );
}

export default function Reports() {
  const { width, isMobile, isTablet } = useLayout();
  const [activeCategory, setActiveCategory] = useState('All Reports');
  const [reportType, setReportType] = useState('Weekly Status Report');
  const [selectedWorkspace, setSelectedWorkspace] = useState('All Workspaces');
  const [generatingPack, setGeneratingPack] = useState<string | null>(null);
  const [generatedPacks, setGeneratedPacks] = useState<Set<string>>(new Set());
  const [hoveredReport, setHoveredReport] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [reportPeriod, setReportPeriod] = useState('This Week (W10)');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [generatedReport, setGeneratedReport] = useState('');
  const [reportError, setReportError] = useState('');

  useEffect(() => {
    getReports().then(setReports).catch(() => {});
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

  // suppress unused warning
  void isMobile;

  const filtered = reports.filter(r => {
    const matchesCat = activeCategory === 'All Reports'           ? true
      : activeCategory === 'Weekly Status'       ? r.type === 'Weekly Status'
      : activeCategory === 'Monthly'             ? r.type === 'Monthly Report'
      : activeCategory === 'Steering Committee'  ? r.type === 'Steering Committee'
      : activeCategory === 'Procurement'         ? r.type === 'Procurement Report'
      : activeCategory === 'Board Summaries'     ? r.type === 'Board Summary'
      : true;
    const matchesSearch = !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.workspace?.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleGeneratePack = (title: string) => {
    setGeneratingPack(title);
    setTimeout(() => {
      setGeneratingPack(null);
      setGeneratedPacks(prev => new Set([...prev, title]));
    }, 2000);
  };

  const selectStyle: React.CSSProperties = {
    width: '100%', padding: '0.5rem 0.75rem',
    borderRadius: 'var(--radius-md)', fontSize: '0.8rem',
    background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-default)',
    color: 'var(--text-primary)', fontFamily: 'inherit',
    outline: 'none', cursor: 'pointer',
    transition: 'border-color var(--transition-base)',
  };

  return (
    <div className="screen-container animate-fade-in">

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${width >= 768 ? 4 : 2}, 1fr)`, gap: '0.875rem' }}>
        {statsData.map(s => (
          <div key={s.label} className="metric-card" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${s.color}, transparent)` }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.625rem' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{s.label}</div>
              <span style={{
                fontSize: '0.65rem', fontWeight: 700,
                color: s.trendUp ? '#34D399' : '#FCA5A5',
                background: s.trendUp ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                padding: '1px 5px', borderRadius: '4px',
                border: s.trendUp ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(239,68,68,0.2)',
              }}>{s.trend}</span>
            </div>
            <div className="hero-number" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Board Pack Generator */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(14,165,233,0.06) 0%, var(--bg-elevated) 50%, rgba(139,92,246,0.05) 100%)',
        border: '1px solid rgba(14,165,233,0.14)', borderRadius: 'var(--radius-lg)', overflow: 'hidden',
      }}>
        <div style={{ padding: '1.125rem 1.5rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ padding: '0.5rem', borderRadius: '8px', background: 'rgba(0,212,255,0.1)', color: '#00D4FF' }}>
            <Sparkles size={16} />
          </div>
          <div>
            <div style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--text-primary)' }}>Generate Board Pack</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '1px' }}>AI-powered report generation for board and executive audiences</div>
          </div>
        </div>
        <div style={{ padding: '1.125rem 1.5rem', display: 'grid', gridTemplateColumns: `repeat(${width >= 900 ? 4 : width >= 600 ? 2 : 1}, 1fr)`, gap: '0.875rem' }}>
          {boardPackTypes.map(pack => (
            <div key={pack.title} className="board-pack-card" style={{ position: 'relative' }}>
              <div style={{ width: '2px', height: '100%', position: 'absolute', left: 0, top: 0, bottom: 0, background: `linear-gradient(180deg, ${pack.color}, transparent)`, borderRadius: '2px 0 0 2px' }} />
              <div style={{ paddingLeft: '0.25rem' }}>
                <div style={{ padding: '0.5rem', borderRadius: '8px', background: `${pack.color}12`, color: pack.color, width: 'fit-content', marginBottom: '0.75rem' }}>
                  {pack.icon}
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>{pack.title}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.55 }}>{pack.desc}</div>
                {generatedPacks.has(pack.title) ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', fontWeight: 600, color: '#34D399', padding: '0.375rem 0' }}>
                    <CheckCircle size={13} /> Generated successfully
                  </div>
                ) : (
                  <button
                    onClick={() => handleGeneratePack(pack.title)}
                    disabled={generatingPack === pack.title}
                    style={{
                      width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)',
                      border: `1px solid ${pack.color}35`, background: `${pack.color}0D`,
                      color: pack.color, cursor: generatingPack === pack.title ? 'wait' : 'pointer',
                      fontSize: '0.78rem', fontWeight: 700, fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
                      transition: 'all var(--transition-base)',
                    }}
                    onMouseEnter={e => { if (generatingPack !== pack.title) { (e.currentTarget as HTMLElement).style.background = `${pack.color}20`; (e.currentTarget as HTMLElement).style.borderColor = `${pack.color}55`; } }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${pack.color}0D`; (e.currentTarget as HTMLElement).style.borderColor = `${pack.color}35`; }}
                  >
                    {generatingPack === pack.title ? (
                      <><Clock size={13} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</>
                    ) : (
                      <><Sparkles size={13} /> Generate</>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '0 0 auto' }}>
          <Search size={13} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            className="input-field"
            placeholder="Search reports..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: '2.25rem', height: '36px', fontSize: '0.8rem', width: '200px' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(255,255,255,0.03)', padding: '0.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', overflowX: 'auto', flex: 1 }}>
          {categoryTabs.map(tab => (
            <button key={tab} className={`tab-item ${activeCategory === tab ? 'active' : ''}`} onClick={() => setActiveCategory(tab)} style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Main Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: isTablet ? '1fr' : '1fr 320px', gap: '1.25rem', alignItems: 'start' }}>

        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Reports Grid */}
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-default)' }}>
              <FileText size={36} style={{ color: 'var(--text-faint)', margin: '0 auto 0.875rem' }} />
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>No reports found</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Try a different filter or generate a new report</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${width >= 1100 ? 3 : width >= 640 ? 2 : 1}, 1fr)`, gap: '0.875rem' }}>
              {filtered.map(report => (
                <div
                  key={report.id}
                  className="section-card"
                  style={{ cursor: 'pointer', overflow: 'hidden', transition: 'all var(--transition-base)', position: 'relative' }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = `${report.type_color}35`;
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 28px rgba(0,0,0,0.35)';
                    setHoveredReport(report.id);
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)';
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                    setHoveredReport(null);
                  }}
                >
                  {/* Top accent */}
                  <div style={{ height: '2px', background: `linear-gradient(90deg, ${report.type_color} 0%, ${report.type_color}55 60%, transparent 100%)` }} />

                  <div style={{ padding: '1rem' }}>
                    {/* Header row */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ padding: '0.5rem', borderRadius: '8px', background: `${report.type_color}12`, color: report.type_color }}>
                          <BarChart3 size={15} />
                        </div>
                        <span style={{ fontSize: '0.62rem', fontWeight: 600, padding: '2px 6px', borderRadius: '9999px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                          {report.pages}p
                        </span>
                      </div>
                      <ReportStatusBadge status={report.status} />
                    </div>

                    {/* Title */}
                    <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.25rem', lineHeight: 1.35 }}>
                      {report.title}
                    </h3>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0 0 0.625rem' }}>
                      {report.workspace}
                    </p>

                    {/* Author / period row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
                      <div className="avatar" style={{ width: '20px', height: '20px', fontSize: '0.55rem', flexShrink: 0 }}>
                        {report.author ? report.author.charAt(0) : 'A'}
                      </div>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{report.period}</span>
                      <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'var(--text-faint)', display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Calendar size={9} /> {report.date}
                      </span>
                    </div>

                    {/* Action buttons – fade in on hover */}
                    <div style={{
                      display: 'flex', gap: '0.5rem',
                      opacity: hoveredReport === report.id ? 1 : 0.5,
                      transform: hoveredReport === report.id ? 'translateY(0)' : 'translateY(2px)',
                      transition: 'all var(--transition-base)',
                    }}>
                      <button className="btn-ghost" style={{ flex: 1, height: '28px', fontSize: '0.72rem', justifyContent: 'center', padding: '0' }}>
                        <Eye size={11} /> Preview
                      </button>
                      <button className="btn-ghost" style={{ height: '28px', fontSize: '0.72rem', padding: '0 0.625rem' }} title="Download">
                        <Download size={11} />
                      </button>
                      <button className="btn-ghost" style={{ height: '28px', fontSize: '0.72rem', padding: '0 0.625rem' }} title="Share">
                        <Share size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Scheduled Reports */}
          <div className="section-card">
            <div className="section-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={14} style={{ color: '#8B5CF6' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>Scheduled Reports</span>
              </div>
              <button className="btn-ghost" style={{ padding: '0 0.75rem', height: '30px', fontSize: '0.72rem' }}>
                <Plus size={11} /> Add Schedule
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ minWidth: '520px' }}>
                <thead>
                  <tr>
                    <th>Report</th>
                    <th>Schedule</th>
                    <th>Next Run</th>
                    <th>Recipients</th>
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduledReports.map(sr => (
                    <tr key={sr.title} style={{ cursor: 'pointer' }}>
                      <td>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{sr.title}</div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{sr.schedule}</span>
                      </td>
                      <td>
                        <span style={{
                          fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px',
                          background: 'rgba(14,165,233,0.1)', color: '#38BDF8', border: '1px solid rgba(14,165,233,0.22)',
                        }}>
                          {sr.nextRun}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{sr.recipients}</td>
                      <td>
                        <span style={{
                          fontSize: '0.67rem', fontWeight: 700, padding: '2px 7px', borderRadius: '9999px',
                          background: 'rgba(139,92,246,0.1)', color: '#A78BFA', border: '1px solid rgba(139,92,246,0.22)',
                        }}>
                          {sr.type}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Volume Chart */}
          <div className="section-card">
            <div className="section-card-header">
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>Reports Generated — 6 Months</span>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#8B5CF6', background: 'rgba(139,92,246,0.1)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(139,92,246,0.2)' }}>
                +47% vs prior period
              </span>
            </div>
            <div style={{ padding: '1.125rem 1rem 0.875rem' }}>
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={reportVolumeData} barCategoryGap="30%">
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

        {/* Right Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Generate Report form */}
          <div className="section-card" style={{
            background: 'linear-gradient(160deg, rgba(139,92,246,0.05) 0%, var(--bg-elevated) 100%)',
            border: '1px solid rgba(139,92,246,0.15)',
          }}>
            <div className="section-card-header" style={{ borderBottom: '1px solid rgba(139,92,246,0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ padding: '5px', borderRadius: '7px', background: 'rgba(139,92,246,0.15)', color: '#A78BFA' }}>
                  <Sparkles size={14} />
                </div>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>Generate Report</span>
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
                <label style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Workspace</label>
                <select
                  value={selectedWorkspace}
                  onChange={e => setSelectedWorkspace(e.target.value)}
                  style={selectStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}
                >
                  <option>All Workspaces</option>
                  <option>NCA Digital Transformation</option>
                  <option>ADNOC Supply Chain</option>
                  <option>MOCI Procurement Reform</option>
                  <option>Smart City Infrastructure PMO</option>
                </select>
              </div>
              <div style={{ marginBottom: '1.125rem' }}>
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
              <button
                className="btn-ai"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleGenerateReport}
                disabled={generatingReport}
              >
                {generatingReport ? <><Clock size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</> : <><Sparkles size={14} /> Generate Report</>}
              </button>
              {reportError && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: '#FCA5A5', background: 'rgba(239,68,68,0.06)', padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.15)' }}>
                  {reportError}
                </div>
              )}
            </div>
          </div>

          {/* AI Insights */}
          <div className="section-card">
            <div className="section-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ padding: '5px', borderRadius: '7px', background: 'rgba(139,92,246,0.12)', color: '#A78BFA' }}>
                  <Sparkles size={13} />
                </div>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>AI Insights</span>
              </div>
              <span style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-faint)', background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>5 min ago</span>
            </div>
            <div style={{ padding: '1rem' }}>
              {/* Summary pill */}
              <div style={{
                fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '1rem',
                lineHeight: 1.6, padding: '0.75rem 0.875rem',
                background: 'rgba(139,92,246,0.06)', borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(139,92,246,0.14)',
              }}>
                Portfolio is performing at <strong style={{ color: '#A78BFA' }}>87% on-time delivery</strong> this quarter. Two engagements require immediate attention.
              </div>

              {/* Highlights */}
              <div style={{ marginBottom: '1.125rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.625rem' }}>
                  <CheckCircle size={12} style={{ color: '#10B981', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#34D399', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Highlights</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {aiNarrative.highlights.map((h, i) => (
                    <div key={i} style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', lineHeight: 1.5, paddingLeft: '0.875rem', borderLeft: '2px solid rgba(16,185,129,0.35)' }}>
                      {h}
                    </div>
                  ))}
                </div>
              </div>

              {/* Concerns */}
              <div style={{ marginBottom: '1.125rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.625rem' }}>
                  <AlertTriangle size={12} style={{ color: '#F59E0B', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#FCD34D', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Concerns</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {aiNarrative.concerns.map((c, i) => (
                    <div key={i} style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', lineHeight: 1.5, paddingLeft: '0.875rem', borderLeft: '2px solid rgba(245,158,11,0.35)' }}>
                      {c}
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendations */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.625rem' }}>
                  <TrendingUp size={12} style={{ color: '#0EA5E9', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#38BDF8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Recommendations</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {aiNarrative.recommendations.map((r, i) => (
                    <div key={i} style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', lineHeight: 1.5, paddingLeft: '0.875rem', borderLeft: '2px solid rgba(14,165,233,0.35)' }}>
                      {r}
                    </div>
                  ))}
                </div>
              </div>
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
            <div style={{ padding: '0.875rem 1.25rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="btn-ghost" style={{ fontSize: '0.78rem' }} onClick={() => setGeneratedReport('')}>Close</button>
              <button className="btn-primary" style={{ fontSize: '0.78rem' }} onClick={() => { navigator.clipboard.writeText(generatedReport); }}>
                Copy to Clipboard
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
