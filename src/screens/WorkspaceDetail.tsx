import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileText, Video, CheckSquare, AlertTriangle,
  Calendar, Users, TrendingUp, MoreHorizontal, Plus, ExternalLink,
  Zap, BarChart3
} from 'lucide-react';
import { workspaces, documents, meetings, tasks, risks } from '../data/mockData';

const tabs = ['Overview', 'Documents', 'Requirements', 'Meetings', 'Decisions', 'Tasks', 'Risks', 'Reports', 'Automations'];

export default function WorkspaceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Overview');

  const ws = workspaces.find(w => w.id === id) || workspaces[0];
  const wsDocs = documents.filter(d => d.workspaceId === ws.id);
  const wsMeetings = meetings.filter(m => m.workspaceId === ws.id);
  const wsTasks = tasks.filter(t => t.workspaceId === ws.id);
  const wsRisks = risks.filter(r => r.workspace === ws.name);

  const recentDecisions = [
    { id: 'DEC-001', text: 'Adopt microservices architecture for integration layer', date: '2026-03-08', owner: 'AM', status: 'Approved' },
    { id: 'DEC-002', text: 'Extend Phase 2 timeline by 3 weeks due to stakeholder availability', date: '2026-03-05', owner: 'SK', status: 'Approved' },
    { id: 'DEC-003', text: 'Engage specialist contractor for data migration workstream', date: '2026-02-28', owner: 'RT', status: 'Pending' },
  ];

  const healthIndicators = [
    { label: 'Schedule', status: 'On Track', color: '#10B981' },
    { label: 'Budget', status: 'At Risk', color: '#F59E0B' },
    { label: 'Scope', status: 'On Track', color: '#10B981' },
    { label: 'Quality', status: 'On Track', color: '#10B981' },
    { label: 'Resources', status: 'Attention', color: '#F59E0B' },
    { label: 'Risks', status: wsRisks.filter(r => r.severity === 'Critical').length > 0 ? 'Critical' : 'Moderate', color: wsRisks.filter(r => r.severity === 'Critical').length > 0 ? '#EF4444' : '#F59E0B' },
  ];

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Back + Header */}
      <div>
        <button
          onClick={() => navigate('/workspaces')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: '0.8rem', padding: 0, marginBottom: '1rem', fontFamily: 'inherit' }}
        >
          <ArrowLeft size={14} /> Back to Workspaces
        </button>

        {/* Banner */}
        <div
          style={{
            padding: '1.5rem',
            borderRadius: '0.875rem',
            background: `linear-gradient(135deg, #0D1527 0%, #111B35 100%)`,
            border: '1px solid rgba(255,255,255,0.08)',
            borderLeft: `4px solid ${ws.sectorColor}`,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{
            position: 'absolute', top: 0, right: 0, width: '300px', height: '100%',
            background: `radial-gradient(ellipse at right, ${ws.sectorColor}08 0%, transparent 70%)`,
          }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.7rem', color: '#475569' }}>{ws.type}</span>
                <span style={{ color: '#334155' }}>·</span>
                <span className={ws.status === 'Active' ? 'status-active' : 'status-pending'}>{ws.status}</span>
              </div>
              <h1 style={{ fontSize: '1.375rem', fontWeight: 800, color: '#F1F5F9', margin: 0, marginBottom: '0.375rem' }}>{ws.name}</h1>
              <p style={{ fontSize: '0.875rem', color: '#94A3B8', margin: 0, marginBottom: '1rem' }}>{ws.client}</p>
              <p style={{ fontSize: '0.8rem', color: '#475569', margin: 0, maxWidth: '600px' }}>{ws.description}</p>
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
          <div style={{ display: 'flex', gap: '2rem', marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
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
              <span style={{ fontSize: '0.75rem', color: '#475569' }}>Last Activity:</span>
              <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{ws.lastActivity}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {tabs.map(tab => (
          <button
            key={tab}
            className={`tab-underline ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
            style={{ marginRight: '1.5rem' }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'Overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Health Indicators */}
          <div className="section-card">
            <div className="section-card-header">
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Project Health</span>
            </div>
            <div style={{ padding: '1rem', display: 'flex', gap: '0.75rem' }}>
              {healthIndicators.map(h => (
                <div
                  key={h.label}
                  style={{
                    flex: 1,
                    padding: '0.875rem',
                    borderRadius: '0.625rem',
                    background: `${h.color}10`,
                    border: `1px solid ${h.color}25`,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '0.65rem', color: '#475569', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h.label}</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: h.color }}>{h.status}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 2-col layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {/* Recent Documents */}
            <div className="section-card">
              <div className="section-card-header">
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Recent Documents</span>
                <button className="btn-ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }} onClick={() => setActiveTab('Documents')}>View All</button>
              </div>
              <div>
                {wsDocs.slice(0, 4).map((doc, i) => (
                  <div
                    key={doc.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem 1.25rem',
                      borderBottom: i < wsDocs.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      cursor: 'pointer',
                    }}
                    onClick={() => navigate(`/documents/${doc.id}`)}
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
                {wsDocs.length === 0 && (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#334155', fontSize: '0.8rem' }}>No documents yet</div>
                )}
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
                  <div
                    key={task.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem 1.25rem',
                      borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    }}
                  >
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '9999px',
                      background: task.priority === 'High' ? '#EF4444' : task.priority === 'Medium' ? '#F59E0B' : '#10B981',
                      flexShrink: 0,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</div>
                      <div style={{ fontSize: '0.7rem', color: '#475569' }}>Due: {task.dueDate} · {task.assignee}</div>
                    </div>
                    <span style={{
                      fontSize: '0.65rem',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: task.status === 'Overdue' ? 'rgba(239,68,68,0.15)' : 'rgba(14,165,233,0.1)',
                      color: task.status === 'Overdue' ? '#FCA5A5' : '#38BDF8',
                      border: `1px solid ${task.status === 'Overdue' ? 'rgba(239,68,68,0.2)' : 'rgba(14,165,233,0.15)'}`,
                    }}>
                      {task.status}
                    </span>
                  </div>
                ))}
                {wsTasks.filter(t => t.status !== 'Completed').length === 0 && (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#334155', fontSize: '0.8rem' }}>No open tasks</div>
                )}
              </div>
            </div>
          </div>

          {/* Decisions + Upcoming Meetings */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {/* Recent Decisions */}
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
                      <td>
                        <div className="avatar" style={{ width: '22px', height: '22px', fontSize: '0.6rem' }}>{d.owner}</div>
                      </td>
                      <td>
                        <span className={d.status === 'Approved' ? 'status-approved' : 'status-pending'} style={{ fontSize: '0.65rem' }}>{d.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Upcoming Meetings */}
            <div className="section-card">
              <div className="section-card-header">
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Upcoming Meetings</span>
              </div>
              <div>
                {wsMeetings.filter(m => m.status === 'Upcoming').length > 0 ? (
                  wsMeetings.filter(m => m.status === 'Upcoming').map((mtg, i) => (
                    <div
                      key={mtg.id}
                      style={{
                        display: 'flex',
                        gap: '0.75rem',
                        padding: '0.875rem 1.25rem',
                        borderBottom: i < wsMeetings.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                        cursor: 'pointer',
                      }}
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
            <button className="btn-primary" style={{ fontSize: '0.8rem' }}>
              <Plus size={13} /> Upload Document
            </button>
          </div>
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
                  <td>
                    <span style={{ fontSize: '0.72rem', padding: '2px 7px', borderRadius: '4px', background: `${doc.typeColor}15`, color: doc.typeColor, border: `1px solid ${doc.typeColor}25` }}>
                      {doc.type}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.78rem' }}>{doc.date}</td>
                  <td><span style={{ fontSize: '0.72rem', color: '#38BDF8' }}>{doc.language}</span></td>
                  <td>
                    <span className={`status-${doc.status === 'Approved' ? 'approved' : doc.status === 'Under Review' ? 'review' : 'draft'}`} style={{ fontSize: '0.65rem' }}>
                      {doc.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.78rem' }}>{doc.pages}</td>
                  <td><ExternalLink size={13} style={{ color: '#334155' }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tasks Tab */}
      {activeTab === 'Tasks' && (
        <div className="section-card">
          <div className="section-card-header">
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Tasks ({wsTasks.length})</span>
            <button className="btn-primary" style={{ fontSize: '0.8rem' }}>
              <Plus size={13} /> New Task
            </button>
          </div>
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
                    <span style={{
                      fontSize: '0.72rem', padding: '2px 7px', borderRadius: '4px',
                      background: task.priority === 'High' ? 'rgba(239,68,68,0.15)' : task.priority === 'Medium' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
                      color: task.priority === 'High' ? '#FCA5A5' : task.priority === 'Medium' ? '#FCD34D' : '#34D399',
                    }}>
                      {task.priority}
                    </span>
                  </td>
                  <td>
                    <span className={task.status === 'Overdue' ? 'status-risk-high' : task.status === 'Completed' ? 'status-approved' : 'status-review'} style={{ fontSize: '0.65rem' }}>
                      {task.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.78rem', color: task.status === 'Overdue' ? '#FCA5A5' : '#94A3B8' }}>{task.dueDate}</td>
                  <td>
                    <div className="avatar" style={{ width: '24px', height: '24px', fontSize: '0.62rem' }}>{task.assignee}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Risks Tab */}
      {activeTab === 'Risks' && (
        <div className="section-card">
          <div className="section-card-header">
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Risk Register ({wsRisks.length})</span>
          </div>
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
                  <td>
                    <span className={`status-risk-${risk.severity.toLowerCase()}`}>{risk.severity}</span>
                  </td>
                  <td>
                    <span className={risk.status === 'Mitigated' || risk.status === 'Closed' ? 'status-approved' : risk.status === 'Monitoring' ? 'status-review' : 'status-pending'} style={{ fontSize: '0.65rem' }}>
                      {risk.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.78rem' }}>{risk.owner.split(' ').map(n => n[0]).join('')}</td>
                </tr>
              ))}
              {wsRisks.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#334155' }}>No risks logged for this workspace</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Other tabs placeholder */}
      {!['Overview', 'Documents', 'Tasks', 'Risks'].includes(activeTab) && (
        <div className="section-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <div style={{ color: '#334155', fontSize: '0.875rem' }}>
            <div style={{ marginBottom: '0.5rem', fontSize: '1.5rem' }}>
              {activeTab === 'Meetings' ? '🎥' : activeTab === 'Reports' ? '📊' : activeTab === 'Automations' ? '⚡' : '📋'}
            </div>
            <div style={{ color: '#475569', fontWeight: 600 }}>{activeTab} — {
              activeTab === 'Meetings' ? `${wsMeetings.length} meetings` :
              activeTab === 'Automations' ? '3 automations configured' :
              'Content loading...'
            }</div>
            <div style={{ color: '#334155', fontSize: '0.78rem', marginTop: '0.375rem' }}>Click the tabs above to navigate workspace sections</div>
          </div>
        </div>
      )}
    </div>
  );
}
