import { useState } from 'react';
import { useLayout } from '../hooks/useLayout';
import {
  AlertTriangle, CheckSquare, Clock, TrendingUp, Plus, Filter, DollarSign,
} from 'lucide-react';
import { tasks, risks } from '../data/mockData';

const kanbanColumns = [
  { key: 'Backlog', label: 'Backlog', color: '#475569' },
  { key: 'In Progress', label: 'In Progress', color: '#0EA5E9' },
  { key: 'In Review', label: 'In Review', color: '#8B5CF6' },
  { key: 'Completed', label: 'Completed', color: '#10B981' },
  { key: 'Overdue', label: 'Overdue', color: '#EF4444' },
];

const priorityColors: Record<string, string> = {
  High: '#EF4444',
  Medium: '#F59E0B',
  Low: '#10B981',
};

type RAIDTab = 'Tasks' | 'Risks' | 'Assumptions' | 'Issues' | 'Dependencies';

const assumptions = [
  { id: 'AS-001', statement: 'Steering committee approval will be obtained within 5 business days of submission', owner: 'AM', validUntil: '30 Jun 2026', status: 'Valid' },
  { id: 'AS-002', statement: 'Client IT team will provide VPN access for integration work by 20 March', owner: 'SK', validUntil: '20 Mar 2026', status: 'Under Review' },
  { id: 'AS-003', statement: 'Vendor B pricing remains fixed per the proposal dated 01 Feb 2026', owner: 'RT', validUntil: '01 May 2026', status: 'Valid' },
  { id: 'AS-004', statement: 'Legacy system migration data quality is 95%+ clean', owner: 'DN', validUntil: '15 Mar 2026', status: 'Expired' },
  { id: 'AS-005', statement: 'Regulatory approval for new digital channels will not require additional assessment', owner: 'FH', validUntil: '31 May 2026', status: 'Valid' },
];

const issues = [
  { id: 'IS-001', issue: 'ADNOC contract review blocked due to absent legal signatory', workspace: 'ADNOC Supply Chain', priority: 'Critical', owner: 'RT', raised: '10 Mar 2026', targetRes: '15 Mar 2026', status: 'Open' },
  { id: 'IS-002', issue: 'Smart City Package 3 contractor failed mobilization audit — replacement needed', workspace: 'Smart City PMO', priority: 'Critical', owner: 'JL', raised: '08 Mar 2026', targetRes: '22 Mar 2026', status: 'In Progress' },
  { id: 'IS-003', issue: 'ENB UAT environment intermittently unavailable — delaying testing cycle', workspace: 'Banking Core', priority: 'High', owner: 'DN', raised: '11 Mar 2026', targetRes: '14 Mar 2026', status: 'In Progress' },
  { id: 'IS-004', issue: 'NCA Phase 3 resources double-booked with Ministry Digital project', workspace: 'NCA Digital Transf.', priority: 'Medium', owner: 'AM', raised: '06 Mar 2026', targetRes: '20 Mar 2026', status: 'Open' },
  { id: 'IS-005', issue: 'Procurement portal integration API version deprecated — rework required', workspace: 'MOCI Procurement', priority: 'Medium', owner: 'FH', raised: '12 Mar 2026', targetRes: '31 Mar 2026', status: 'Open' },
];

const dependencies = [
  { id: 'DEP-001', fromWorkspace: 'NCA Digital Transf.', description: 'Requires identity federation module from Ministry Digital project', toWorkspace: 'Ministry Digital', due: '01 Apr 2026', status: 'On Track' },
  { id: 'DEP-002', fromWorkspace: 'Smart City PMO', description: 'Requires ADNOC utility data feed for smart grid integration', toWorkspace: 'ADNOC Supply Chain', due: '15 Mar 2026', status: 'At Risk' },
  { id: 'DEP-003', fromWorkspace: 'Banking Core', description: 'Requires MOCI KYC API endpoint documentation', toWorkspace: 'MOCI Procurement', due: '20 Mar 2026', status: 'On Track' },
  { id: 'DEP-004', fromWorkspace: 'Healthcare Digital', description: 'Requires Ministry Digital patient portal API specs', toWorkspace: 'Ministry Digital', due: '30 Apr 2026', status: 'Upcoming' },
  { id: 'DEP-005', fromWorkspace: 'ADNOC Supply Chain', description: 'ERP go-live contingent on Smart City IoT data schema finalization', toWorkspace: 'Smart City PMO', due: '01 May 2026', status: 'At Risk' },
];

