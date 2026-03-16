import { useState, useEffect } from 'react';
import { useLayout } from '../hooks/useLayout';
import {
  Users, Briefcase, Zap, Brain, FileText, Bell, Shield,
  List, Check, X, Settings, Plus, RefreshCw, ExternalLink
} from 'lucide-react';
import { users } from '../data/mockData';
import { getActivities, getWorkspaces } from '../lib/db';
import type { ActivityRow, WorkspaceRow } from '../lib/db';

const adminSections = [
  { id: 'users', label: 'Users & Roles', icon: <Users size={15} /> },
  { id: 'workspaces', label: 'Workspaces', icon: <Briefcase size={15} /> },
  { id: 'integrations', label: 'Integrations', icon: <Zap size={15} /> },
  { id: 'ai', label: 'AI Models', icon: <Brain size={15} /> },
  { id: 'prompts', label: 'Prompt Library', icon: <FileText size={15} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={15} /> },
  { id: 'approvals', label: 'Approval Rules', icon: <Shield size={15} /> },
  { id: 'audit', label: 'Audit Logs', icon: <List size={15} /> },
];

const roleColors: Record<string, { bg: string; text: string }> = {
  Admin: { bg: 'rgba(139,92,246,0.15)', text: '#A78BFA' },
  Manager: { bg: 'rgba(14,165,233,0.12)', text: '#38BDF8' },
  Consultant: { bg: 'rgba(16,185,129,0.12)', text: '#34D399' },
  Analyst: { bg: 'rgba(245,158,11,0.1)', text: '#FCD34D' },
  Viewer: { bg: 'rgba(148,163,184,0.1)', text: '#94A3B8' },
};

const integrations = [
  { name: 'Microsoft SharePoint', category: 'Storage', status: 'Connected', logo: '🔷', desc: 'Document sync and storage' },
  { name: 'Google Drive', category: 'Storage', status: 'Connected', logo: '📁', desc: 'File storage and collaboration' },
  { name: 'OneDrive', category: 'Storage', status: 'Disconnected', logo: '☁️', desc: 'Microsoft cloud storage' },
  { name: 'Gmail', category: 'Email', status: 'Connected', logo: '📧', desc: 'Email integration for notifications' },
  { name: 'Microsoft Teams', category: 'Communication', status: 'Connected', logo: '💬', desc: 'Notifications and meeting sync' },
  { name: 'Slack', category: 'Communication', status: 'Disconnected', logo: '📢', desc: 'Team messaging and alerts' },
  { name: 'Jira', category: 'Project Management', status: 'Connected', logo: '🔵', desc: 'Task and issue tracking sync' },
  { name: 'Notion', category: 'Knowledge', status: 'Disconnected', logo: '📓', desc: 'Knowledge base sync' },
  { name: 'GitHub', category: 'Development', status: 'Disconnected', logo: '🐙', desc: 'Code repository integration' },
  { name: 'Azure Form Recognizer', category: 'AI', status: 'Connected', logo: '🤖', desc: 'OCR and document intelligence' },
  { name: 'OpenAI GPT-4o', category: 'AI', status: 'Connected', logo: '✨', desc: 'Primary LLM for generation' },
  { name: 'Anthropic Claude', category: 'AI', status: 'Connected', logo: '🧠', desc: 'Secondary LLM for analysis' },
];

const auditLogs = [
  { time: '2026-03-15 14:32', user: 'AM', action: 'Document uploaded', resource: 'NCA Enterprise Architecture BRD v2.3', ip: '192.168.1.45' },
  { time: '2026-03-15 14:15', user: 'RT', action: 'Automation run triggered', resource: 'Meeting Minutes Generator', ip: '10.0.2.18' },
  { time: '2026-03-15 13:58', user: 'SK', action: 'User role changed', resource: 'Paul Lee → Analyst', ip: '192.168.1.67' },
  { time: '2026-03-15 13:45', user: 'YA', action: 'Integration configured', resource: 'Microsoft Teams webhook updated', ip: '10.0.2.3' },
  { time: '2026-03-15 12:30', user: 'JL', action: 'Risk status updated', resource: 'RISK-003 Smart City Contractor', ip: '192.168.1.102' },
  { time: '2026-03-15 11:15', user: 'AM', action: 'Report generated', resource: 'NCA Weekly Status W10', ip: '192.168.1.45' },
  { time: '2026-03-15 10:00', user: 'YA', action: 'New workspace created', resource: 'Retail Digital Commerce', ip: '10.0.2.3' },
];

