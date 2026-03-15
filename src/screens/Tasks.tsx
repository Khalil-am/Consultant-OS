import { useState } from 'react';
import { useLayout } from '../hooks/useLayout';
import {
  AlertTriangle, CheckSquare, Clock, TrendingUp, Plus, Filter
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

export default function Tasks() {
  const { width, isMobile, isTablet } = useLayout();
  const [activeView, setActiveView] = useState<'Tasks' | 'Risks'>('Tasks');

  const tasksByStatus = (status: string) => tasks.filter(t => t.status === status);

  return (
    <div style={{ padding: isMobile ? '0.875rem' : '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Summary Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${width >= 768 ? 4 : 2}, 1fr)`, gap: '0.875rem' }}>
        {[
          { label: 'Total Tasks', value: tasks.length, icon: <CheckSquare size={16} />, color: '#0EA5E9' },
          { label: 'Overdue', value: tasks.filter(t => t.status === 'Overdue').length, icon: <Clock size={16} />, color: '#EF4444' },
          { label: 'High Priority', value: tasks.filter(t => t.priority === 'High').length, icon: <AlertTriangle size={16} />, color: '#F59E0B' },
          { label: 'Active Risks', value: risks.filter(r => r.status === 'Open' || r.status === 'Monitoring').length, icon: <TrendingUp size={16} />, color: '#8B5CF6' },
        ].map(stat => (
          <div key={stat.label} className="metric-card" style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <div style={{ padding: '0.625rem', borderRadius: '8px', background: `${stat.color}15`, color: stat.color }}>
              {stat.icon}
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#F1F5F9' }}>{stat.value}</div>
              <div style={{ fontSize: '0.72rem', color: '#475569' }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* View Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(255,255,255,0.03)', padding: '0.25rem', borderRadius: '0.625rem', border: '1px solid rgba(255,255,255,0.06)' }}>
          {(['Tasks', 'Risks'] as const).map(view => (
            <button
              key={view}
              className={`tab-item ${activeView === view ? 'active' : ''}`}
              onClick={() => setActiveView(view)}
              style={{ padding: '0.375rem 1.25rem', fontSize: '0.875rem' }}
            >
              {view}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-ghost" style={{ height: '34px', fontSize: '0.8rem' }}>
            <Filter size={13} /> Filter
          </button>
          <button className="btn-primary" style={{ height: '34px', fontSize: '0.8rem' }}>
            <Plus size={13} /> {activeView === 'Tasks' ? 'New Task' : 'Log Risk'}
          </button>
        </div>
      </div>

      {/* Tasks – Kanban */}
      {activeView === 'Tasks' && (
        <div style={{ display: 'flex', gap: '0.875rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
          {kanbanColumns.map(col => {
            const colTasks = tasksByStatus(col.key);
            return (
              <div key={col.key} style={{ minWidth: '230px', width: '230px', flexShrink: 0 }}>
                {/* Column Header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: '0.75rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '9999px', background: col.color }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94A3B8' }}>{col.label}</span>
                  </div>
                  <span style={{
                    fontSize: '0.68rem', padding: '1px 6px', borderRadius: '9999px',
                    background: 'rgba(255,255,255,0.06)', color: '#475569',
                  }}>
                    {colTasks.length}
                  </span>
                </div>

                {/* Drop zone */}
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: '0.5rem',
                  minHeight: '120px',
                  padding: '0.5rem',
                  borderRadius: '0.625rem',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px dashed rgba(255,255,255,0.06)',
                }}>
                  {colTasks.map(task => (
                    <div key={task.id} className="kanban-card">
                      {/* Priority dot + workspace */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{
                          fontSize: '0.62rem', padding: '1px 5px', borderRadius: '3px',
                          background: 'rgba(255,255,255,0.04)', color: '#334155',
                          border: '1px solid rgba(255,255,255,0.06)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          maxWidth: '120px',
                        }}>
                          {task.workspace.split(' ').slice(0, 2).join(' ')}
                        </span>
                        <div style={{
                          width: '8px', height: '8px', borderRadius: '9999px',
                          background: priorityColors[task.priority],
                          boxShadow: `0 0 6px ${priorityColors[task.priority]}60`,
                        }} />
                      </div>

                      {/* Task title */}
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#F1F5F9', lineHeight: 1.4, marginBottom: '0.5rem' }}>
                        {task.title.slice(0, 60)}{task.title.length > 60 ? '...' : ''}
                      </div>

                      {/* Footer */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{
                          fontSize: '0.65rem', color: task.status === 'Overdue' ? '#FCA5A5' : '#475569',
                          display: 'flex', alignItems: 'center', gap: '3px',
                        }}>
                          <Clock size={9} /> {task.dueDate}
                        </span>
                        <div className="avatar" style={{ width: '20px', height: '20px', fontSize: '0.55rem' }}>
                          {task.assignee}
                        </div>
                      </div>

                      {/* Links */}
                      {(task.linkedDoc || task.linkedMeeting) && (
                        <div style={{ marginTop: '0.375rem', paddingTop: '0.375rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                          <span style={{ fontSize: '0.62rem', color: '#334155' }}>
                            {task.linkedDoc ? `📄 ${task.linkedDoc.slice(0, 25)}...` : `🎥 ${task.linkedMeeting?.slice(0, 25)}...`}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}

                  {colTasks.length === 0 && (
                    <div style={{ padding: '1rem', textAlign: 'center', color: '#1E2E52', fontSize: '0.75rem' }}>
                      No tasks
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Risks Table */}
      {activeView === 'Risks' && (
        <div>
          {/* Risk Summary Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${width >= 768 ? 4 : 2}, 1fr)`, gap: '0.75rem', marginBottom: '1.25rem' }}>
            {[
              { label: 'Critical', count: risks.filter(r => r.severity === 'Critical').length, color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
              { label: 'High', count: risks.filter(r => r.severity === 'High').length, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
              { label: 'Medium', count: risks.filter(r => r.severity === 'Medium').length, color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)' },
              { label: 'Low', count: risks.filter(r => r.severity === 'Low').length, color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
            ].map(cat => (
              <div key={cat.label} style={{
                padding: '0.875rem 1.125rem', borderRadius: '0.625rem',
                background: cat.bg, border: `1px solid ${cat.color}20`,
                display: 'flex', alignItems: 'center', gap: '0.875rem',
              }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: cat.color }}>{cat.count}</div>
                <div style={{ fontSize: '0.78rem', color: cat.color }}>{cat.label} Risks</div>
              </div>
            ))}
          </div>

          <div className="section-card">
            <div className="section-card-header">
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Risk Register</span>
              <span style={{ fontSize: '0.75rem', color: '#475569' }}>{risks.length} risks across 8 workspaces</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Risk Title</th>
                  <th>Workspace</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'center' }}>P</th>
                  <th style={{ textAlign: 'center' }}>I</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Owner</th>
                </tr>
              </thead>
              <tbody>
                {risks.map(risk => (
                  <tr key={risk.id} style={{ cursor: 'pointer' }}>
                    <td style={{ color: '#EF4444', fontWeight: 500 }}>{risk.id}</td>
                    <td>
                      <div style={{ fontSize: '0.82rem', fontWeight: 500, color: '#F1F5F9', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {risk.title}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '220px' }}>
                        {risk.mitigation.slice(0, 45)}...
                      </div>
                    </td>
                    <td style={{ fontSize: '0.72rem', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {risk.workspace.split(' ').slice(0, 2).join(' ')}
                    </td>
                    <td>
                      <span style={{
                        fontSize: '0.68rem', padding: '1px 5px', borderRadius: '3px',
                        background: 'rgba(255,255,255,0.05)', color: '#94A3B8',
                        border: '1px solid rgba(255,255,255,0.07)',
                      }}>
                        {risk.category}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: '22px', height: '22px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 700,
                        background: risk.probability >= 4 ? 'rgba(239,68,68,0.15)' : risk.probability >= 3 ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
                        color: risk.probability >= 4 ? '#FCA5A5' : risk.probability >= 3 ? '#FCD34D' : '#34D399',
                      }}>
                        {risk.probability}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: '22px', height: '22px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 700,
                        background: risk.impact >= 5 ? 'rgba(239,68,68,0.2)' : risk.impact >= 4 ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
                        color: risk.impact >= 5 ? '#FCA5A5' : risk.impact >= 4 ? '#FCD34D' : '#34D399',
                      }}>
                        {risk.impact}
                      </span>
                    </td>
                    <td>
                      <span className={`status-risk-${risk.severity.toLowerCase()}`}>{risk.severity}</span>
                    </td>
                    <td>
                      <span className={
                        risk.status === 'Mitigated' || risk.status === 'Closed' ? 'status-approved' :
                        risk.status === 'Monitoring' ? 'status-review' : 'status-pending'
                      } style={{ fontSize: '0.65rem' }}>
                        {risk.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.75rem', color: '#475569' }}>
                      {risk.owner.split(' ').map(n => n[0]).join('')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
