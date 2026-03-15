import { useNavigate } from 'react-router-dom';
import {
  Briefcase, FileText, Zap, CheckSquare, Clock, AlertTriangle,
  TrendingUp, TrendingDown, Upload, Play, Video, Sparkles,
  ArrowRight, Circle, Bot
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { automationRunsData, documentsByTypeData, activities, meetings, tasks } from '../data/mockData';

const kpiCards = [
  {
    label: 'Active Projects',
    value: '12',
    icon: <Briefcase size={18} />,
    color: '#0EA5E9',
    bg: 'rgba(14,165,233,0.1)',
    trend: '+2',
    trendUp: true,
  },
  {
    label: 'Docs Processed',
    value: '847',
    icon: <FileText size={18} />,
    color: '#8B5CF6',
    bg: 'rgba(139,92,246,0.1)',
    trend: '+34',
    trendUp: true,
  },
  {
    label: 'Automations Run',
    value: '1,284',
    icon: <Zap size={18} />,
    color: '#00D4FF',
    bg: 'rgba(0,212,255,0.1)',
    trend: '+128',
    trendUp: true,
  },
  {
    label: 'Open Actions',
    value: '34',
    icon: <CheckSquare size={18} />,
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.1)',
    trend: '-6',
    trendUp: false,
  },
  {
    label: 'Pending Approvals',
    value: '8',
    icon: <Clock size={18} />,
    color: '#10B981',
    bg: 'rgba(16,185,129,0.1)',
    trend: '+3',
    trendUp: false,
  },
  {
    label: 'Risk Alerts',
    value: '3',
    icon: <AlertTriangle size={18} />,
    color: '#EF4444',
    bg: 'rgba(239,68,68,0.1)',
    trend: '+1',
    trendUp: false,
  },
];

const recentAutomations = [
  { name: 'BRD Generator', workspace: 'NCA Digital Transformation', status: 'Success', time: '2h ago', outputs: 1 },
  { name: 'Meeting Minutes', workspace: 'Banking Core Transformation', status: 'Success', time: '3h ago', outputs: 1 },
  { name: 'Weekly Status Reports', workspace: 'Multiple', status: 'Success', time: '8h ago', outputs: 4 },
  { name: 'Risk Register Analyzer', workspace: 'Smart City PMO', status: 'Warning', time: '1d ago', outputs: 1 },
  { name: 'Knowledge Base Indexer', workspace: 'All', status: 'Success', time: '15m ago', outputs: 12 },
];

const pendingApprovals = [
  { title: 'NCA BRD v2.3', requester: 'AM', type: 'Document Approval', urgency: 'High' },
  { title: 'SC-10 Budget AED 2.4M', requester: 'RT', type: 'Budget Approval', urgency: 'High' },
  { title: 'MOCI Vendor Shortlist', requester: 'FH', type: 'Procurement Decision', urgency: 'Medium' },
  { title: 'Healthcare Strategy Report', requester: 'SK', type: 'Report Sign-off', urgency: 'Low' },
];

const aiRecommendations = [
  {
    icon: '⚡',
    title: 'Generate SC-10 Committee Pack',
    detail: 'Meeting in 5 days — 3 pending decisions need packaging',
    action: 'Generate Now',
    color: '#8B5CF6',
  },
  {
    icon: '⚠️',
    title: 'Review 3 Critical Risks',
    detail: 'Smart City & NCA have unmitigated critical risks',
    action: 'View Risks',
    color: '#EF4444',
  },
  {
    icon: '📋',
    title: 'ADNOC Contract Overdue',
    detail: 'Contract review task 3 days overdue — assign or escalate',
    action: 'View Task',
    color: '#F59E0B',
  },
];

