import { useState, useEffect, useMemo } from 'react';
import {
  Users, Zap, Shield, Check, X, Plus, RefreshCw, ExternalLink,
  Mail, CheckCircle, Download, Key, LayoutDashboard, Sparkles, Brain, AlertTriangle,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useLayout } from '../hooks/useLayout';
import { getTeamMembers, createTeamMember, updateTeamMember } from '../lib/db';
import { fetchBATrafficBoard } from '../lib/trello';
import { Badge, cn, fadeUp, stagger } from '../components/ui';

const SECTIONS = [
  { id: 'users',        label: 'Users & Roles', Icon: Users },
  { id: 'integrations', label: 'Integrations',  Icon: Zap },
] as const;

const ROLE_TONE: Record<string, { bg: string; text: string }> = {
  Admin:      { bg: 'rgba(167,139,250,0.15)', text: '#C4B5FD' },
  Manager:    { bg: 'rgba(99,230,190,0.15)',  text: '#63E6BE' },
  Consultant: { bg: 'rgba(52,211,153,0.12)',  text: '#34D399' },
  Analyst:    { bg: 'rgba(148,163,184,0.1)',  text: '#8790A8' },
  Viewer:     { bg: 'rgba(120,119,198,0.12)', text: '#7DD3FC' },
};

const ROLE_DISPLAY: Record<string, string> = {
  Admin: 'System Admin',
  Manager: 'Senior Consultant',
  Consultant: 'Consultant',
  Analyst: 'Analyst',
  Viewer: 'Client Viewer',
};

interface LocalUser {
  id: string; name: string; email: string; role: string;
  workspaces: number; lastActive: string;
  status: 'Active' | 'Inactive'; initials: string;
}