// Risk heatmap: cells[impact][probability] -> risk IDs
function buildHeatmap() {
  const grid: Record<number, Record<number, string[]>> = {};
  for (let i = 1; i <= 5; i++) {
    grid[i] = {};
    for (let p = 1; p <= 5; p++) {
      grid[i][p] = [];
    }
  }
  risks.forEach((r, idx) => {
    const imp = Math.min(5, Math.max(1, r.impact));
    const prob = Math.min(5, Math.max(1, r.probability));
    grid[imp][prob].push(String(idx + 1));
  });
  return grid;
}

function heatmapCellColor(impact: number, prob: number): string {
  const score = impact * prob;
  if (score >= 17) return 'rgba(239,68,68,0.3)';
  if (score >= 10) return 'rgba(239,68,68,0.15)';
  if (score >= 5) return 'rgba(245,158,11,0.15)';
  return 'rgba(16,185,129,0.12)';
}

function heatmapBorder(impact: number, prob: number): string {
  const score = impact * prob;
  if (score >= 17) return 'rgba(239,68,68,0.4)';
  if (score >= 10) return 'rgba(239,68,68,0.25)';
  if (score >= 5) return 'rgba(245,158,11,0.25)';
  return 'rgba(16,185,129,0.2)';
}

function fmtAED(val: number): string {
  if (val >= 1000000) return `AED ${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `AED ${(val / 1000).toFixed(0)}K`;
  return `AED ${val.toLocaleString()}`;
}

const riskFinancialImpact: Record<string, number> = {
  'Critical': 2500000,
  'High': 1200000,
  'Medium': 450000,
  'Low': 120000,
};

export default function Tasks() {
  const { width, isMobile } = useLayout();
  const [activeView, setActiveView] = useState<RAIDTab>('Tasks');
  const heatmap = buildHeatmap();

  const tasksByStatus = (status: string) => tasks.filter(t => t.status === status);

  const statusColor = (s: string) => {
    if (s === 'Valid') return '#10B981';
    if (s === 'Expired') return '#EF4444';
    return '#F59E0B';
  };

  const depStatusColor = (s: string) => {
    if (s === 'On Track') return '#10B981';
    if (s === 'At Risk') return '#F59E0B';
    if (s === 'Upcoming') return '#0EA5E9';
    return '#EF4444';
  };

  const issueColor = (p: string) => {
    if (p === 'Critical') return '#EF4444';
    if (p === 'High') return '#F59E0B';
    return '#0EA5E9';
  };

  const raidTabs: RAIDTab[] = ['Tasks', 'Risks', 'Assumptions', 'Issues', 'Dependencies'];

  return (
    <div style={{ padding: isMobile ? '0.875rem' : '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Summary Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${width >= 768 ? 4 : 2}, 1fr)`, gap: '0.875rem' }}>
        {[
          { label: 'Total Tasks', value: tasks.length, icon: <CheckSquare size={16} />, color: '#0EA5E9', sub: `${tasks.filter(t => t.status === 'In Progress').length} in progress` },
          { label: 'Overdue', value: tasks.filter(t => t.status === 'Overdue').length, icon: <Clock size={16} />, color: '#EF4444', sub: 'Require immediate action' },
          { label: 'High Priority', value: tasks.filter(t => t.priority === 'High').length, icon: <AlertTriangle size={16} />, color: '#F59E0B', sub: 'Across all workspaces' },
          { label: 'Active Risks', value: risks.filter(r => r.status === 'Open' || r.status === 'Monitoring').length, icon: <TrendingUp size={16} />, color: '#8B5CF6', sub: `${risks.filter(r => r.severity === 'Critical').length} critical` },
        ].map(stat => (
          <div key={stat.label} className="metric-card" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${stat.color}, transparent)` }} />
            <div style={{ padding: '0.625rem', borderRadius: '8px', background: `${stat.color}15`, color: stat.color, flexShrink: 0 }}>
              {stat.icon}
            </div>
            <div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#F1F5F9', lineHeight: 1, letterSpacing: '-0.02em' }}>{stat.value}</div>
              <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '2px' }}>{stat.label}</div>
              <div style={{ fontSize: '0.65rem', color: '#334155', marginTop: '1px' }}>{stat.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* RAID Tab Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(255,255,255,0.03)', padding: '0.25rem', borderRadius: '0.625rem', border: '1px solid rgba(255,255,255,0.06)', overflowX: 'auto' }}>
          {raidTabs.map(view => (
            <button key={view} className={`tab-item ${activeView === view ? 'active' : ''}`} onClick={() => setActiveView(view)} style={{ padding: '0.375rem 1rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
              {view}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-ghost" style={{ height: '34px', fontSize: '0.8rem' }}>
            <Filter size={13} /> Filter
          </button>
          <button className="btn-primary" style={{ height: '34px', fontSize: '0.8rem' }}>
            <Plus size={13} /> {activeView === 'Tasks' ? 'New Task' : activeView === 'Risks' ? 'Log Risk' : activeView === 'Issues' ? 'Log Issue' : 'Add Item'}
          </button>
        </div>
      </div>

      {/* Tasks View – Kanban */}
      {activeView === 'Tasks' && (
        <div style={{ display: 'flex', gap: '0.875rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
          {kanbanColumns.map(col => {
            const colTasks = tasksByStatus(col.key);
            return (
              <div key={col.key} style={{ minWidth: '240px', width: '240px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '9999px', background: col.color }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94A3B8' }}>{col.label}</span>
                  </div>
                  <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '9999px', background: `${col.color}15`, color: col.color }}>
                    {colTasks.length}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: '120px', padding: '0.5rem', borderRadius: '0.625rem', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.06)' }}>
                  {colTasks.map(task => (
                    <div key={task.id} className="kanban-card">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.62rem', padding: '1px 5px', borderRadius: '3px', background: 'rgba(255,255,255,0.04)', color: '#334155', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px' }}>
                          {task.workspace.split(' ').slice(0, 2).join(' ')}
                        </span>
                        <div style={{ width: '8px', height: '8px', borderRadius: '9999px', background: priorityColors[task.priority], boxShadow: `0 0 6px ${priorityColors[task.priority]}60` }} />
                      </div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#F1F5F9', lineHeight: 1.4, marginBottom: '0.5rem' }}>
                        {task.title.slice(0, 60)}{task.title.length > 60 ? '...' : ''}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.65rem', color: task.status === 'Overdue' ? '#FCA5A5' : '#475569', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Clock size={9} /> {task.dueDate}
                        </span>
                        <div className="avatar" style={{ width: '20px', height: '20px', fontSize: '0.55rem' }}>
                          {task.assignee}
                        </div>
                      </div>
                      {(task.linkedDoc || task.linkedMeeting) && (
                        <div style={{ marginTop: '0.375rem', paddingTop: '0.375rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                          <span style={{ fontSize: '0.62rem', color: '#334155' }}>
                            {task.linkedDoc ? `Doc: ${task.linkedDoc.slice(0, 22)}...` : `Mtg: ${task.linkedMeeting?.slice(0, 22)}...`}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                  {colTasks.length === 0 && (
                    <div style={{ padding: '1rem', textAlign: 'center', color: '#1E2E52', fontSize: '0.75rem' }}>No tasks</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Risks View */}
      {activeView === 'Risks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Risk Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${width >= 768 ? 4 : 2}, 1fr)`, gap: '0.75rem' }}>
            {[
              { label: 'Critical', color: '#EF4444', bg: 'rgba(239,68,68,0.1)', count: risks.filter(r => r.severity === 'Critical').length },
              { label: 'High', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', count: risks.filter(r => r.severity === 'High').length },
              { label: 'Medium', color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)', count: risks.filter(r => r.severity === 'Medium').length },
              { label: 'Low', color: '#10B981', bg: 'rgba(16,185,129,0.1)', count: risks.filter(r => r.severity === 'Low').length },
            ].map(cat => (
              <div key={cat.label} style={{ padding: '1rem 1.25rem', borderRadius: '0.75rem', background: cat.bg, border: `1px solid ${cat.color}25`, display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 900, color: cat.color, lineHeight: 1 }}>{cat.count}</div>
                  <div style={{ padding: '0.375rem', borderRadius: '6px', background: `${cat.color}20`, color: cat.color }}>
                    <AlertTriangle size={14} />
                  </div>
                </div>
                <div style={{ fontSize: '0.78rem', color: cat.color, fontWeight: 600 }}>{cat.label} Risks</div>
                <div style={{ fontSize: '0.68rem', color: '#475569' }}>
                  Exposure: {fmtAED(cat.count * riskFinancialImpact[cat.label])}
                </div>
              </div>
            ))}
          </div>

          {/* Risk Heatmap */}
          <div className="section-card">
            <div className="section-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={14} style={{ color: '#EF4444' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Risk Heat Map – All Portfolios</span>
              </div>
              <span style={{ fontSize: '0.72rem', color: '#475569' }}>{risks.length} risks plotted</span>
            </div>
            <div style={{ padding: '1.25rem', overflowX: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', minWidth: '400px' }}>
                {/* Y-axis label */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', height: '280px', paddingBottom: '2rem' }}>
                  {[5, 4, 3, 2, 1].map(i => (
                    <div key={i} style={{ fontSize: '0.65rem', color: '#475569', textAlign: 'right', width: '80px', lineHeight: 1.2 }}>
                      {i === 5 ? 'Catastrophic' : i === 4 ? 'Major' : i === 3 ? 'Moderate' : i === 2 ? 'Minor' : 'Negligible'}
                    </div>
                  ))}
                </div>
                <div style={{ flex: 1 }}>
                  {/* Grid */}
                  {[5, 4, 3, 2, 1].map(impact => (
                    <div key={impact} style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '3px', marginBottom: '3px' }}>
                      {[1, 2, 3, 4, 5].map(prob => {
                        const cellRisks = heatmap[impact]?.[prob] || [];
                        return (
                          <div
                            key={prob}
                            style={{
                              height: '52px',
                              borderRadius: '5px',
                              background: heatmapCellColor(impact, prob),
                              border: `1px solid ${heatmapBorder(impact, prob)}`,
                              display: 'flex',
                              flexWrap: 'wrap',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '2px',
                              padding: '3px',
                            }}
                          >
                            {cellRisks.slice(0, 4).map((rId) => (
                              <div
                                key={rId}
                                style={{
                                  width: '18px', height: '18px', borderRadius: '50%',
                                  background: heatmapCellColor(impact, prob).includes('239') ? 'rgba(239,68,68,0.5)' : heatmapCellColor(impact, prob).includes('245') ? 'rgba(245,158,11,0.5)' : 'rgba(16,185,129,0.4)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '0.55rem', fontWeight: 700, color: 'white',
                                }}
                              >
                                {rId}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  {/* X-axis labels */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '3px', marginTop: '6px' }}>
                    {['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost Certain'].map(l => (
                      <div key={l} style={{ fontSize: '0.6rem', color: '#475569', textAlign: 'center', lineHeight: 1.2 }}>{l}</div>
                    ))}
                  </div>
                  <div style={{ textAlign: 'center', marginTop: '0.375rem', fontSize: '0.65rem', color: '#334155' }}>Probability</div>
                </div>
              </div>
              {/* Legend */}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                {[['Low (1-4)', 'rgba(16,185,129,0.2)', '#10B981'], ['Medium (5-9)', 'rgba(245,158,11,0.2)', '#F59E0B'], ['High (10-16)', 'rgba(239,68,68,0.2)', '#EF4444'], ['Critical (17-25)', 'rgba(239,68,68,0.4)', '#EF4444']].map(([label, bg, border]) => (
                  <div key={label as string} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: bg as string, border: `1px solid ${border as string}` }} />
                    <span style={{ fontSize: '0.68rem', color: '#475569' }}>{label as string}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Risk Register Table */}
          <div className="section-card">
            <div className="section-card-header">
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Risk Register</span>
              <span style={{ fontSize: '0.75rem', color: '#475569' }}>{risks.length} risks across 8 workspaces</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ minWidth: '800px' }}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Risk Title</th>
                    <th>Workspace</th>
                    <th>Category</th>
                    <th style={{ textAlign: 'center' }}>P</th>
                    <th style={{ textAlign: 'center' }}>I</th>
                    <th>Severity</th>
                    <th>Fin. Impact</th>
                    <th>Status</th>
                    <th>Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {risks.map(risk => (
                    <tr key={risk.id} style={{ cursor: 'pointer' }}>
                      <td style={{ color: '#EF4444', fontWeight: 500 }}>{risk.id}</td>
                      <td>
                        <div style={{ fontSize: '0.82rem', fontWeight: 500, color: '#F1F5F9', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{risk.title}</div>
                        <div style={{ fontSize: '0.68rem', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>{risk.mitigation.slice(0, 40)}...</div>
                      </td>
                      <td style={{ fontSize: '0.72rem', maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{risk.workspace.split(' ').slice(0, 2).join(' ')}</td>
                      <td><span style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: '3px', background: 'rgba(255,255,255,0.05)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.07)' }}>{risk.category}</span></td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 700, background: risk.probability >= 4 ? 'rgba(239,68,68,0.15)' : risk.probability >= 3 ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)', color: risk.probability >= 4 ? '#FCA5A5' : risk.probability >= 3 ? '#FCD34D' : '#34D399' }}>
                          {risk.probability}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 700, background: risk.impact >= 5 ? 'rgba(239,68,68,0.2)' : risk.impact >= 4 ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)', color: risk.impact >= 5 ? '#FCA5A5' : risk.impact >= 4 ? '#FCD34D' : '#34D399' }}>
                          {risk.impact}
                        </span>
                      </td>
                      <td><span className={`status-risk-${risk.severity.toLowerCase()}`}>{risk.severity}</span></td>
                      <td style={{ fontSize: '0.72rem', color: '#F59E0B', fontWeight: 600 }}>
                        {fmtAED(riskFinancialImpact[risk.severity] || 100000)}
                      </td>
                      <td>
                        <span className={risk.status === 'Mitigated' || risk.status === 'Closed' ? 'status-approved' : risk.status === 'Monitoring' ? 'status-review' : 'status-pending'} style={{ fontSize: '0.65rem' }}>
                          {risk.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.75rem', color: '#475569' }}>{risk.owner.split(' ').map((n: string) => n[0]).join('')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Assumptions View */}
      {activeView === 'Assumptions' && (
        <div className="section-card">
          <div className="section-card-header">
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Assumptions Register</span>
            <span style={{ fontSize: '0.72rem', color: '#475569' }}>{assumptions.length} assumptions logged</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ minWidth: '700px' }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Assumption Statement</th>
                  <th>Owner</th>
                  <th>Valid Until</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {assumptions.map(a => (
                  <tr key={a.id}>
                    <td style={{ color: '#0EA5E9', fontWeight: 500 }}>{a.id}</td>
                    <td style={{ maxWidth: '320px' }}>
                      <div style={{ fontSize: '0.8rem', color: '#F1F5F9', lineHeight: 1.4 }}>{a.statement}</div>
                    </td>
                    <td>
                      <div className="avatar" style={{ width: '24px', height: '24px', fontSize: '0.62rem' }}>{a.owner}</div>
                    </td>
                    <td style={{ fontSize: '0.78rem', color: '#94A3B8' }}>{a.validUntil}</td>
                    <td>
                      <span style={{ fontSize: '0.72rem', padding: '2px 7px', borderRadius: '4px', background: `${statusColor(a.status)}15`, color: statusColor(a.status), border: `1px solid ${statusColor(a.status)}25` }}>
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Issues View */}
      {activeView === 'Issues' && (
        <div className="section-card">
          <div className="section-card-header">
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Issues Log</span>
            <span style={{ fontSize: '0.72rem', color: '#475569' }}>{issues.length} issues tracked</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ minWidth: '800px' }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Issue</th>
                  <th>Workspace</th>
                  <th>Priority</th>
                  <th>Owner</th>
                  <th>Raised</th>
                  <th>Target Res.</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {issues.map(iss => (
                  <tr key={iss.id}>
                    <td style={{ color: '#EF4444', fontWeight: 500 }}>{iss.id}</td>
                    <td style={{ maxWidth: '240px' }}>
                      <div style={{ fontSize: '0.8rem', color: '#F1F5F9', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{iss.issue}</div>
                    </td>
                    <td style={{ fontSize: '0.72rem', color: '#94A3B8', maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{iss.workspace}</td>
                    <td>
                      <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: `${issueColor(iss.priority)}15`, color: issueColor(iss.priority), border: `1px solid ${issueColor(iss.priority)}25`, fontWeight: 600 }}>
                        {iss.priority}
                      </span>
                    </td>
                    <td><div className="avatar" style={{ width: '22px', height: '22px', fontSize: '0.58rem' }}>{iss.owner}</div></td>
                    <td style={{ fontSize: '0.72rem', color: '#475569' }}>{iss.raised}</td>
                    <td style={{ fontSize: '0.72rem', color: iss.status === 'In Progress' ? '#38BDF8' : '#94A3B8' }}>{iss.targetRes}</td>
                    <td>
                      <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', background: iss.status === 'In Progress' ? 'rgba(14,165,233,0.1)' : 'rgba(245,158,11,0.1)', color: iss.status === 'In Progress' ? '#38BDF8' : '#FCD34D', border: `1px solid ${iss.status === 'In Progress' ? 'rgba(14,165,233,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
                        {iss.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dependencies View */}
      {activeView === 'Dependencies' && (
        <div className="section-card">
          <div className="section-card-header">
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Cross-Workspace Dependencies</span>
            <span style={{ fontSize: '0.72rem', color: '#475569' }}>{dependencies.length} dependencies tracked</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ minWidth: '750px' }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>From Workspace</th>
                  <th>Dependency</th>
                  <th>To Workspace</th>
                  <th>Due Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {dependencies.map(dep => (
                  <tr key={dep.id}>
                    <td style={{ color: '#8B5CF6', fontWeight: 500 }}>{dep.id}</td>
                    <td style={{ fontSize: '0.78rem', color: '#F1F5F9', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dep.fromWorkspace}</td>
                    <td style={{ maxWidth: '240px' }}>
                      <div style={{ fontSize: '0.78rem', color: '#94A3B8', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{dep.description}</div>
                    </td>
                    <td style={{ fontSize: '0.78rem', color: '#F1F5F9', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dep.toWorkspace}</td>
                    <td style={{ fontSize: '0.72rem', color: '#475569' }}>{dep.due}</td>
                    <td>
                      <span style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: '4px', background: `${depStatusColor(dep.status)}15`, color: depStatusColor(dep.status), border: `1px solid ${depStatusColor(dep.status)}25` }}>
                        {dep.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
