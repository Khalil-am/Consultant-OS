import { useState } from 'react';
import { useLayout } from '../hooks/useLayout';
import {
  BarChart3, Download, Share, Eye, Plus, Calendar,
  TrendingUp, AlertTriangle, CheckCircle, Sparkles, Clock, FileText,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { reports } from '../data/mockData';

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
  { title: 'Monthly Board Pack', schedule: '1st of each month', nextRun: '01 Apr 2026', recipients: 'Board Members (5)', type: 'Board Summary' },
  { title: 'Procurement Dashboard', schedule: 'Every Wednesday', nextRun: '18 Mar 2026', recipients: 'PMO Team (12)', type: 'Procurement' },
];

const statsData = [
  { label: 'Reports This Month', value: '28', trend: '+6', trendUp: true, color: '#0EA5E9' },
  { label: 'Pending Sign-offs', value: '3', trend: '-2', trendUp: false, color: '#F59E0B' },
  { label: 'Total Downloads', value: '847', trend: '+124', trendUp: true, color: '#10B981' },
  { label: 'Avg Generation Time', value: '42s', trend: '-8s', trendUp: true, color: '#8B5CF6' },
];

export default function Reports() {
  const { width, isMobile, isTablet } = useLayout();
  const [activeCategory, setActiveCategory] = useState('All Reports');
  const [reportType, setReportType] = useState('Weekly Status Report');
  const [selectedWorkspace, setSelectedWorkspace] = useState('All Workspaces');
  const [generatingPack, setGeneratingPack] = useState<string | null>(null);
  const [generatedPacks, setGeneratedPacks] = useState<Set<string>>(new Set());
  const [hoveredReport, setHoveredReport] = useState<string | null>(null);

  const filtered = reports.filter(r => {
    if (activeCategory === 'All Reports') return true;
    if (activeCategory === 'Weekly Status') return r.type === 'Weekly Status';
    if (activeCategory === 'Monthly') return r.type === 'Monthly Report';
    if (activeCategory === 'Steering Committee') return r.type === 'Steering Committee';
    if (activeCategory === 'Procurement') return r.type === 'Procurement Report';
    if (activeCategory === 'Board Summaries') return r.type === 'Board Summary';
    return true;
  });

  const handleGeneratePack = (title: string) => {
    setGeneratingPack(title);
    setTimeout(() => {
      setGeneratingPack(null);
      setGeneratedPacks(prev => new Set([...prev, title]));
    }, 2000);
  };

  return (
    <div style={{ padding: isMobile ? '0.875rem' : '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${width >= 768 ? 4 : 2}, 1fr)`, gap: '0.875rem' }}>
        {statsData.map(s => (
          <div key={s.label} className="metric-card" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${s.color}, transparent)` }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.65rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
              <span style={{ fontSize: '0.65rem', fontWeight: 600, color: s.trendUp ? '#34D399' : '#FCA5A5' }}>{s.trend}</span>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: s.color, lineHeight: 1, letterSpacing: '-0.02em' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Board Pack Generator */}
      <div style={{ background: 'linear-gradient(135deg, #0D1527, #0D1B3E)', border: '1px solid rgba(14,165,233,0.15)', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <Sparkles size={16} style={{ color: '#00D4FF' }} />
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#F1F5F9' }}>Generate Board Pack</div>
              <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '2px' }}>AI-powered report generation for board and executive audiences</div>
            </div>
          </div>
        </div>
        <div style={{ padding: '1.25rem 1.5rem', display: 'grid', gridTemplateColumns: `repeat(${width >= 900 ? 4 : width >= 600 ? 2 : 1}, 1fr)`, gap: '0.875rem' }}>
          {boardPackTypes.map(pack => (
            <div
              key={pack.title}
              className="board-pack-card"
              style={{ position: 'relative' }}
            >
              <div style={{ padding: '0.625rem', borderRadius: '8px', background: `${pack.color}15`, color: pack.color, width: 'fit-content', marginBottom: '0.75rem' }}>
                {pack.icon}
              </div>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#F1F5F9', marginBottom: '0.375rem' }}>{pack.title}</div>
              <div style={{ fontSize: '0.72rem', color: '#475569', marginBottom: '1rem', lineHeight: 1.5 }}>{pack.desc}</div>
              {generatedPacks.has(pack.title) ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: '#34D399', padding: '0.375rem 0' }}>
                  <CheckCircle size={13} /> Generated successfully
                </div>
              ) : (
                <button
                  onClick={() => handleGeneratePack(pack.title)}
                  disabled={generatingPack === pack.title}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: `1px solid ${pack.color}30`, background: `${pack.color}10`, color: pack.color, cursor: generatingPack === pack.title ? 'wait' : 'pointer', fontSize: '0.78rem', fontWeight: 600, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', transition: 'all 0.2s' }}
                  onMouseEnter={e => { if (generatingPack !== pack.title) { (e.currentTarget as HTMLElement).style.background = `${pack.color}20`; } }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${pack.color}10`; }}
                >
                  {generatingPack === pack.title ? (
                    <><Clock size={13} style={{ animation: 'spin 1s linear infinite' }} /> Generating...</>
                  ) : (
                    <><Sparkles size={13} /> Generate</>
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Category Filter */}
      <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(255,255,255,0.03)', padding: '0.25rem', borderRadius: '0.625rem', border: '1px solid rgba(255,255,255,0.06)', overflowX: 'auto', width: 'fit-content', maxWidth: '100%' }}>
        {categoryTabs.map(tab => (
          <button key={tab} className={`tab-item ${activeCategory === tab ? 'active' : ''}`} onClick={() => setActiveCategory(tab)} style={{ padding: '0.375rem 0.875rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
            {tab}
          </button>
        ))}
      </div>

      {/* Main Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: isTablet ? '1fr' : '1fr 320px', gap: '1.25rem', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Reports Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${width >= 1100 ? 3 : width >= 640 ? 2 : 1}, 1fr)`, gap: '0.875rem' }}>
            {filtered.map(report => (
              <div
                key={report.id}
                className="section-card"
                style={{ cursor: 'pointer', overflow: 'hidden', transition: 'all 0.2s', position: 'relative' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)'; setHoveredReport(report.id); }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; setHoveredReport(null); }}
              >
                <div style={{ height: '3px', background: `linear-gradient(90deg, ${report.typeColor}, transparent)` }} />
                <div style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ padding: '0.5rem', borderRadius: '8px', background: `${report.typeColor}15`, color: report.typeColor }}>
                        <BarChart3 size={16} />
                      </div>
                      <div style={{ padding: '3px 6px', borderRadius: '9999px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', fontSize: '0.65rem', color: '#475569' }}>
                        {report.pages}p
                      </div>
                    </div>
                    <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: report.status === 'Generated' ? 'rgba(16,185,129,0.1)' : report.status === 'Scheduled' ? 'rgba(14,165,233,0.1)' : 'rgba(148,163,184,0.1)', color: report.status === 'Generated' ? '#34D399' : report.status === 'Scheduled' ? '#38BDF8' : '#94A3B8', border: `1px solid ${report.status === 'Generated' ? 'rgba(16,185,129,0.2)' : 'rgba(14,165,233,0.15)'}` }}>
                      {report.status}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#F1F5F9', margin: 0, marginBottom: '0.25rem', lineHeight: 1.3 }}>
                    {report.title}
                  </h3>
                  <p style={{ fontSize: '0.72rem', color: '#475569', margin: 0, marginBottom: '0.5rem' }}>
                    {report.workspace}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <div className="avatar" style={{ width: '20px', height: '20px', fontSize: '0.55rem', flexShrink: 0 }}>
                      {report.author ? report.author.charAt(0) : 'A'}
                    </div>
                    <span style={{ fontSize: '0.68rem', color: '#475569' }}>{report.period}</span>
                    <span style={{ fontSize: '0.68rem', color: '#334155' }}>·</span>
                    <span style={{ fontSize: '0.68rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Calendar size={9} /> {report.date}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', opacity: hoveredReport === report.id ? 1 : 0.6, transition: 'opacity 0.2s' }}>
                    <button className="btn-ghost" style={{ flex: 1, height: '28px', fontSize: '0.72rem', justifyContent: 'center' }}>
                      <Eye size={11} /> Preview
                    </button>
                    <button className="btn-ghost" style={{ height: '28px', fontSize: '0.72rem', padding: '0 0.625rem' }}>
                      <Download size={11} />
                    </button>
                    <button className="btn-ghost" style={{ height: '28px', fontSize: '0.72rem', padding: '0 0.625rem' }}>
                      <Share size={11} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Scheduled Reports */}
          <div className="section-card">
            <div className="section-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={14} style={{ color: '#8B5CF6' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Scheduled Reports</span>
              </div>
              <button className="btn-ghost" style={{ padding: '0.25rem 0.625rem', fontSize: '0.72rem' }}>
                <Plus size={11} /> Add Schedule
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ minWidth: '500px' }}>
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
                    <tr key={sr.title}>
                      <td>
                        <div style={{ fontSize: '0.82rem', fontWeight: 500, color: '#F1F5F9' }}>{sr.title}</div>
                      </td>
                      <td style={{ fontSize: '0.75rem', color: '#475569' }}>{sr.schedule}</td>
                      <td>
                        <span style={{ fontSize: '0.72rem', padding: '2px 7px', borderRadius: '4px', background: 'rgba(14,165,233,0.1)', color: '#38BDF8', border: '1px solid rgba(14,165,233,0.15)' }}>
                          {sr.nextRun}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{sr.recipients}</td>
                      <td>
                        <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '3px', background: 'rgba(139,92,246,0.1)', color: '#A78BFA', border: '1px solid rgba(139,92,246,0.2)' }}>
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
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Reports Generated – 6 Months</span>
            </div>
            <div style={{ padding: '1rem 0.5rem 0.5rem' }}>
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={reportVolumeData}>
                  <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ background: '#111B35', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '0.75rem' }} labelStyle={{ color: '#94A3B8' }} itemStyle={{ color: '#8B5CF6' }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {reportVolumeData.map((_, index) => (
                      <Cell key={index} fill={index === reportVolumeData.length - 1 ? '#8B5CF6' : 'rgba(139,92,246,0.4)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Generate New Report */}
          <div className="section-card" style={{ background: 'linear-gradient(160deg, #0D1527, #111827)' }}>
            <div className="section-card-header" style={{ borderBottom: '1px solid rgba(139,92,246,0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={15} style={{ color: '#8B5CF6' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Generate Report</span>
              </div>
            </div>
            <div style={{ padding: '1rem' }}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.72rem', color: '#475569', display: 'block', marginBottom: '0.375rem' }}>Report Type</label>
                <select value={reportType} onChange={e => setReportType(e.target.value)} style={{ width: '100%', padding: '0.5rem 0.625rem', borderRadius: '6px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#F1F5F9', fontFamily: 'inherit' }}>
                  {reportTypeOptions.map(opt => <option key={opt}>{opt}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.72rem', color: '#475569', display: 'block', marginBottom: '0.375rem' }}>Workspace</label>
                <select value={selectedWorkspace} onChange={e => setSelectedWorkspace(e.target.value)} style={{ width: '100%', padding: '0.5rem 0.625rem', borderRadius: '6px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#F1F5F9', fontFamily: 'inherit' }}>
                  <option>All Workspaces</option>
                  <option>NCA Digital Transformation</option>
                  <option>ADNOC Supply Chain</option>
                  <option>MOCI Procurement Reform</option>
                  <option>Smart City Infrastructure PMO</option>
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.72rem', color: '#475569', display: 'block', marginBottom: '0.375rem' }}>Period</label>
                <select style={{ width: '100%', padding: '0.5rem 0.625rem', borderRadius: '6px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#F1F5F9', fontFamily: 'inherit' }}>
                  <option>This Week (W10)</option>
                  <option>Last Week (W9)</option>
                  <option>This Month (March)</option>
                  <option>Q1 2026</option>
                </select>
              </div>
              <button className="btn-ai" style={{ width: '100%', justifyContent: 'center' }}>
                <Sparkles size={14} /> Generate Report
              </button>
            </div>
          </div>

          {/* AI Narrative */}
          <div className="section-card">
            <div className="section-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={14} style={{ color: '#8B5CF6' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>AI Insights</span>
              </div>
              <span style={{ fontSize: '0.65rem', color: '#334155' }}>Updated 5 min ago</span>
            </div>
            <div style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.7rem', color: '#475569', marginBottom: '0.875rem', lineHeight: 1.6, padding: '0.625rem', background: 'rgba(139,92,246,0.05)', borderRadius: '6px', border: '1px solid rgba(139,92,246,0.1)' }}>
                Portfolio is performing at 87% on-time delivery this quarter. Two engagements require immediate attention.
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.5rem' }}>
                  <CheckCircle size={13} style={{ color: '#10B981' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#34D399', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Highlights</span>
                </div>
                {aiNarrative.highlights.map((h, i) => (
                  <div key={i} style={{ fontSize: '0.75rem', color: '#94A3B8', lineHeight: 1.5, paddingLeft: '1rem', marginBottom: '0.375rem', borderLeft: '2px solid rgba(16,185,129,0.3)' }}>
                    {h}
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.5rem' }}>
                  <AlertTriangle size={13} style={{ color: '#F59E0B' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#FCD34D', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Concerns</span>
                </div>
                {aiNarrative.concerns.map((c, i) => (
                  <div key={i} style={{ fontSize: '0.75rem', color: '#94A3B8', lineHeight: 1.5, paddingLeft: '1rem', marginBottom: '0.375rem', borderLeft: '2px solid rgba(245,158,11,0.3)' }}>
                    {c}
                  </div>
                ))}
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.5rem' }}>
                  <TrendingUp size={13} style={{ color: '#0EA5E9' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38BDF8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recommendations</span>
                </div>
                {aiNarrative.recommendations.map((r, i) => (
                  <div key={i} style={{ fontSize: '0.75rem', color: '#94A3B8', lineHeight: 1.5, paddingLeft: '1rem', marginBottom: '0.375rem', borderLeft: '2px solid rgba(14,165,233,0.3)' }}>
                    {r}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
