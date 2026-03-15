import { useState } from 'react';
import { useLayout } from '../hooks/useLayout';
import {
  BarChart3, Download, Share, Eye, Plus, Calendar,
  TrendingUp, AlertTriangle, CheckCircle, Sparkles
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

export default function Reports() {
  const { width, isMobile, isTablet } = useLayout();
  const [activeCategory, setActiveCategory] = useState('All Reports');
  const [reportType, setReportType] = useState('Weekly Status Report');
  const [selectedWorkspace, setSelectedWorkspace] = useState('All Workspaces');

  const filtered = reports.filter(r => {
    if (activeCategory === 'All Reports') return true;
    if (activeCategory === 'Weekly Status') return r.type === 'Weekly Status';
    if (activeCategory === 'Monthly') return r.type === 'Monthly Report';
    if (activeCategory === 'Steering Committee') return r.type === 'Steering Committee';
    if (activeCategory === 'Procurement') return r.type === 'Procurement Report';
    if (activeCategory === 'Board Summaries') return r.type === 'Board Summary';
    return true;
  });

  return (
    <div style={{ padding: isMobile ? '0.875rem' : '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${width >= 768 ? 4 : 2}, 1fr)`, gap: '0.875rem' }}>
        {[
          { label: 'Reports This Month', value: '8', color: '#0EA5E9' },
          { label: 'Scheduled Reports', value: '3', color: '#8B5CF6' },
          { label: 'Downloads', value: '47', color: '#10B981' },
          { label: 'Shared Reports', value: '12', color: '#F59E0B' },
        ].map(s => (
          <div key={s.label} className="metric-card" style={{ padding: '1rem' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '2px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Category Filter */}
      <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(255,255,255,0.03)', padding: '0.25rem', borderRadius: '0.625rem', border: '1px solid rgba(255,255,255,0.06)', width: 'fit-content' }}>
        {categoryTabs.map(tab => (
          <button
            key={tab}
            className={`tab-item ${activeCategory === tab ? 'active' : ''}`}
            onClick={() => setActiveCategory(tab)}
            style={{ padding: '0.375rem 0.875rem', fontSize: '0.8rem' }}
          >
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
                style={{ cursor: 'pointer', overflow: 'hidden' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'}
              >
                <div style={{ height: '3px', background: `linear-gradient(90deg, ${report.typeColor}, transparent)` }} />
                <div style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <div style={{ padding: '0.5rem', borderRadius: '8px', background: `${report.typeColor}15`, color: report.typeColor }}>
                      <BarChart3 size={16} />
                    </div>
                    <span style={{
                      fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px',
                      background: report.status === 'Generated' ? 'rgba(16,185,129,0.1)' : report.status === 'Scheduled' ? 'rgba(14,165,233,0.1)' : 'rgba(148,163,184,0.1)',
                      color: report.status === 'Generated' ? '#34D399' : report.status === 'Scheduled' ? '#38BDF8' : '#94A3B8',
                      border: `1px solid ${report.status === 'Generated' ? 'rgba(16,185,129,0.2)' : 'rgba(14,165,233,0.15)'}`,
                    }}>
                      {report.status}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#F1F5F9', margin: 0, marginBottom: '0.25rem', lineHeight: 1.3 }}>
                    {report.title}
                  </h3>
                  <p style={{ fontSize: '0.72rem', color: '#475569', margin: 0, marginBottom: '0.875rem' }}>
                    {report.workspace}
                  </p>

                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.875rem' }}>
                    <span style={{ fontSize: '0.7rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Calendar size={10} /> {report.date}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#334155' }}>{report.pages} pages</span>
                    <span style={{ fontSize: '0.7rem', color: '#334155' }}>{report.period}</span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
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
                  <Tooltip
                    contentStyle={{ background: '#111B35', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '0.75rem' }}
                    labelStyle={{ color: '#94A3B8' }}
                    itemStyle={{ color: '#8B5CF6' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {reportVolumeData.map((entry, index) => (
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
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Generate New Report</span>
              </div>
            </div>
            <div style={{ padding: '1rem' }}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.72rem', color: '#475569', display: 'block', marginBottom: '0.375rem' }}>Report Type</label>
                <select
                  value={reportType}
                  onChange={e => setReportType(e.target.value)}
                  style={{
                    width: '100%', padding: '0.5rem 0.625rem', borderRadius: '6px', fontSize: '0.8rem',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    color: '#F1F5F9', fontFamily: 'inherit',
                  }}
                >
                  {reportTypeOptions.map(opt => <option key={opt}>{opt}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.72rem', color: '#475569', display: 'block', marginBottom: '0.375rem' }}>Workspace</label>
                <select
                  value={selectedWorkspace}
                  onChange={e => setSelectedWorkspace(e.target.value)}
                  style={{
                    width: '100%', padding: '0.5rem 0.625rem', borderRadius: '6px', fontSize: '0.8rem',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    color: '#F1F5F9', fontFamily: 'inherit',
                  }}
                >
                  <option>All Workspaces</option>
                  <option>NCA Digital Transformation</option>
                  <option>ADNOC Supply Chain</option>
                  <option>MOCI Procurement Reform</option>
                  <option>Smart City Infrastructure PMO</option>
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.72rem', color: '#475569', display: 'block', marginBottom: '0.375rem' }}>Period</label>
                <select style={{
                  width: '100%', padding: '0.5rem 0.625rem', borderRadius: '6px', fontSize: '0.8rem',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  color: '#F1F5F9', fontFamily: 'inherit',
                }}>
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
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>AI Narrative Summary</span>
              </div>
            </div>
            <div style={{ padding: '1rem' }}>
              {/* Highlights */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.5rem' }}>
                  <CheckCircle size={13} style={{ color: '#10B981' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#34D399' }}>Highlights</span>
                </div>
                {aiNarrative.highlights.map((h, i) => (
                  <div key={i} style={{ fontSize: '0.75rem', color: '#475569', lineHeight: 1.5, paddingLeft: '1rem', marginBottom: '0.375rem', borderLeft: '2px solid rgba(16,185,129,0.3)' }}>
                    {h}
                  </div>
                ))}
              </div>

              {/* Concerns */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.5rem' }}>
                  <AlertTriangle size={13} style={{ color: '#F59E0B' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#FCD34D' }}>Concerns</span>
                </div>
                {aiNarrative.concerns.map((c, i) => (
                  <div key={i} style={{ fontSize: '0.75rem', color: '#475569', lineHeight: 1.5, paddingLeft: '1rem', marginBottom: '0.375rem', borderLeft: '2px solid rgba(245,158,11,0.3)' }}>
                    {c}
                  </div>
                ))}
              </div>

              {/* Recommendations */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.5rem' }}>
                  <TrendingUp size={13} style={{ color: '#0EA5E9' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#38BDF8' }}>Recommendations</span>
                </div>
                {aiNarrative.recommendations.map((r, i) => (
                  <div key={i} style={{ fontSize: '0.75rem', color: '#475569', lineHeight: 1.5, paddingLeft: '1rem', marginBottom: '0.375rem', borderLeft: '2px solid rgba(14,165,233,0.3)' }}>
                    {r}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