const rolePermissions = [
  { role: 'Admin', permissions: { create: true, read: true, update: true, delete: true, configure: true, manage_users: true } },
  { role: 'Manager', permissions: { create: true, read: true, update: true, delete: false, configure: true, manage_users: false } },
  { role: 'Consultant', permissions: { create: true, read: true, update: true, delete: false, configure: false, manage_users: false } },
  { role: 'Analyst', permissions: { create: true, read: true, update: false, delete: false, configure: false, manage_users: false } },
  { role: 'Viewer', permissions: { create: false, read: true, update: false, delete: false, configure: false, manage_users: false } },
];

export default function Admin() {
  const { width, isMobile, isTablet } = useLayout();
  const [activeSection, setActiveSection] = useState('users');
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);

  useEffect(() => {
    getActivities(50).then(setActivities).catch(() => {});
    getWorkspaces().then(setWorkspaces).catch(() => {});
  }, []);

  // suppress unused warnings
  void width;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
      {/* Left Sidebar */}
      <div style={{
        width: '220px', minWidth: '220px', borderRight: '1px solid rgba(255,255,255,0.05)',
        padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '2px',
        background: '#0C1220',
      }}>
        <div className="sidebar-section-label" style={{ marginBottom: '0.375rem' }}>Administration</div>
        {adminSections.map(section => (
          <button
            key={section.id}
            className={`nav-item ${activeSection === section.id ? 'active' : ''}`}
            onClick={() => setActiveSection(section.id)}
            style={{ justifyContent: 'flex-start', background: 'none', width: '100%' }}
          >
            <span style={{ opacity: activeSection === section.id ? 1 : 0.6 }}>{section.icon}</span>
            <span>{section.label}</span>
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '0.875rem' : '1.5rem' }}>
        {/* Users & Roles */}
        {activeSection === 'users' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#F1F5F9', margin: 0, marginBottom: '0.25rem' }}>Users & Roles</h2>
                <p style={{ fontSize: '0.8rem', color: '#64748B', margin: 0 }}>{users.length} users · 4 roles</p>
              </div>
              <button className="btn-primary" style={{ height: '34px', fontSize: '0.8rem' }}>
                <Plus size={13} /> Invite User
              </button>
            </div>

            {/* Users Table */}
            <div className="section-card">
              <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Workspaces</th>
                    <th>Last Active</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                          <div className="avatar" style={{ width: '28px', height: '28px', fontSize: '0.62rem' }}>{user.avatar}</div>
                          <span style={{ fontSize: '0.82rem', fontWeight: 500, color: '#F1F5F9' }}>{user.name}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: '0.78rem' }}>{user.email}</td>
                      <td>
                        <span style={{
                          fontSize: '0.7rem', padding: '2px 7px', borderRadius: '4px',
                          background: roleColors[user.role]?.bg, color: roleColors[user.role]?.text,
                          border: `1px solid ${roleColors[user.role]?.text}25`,
                        }}>
                          {user.role}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.78rem' }}>{user.workspacesCount}</td>
                      <td style={{ fontSize: '0.75rem' }}>{user.lastActive}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{
                            width: '28px', height: '16px', borderRadius: '8px', cursor: 'pointer',
                            background: user.status === 'Active' ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.08)',
                            border: `1px solid ${user.status === 'Active' ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.12)'}`,
                            position: 'relative', transition: 'all 0.2s',
                          }}>
                            <div style={{
                              position: 'absolute', width: '10px', height: '10px', borderRadius: '9999px',
                              background: user.status === 'Active' ? '#10B981' : '#64748B',
                              top: '2px', left: user.status === 'Active' ? '15px' : '2px',
                              transition: 'left 0.2s',
                            }} />
                          </div>
                          <span style={{ fontSize: '0.72rem', color: user.status === 'Active' ? '#34D399' : '#64748B' }}>
                            {user.status}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button style={{ padding: '0.25rem 0.5rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem', color: '#94A3B8', fontFamily: 'inherit' }}>
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>

            {/* Role Permissions Matrix */}
            <div className="section-card">
              <div className="section-card-header">
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Role Permissions Matrix</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Role</th>
                      <th>Create</th>
                      <th>Read</th>
                      <th>Update</th>
                      <th>Delete</th>
                      <th>Configure</th>
                      <th>Manage Users</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rolePermissions.map(rp => (
                      <tr key={rp.role}>
                        <td>
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: roleColors[rp.role]?.text || '#94A3B8' }}>
                            {rp.role}
                          </span>
                        </td>
                        {Object.values(rp.permissions).map((val, i) => (
                          <td key={i} style={{ textAlign: 'center' }}>
                            {val ? (
                              <div style={{ width: '18px', height: '18px', borderRadius: '4px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                                <Check size={11} style={{ color: '#34D399' }} />
                              </div>
                            ) : (
                              <div style={{ width: '18px', height: '18px', borderRadius: '4px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                                <X size={10} style={{ color: '#EF444480' }} />
                              </div>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Integrations */}
        {activeSection === 'integrations' && (
          <div>
            <div style={{ marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#F1F5F9', margin: 0, marginBottom: '0.25rem' }}>Integrations</h2>
              <p style={{ fontSize: '0.8rem', color: '#64748B', margin: 0 }}>
                {integrations.filter(i => i.status === 'Connected').length} connected · {integrations.filter(i => i.status === 'Disconnected').length} available
              </p>
            </div>

            {['Storage', 'Communication', 'Project Management', 'Knowledge', 'Development', 'AI'].map(category => {
              const catItems = integrations.filter(i => i.category === category);
              if (!catItems.length) return null;
              return (
                <div key={category} style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.72rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>{category}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${width >= 900 ? 3 : width >= 600 ? 2 : 1}, 1fr)`, gap: '0.75rem' }}>
                    {catItems.map(integration => (
                      <div key={integration.name} className="elevated-card" style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                            <span style={{ fontSize: '1.25rem' }}>{integration.logo}</span>
                            <div>
                              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#F1F5F9' }}>{integration.name}</div>
                              <div style={{ fontSize: '0.68rem', color: '#334155' }}>{integration.desc}</div>
                            </div>
                          </div>
                          <span style={{
                            fontSize: '0.65rem', padding: '2px 6px', borderRadius: '9999px',
                            background: integration.status === 'Connected' ? 'rgba(16,185,129,0.12)' : 'rgba(148,163,184,0.08)',
                            color: integration.status === 'Connected' ? '#34D399' : '#64748B',
                            border: `1px solid ${integration.status === 'Connected' ? 'rgba(16,185,129,0.2)' : 'rgba(148,163,184,0.1)'}`,
                          }}>
                            {integration.status}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {integration.status === 'Connected' ? (
                            <>
                              <button className="btn-ghost" style={{ flex: 1, height: '26px', fontSize: '0.7rem', justifyContent: 'center' }}>
                                <Settings size={10} /> Configure
                              </button>
                              <button className="btn-ghost" style={{ height: '26px', fontSize: '0.7rem', padding: '0 0.5rem' }}>
                                <RefreshCw size={10} />
                              </button>
                            </>
                          ) : (
                            <button className="btn-primary" style={{ flex: 1, height: '26px', fontSize: '0.7rem', justifyContent: 'center' }}>
                              <Plus size={10} /> Connect
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* AI Models */}
        {activeSection === 'ai' && (
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#F1F5F9', margin: 0, marginBottom: '1.25rem' }}>AI Model Configuration</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {[
                { name: 'GPT-4o', provider: 'OpenAI', status: 'Primary', usage: '78%', tokens: '2.4M', color: '#10B981' },
                { name: 'Claude 3.5 Sonnet', provider: 'Anthropic', status: 'Secondary', usage: '18%', tokens: '560K', color: '#8B5CF6' },
                { name: 'Azure Form Recognizer', provider: 'Microsoft', status: 'Active', usage: 'OCR', tokens: '847 docs', color: '#0EA5E9' },
                { name: 'GPT-4 Turbo', provider: 'OpenAI', status: 'Fallback', usage: '4%', tokens: '120K', color: '#F59E0B' },
              ].map(model => (
                <div key={model.name} className="section-card" style={{ padding: '1.125rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
                    <div>
                      <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#F1F5F9', margin: 0, marginBottom: '2px' }}>{model.name}</h3>
                      <span style={{ fontSize: '0.72rem', color: '#64748B' }}>{model.provider}</span>
                    </div>
                    <span style={{
                      fontSize: '0.7rem', padding: '2px 7px', borderRadius: '4px',
                      background: `${model.color}15`, color: model.color, border: `1px solid ${model.color}25`,
                    }}>
                      {model.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '2rem', marginBottom: '0.875rem' }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#334155', marginBottom: '2px' }}>Usage</div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 700, color: model.color }}>{model.usage}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#334155', marginBottom: '2px' }}>Tokens / Month</div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#94A3B8' }}>{model.tokens}</div>
                    </div>
                  </div>
                  <button className="btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: '0.78rem', height: '30px' }}>
                    <Settings size={12} /> Configure
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audit Logs */}
        {activeSection === 'audit' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#F1F5F9', margin: 0, marginBottom: '0.25rem' }}>Audit Logs</h2>
                <p style={{ fontSize: '0.8rem', color: '#64748B', margin: 0 }}>All system activity logs</p>
              </div>
              <button className="btn-ghost" style={{ height: '34px', fontSize: '0.8rem' }}>
                <ExternalLink size={13} /> Export Logs
              </button>
            </div>
            <div className="section-card">
              <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Resource</th>
                    <th>IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {(activities.length > 0 ? activities : auditLogs.map((l, i) => ({ id: String(i), user: l.user, action: l.action, target: l.resource, workspace: '', workspace_id: null, time: l.time, type: 'system', created_at: l.time }))).map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#00D4FF' }}>{log.created_at?.slice(0, 16).replace('T', ' ')}</td>
                      <td>
                        <div className="avatar" style={{ width: '22px', height: '22px', fontSize: '0.6rem', display: 'inline-flex' }}>{(log.user || '').slice(0, 2).toUpperCase()}</div>
                      </td>
                      <td style={{ fontSize: '0.82rem', color: '#F1F5F9', fontWeight: 500 }}>{log.action}</td>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>{log.target}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{log.workspace || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )}

        {/* Workspaces Section */}
        {activeSection === 'workspaces' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#F1F5F9', margin: 0 }}>Workspace Configuration</h2>
              <button className="btn-primary" style={{ height: '34px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}><Plus size={14} /> New Workspace</button>
            </div>
            <div className="section-card">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                  <thead>
                    <tr>
                      {['Workspace Name', 'Type', 'Members', 'Language', 'Confidentiality', 'Status', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '0.625rem 1rem', textAlign: 'left', fontSize: '0.65rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {workspaces.map((ws) => (
                      <tr key={ws.id} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: 500, color: '#F1F5F9', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{ws.name}</td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: '#94A3B8', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{ws.type}</td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: '#94A3B8', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{ws.contributors?.length ?? 0}</td>
                        <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}><span style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: '4px', background: 'rgba(14,165,233,0.1)', color: '#38BDF8', border: '1px solid rgba(14,165,233,0.2)' }}>{ws.language}</span></td>
                        <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}><span style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: '4px', background: 'rgba(148,163,184,0.07)', color: '#94A3B8' }}>{ws.sector}</span></td>
                        <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <span style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: '4px', background: ws.status === 'Active' ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.1)', color: ws.status === 'Active' ? '#34D399' : '#94A3B8' }}>{ws.status}</span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <button style={{ background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '3px 8px', fontSize: '0.68rem', color: '#94A3B8', cursor: 'pointer', fontFamily: 'inherit' }}>Configure</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Prompt Library Section */}
        {activeSection === 'prompts' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#F1F5F9', margin: 0 }}>Prompt Library</h2>
              <button className="btn-ai" style={{ height: '34px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}><Plus size={14} /> New Prompt</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                { name: 'BRD Section Extractor', category: 'BA & Requirements', model: 'Claude Opus 4', tokens: '2,400', lastUsed: '2h ago', uses: 284 },
                { name: 'Meeting Minutes Generator', category: 'Meetings', model: 'Claude Sonnet 4', tokens: '3,100', lastUsed: '3h ago', uses: 512 },
                { name: 'Executive Summary Writer', category: 'Reporting', model: 'Claude Opus 4', tokens: '1,800', lastUsed: '1d ago', uses: 98 },
                { name: 'Risk Register Analyzer', category: 'PMO', model: 'Claude Sonnet 4', tokens: '2,200', lastUsed: '1d ago', uses: 147 },
                { name: 'Procurement Comparison Engine', category: 'Procurement', model: 'Claude Opus 4', tokens: '4,500', lastUsed: '2d ago', uses: 63 },
                { name: 'Arabic-English Terminology Mapper', category: 'Knowledge', model: 'Claude Sonnet 4', tokens: '1,200', lastUsed: '5h ago', uses: 331 },
              ].map((prompt, i) => (
                <div key={i} className="section-card" style={{ padding: '0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.875rem 1.125rem', cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <div style={{ padding: '0.5rem', borderRadius: '8px', background: 'rgba(139,92,246,0.1)', color: '#A78BFA', flexShrink: 0 }}>
                      <FileText size={15} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#F1F5F9' }}>{prompt.name}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{prompt.category} · {prompt.model} · ~{prompt.tokens} tokens</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 600 }}>{prompt.uses} uses</div>
                      <div style={{ fontSize: '0.65rem', color: '#334155' }}>{prompt.lastUsed}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                      <button style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '3px 8px', fontSize: '0.68rem', color: '#94A3B8', cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>
                      <button style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: '4px', padding: '3px 8px', fontSize: '0.68rem', color: '#38BDF8', cursor: 'pointer', fontFamily: 'inherit' }}>Test</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notifications Section */}
        {activeSection === 'notifications' && (
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#F1F5F9', margin: 0, marginBottom: '1.25rem' }}>Notification Rules</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                { event: 'Automation completed successfully', channels: ['In-App', 'Email'], enabled: true },
                { event: 'Automation failed or errored', channels: ['In-App', 'Email', 'Slack'], enabled: true },
                { event: 'Document requires approval', channels: ['In-App', 'Email'], enabled: true },
                { event: 'Task overdue (>1 day)', channels: ['In-App', 'Email'], enabled: true },
                { event: 'New critical risk identified', channels: ['In-App', 'Email', 'Slack'], enabled: true },
                { event: 'Meeting minutes generated', channels: ['In-App'], enabled: true },
                { event: 'Board decision requires sign-off', channels: ['In-App', 'Email'], enabled: true },
                { event: 'Weekly digest (every Monday 8am)', channels: ['Email'], enabled: false },
              ].map((rule, i) => (
                <div key={i} className="section-card" style={{ padding: '0.875rem 1.125rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 500, color: '#F1F5F9' }}>{rule.event}</div>
                      <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.375rem' }}>
                        {rule.channels.map(ch => (
                          <span key={ch} style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(14,165,233,0.1)', color: '#38BDF8', border: '1px solid rgba(14,165,233,0.15)' }}>{ch}</span>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.72rem', color: rule.enabled ? '#34D399' : '#64748B' }}>{rule.enabled ? 'Enabled' : 'Disabled'}</span>
                      <div style={{ width: '36px', height: '20px', borderRadius: '10px', background: rule.enabled ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)', cursor: 'pointer', position: 'relative', border: `1px solid ${rule.enabled ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.1)'}` }}>
                        <div style={{ position: 'absolute', top: '3px', left: rule.enabled ? '18px' : '3px', width: '12px', height: '12px', borderRadius: '50%', background: rule.enabled ? '#10B981' : '#64748B', transition: 'left 0.2s ease' }} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Approval Rules Section */}
        {activeSection === 'approvals' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#F1F5F9', margin: 0 }}>Approval Workflow Rules</h2>
              <button className="btn-primary" style={{ height: '34px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}><Plus size={14} /> New Rule</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                { trigger: 'Document marked "Final"', approvers: ['Workspace Admin', 'Client Contact'], sla: '48h', escalation: 'Programme Director', status: 'Active' },
                { trigger: 'AI-generated report published', approvers: ['Consultant', 'Manager'], sla: '24h', escalation: 'Team Lead', status: 'Active' },
                { trigger: 'Budget variance > AED 100K', approvers: ['PMO Director', 'Finance'], sla: '12h', escalation: 'Managing Partner', status: 'Active' },
                { trigger: 'New vendor awarded (procurement)', approvers: ['Committee Chair', 'Legal'], sla: '72h', escalation: 'Board', status: 'Active' },
                { trigger: 'Risk severity upgraded to Critical', approvers: ['Risk Owner', 'Programme Director'], sla: '6h', escalation: 'Board', status: 'Active' },
              ].map((rule, i) => (
                <div key={i} className="section-card" style={{ padding: '0.875rem 1.125rem' }}>
                  <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <div style={{ fontSize: '0.68rem', color: '#64748B', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trigger</div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#F1F5F9' }}>{rule.trigger}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#64748B', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Approvers</div>
                      <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                        {rule.approvers.map(a => <span key={a} style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: '4px', background: 'rgba(139,92,246,0.1)', color: '#C4B5FD', border: '1px solid rgba(139,92,246,0.2)' }}>{a}</span>)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#64748B', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SLA</div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#FCD34D' }}>{rule.sla}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#64748B', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Escalation</div>
                      <div style={{ fontSize: '0.78rem', color: '#FCA5A5' }}>{rule.escalation}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(16,185,129,0.1)', color: '#34D399', border: '1px solid rgba(16,185,129,0.2)' }}>Active</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
