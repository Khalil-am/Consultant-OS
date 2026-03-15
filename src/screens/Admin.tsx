import { useState } from 'react';
import { useLayout } from '../hooks/useLayout';
import {
  Users, Briefcase, Zap, Brain, FileText, Bell, Shield,
  List, Check, X, Settings, Plus, RefreshCw, ExternalLink
} from 'lucide-react';
import { users } from '../data/mockData';

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

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      {/* Left Sidebar */}
      <div style={{
        width: '220px', minWidth: '220px', borderRight: '1px solid rgba(255,255,255,0.06)',
        padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '2px',
        background: '#0D1527',
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
                <p style={{ fontSize: '0.8rem', color: '#475569', margin: 0 }}>{users.length} users · 4 roles</p>
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
                              background: user.status === 'Active' ? '#10B981' : '#475569',
                              top: '2px', left: user.status === 'Active' ? '15px' : '2px',
                              transition: 'left 0.2s',
                            }} />
                          </div>
                          <span style={{ fontSize: '0.72rem', color: user.status === 'Active' ? '#34D399' : '#475569' }}>
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
              <p style={{ fontSize: '0.8rem', color: '#475569', margin: 0 }}>
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
                            color: integration.status === 'Connected' ? '#34D399' : '#475569',
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
                      <span style={{ fontSize: '0.72rem', color: '#475569' }}>{model.provider}</span>
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
                <p style={{ fontSize: '0.8rem', color: '#475569', margin: 0 }}>All system activity logs</p>
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
                  {auditLogs.map((log, i) => (
                    <tr key={i}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#00D4FF' }}>{log.time}</td>
                      <td>
                        <div className="avatar" style={{ width: '22px', height: '22px', fontSize: '0.6rem', display: 'inline-flex' }}>{log.user}</div>
                      </td>
                      <td style={{ fontSize: '0.82rem', color: '#F1F5F9', fontWeight: 500 }}>{log.action}</td>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>{log.resource}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{log.ip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )}

        {/* Placeholder sections */}
        {!['users', 'integrations', 'ai', 'audit'].includes(activeSection) && (
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#F1F5F9', margin: 0, marginBottom: '1.25rem' }}>
              {adminSections.find(s => s.id === activeSection)?.label}
            </h2>
            <div className="section-card" style={{ padding: '3rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚙️</div>
              <div style={{ color: '#475569', fontSize: '0.875rem' }}>
                {adminSections.find(s => s.id === activeSection)?.label} configuration panel
              </div>
              <div style={{ color: '#334155', fontSize: '0.78rem', marginTop: '0.375rem' }}>
                Settings for this section are available here
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
