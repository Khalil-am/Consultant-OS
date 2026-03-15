import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLayout } from '../hooks/useLayout';
import {
  ArrowLeft, FileText, Video, CheckSquare, AlertTriangle,
  Calendar, Users, TrendingUp, Plus, ExternalLink,
  Zap, DollarSign, TrendingDown,
} from 'lucide-react';
import { workspaces, documents, meetings, tasks, risks, workspaceFinancials, milestones, ragStatusData } from '../data/mockData';

const tabs = ['Overview', 'Documents', 'Requirements', 'Meetings', 'Decisions', 'Tasks', 'Risks', 'Reports', 'Automations'];

const RAG_COLORS: Record<string, string> = {
  Green: '#10B981',
  Amber: '#F59E0B',
  Red: '#EF4444',
};

function fmtAED(val: number): string {
  if (val >= 1000000) return `AED ${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `AED ${(val / 1000).toFixed(0)}K`;
  return `AED ${val.toLocaleString()}`;
}

export default function WorkspaceDetail() {
  const { width, isMobile, isTablet } = useLayout();
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Overview');

  const ws = workspaces.find(w => w.id === id) || workspaces[0];
  const wsDocs = documents.filter(d => d.workspaceId === ws.id);
  const wsMeetings = meetings.filter(m => m.workspaceId === ws.id);
  const wsTasks = tasks.filter(t => t.workspaceId === ws.id);
  const wsRisks = risks.filter(r => r.workspace === ws.name);
  const fin = workspaceFinancials.find(f => f.workspaceId === ws.id);
  const wsRag = ragStatusData.find(r => r.workspace === ws.name);
  const wsMilestones = milestones.filter(m => m.workspaceId === ws.id);

  const spentPct = fin ? Math.round((fin.spent / fin.contractValue) * 100) : null;
  const forecastPct = fin ? Math.round((fin.forecast / fin.contractValue) * 100) : null;

  const recentDecisions = [
    { id: 'DEC-001', text: 'Adopt microservices architecture for integration layer', date: '2026-03-08', owner: 'AM', status: 'Approved' },
    { id: 'DEC-002', text: 'Extend Phase 2 timeline by 3 weeks due to stakeholder availability', date: '2026-03-05', owner: 'SK', status: 'Approved' },
    { id: 'DEC-003', text: 'Engage specialist contractor for data migration workstream', date: '2026-02-28', owner: 'RT', status: 'Pending' },
  ];

  const milestoneStatusColor: Record<string, string> = {
    Completed: '#10B981',
    'On Track': '#0EA5E9',
    'At Risk': '#F59E0B',
    Delayed: '#EF4444',
    Upcoming: '#475569',
  };

  return (
    <div style={{ padding: isMobile ? '0.875rem' : '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Back */}
      <button onClick={() => navigate('/workspaces')} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: '0.8rem', padding: 0, fontFamily: 'inherit', width: 'fit-content' }}>
        <ArrowLeft size={14} /> Back to Workspaces
      </button>

      {/* Banner */}
      <div style={{ padding: isMobile ? '1.25rem' : '1.75rem', borderRadius: '0.875rem', background: `linear-gradient(135deg, #0D1527 0%, #111B35 60%, #0D1B3E 100%)`, border: '1px solid rgba(255,255,255,0.08)', borderLeft: `4px solid ${ws.sectorColor}`, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: '300px', height: '100%', background: `radial-gradient(ellipse at right, ${ws.sectorColor}10 0%, transparent 70%)` }} />
        <div style={{ position: 'absolute', bottom: -40, right: 100, width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,212,255,0.05) 0%, transparent 70%)' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.7rem', color: '#475569' }}>{ws.type}</span>
              <span style={{ color: '#334155' }}>·</span>
              <span className={ws.status === 'Active' ? 'status-active' : 'status-pending'}>{ws.status}</span>
              {/* RAG Badges */}
              {wsRag && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {[['Budget', wsRag.budget], ['Schedule', wsRag.schedule], ['Risk', wsRag.risk], ['Overall', wsRag.rag]].map(([label, status]) => (
                    <div key={label as string} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 7px', borderRadius: '4px', background: `${RAG_COLORS[status as string]}12`, border: `1px solid ${RAG_COLORS[status as string]}25` }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: RAG_COLORS[status as string], boxShadow: `0 0 4px ${RAG_COLORS[status as string]}80` }} />
                      <span style={{ fontSize: '0.6rem', color: RAG_COLORS[status as string], fontWeight: 600 }}>{label as string}</span>
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
            <button className="btn-ghost" style={{ fontSize: '0.8rem' }}>
              <Zap size={14} /> Run Automation
            </button>
            <button className="btn-primary" style={{ fontSize: '0.8rem' }}>
              <Plus size={14} /> Add Document
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div style={{ display: 'flex', gap: isMobile ? '1rem' : '2rem', marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
          {[
            { icon: <FileText size={13} />, value: ws.docsCount, label: 'Documents' },
            { icon: <Video size={13} />, value: ws.meetingsCount, label: 'Meetings' },
            { icon: <CheckSquare size={13} />, value: ws.tasksCount, label: 'Tasks' },
            { icon: <AlertTriangle size={13} />, value: wsRisks.length, label: 'Risks' },
            { icon: <TrendingUp size={13} />, value: `${ws.progress}%`, label: 'Progress' },
          ].map(stat => (
            <div key={stat.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: '#475569' }}>{stat.icon}</span>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: '#F1F5F9' }}>{stat.value}</span>
              <span style={{ fontSize: '0.75rem', color: '#475569' }}>{stat.label}</span>
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
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'Overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Financial Summary Panel */}
          {fin && (
            <div style={{ background: 'linear-gradient(135deg, #0D1527 0%, #111B35 100%)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '12px', padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <DollarSign size={15} style={{ color: '#F59E0B' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#F1F5F9' }}>Financial Summary</span>
                <span style={{ fontSize: '0.65rem', padding: '1px 7px', borderRadius: '9999px', background: 'rgba(245,158,11,0.12)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.2)', marginLeft: 'auto' }}>
                  {fin.billingModel} · {fin.currency}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${width >= 768 ? 4 : 2}, 1fr)`, gap: '0.875rem', marginBottom: '1rem' }}>
                {[
                  { label: 'Contract Value', value: fmtAED(fin.contractValue), color: '#00D4FF', icon: <DollarSign size={14} /> },
                  { label: 'Spent to Date', value: fmtAED(fin.spent), color: spentPct !== null && spentPct >= 95 ? '#EF4444' : spentPct !== null && spentPct >= 80 ? '#F59E0B' : '#10B981', icon: <TrendingUp size={14} /> },
                  { label: 'Forecast at Completion', value: fmtAED(fin.forecast), color: '#8B5CF6', icon: <TrendingUp size={14} /> },
                  { label: 'Variance', value: (fin.variance === 0 ? 'On Budget' : (fin.variance > 0 ? '+' : '') + fmtAED(fin.variance)), color: fin.variance <= 0 ? '#34D399' : '#FCA5A5', icon: fin.variance > 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} /> },
                ].map(m => (
                  <div key={m.label} style={{ padding: '0.875rem', borderRadius: '8px', background: `${m.color}08`, border: `1px solid ${m.color}20` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.375rem', color: m.color }}>
                      {m.icon}
                      <span style={{ fontSize: '0.65rem', color: '#475569' }}>{m.label}</span>
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>
              {/* Spent progress bar */}
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
                    <span style={{ fontSize: '0.65rem', color: '#334155' }}>Last Invoice: {fin.lastInvoice}</span>
                    <span style={{ fontSize: '0.65rem', color: '#F59E0B' }}>Next Milestone: {fmtAED(fin.nextMilestoneValue)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Milestone Tracker */}
          {wsMilestones.length > 0 && (
            <div className="section-card">
              <div className="section-card-header">
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Milestone Tracker</span>
                <span style={{ fontSize: '0.7rem', color: '#475569' }}>{wsMilestones.filter(m => m.status !== 'Completed').length} active</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ minWidth: '560px' }}>
                  <thead>
                    <tr>
                      <th>Milestone</th>
                      <th>Due Date</th>
                      <th>Progress</th>
                      <th>Value</th>
                      <th>Owner</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wsMilestones.map(ms => {
                      const sc = milestoneStatusColor[ms.status] || '#475569';
                      return (
                        <tr key={ms.id}>
                          <td>
                            <div style={{ fontSize: '0.82rem', fontWeight: 500, color: '#F1F5F9' }}>{ms.title}</div>
                          </td>
                          <td style={{ fontSize: '0.78rem', color: '#475569' }}>{ms.dueDate}</td>
                          <td style={{ minWidth: '120px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ flex: 1, height: '5px', borderRadius: '9999px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${ms.completionPct}%`, background: `linear-gradient(90deg, ${sc}, ${sc}cc)`, borderRadius: '9999px' }} />
                              </div>
                              <span style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 600, flexShrink: 0 }}>{ms.completionPct}%</span>
                            </div>
                          </td>
                          <td style={{ fontSize: '0.78rem', color: '#F59E0B', fontWeight: 600 }}>{fmtAED(ms.value)}</td>
                          <td><div className="avatar" style={{ width: '22px', height: '22px', fontSize: '0.58rem' }}>{ms.owner}</div></td>
                          <td>
                            <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', background: `${sc}15`, color: sc, border: `1px solid ${sc}25` }}>
                              {ms.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 2-col layout */}
          <div style={{ display: 'grid', gridTemplateColumns: isTablet ? '1fr' : '1fr 1fr', gap: '1rem' }}>
            {/* Recent Documents */}
            <div className="section-card">
              <div className="section-card-header">
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Recent Documents</span>
                <button className="btn-ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }} onClick={() => setActiveTab('Documents')}>View All</button>
              </div>
              <div>
                {wsDocs.slice(0, 4).map((doc, i) => (
                  <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1.25rem', borderBottom: i < wsDocs.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', cursor: 'pointer' }}
                    onClick={() => navigate(`/documents/${doc.id}`)}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ padding: '0.375rem', borderRadius: '6px', background: `${doc.typeColor}15`, color: doc.typeColor, flexShrink: 0 }}>
                      <FileText size={13} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>
                      <div style={{ fontSize: '0.7rem', color: '#475569' }}>{doc.date} · {doc.pages} pages</div>
                    </div>
                    <span className={`status-${doc.status === 'Approved' ? 'approved' : doc.status === 'Under Review' ? 'review' : 'draft'}`} style={{ fontSize: '0.65rem' }}>
                      {doc.status}
                    </span>
                  </div>
                ))}
                {wsDocs.length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: '#334155', fontSize: '0.8rem' }}>No documents yet</div>}
              </div>
            </div>

            {/* Open Actions */}
            <div className="section-card">
              <div className="section-card-header">
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Open Actions</span>
                <button className="btn-ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }} onClick={() => setActiveTab('Tasks')}>View All</button>
              </div>
              <div>
                {wsTasks.filter(t => t.status !== 'Completed').slice(0, 4).map((task, i) => (
                  <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1.25rem', borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '9999px', background: task.priority === 'High' ? '#EF4444' : task.priority === 'Medium' ? '#F59E0B' : '#10B981', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</div>
                      <div style={{ fontSize: '0.7rem', color: '#475569' }}>Due: {task.dueDate} · {task.assignee}</div>
                    </div>
                    <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: task.status === 'Overdue' ? 'rgba(239,68,68,0.15)' : 'rgba(14,165,233,0.1)', color: task.status === 'Overdue' ? '#FCA5A5' : '#38BDF8', border: `1px solid ${task.status === 'Overdue' ? 'rgba(239,68,68,0.2)' : 'rgba(14,165,233,0.15)'}` }}>
                      {task.status}
                    </span>
                  </div>
                ))}
                {wsTasks.filter(t => t.status !== 'Completed').length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: '#334155', fontSize: '0.8rem' }}>No open tasks</div>}
              </div>
            </div>
          </div>

          {/* Decisions + Upcoming Meetings */}
          <div style={{ display: 'grid', gridTemplateColumns: isTablet ? '1fr' : '1fr 1fr', gap: '1rem' }}>
            <div className="section-card">
              <div className="section-card-header">
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Recent Decisions</span>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Decision</th>
                    <th>Owner</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDecisions.map(d => (
                    <tr key={d.id}>
                      <td style={{ color: '#0EA5E9', fontSize: '0.75rem' }}>{d.id}</td>
                      <td style={{ color: '#94A3B8', maxWidth: '200px' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{d.text}</div>
                      </td>
                      <td><div className="avatar" style={{ width: '22px', height: '22px', fontSize: '0.6rem' }}>{d.owner}</div></td>
                      <td><span className={d.status === 'Approved' ? 'status-approved' : 'status-pending'} style={{ fontSize: '0.65rem' }}>{d.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="section-card">
              <div className="section-card-header">
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Upcoming Meetings</span>
              </div>
              <div>
                {wsMeetings.filter(m => m.status === 'Upcoming').length > 0 ? (
                  wsMeetings.filter(m => m.status === 'Upcoming').map((mtg, i) => (
                    <div key={mtg.id} style={{ display: 'flex', gap: '0.75rem', padding: '0.875rem 1.25rem', borderBottom: i < wsMeetings.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', cursor: 'pointer' }}
                      onClick={() => navigate(`/meetings/${mtg.id}`)}
                    >
                      <div style={{ padding: '0.375rem', borderRadius: '6px', background: 'rgba(139,92,246,0.1)', color: '#8B5CF6', flexShrink: 0 }}>
                        <Video size={13} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#F1F5F9' }}>{mtg.title}</div>
                        <div style={{ fontSize: '0.7rem', color: '#475569' }}>{mtg.date} · {mtg.time}</div>
                      </div>
                      <ExternalLink size={13} style={{ color: '#334155' }} />
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#334155', fontSize: '0.8rem' }}>No upcoming meetings</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === 'Documents' && (
        <div className="section-card">
          <div className="section-card-header">
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>All Documents ({wsDocs.length})</span>
            <button className="btn-primary" style={{ fontSize: '0.8rem' }}><Plus size={13} /> Upload Document</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Language</th>
                  <th>Status</th>
                  <th>Pages</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {wsDocs.map(doc => (
                  <tr key={doc.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/documents/${doc.id}`)}>
                    <td>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#F1F5F9' }}>{doc.name}</div>
                      <div style={{ fontSize: '0.7rem', color: '#475569' }}>{doc.author} · {doc.size}</div>
                    </td>
                    <td><span style={{ fontSize: '0.72rem', padding: '2px 7px', borderRadius: '4px', background: `${doc.typeColor}15`, color: doc.typeColor, border: `1px solid ${doc.typeColor}25` }}>{doc.type}</span></td>
                    <td style={{ fontSize: '0.78rem' }}>{doc.date}</td>
                    <td><span style={{ fontSize: '0.72rem', color: '#38BDF8' }}>{doc.language}</span></td>
                    <td><span className={`status-${doc.status === 'Approved' ? 'approved' : doc.status === 'Under Review' ? 'review' : 'draft'}`} style={{ fontSize: '0.65rem' }}>{doc.status}</span></td>
                    <td style={{ fontSize: '0.78rem' }}>{doc.pages}</td>
                    <td><ExternalLink size={13} style={{ color: '#334155' }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tasks Tab */}
      {activeTab === 'Tasks' && (
        <div className="section-card">
          <div className="section-card-header">
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Tasks ({wsTasks.length})</span>
            <button className="btn-primary" style={{ fontSize: '0.8rem' }}><Plus size={13} /> New Task</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Due Date</th>
                  <th>Assignee</th>
                </tr>
              </thead>
              <tbody>
                {wsTasks.map(task => (
                  <tr key={task.id}>
                    <td>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#F1F5F9' }}>{task.title}</div>
                      <div style={{ fontSize: '0.7rem', color: '#475569' }}>{task.description.slice(0, 60)}...</div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.72rem', padding: '2px 7px', borderRadius: '4px', background: task.priority === 'High' ? 'rgba(239,68,68,0.15)' : task.priority === 'Medium' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)', color: task.priority === 'High' ? '#FCA5A5' : task.priority === 'Medium' ? '#FCD34D' : '#34D399' }}>
                        {task.priority}
                      </span>
                    </td>
                    <td>
                      <span className={task.status === 'Overdue' ? 'status-risk-high' : task.status === 'Completed' ? 'status-approved' : 'status-review'} style={{ fontSize: '0.65rem' }}>
                        {task.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.78rem', color: task.status === 'Overdue' ? '#FCA5A5' : '#94A3B8' }}>{task.dueDate}</td>
                    <td><div className="avatar" style={{ width: '24px', height: '24px', fontSize: '0.62rem' }}>{task.assignee}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Risks Tab */}
      {activeTab === 'Risks' && (
        <div className="section-card">
          <div className="section-card-header">
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Risk Register ({wsRisks.length})</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Risk</th>
                  <th>Category</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Owner</th>
                </tr>
              </thead>
              <tbody>
                {wsRisks.map(risk => (
                  <tr key={risk.id}>
                    <td style={{ color: '#EF4444', fontSize: '0.75rem' }}>{risk.id}</td>
                    <td>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#F1F5F9' }}>{risk.title}</div>
                      <div style={{ fontSize: '0.7rem', color: '#475569' }}>{risk.mitigation.slice(0, 50)}...</div>
                    </td>
                    <td style={{ fontSize: '0.78rem' }}>{risk.category}</td>
                    <td><span className={`status-risk-${risk.severity.toLowerCase()}`}>{risk.severity}</span></td>
                    <td><span className={risk.status === 'Mitigated' || risk.status === 'Closed' ? 'status-approved' : risk.status === 'Monitoring' ? 'status-review' : 'status-pending'} style={{ fontSize: '0.65rem' }}>{risk.status}</span></td>
                    <td style={{ fontSize: '0.78rem' }}>{risk.owner.split(' ').map((n: string) => n[0]).join('')}</td>
                  </tr>
                ))}
                {wsRisks.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#334155' }}>No risks logged</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Other tabs */}
      {!['Overview', 'Documents', 'Tasks', 'Risks'].includes(activeTab) && (
        <div className="section-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <div style={{ color: '#334155', fontSize: '0.875rem' }}>
            <div style={{ color: '#475569', fontWeight: 600 }}>{activeTab} — {
              activeTab === 'Meetings' ? `${wsMeetings.length} meetings` :
              activeTab === 'Automations' ? '3 automations configured' :
              'Content loading...'
            }</div>
            <div style={{ color: '#334155', fontSize: '0.78rem', marginTop: '0.375rem' }}>Navigate to the relevant section via the tabs above</div>
          </div>
        </div>
      )}
    </div>
  );
}