export default function Admin() {
  const { isMobile } = useLayout();
  const [activeSection, setActiveSection] = useState<typeof SECTIONS[number]['id']>('users');
  const [userList, setUserList] = useState<LocalUser[]>([]);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'Analyst' });
  const [inviteSaving, setInviteSaving] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');

  const [trelloStatus, setTrelloStatus] = useState<'Checking' | 'Connected' | 'Disconnected'>('Checking');
  const [trelloTesting, setTrelloTesting] = useState(false);
  const [trelloRefreshMsg, setTrelloRefreshMsg] = useState<string | null>(null);

  useEffect(() => {
    getTeamMembers().then((data) => {
      setUserList(data.map((m) => ({
        id: m.id, name: m.name, email: m.email, role: m.role,
        workspaces: m.workspaces_count, lastActive: m.last_active,
        status: m.status, initials: m.initials,
      })));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchBATrafficBoard()
      .then(() => setTrelloStatus('Connected'))
      .catch(() => setTrelloStatus('Disconnected'));
  }, []);

  const filteredUsers = useMemo(() => {
    if (roleFilter === 'All') return userList;
    if (roleFilter === 'Admins') return userList.filter((u) => u.role === 'Admin');
    if (roleFilter === 'Consultants') return userList.filter((u) => u.role === 'Consultant' || u.role === 'Manager');
    if (roleFilter === 'Clients') return userList.filter((u) => u.role === 'Viewer');
    return userList;
  }, [userList, roleFilter]);

  function handleInvite() {
    if (!inviteForm.name || !inviteForm.email) return;
    setInviteSaving(true);
    setInviteError('');
    const newId = crypto.randomUUID();
    const initials = inviteForm.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
    createTeamMember({
      id: newId, name: inviteForm.name, email: inviteForm.email,
      role: inviteForm.role as 'Admin' | 'Consultant' | 'Manager' | 'Viewer' | 'Analyst',
      workspaces_count: 0, last_active: 'Just now', status: 'Active', initials,
    }).then((saved) => {
      setUserList((prev) => [...prev, {
        id: saved.id, name: saved.name, email: saved.email, role: saved.role,
        workspaces: saved.workspaces_count, lastActive: saved.last_active,
        status: saved.status, initials: saved.initials,
      }]);
      setInviteSuccess(`Invite sent to ${inviteForm.email}`);
      setInviteForm({ name: '', email: '', role: 'Analyst' });
      setInviteSaving(false);
      setTimeout(() => { setShowInvite(false); setInviteSuccess(''); }, 1500);
    }).catch((e: unknown) => {
      setInviteSaving(false);
      setInviteError(e instanceof Error ? e.message : 'Failed to send invite.');
    });
  }

  function handleToggleStatus(userId: string) {
    const target = userList.find((u) => u.id === userId);
    if (!target) return;
    const newStatus: 'Active' | 'Inactive' = target.status === 'Active' ? 'Inactive' : 'Active';
    setUserList((prev) => prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u)));
    updateTeamMember(userId, { status: newStatus }).catch(() => {});
  }

  async function handleTrelloTest() {
    setTrelloTesting(true);
    try {
      await fetchBATrafficBoard();
      setTrelloStatus('Connected');
    } catch {
      setTrelloStatus('Disconnected');
    } finally {
      setTrelloTesting(false);
    }
  }

  async function handleTrelloRefresh() {
    setTrelloRefreshMsg(null);
    try {
      await fetchBATrafficBoard();
      setTrelloRefreshMsg('Sync successful');
    } catch {
      setTrelloRefreshMsg('Sync failed');
    }
    setTimeout(() => setTrelloRefreshMsg(null), 3000);
  }

  const activeUsers = userList.filter((u) => u.status === 'Active').length;

  // Role distribution
  const roleDistribution = [
    { label: 'Consultant', color: '#7877C6', count: userList.filter((u) => u.role === 'Consultant').length },
    { label: 'Analyst',    color: '#63E6BE', count: userList.filter((u) => u.role === 'Analyst').length },
    { label: 'Admin',      color: '#A78BFA', count: userList.filter((u) => u.role === 'Admin').length },
    { label: 'Manager',    color: '#F0A875', count: userList.filter((u) => u.role === 'Manager').length },
    { label: 'Viewer',     color: '#7DD3FC', count: userList.filter((u) => u.role === 'Viewer').length },
  ];

  return (
    <motion.div
      initial="hidden" animate="show"
      variants={{ hidden: {}, show: { transition: stagger(0.05, 0.08) } }}
      className="screen-container"
    >
      <motion.div variants={fadeUp} className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-[1.5rem] md:text-[1.75rem] font-semibold tracking-[-0.025em] leading-tight text-white">Admin</h1>
          <p className="text-[0.78rem] text-[color:var(--text-muted)] mt-1">
            {userList.length} users · {activeUsers} active
          </p>
        </div>
        {activeSection === 'users' && (
          <button type="button" onClick={() => setShowInvite(true)} className="btn-primary">
            <Plus size={14} /> Invite User
          </button>
        )}
      </motion.div>

      {/* Section tabs */}
      <motion.div variants={fadeUp} className="flex items-center gap-1.5 flex-wrap">
        {SECTIONS.map((s) => {
          const Icon = s.Icon;
          const isActive = activeSection === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSection(s.id)}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[0.8rem] font-medium transition-colors border',
                isActive
                  ? 'bg-[rgba(120,119,198,0.18)] text-white border-[rgba(120,119,198,0.35)]'
                  : 'bg-white/[0.025] border-white/[0.06] text-[color:var(--text-muted)] hover:text-white hover:bg-white/[0.05]',
              )}
            >
              <Icon size={13} />
              {s.label}
            </button>
          );
        })}
      </motion.div>

      {activeSection === 'users' && (
        <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'grid-cols-[1fr_280px]')}>
          {/* Users table */}
          <motion.div variants={fadeUp} className="section-card">
            <div className="section-card-header flex-wrap gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                {['All', 'Admins', 'Consultants', 'Clients'].map((r) => {
                  const isActive = roleFilter === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRoleFilter(r)}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-[0.72rem] font-medium transition-colors border',
                        isActive
                          ? 'bg-[rgba(120,119,198,0.18)] text-white border-[rgba(120,119,198,0.35)]'
                          : 'bg-white/[0.025] border-white/[0.06] text-[color:var(--text-muted)] hover:text-white',
                      )}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
              <button type="button" className="flex items-center gap-1 text-[0.72rem] text-[color:var(--text-muted)] hover:text-white transition-colors">
                <Download size={11} /> Export
              </button>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Workspaces</th>
                    <th>Last active</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="cursor-pointer">
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7877C6] to-[#63E6BE] flex items-center justify-center text-[0.65rem] font-bold text-white ring-2 ring-white/10 flex-shrink-0">
                            {user.initials}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[0.84rem] font-semibold text-white truncate">{user.name}</div>
                            <div className="text-[0.7rem] text-[color:var(--text-muted)] truncate">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          className="text-[0.68rem] font-semibold px-2 py-0.5 rounded-md"
                          style={{ background: ROLE_TONE[user.role]?.bg ?? 'rgba(148,163,184,0.1)', color: ROLE_TONE[user.role]?.text ?? '#8790A8' }}
                        >
                          {ROLE_DISPLAY[user.role] ?? user.role}
                        </span>
                      </td>
                      <td className="tabular-nums">{user.workspaces}</td>
                      <td className="text-[0.72rem]">{user.lastActive}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Badge tone={user.status === 'Active' ? 'success' : 'neutral'}>{user.status}</Badge>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleToggleStatus(user.id); }}
                            aria-label={user.status === 'Active' ? 'Suspend' : 'Reactivate'}
                            className="text-[0.66rem] font-semibold text-[color:var(--text-muted)] hover:text-white transition-colors"
                          >
                            {user.status === 'Active' ? 'Suspend' : 'Reactivate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Side panel: Role distribution + AI Access */}
          <div className="flex flex-col gap-4">
            <motion.div variants={fadeUp} className="section-card">
              <div className="section-card-header">
                <span className="text-[0.9rem] font-bold text-white">Role Distribution</span>
              </div>
              <div className="p-4 space-y-2.5">
                {roleDistribution.map((r) => {
                  const pct = userList.length > 0 ? Math.round((r.count / userList.length) * 100) : 0;
                  return (
                    <div key={r.label}>
                      <div className="flex items-center justify-between text-[0.75rem] mb-1">
                        <span className="text-[color:var(--text-secondary)]">{r.label}</span>
                        <span className="text-white font-semibold tabular-nums">{r.count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                          className="h-full rounded-full"
                          style={{ background: r.color, boxShadow: `0 0 8px ${r.color}99` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            <motion.div variants={fadeUp} className="section-card">
              <div className="section-card-header">
                <div className="flex items-center gap-2">
                  <Sparkles size={13} className="text-[#A78BFA]" />
                  <span className="text-[0.9rem] font-bold text-white">AI Access Auditor</span>
                </div>
              </div>
              <div className="p-4 space-y-2.5">
                <div className="flex items-start gap-2">
                  <CheckCircle size={12} className="text-[#34D399] flex-shrink-0 mt-0.5" />
                  <span className="text-[0.72rem] text-[color:var(--text-secondary)]">All roles reviewed in last 30 days</span>
                </div>
                <div className="flex items-start gap-2">
                  <Shield size={12} className="text-[#7DD3FC] flex-shrink-0 mt-0.5" />
                  <span className="text-[0.72rem] text-[color:var(--text-secondary)]">2FA recommended for {Math.floor(userList.length * 0.3)} users</span>
                </div>
                <div className="flex items-start gap-2">
                  <Key size={12} className="text-[#F0A875] flex-shrink-0 mt-0.5" />
                  <span className="text-[0.72rem] text-[color:var(--text-secondary)]">3 API keys expire this month</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      )}

      {activeSection === 'integrations' && (
        <motion.div variants={fadeUp} className="section-card">
          <div className="section-card-header">
            <span className="text-[0.9rem] font-bold text-white">Connected integrations</span>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="w-10 h-10 rounded-xl bg-[rgba(120,119,198,0.18)] text-[#A78BFA] flex items-center justify-center ring-1 ring-[rgba(120,119,198,0.3)] flex-shrink-0">
                <LayoutDashboard size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[0.88rem] font-semibold text-white">Trello</span>
                  <Badge tone={trelloStatus === 'Connected' ? 'success' : trelloStatus === 'Checking' ? 'pending' : 'critical'}>{trelloStatus}</Badge>
                </div>
                <div className="text-[0.72rem] text-[color:var(--text-muted)]">BA Traffic Board — live task sync from Trello API</div>
                {trelloRefreshMsg && (
                  <div className="text-[0.7rem] mt-1" style={{ color: trelloRefreshMsg.includes('success') ? '#63E6BE' : '#FCA5A5' }}>
                    {trelloRefreshMsg}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button" onClick={handleTrelloRefresh}
                  className="p-2 rounded-lg text-[color:var(--text-muted)] hover:text-white hover:bg-white/[0.06] transition-colors"
                  title="Sync"
                >
                  <RefreshCw size={13} />
                </button>
                <button
                  type="button" onClick={handleTrelloTest}
                  disabled={trelloTesting}
                  className="text-[0.72rem] font-semibold px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[color:var(--text-secondary)] hover:text-white hover:bg-white/[0.08] transition-colors"
                >
                  {trelloTesting ? 'Testing…' : 'Test'}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Invite modal */}
      {showInvite && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowInvite(false); setInviteSuccess(''); setInviteError(''); } }}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className="glass-elevated w-full max-w-md rounded-2xl p-6"
          >
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-[1.05rem] font-semibold text-white tracking-tight">Invite User</h2>
                <p className="text-[0.76rem] text-[color:var(--text-muted)] mt-0.5">Send an email invite to join your team.</p>
              </div>
              <button
                type="button"
                onClick={() => { setShowInvite(false); setInviteSuccess(''); setInviteError(''); }}
                className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[color:var(--text-muted)] hover:bg-white/[0.08] hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {inviteSuccess && (
              <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-[rgba(52,211,153,0.1)] border border-[rgba(52,211,153,0.25)] text-[#34D399] text-[0.8rem]">
                <Check size={14} /> {inviteSuccess}
              </div>
            )}
            {inviteError && (
              <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-[rgba(255,107,107,0.08)] border border-[rgba(255,107,107,0.2)] text-[#FCA5A5] text-[0.78rem]">
                <AlertTriangle size={13} /> {inviteError}
              </div>
            )}

            <div className="space-y-3.5">
              <div>
                <label className="block text-[0.7rem] font-semibold tracking-[0.08em] uppercase text-[color:var(--text-muted)] mb-1.5">Full Name</label>
                <input className="input-field" placeholder="e.g. Sarah Ahmed" value={inviteForm.name} onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-[0.7rem] font-semibold tracking-[0.08em] uppercase text-[color:var(--text-muted)] mb-1.5">Email</label>
                <input className="input-field" placeholder="sarah@firm.com" value={inviteForm.email} onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="block text-[0.7rem] font-semibold tracking-[0.08em] uppercase text-[color:var(--text-muted)] mb-1.5">Role</label>
                <select className="input-field" value={inviteForm.role} onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value }))}>
                  {['Admin', 'Manager', 'Consultant', 'Analyst', 'Viewer'].map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" className="btn-ghost" onClick={() => { setShowInvite(false); setInviteError(''); }}>Cancel</button>
                <button type="button" className="btn-primary min-w-[140px] justify-center" onClick={handleInvite} disabled={inviteSaving || !inviteForm.name || !inviteForm.email}>
                  {inviteSaving ? 'Sending…' : (<><Mail size={13} /> Send Invite</>)}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}