const quickActions = [
  { icon: <Upload size={22} />, label: 'Upload Document', color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)', path: '/documents' },
  { icon: <Zap size={22} />, label: 'Run Automation', color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)', path: '/automations' },
  { icon: <Video size={22} />, label: 'New Meeting', color: '#10B981', bg: 'rgba(16,185,129,0.1)', path: '/meetings' },
  { icon: <FileText size={22} />, label: 'Generate BRD', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', path: '/automations' },
  { icon: <Sparkles size={22} />, label: 'Ask AI', color: '#00D4FF', bg: 'rgba(0,212,255,0.1)', path: '/knowledge' },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#111B35', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 12px', fontSize: '0.75rem', color: '#F1F5F9' }}>
        <p style={{ margin: 0, color: '#94A3B8' }}>{label}</p>
        <p style={{ margin: 0, color: '#00D4FF', fontWeight: 600 }}>{payload[0].value} runs</p>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.875rem' }}>
        {kpiCards.map((card) => (
          <div key={card.label} className="metric-card" style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ padding: '0.5rem', borderRadius: '8px', background: card.bg, color: card.color }}>
                {card.icon}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: card.trendUp ? '#34D399' : card.label === 'Open Actions' ? '#34D399' : '#FCA5A5',
                }}
              >
                {card.trendUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {card.trend}
              </div>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#F1F5F9', lineHeight: 1 }}>
              {card.value}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.25rem' }}>
              {card.label}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="section-card">
        <div className="section-card-header">
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Quick Actions</span>
        </div>
        <div style={{ padding: '1rem', display: 'flex', gap: '0.75rem' }}>
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.path)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.625rem',
                padding: '1rem 0.5rem',
                borderRadius: '0.75rem',
                background: action.bg,
                border: `1px solid ${action.color}22`,
                cursor: 'pointer',
                transition: 'all 0.2s',
                color: action.color,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 20px ${action.color}20`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}
            >
              {action.icon}
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', whiteSpace: 'nowrap' }}>{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main 3-Column Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 340px', gap: '1rem' }}>
        {/* Recent Activity */}
        <div className="section-card">
          <div className="section-card-header">
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Recent Activity</span>
            <button className="btn-ghost" style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem' }}>View All</button>
          </div>
          <div style={{ padding: '0.5rem 0' }}>
            {activities.slice(0, 6).map((act, i) => (
              <div
                key={act.id}
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  padding: '0.625rem 1.25rem',
                  borderBottom: i < 5 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '9999px', background: act.color, marginTop: '4px', flexShrink: 0 }} />
                  {i < 5 && <div style={{ width: '1px', flex: 1, background: 'rgba(255,255,255,0.06)' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#F1F5F9', marginBottom: '2px' }}>{act.title}</div>
                  <div style={{ fontSize: '0.72rem', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{act.detail}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '4px' }}>
                    <span style={{ fontSize: '0.68rem', color: '#334155' }}>{act.workspace}</span>
                    <span style={{ fontSize: '0.68rem', color: '#334155' }}>·</span>
                    <span style={{ fontSize: '0.68rem', color: '#334155' }}>{act.timestamp}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Meetings + Chart */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Automation Chart */}
          <div className="section-card" style={{ flex: 1 }}>
            <div className="section-card-header">
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Automation Runs – This Week</span>
            </div>
            <div style={{ padding: '1rem 0.5rem 0.5rem' }}>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={automationRunsData}>
                  <defs>
                    <linearGradient id="runGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00D4FF" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#00D4FF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="runs" stroke="#00D4FF" strokeWidth={2} fill="url(#runGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Upcoming Meetings */}
          <div className="section-card" style={{ flex: 1 }}>
            <div className="section-card-header">
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Upcoming Meetings</span>
              <button className="btn-ghost" style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem' }} onClick={() => navigate('/meetings')}>
                View All
              </button>
            </div>
            <div style={{ padding: '0.5rem 0' }}>
              {meetings.filter(m => m.status === 'Upcoming').slice(0, 3).map((mtg, i) => (
                <div
                  key={mtg.id}
                  style={{
                    display: 'flex',
                    gap: '0.75rem',
                    alignItems: 'flex-start',
                    padding: '0.75rem 1.25rem',
                    borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    cursor: 'pointer',
                  }}
                  onClick={() => navigate(`/meetings/${mtg.id}`)}
                >
                  <div style={{
                    padding: '0.375rem',
                    borderRadius: '6px',
                    background: 'rgba(139,92,246,0.1)',
                    color: '#8B5CF6',
                    flexShrink: 0,
                  }}>
                    <Video size={14} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#F1F5F9', marginBottom: '2px' }}>{mtg.title}</div>
                    <div style={{ fontSize: '0.72rem', color: '#475569' }}>{mtg.date} · {mtg.time} · {mtg.duration}</div>
                  </div>
                  <span style={{
                    fontSize: '0.65rem',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: 'rgba(139,92,246,0.1)',
                    color: '#A78BFA',
                    border: '1px solid rgba(139,92,246,0.2)',
                    flexShrink: 0,
                  }}>
                    {mtg.type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* AI Recommendations */}
          <div className="section-card" style={{ background: 'linear-gradient(160deg, #0D1527 0%, #130D2A 100%)' }}>
            <div className="section-card-header" style={{ borderBottom: '1px solid rgba(139,92,246,0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Bot size={15} style={{ color: '#8B5CF6' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>AI Recommendations</span>
              </div>
            </div>
            <div style={{ padding: '0.75rem' }}>
              {aiRecommendations.map((rec, i) => (
                <div
                  key={i}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    marginBottom: i < 2 ? '0.5rem' : 0,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1rem' }}>{rec.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#F1F5F9', marginBottom: '2px' }}>{rec.title}</div>
                      <div style={{ fontSize: '0.7rem', color: '#475569', marginBottom: '0.5rem' }}>{rec.detail}</div>
                      <button style={{
                        fontSize: '0.7rem',
                        color: '#A78BFA',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontFamily: 'inherit',
                      }}>
                        {rec.action} <ArrowRight size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pending Approvals */}
          <div className="section-card">
            <div className="section-card-header">
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Pending Approvals</span>
              <span style={{
                fontSize: '0.7rem',
                padding: '2px 7px',
                borderRadius: '9999px',
                background: 'rgba(245,158,11,0.15)',
                color: '#FCD34D',
                border: '1px solid rgba(245,158,11,0.25)',
              }}>8</span>
            </div>
            <div style={{ padding: '0.5rem 0' }}>
              {pendingApprovals.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.625rem 1.25rem',
                    borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 500, color: '#F1F5F9' }}>{item.title}</div>
                    <div style={{ fontSize: '0.7rem', color: '#475569' }}>{item.type}</div>
                  </div>
                  <span style={{
                    fontSize: '0.65rem',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    background: item.urgency === 'High' ? 'rgba(239,68,68,0.15)' : item.urgency === 'Medium' ? 'rgba(245,158,11,0.1)' : 'rgba(148,163,184,0.1)',
                    color: item.urgency === 'High' ? '#FCA5A5' : item.urgency === 'Medium' ? '#FCD34D' : '#94A3B8',
                    border: `1px solid ${item.urgency === 'High' ? 'rgba(239,68,68,0.2)' : item.urgency === 'Medium' ? 'rgba(245,158,11,0.15)' : 'rgba(148,163,184,0.15)'}`,
                  }}>
                    {item.urgency}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1rem' }}>
        {/* Automation Health */}
        <div className="section-card">
          <div className="section-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Zap size={15} style={{ color: '#00D4FF' }} />
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Automation Health</span>
            </div>
            <button className="btn-ghost" style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem' }} onClick={() => navigate('/automations')}>
              All Automations
            </button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Automation</th>
                <th>Workspace</th>
                <th>Status</th>
                <th>Time</th>
                <th>Outputs</th>
              </tr>
            </thead>
            <tbody>
              {recentAutomations.map((run, i) => (
                <tr key={i} style={{ cursor: 'pointer' }}>
                  <td style={{ color: '#F1F5F9', fontWeight: 500 }}>{run.name}</td>
                  <td style={{ fontSize: '0.75rem' }}>{run.workspace}</td>
                  <td>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.72rem',
                      padding: '2px 7px',
                      borderRadius: '9999px',
                      background: run.status === 'Success' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                      color: run.status === 'Success' ? '#34D399' : '#FCD34D',
                      border: `1px solid ${run.status === 'Success' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
                    }}>
                      <Circle size={5} fill="currentColor" />
                      {run.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.75rem' }}>{run.time}</td>
                  <td style={{ color: '#00D4FF', fontWeight: 600, fontSize: '0.85rem' }}>{run.outputs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Docs by Type */}
        <div className="section-card">
          <div className="section-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={15} style={{ color: '#8B5CF6' }} />
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Documents by Type</span>
            </div>
          </div>
          <div style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <ResponsiveContainer width={130} height={130}>
              <PieChart>
                <Pie
                  data={documentsByTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={58}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {documentsByTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1 }}>
              {documentsByTypeData.map((item) => (
                <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: item.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>{item.name}</span>
                  </div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#F1F5F9' }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Overdue Tasks Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem 1.25rem',
        borderRadius: '0.75rem',
        background: 'rgba(245,158,11,0.06)',
        border: '1px solid rgba(245,158,11,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <AlertTriangle size={16} style={{ color: '#F59E0B' }} />
          <div>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>12 overdue tasks across 4 workspaces</span>
            <span style={{ fontSize: '0.8rem', color: '#475569', marginLeft: '0.75rem' }}>Including 3 high-priority items that may impact project milestones</span>
          </div>
        </div>
        <button className="btn-ghost" style={{ fontSize: '0.8rem' }} onClick={() => navigate('/tasks')}>
          Review Tasks <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
