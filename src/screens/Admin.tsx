import { useState, useEffect, useMemo } from 'react';
import { useLayout } from '../hooks/useLayout';
import {
  Users, Briefcase, Zap, Shield,
  Check, X, Settings, Plus, RefreshCw, ExternalLink,
  Share2, HardDrive, Cloud, Mail, MessageSquare, Hash,
  LayoutDashboard, BookOpen, Github, ScanLine, Sparkles, Brain,
  CheckCircle, ChevronLeft, ChevronRight, Download, Filter,
  Lock, Key, AlertTriangle, Info, Code2, Search, Trash2, ClipboardCopy, FileText,
} from 'lucide-react';
import { users } from '../data/mockData';
import { fetchBATrafficBoard } from '../lib/trello';
import { getUsers, upsertUser, updateUser } from '../lib/db';

const adminSections = [
  { id: 'users', label: 'Users & Roles', icon: <Users size={15} /> },
  { id: 'integrations', label: 'Integrations', icon: <Zap size={15} /> },
  { id: 'security', label: 'Security & Audit', icon: <Shield size={15} /> },
];

interface AuditEvent {
  id: string;
  actor: string;
  action: string;
  target: string;
  ip: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'critical';
}

const AUDIT_EVENTS_KEY = 'admin_audit_events';

const initialAuditEvents: AuditEvent[] = [
  { id: 'evt-001', actor: 'Ahmed Khalil', action: 'User role changed', target: 'Rania Taleb → Senior Consultant', ip: '10.0.1.15', timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), severity: 'warning' },
  { id: 'evt-002', actor: 'System', action: 'Failed login attempt', target: 'admin@firm.com', ip: '192.168.0.42', timestamp: new Date(Date.now() - 1000 * 60 * 22).toISOString(), severity: 'critical' },
  { id: 'evt-003', actor: 'Ahmed Khalil', action: 'User invited', target: 'sarah.jones@client.gov', ip: '10.0.1.15', timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(), severity: 'info' },
  { id: 'evt-004', actor: 'Rania Taleb', action: 'CSV export downloaded', target: 'users_export_2026-04-11.csv', ip: '10.0.2.8', timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(), severity: 'info' },
  { id: 'evt-005', actor: 'System', action: '2FA disabled', target: 'faisal.hassan@firm.com', ip: '10.0.3.55', timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(), severity: 'critical' },
  { id: 'evt-006', actor: 'Ahmed Khalil', action: 'Trello integration refreshed', target: 'BA Traffic Board', ip: '10.0.1.15', timestamp: new Date(Date.now() - 1000 * 60 * 240).toISOString(), severity: 'info' },
  { id: 'evt-007', actor: 'System', action: 'User deactivated', target: 'old.account@firm.com', ip: 'System', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), severity: 'warning' },
  { id: 'evt-008', actor: 'Rania Taleb', action: 'Password reset triggered', target: 'khalid.omar@firm.com', ip: '10.0.2.8', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(), severity: 'warning' },
  { id: 'evt-009', actor: 'Ahmed Khalil', action: 'New workspace created', target: 'NCA Smart City Initiative', ip: '10.0.1.15', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(), severity: 'info' },
  { id: 'evt-010', actor: 'System', action: 'Suspicious login blocked', target: 'admin@firm.com from unknown device', ip: '45.33.32.156', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), severity: 'critical' },
];

const roleColors: Record<string, { bg: string; text: string }> = {
  Admin: { bg: 'rgba(139,92,246,0.15)', text: '#A78BFA' },
  Manager: { bg: 'rgba(16,185,129,0.12)', text: '#34D399' },
  Consultant: { bg: 'rgba(16,185,129,0.12)', text: '#34D399' },
  Analyst: { bg: 'rgba(148,163,184,0.1)', text: '#94A3B8' },
  Viewer: { bg: 'rgba(14,165,233,0.12)', text: '#38BDF8' },
};

const roleDisplayNames: Record<string, string> = {
  Admin: 'System Admin',
  Manager: 'Senior Consultant',
  Consultant: 'Consultant',
  Analyst: 'Analyst',
  Viewer: 'Client Viewer',
};

const integrations: { name: string; category: string; status: string; logo: React.ReactNode; desc: string }[] = [
  { name: 'Trello', category: 'Project Management', status: 'Connected', logo: <LayoutDashboard size={18} />, desc: 'BA Traffic Board — live task sync from Trello API' },
];


interface LocalUser { id: string; name: string; email: string; role: string; workspaces: number; lastActive: string; status: 'Active' | 'Inactive'; initials: string; }

const USERS_PER_PAGE = 5;

// Mock 2FA data (deterministic based on user id)
function has2FA(userId: string): boolean {
  const hash = userId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return hash % 3 !== 0;
}

// Mock last activity relative times
const lastActivityTimes: Record<string, string> = {
  'usr-001': 'Just now',
  'usr-002': '15 mins ago',
  'usr-003': '1 hour ago',
  'usr-004': '30 mins ago',
  'usr-005': '3 hours ago',
  'usr-006': '5 hours ago',
  'usr-007': '2 days ago',
  'usr-008': '1 day ago',
  'usr-009': '10 mins ago',
  'usr-010': '4 days ago',
};

// Suppress unused import warnings
void Code2;

export default function Admin() {
  const { width, isMobile, isTablet } = useLayout();
  const [activeSection, setActiveSection] = useState('users');
  const [userList, setUserList] = useState<LocalUser[]>(() => {
    try { return JSON.parse(localStorage.getItem('admin_users') ?? 'null') ?? users; } catch { return users; }
  });
  const [dbUsersLoaded, setDbUsersLoaded] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'Analyst' });
  const [inviteSaving, setInviteSaving] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [userStatusFilter, setUserStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [userSearch, setUserSearch] = useState('');
  const [userSort, setUserSort] = useState<'name' | 'role' | 'status' | 'email' | 'joined' | 'workspaces'>('name');
  const [currentPage, setCurrentPage] = useState(1);
  const [showTrelloConfig, setShowTrelloConfig] = useState(false);
  const [trelloTestResult, setTrelloTestResult] = useState<string | null>(null);
  const [trelloTesting, setTrelloTesting] = useState(false);
  const [trelloRefreshMsg, setTrelloRefreshMsg] = useState<string | null>(null);

  // ── Security audit log ────────────────────────────────────────
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(() => {
    try {
      const saved = localStorage.getItem(AUDIT_EVENTS_KEY);
      if (saved) return JSON.parse(saved) as AuditEvent[];
    } catch { /* ignore */ }
    return initialAuditEvents;
  });
  const [auditSeverityFilter, setAuditSeverityFilter] = useState<'all' | 'info' | 'warning' | 'critical'>('all');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActorFilter, setAuditActorFilter] = useState<string>('All');
  const [auditDateFilter, setAuditDateFilter] = useState<'All' | 'Today' | 'This Week'>('All');
  const [auditSort, setAuditSort] = useState<'newest' | 'oldest' | 'severity' | 'actor'>('newest');
  const [resetPwToast, setResetPwToast] = useState<string | null>(null);
  const [userSummaryCopied, setUserSummaryCopied] = useState(false);
  const [auditCsvExported, setAuditCsvExported] = useState(false);
  const [auditTxtExported, setAuditTxtExported] = useState(false);
  const [usersTxtExported, setUsersTxtExported] = useState(false);
  const [auditSummaryCopied, setAuditSummaryCopied] = useState(false);
  const [integrationStatusCopied, setIntegrationStatusCopied] = useState(false);

  function handleExportAuditLogCSV() {
    if (filteredAuditEvents.length === 0) return;
    const headers = ['Time', 'Actor', 'Action', 'Target', 'IP', 'Severity'];
    const rows = filteredAuditEvents.map(e => [
      `"${e.timestamp}"`,
      `"${e.actor.replace(/"/g, '""')}"`,
      `"${e.action.replace(/"/g, '""')}"`,
      `"${e.target.replace(/"/g, '""')}"`,
      e.ip,
      e.severity,
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_log_export.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setAuditCsvExported(true);
    setTimeout(() => setAuditCsvExported(false), 2000);
  }

  function handleCopyAuditSummary() {
    if (filteredAuditEvents.length === 0) return;
    const critical = filteredAuditEvents.filter(e => e.severity === 'critical').length;
    const warnings = filteredAuditEvents.filter(e => e.severity === 'warning').length;
    const info = filteredAuditEvents.filter(e => e.severity === 'info').length;
    const lines = [
      `Security & Audit Log Summary`,
      `Total Events: ${filteredAuditEvents.length}`,
      `Critical: ${critical}`,
      `Warnings: ${warnings}`,
      `Info: ${info}`,
    ].join('\n');
    navigator.clipboard.writeText(lines).then(() => {
      setAuditSummaryCopied(true);
      setTimeout(() => setAuditSummaryCopied(false), 2000);
    }).catch(() => {});
  }

  function handleCopyIntegrationStatus() {
    const connected = integrations.filter(i => i.status === 'Connected');
    const disconnected = integrations.filter(i => i.status !== 'Connected');
    const lines = [
      `Integration Status Report`,
      `Total: ${integrations.length}`,
      `Connected: ${connected.length}`,
      `Available: ${disconnected.length}`,
      '',
      ...connected.map(i => `✓ ${i.name} (${i.category})`),
      ...disconnected.map(i => `○ ${i.name} (${i.category})`),
    ].join('\n');
    navigator.clipboard.writeText(lines).then(() => {
      setIntegrationStatusCopied(true);
      setTimeout(() => setIntegrationStatusCopied(false), 2000);
    }).catch(() => {});
  }

  function logAuditEvent(actor: string, action: string, target: string, severity: AuditEvent['severity'] = 'info') {
    const evt: AuditEvent = {
      id: `evt-${Date.now()}`,
      actor, action, target,
      ip: '10.0.1.15',
      timestamp: new Date().toISOString(),
      severity,
    };
    setAuditEvents(prev => {
      const updated = [evt, ...prev].slice(0, 50);
      try { localStorage.setItem(AUDIT_EVENTS_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
      return updated;
    });
  }

  const auditActors = useMemo(() => {
    const actors = [...new Set(auditEvents.map(e => e.actor))].sort();
    return actors;
  }, [auditEvents]);

  const filteredAuditEvents = useMemo(() => {
    let events = auditEvents;
    if (auditSeverityFilter !== 'all') events = events.filter(e => e.severity === auditSeverityFilter);
    if (auditActorFilter !== 'All') events = events.filter(e => e.actor === auditActorFilter);
    if (auditDateFilter !== 'All') {
      const today = new Date().toISOString().slice(0, 10);
      if (auditDateFilter === 'Today') {
        events = events.filter(e => e.timestamp.startsWith(today));
      } else {
        const d = new Date(); const day = d.getDay();
        const monday = new Date(d); monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
        const weekStart = monday.toISOString().slice(0, 10);
        events = events.filter(e => e.timestamp.slice(0, 10) >= weekStart);
      }
    }
    if (auditSearch.trim()) {
      const q = auditSearch.toLowerCase();
      events = events.filter(e =>
        e.actor.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q) ||
        e.target.toLowerCase().includes(q) ||
        e.ip.toLowerCase().includes(q)
      );
    }
    const SEVERITY_ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    if (auditSort === 'oldest') return [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    if (auditSort === 'severity') return [...events].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 2) - (SEVERITY_ORDER[b.severity] ?? 2));
    if (auditSort === 'actor') return [...events].sort((a, b) => a.actor.localeCompare(b.actor));
    return [...events].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [auditEvents, auditSeverityFilter, auditActorFilter, auditDateFilter, auditSearch, auditSort]);

  function clearAuditLog() {
    setAuditEvents([]);
    localStorage.removeItem(AUDIT_EVENTS_KEY);
  }

  function fmtAuditTime(iso: string): string {
    const d = new Date(iso);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }


  const filteredUsers = useMemo(() => {
    let list = userList;
    if (roleFilter === 'Admins') list = list.filter(u => u.role === 'Admin');
    else if (roleFilter === 'Consultants') list = list.filter(u => u.role === 'Consultant' || u.role === 'Manager');
    else if (roleFilter === 'Clients') list = list.filter(u => u.role === 'Viewer');
    if (userStatusFilter !== 'All') list = list.filter(u => u.status === userStatusFilter);
    if (userSearch.trim()) {
      const q = userSearch.toLowerCase();
      list = list.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    if (userSort === 'role') return [...list].sort((a, b) => a.role.localeCompare(b.role));
    if (userSort === 'status') return [...list].sort((a, b) => a.status.localeCompare(b.status));
    if (userSort === 'email') return [...list].sort((a, b) => a.email.localeCompare(b.email));
    if (userSort === 'joined') return [...list].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
    if (userSort === 'workspaces') return [...list].sort((a, b) => (b.workspaces ?? 0) - (a.workspaces ?? 0));
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [userList, roleFilter, userStatusFilter, userSearch, userSort]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * USERS_PER_PAGE, currentPage * USERS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [roleFilter, userStatusFilter, userSearch, userSort]);

  // Load users from DB on mount (fall back to localStorage/mockData if unavailable)
  useEffect(() => {
    if (dbUsersLoaded) return;
    getUsers().then(dbRows => {
      if (dbRows.length > 0) {
        const mapped: LocalUser[] = dbRows.map(u => ({
          id: u.id, name: u.name, email: u.email ?? '', role: u.role,
          workspaces: u.workspaces ?? 0, lastActive: 'Recently',
          status: u.status, initials: u.initials,
        }));
        setUserList(mapped);
        localStorage.setItem('admin_users', JSON.stringify(mapped));
      }
      setDbUsersLoaded(true);
    }).catch(() => { setDbUsersLoaded(true); });
  }, [dbUsersLoaded]);

  async function handleInviteUser() {
    if (!inviteForm.name || !inviteForm.email) return;
    setInviteSaving(true);
    const newUser: LocalUser = {
      id: crypto.randomUUID(),
      name: inviteForm.name,
      email: inviteForm.email,
      role: inviteForm.role,
      workspaces: 0,
      lastActive: 'Just now',
      status: 'Active',
      initials: inviteForm.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
    };
    // Try persisting to DB, fall back gracefully
    upsertUser({
      id: newUser.id, name: newUser.name, email: newUser.email,
      role: newUser.role, workspaces: 0, status: 'Active', initials: newUser.initials,
    }).catch(() => {});
    const updated = [...userList, newUser];
    setUserList(updated);
    try { localStorage.setItem('admin_users', JSON.stringify(updated)); } catch { /* ignore */ }
    setInviteSuccess(`Invite sent to ${inviteForm.email}`);
    logAuditEvent('Ahmed Khalil', 'User invited', inviteForm.email, 'info');
    setInviteForm({ name: '', email: '', role: 'Analyst' });
    setInviteSaving(false);
    setTimeout(() => { setShowInvite(false); setInviteSuccess(''); }, 1500);
  }

  function handleToggleUserStatus(userId: string) {
    const updated = userList.map(u => u.id === userId ? { ...u, status: (u.status === 'Active' ? 'Inactive' : 'Active') as 'Active' | 'Inactive' } : u);
    setUserList(updated);
    try { localStorage.setItem('admin_users', JSON.stringify(updated)); } catch { /* ignore */ }
    const target = updated.find(u => u.id === userId);
    if (target) {
      updateUser(userId, { status: target.status }).catch(() => {});
    }
  }

  function handleCopyUserSummary() {
    const total = userList.length;
    const admins = userList.filter(u => u.role === 'Admin').length;
    const consultants = userList.filter(u => u.role === 'Consultant' || u.role === 'Manager').length;
    const clients = userList.filter(u => u.role === 'Viewer').length;
    const active = userList.filter(u => u.status === 'Active').length;
    const lines = [
      `User Summary – Consultant OS`,
      `Total Users: ${total}`,
      `Active: ${active}`,
      `Admins: ${admins}`,
      `Consultants/Managers: ${consultants}`,
      `Clients: ${clients}`,
    ].join('\n');
    navigator.clipboard.writeText(lines).then(() => {
      setUserSummaryCopied(true);
      setTimeout(() => setUserSummaryCopied(false), 2000);
    }).catch(() => {});
  }

  function handleResetPassword(user: LocalUser) {
    logAuditEvent('Ahmed Khalil', 'Password reset triggered', user.email, 'warning');
    setResetPwToast(`Password reset email sent to ${user.email}`);
    setTimeout(() => setResetPwToast(null), 3500);
  }

  function handleExportUsersCSV() {
    const rows = filteredUsers;
    const header = ['Name', 'Email', 'Role', 'Status', 'Workspaces', 'Last Active'];
    const csvRows = [
      header.join(','),
      ...rows.map(u => [
        `"${u.name}"`,
        `"${u.email}"`,
        `"${u.role}"`,
        `"${u.status}"`,
        String(u.workspaces),
        `"${lastActivityTimes[u.id] ?? u.lastActive}"`,
      ].join(',')),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    logAuditEvent('Ahmed Khalil', 'CSV export downloaded', `users_export_${new Date().toISOString().slice(0, 10)}.csv`, 'info');
  }

  function handleExportUsersTxt() {
    const rows = filteredUsers;
    if (rows.length === 0) return;
    const lines = [
      `Users Export – Consultant OS`,
      `Total: ${rows.length}`,
      ``,
      ...rows.map(u => `  [${u.role}] ${u.name} <${u.email}> – ${u.status}`),
    ].join('\n');
    const blob = new Blob([lines], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users_export.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setUsersTxtExported(true);
    setTimeout(() => setUsersTxtExported(false), 2000);
  }

  function handleExportAuditLogTxt() {
    if (filteredAuditEvents.length === 0) return;
    const lines = [
      `Security Audit Log – Consultant OS`,
      `Total Events: ${filteredAuditEvents.length}`,
      ``,
      ...filteredAuditEvents.map(e => `  [${e.severity.toUpperCase()}] ${e.timestamp} – ${e.actor}: ${e.action} on ${e.target} (${e.ip})`),
    ].join('\n');
    const blob = new Blob([lines], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_log_export.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setAuditTxtExported(true);
    setTimeout(() => setAuditTxtExported(false), 2000);
  }

  function toggleUserSelection(userId: string) {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function handleTrelloTest() {
    setTrelloTesting(true);
    setTrelloTestResult(null);
    try {
      await fetchBATrafficBoard();
      setTrelloTestResult('Connection successful');
    } catch {
      setTrelloTestResult('Connection failed');
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

  function toggleAllSelection() {
    if (selectedUsers.size === paginatedUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(paginatedUsers.map(u => u.id)));
    }
  }

  function getStatusDisplay(user: LocalUser): { label: string; color: string; dotColor: string } {
    if (user.status === 'Active') return { label: 'ACTIVE', color: '#34D399', dotColor: '#10B981' };
    // Randomly assign PENDING or LOCKED for inactive users
    const hash = user.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    if (hash % 2 === 0) return { label: 'PENDING', color: '#F59E0B', dotColor: '#F59E0B' };
    return { label: 'LOCKED', color: '#EF4444', dotColor: '#EF4444' };
  }

  /* ─── Stats Cards ─── */
  const statsCards = [
    {
      title: 'TOTAL USERS',
      value: userList.length.toLocaleString(),
      trend: '+12% vs last month',
      trendPositive: true,
      color: '#0EA5E9',
      icon: <Users size={16} />,
    },
    {
      title: 'DAILY ACTIVE',
      value: '892',
      trend: '+5%',
      trendPositive: true,
      color: '#10B981',
      icon: <CheckCircle size={16} />,
      sparkline: true,
    },
    {
      title: 'PENDING INVITES',
      value: '24',
      sub: '8 expiring soon',
      link: 'View All',
      color: '#F59E0B',
      icon: <Mail size={16} />,
    },
    {
      title: 'SECURITY ALERTS',
      value: '3',
      sub: '2 unusual logins',
      link: 'Review',
      color: '#EF4444',
      icon: <Shield size={16} />,
      redDot: true,
    },
  ];

  /* ─── Role distribution for sidebar chart ─── */
  const roleDistribution = [
    { label: 'Consultant', color: '#0EA5E9', pct: 50 },
    { label: 'Analyst', color: '#F59E0B', pct: 20 },
    { label: 'Admin', color: '#A78BFA', pct: 15 },
    { label: 'Client', color: '#EF4444', pct: 15 },
  ];

  return (<>
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
      {/* Left Sidebar — hidden on tablet/mobile */}
      {!isTablet && (
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
              aria-label={`Admin section: ${section.label}`}
              aria-pressed={activeSection === section.id}
            >
              <span style={{ opacity: activeSection === section.id ? 1 : 0.6 }}>{section.icon}</span>
              <span>{section.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '0.875rem' : '1.5rem' }}>

        {/* Horizontal section pills for tablet/mobile */}
        {isTablet && (
          <div style={{
            display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.75rem',
            marginBottom: '0.5rem', WebkitOverflowScrolling: 'touch',
          }}>
            {adminSections.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.375rem',
                  padding: '6px 14px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 500,
                  whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                  background: activeSection === section.id ? 'rgba(14,165,233,0.15)' : 'rgba(255,255,255,0.04)',
                  color: activeSection === section.id ? '#38BDF8' : '#94A3B8',
                  border: activeSection === section.id ? '1px solid rgba(14,165,233,0.3)' : '1px solid rgba(255,255,255,0.08)',
                }}
                aria-label={`Admin section: ${section.label}`}
                aria-pressed={activeSection === section.id}
              >
                {section.icon}
                <span>{section.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* ═══ Users & Roles ═══ */}
        {activeSection === 'users' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#F1F5F9', margin: 0, marginBottom: '0.25rem' }}>Users & Roles</h2>
                <p style={{ fontSize: '0.8rem', color: '#64748B', margin: 0 }}>{userList.length} users · 5 roles</p>
              </div>
              <button className="btn-primary" style={{ height: '34px', fontSize: '0.8rem' }} onClick={() => setShowInvite(true)} aria-label="Invite User">
                <Plus size={13} /> Invite User
              </button>
            </div>

            {/* Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${width >= 1024 ? 4 : width >= 640 ? 2 : 1}, 1fr)`, gap: '0.875rem' }}>
              {statsCards.map((card) => (
                <div key={card.title} className="section-card" style={{ padding: '1rem 1.125rem', position: 'relative', overflow: 'hidden' }}>
                  {/* Icon badge top-right */}
                  <div style={{
                    position: 'absolute', top: '0.75rem', right: '0.75rem',
                    width: '32px', height: '32px', borderRadius: '8px',
                    background: `${card.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: card.color,
                  }}>
                    {card.icon}
                  </div>
                  <div style={{ fontSize: '0.62rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
                    {card.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 700, color: card.color, lineHeight: 1 }}>
                      {card.value}
                    </span>
                    {card.redDot && (
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444', display: 'inline-block', boxShadow: '0 0 6px rgba(239,68,68,0.5)' }} />
                    )}
                  </div>
                  {card.trend && (
                    <span style={{
                      display: 'inline-block', marginTop: '0.5rem',
                      fontSize: '0.62rem', padding: '2px 6px', borderRadius: '9999px',
                      background: card.trendPositive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                      color: card.trendPositive ? '#34D399' : '#EF4444',
                      border: `1px solid ${card.trendPositive ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                    }}>
                      {card.trend}
                    </span>
                  )}
                  {card.sparkline && (
                    <div style={{ marginTop: '0.375rem', display: 'flex', alignItems: 'end', gap: '2px', height: '16px' }}>
                      {[4,6,5,8,7,10,9,12,11,14].map((h, i) => (
                        <div key={i} style={{ width: '3px', height: `${h}px`, borderRadius: '1px', background: `${card.color}60` }} />
                      ))}
                    </div>
                  )}
                  {card.sub && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.68rem', color: '#64748B' }}>
                      {card.sub}
                      {card.link && (
                        <span style={{ color: card.color, marginLeft: '0.5rem', cursor: 'pointer', fontWeight: 500 }}>{card.link}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Main 2-column layout */}
            <div style={{ display: 'grid', gridTemplateColumns: width >= 1024 ? '1fr 300px' : '1fr', gap: '1.25rem' }}>
              {/* Left: Users Directory */}
              <div style={{ minWidth: 0 }}>
                <div className="section-card" style={{ padding: 0 }}>
                  {/* Table header bar */}
                  <div style={{ padding: '0.875rem 1.125rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Users Directory</span>
                      <span style={{
                        fontSize: '0.62rem', padding: '2px 8px', borderRadius: '9999px',
                        background: 'rgba(14,165,233,0.1)', color: '#38BDF8',
                        border: '1px solid rgba(14,165,233,0.2)',
                      }}>
                        {filteredUsers.length.toLocaleString()} total
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {/* Filter tabs */}
                      {['All', 'Admins', 'Consultants', 'Clients'].map(tab => (
                        <button
                          key={tab}
                          onClick={() => setRoleFilter(tab)}
                          aria-label={`Filter users: ${tab}`}
                          aria-pressed={roleFilter === tab}
                          style={{
                            padding: '4px 10px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 500,
                            background: roleFilter === tab ? 'rgba(14,165,233,0.15)' : 'transparent',
                            color: roleFilter === tab ? '#38BDF8' : '#64748B',
                            border: roleFilter === tab ? '1px solid rgba(14,165,233,0.25)' : '1px solid transparent',
                            cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          {tab}
                        </button>
                      ))}
                      <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.08)', margin: '0 0.25rem' }} />
                      {/* Status quick filter */}
                      {(['All', 'Active', 'Inactive'] as const).map(sf => (
                        <button
                          key={sf}
                          onClick={() => setUserStatusFilter(sf)}
                          aria-label={`Filter users by status: ${sf}`}
                          aria-pressed={userStatusFilter === sf}
                          style={{
                            padding: '4px 10px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 500,
                            background: userStatusFilter === sf ? 'rgba(16,185,129,0.15)' : 'transparent',
                            color: userStatusFilter === sf ? '#34D399' : '#64748B',
                            border: userStatusFilter === sf ? '1px solid rgba(16,185,129,0.25)' : '1px solid transparent',
                            cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          {sf}
                        </button>
                      ))}
                      <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.08)', margin: '0 0.25rem' }} />
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', display: 'flex', padding: '4px' }} aria-label="Advanced filter options">
                        <Filter size={14} />
                      </button>
                      <button
                        onClick={handleExportUsersCSV}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', display: 'flex', padding: '4px' }}
                        aria-label="Export users list as CSV"
                        title="Export to CSV"
                      >
                        <Download size={14} />
                      </button>
                      <button
                        onClick={handleExportUsersTxt}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: usersTxtExported ? '#34D399' : '#64748B', display: 'flex', padding: '4px' }}
                        aria-label="Export users list as TXT"
                        title="Export to TXT"
                      >
                        <FileText size={14} />
                      </button>
                      <button
                        onClick={handleCopyUserSummary}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: userSummaryCopied ? '#34D399' : '#64748B', display: 'flex', padding: '4px' }}
                        aria-label="Copy user summary to clipboard"
                        title="Copy summary"
                      >
                        <ClipboardCopy size={14} />
                      </button>
                    </div>
                  </div>

                  {/* User search bar + sort */}
                  <div style={{ padding: '0.5rem 1.125rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.01)' }}>
                    <Search size={13} style={{ color: '#64748B', flexShrink: 0 }} />
                    <input
                      type="text"
                      aria-label="Search users"
                      placeholder="Search by name or email…"
                      value={userSearch}
                      onChange={e => setUserSearch(e.target.value)}
                      style={{
                        flex: 1, background: 'transparent', border: 'none', outline: 'none',
                        fontSize: '0.78rem', color: '#CBD5E1', fontFamily: 'inherit',
                      }}
                    />
                    {userSearch && (
                      <button
                        aria-label="Clear user search"
                        onClick={() => setUserSearch('')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', display: 'flex', padding: '2px' }}
                      >
                        <X size={12} />
                      </button>
                    )}
                    <select
                      aria-label="Sort users"
                      value={userSort}
                      onChange={e => setUserSort(e.target.value as typeof userSort)}
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#94A3B8', fontSize: '0.72rem', padding: '2px 6px', fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}
                    >
                      <option value="name">Name</option>
                      <option value="role">Role</option>
                      <option value="status">Status</option>
                      <option value="email">Email</option>
                      <option value="joined">Joined</option>
                      <option value="workspaces">Workspaces</option>
                    </select>
                  </div>

                  {/* Bulk action bar */}
                  {selectedUsers.size > 0 && (
                    <div style={{
                      padding: '0.5rem 1.125rem', background: 'rgba(14,165,233,0.06)',
                      borderBottom: '1px solid rgba(14,165,233,0.15)',
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                    }}>
                      <span style={{ fontSize: '0.75rem', color: '#0EA5E9', fontWeight: 600 }}>
                        {selectedUsers.size} user{selectedUsers.size > 1 ? 's' : ''} selected
                      </span>
                      <div style={{ display: 'flex', gap: '0.375rem', marginLeft: 'auto' }}>
                        <button aria-label="Change Role for selected users" style={{
                          padding: '3px 10px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 500,
                          background: 'rgba(255,255,255,0.06)', color: '#94A3B8',
                          border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontFamily: 'inherit',
                        }}>Change Role</button>
                        <button aria-label="Reset Password for selected users" style={{
                          padding: '3px 10px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 500,
                          background: 'rgba(255,255,255,0.06)', color: '#94A3B8',
                          border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontFamily: 'inherit',
                        }}>Reset Password</button>
                        <button aria-label="Suspend selected users" style={{
                          padding: '3px 10px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 500,
                          background: 'rgba(239,68,68,0.1)', color: '#EF4444',
                          border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer', fontFamily: 'inherit',
                        }}>Suspend</button>
                      </div>
                    </div>
                  )}

                  {/* Table */}
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ width: '36px' }}>
                            <div
                              onClick={toggleAllSelection}
                              style={{
                                width: '16px', height: '16px', borderRadius: '3px', cursor: 'pointer',
                                border: `1.5px solid ${selectedUsers.size === paginatedUsers.length && paginatedUsers.length > 0 ? '#0EA5E9' : 'rgba(255,255,255,0.2)'}`,
                                background: selectedUsers.size === paginatedUsers.length && paginatedUsers.length > 0 ? 'rgba(14,165,233,0.3)' : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              {selectedUsers.size === paginatedUsers.length && paginatedUsers.length > 0 && <Check size={10} style={{ color: '#0EA5E9' }} />}
                            </div>
                          </th>
                          <th>User</th>
                          <th>Role</th>
                          <th>Status</th>
                          {!isMobile && <th>Last Activity</th>}
                          {!isMobile && <th>2FA</th>}
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedUsers.map(user => {
                          const statusInfo = getStatusDisplay(user);
                          const twoFA = has2FA(user.id);
                          const isSelected = selectedUsers.has(user.id);
                          return (
                            <tr key={user.id} style={{ background: isSelected ? 'rgba(14,165,233,0.04)' : undefined }}>
                              <td style={{ width: '36px' }}>
                                <div
                                  onClick={() => toggleUserSelection(user.id)}
                                  style={{
                                    width: '16px', height: '16px', borderRadius: '3px', cursor: 'pointer',
                                    border: `1.5px solid ${isSelected ? '#0EA5E9' : 'rgba(255,255,255,0.2)'}`,
                                    background: isSelected ? 'rgba(14,165,233,0.3)' : 'transparent',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}
                                >
                                  {isSelected && <Check size={10} style={{ color: '#0EA5E9' }} />}
                                </div>
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                  <div className="avatar" style={{ width: '30px', height: '30px', fontSize: '0.62rem', flexShrink: 0 }}>
                                    {(user as { avatar?: string }).avatar ?? user.initials}
                                  </div>
                                  <div>
                                    <div style={{ fontSize: '0.82rem', fontWeight: 500, color: '#F1F5F9', lineHeight: 1.3 }}>{user.name}</div>
                                    <div style={{ fontSize: '0.68rem', color: '#475569', lineHeight: 1.3 }}>{user.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span style={{
                                  fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px',
                                  background: roleColors[user.role]?.bg, color: roleColors[user.role]?.text,
                                  border: `1px solid ${roleColors[user.role]?.text}25`,
                                  whiteSpace: 'nowrap',
                                }}>
                                  {roleDisplayNames[user.role] ?? user.role}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                  <span style={{
                                    width: '6px', height: '6px', borderRadius: '50%',
                                    background: statusInfo.dotColor, display: 'inline-block',
                                    boxShadow: `0 0 4px ${statusInfo.dotColor}60`,
                                  }} />
                                  <span style={{ fontSize: '0.68rem', fontWeight: 600, color: statusInfo.color, letterSpacing: '0.03em' }}>
                                    {statusInfo.label}
                                  </span>
                                </div>
                              </td>
                              {!isMobile && (
                                <td style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                                  {lastActivityTimes[user.id] ?? user.lastActive}
                                </td>
                              )}
                              {!isMobile && (
                                <td>
                                  <Shield size={14} style={{ color: twoFA ? '#10B981' : '#334155' }} />
                                </td>
                              )}
                              <td>
                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                  <button
                                    onClick={() => handleToggleUserStatus(user.id)}
                                    style={{
                                      padding: '0.25rem 0.5rem', background: 'rgba(255,255,255,0.04)',
                                      border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px',
                                      cursor: 'pointer', fontSize: '0.7rem', color: '#94A3B8', fontFamily: 'inherit',
                                    }}
                                    aria-label={`${user.status === 'Active' ? 'Suspend' : 'Activate'} ${user.name}`}
                                  >
                                    {user.status === 'Active' ? 'Suspend' : 'Activate'}
                                  </button>
                                  <button
                                    onClick={() => handleResetPassword(user)}
                                    style={{
                                      padding: '0.25rem 0.5rem', background: 'rgba(255,255,255,0.04)',
                                      border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px',
                                      cursor: 'pointer', fontSize: '0.7rem', color: '#94A3B8', fontFamily: 'inherit',
                                    }}
                                    aria-label={`Reset password for ${user.name}`}
                                  >
                                    Reset PW
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div style={{
                    padding: '0.75rem 1.125rem', borderTop: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                      Showing {Math.min((currentPage - 1) * USERS_PER_PAGE + 1, filteredUsers.length)}-{Math.min(currentPage * USERS_PER_PAGE, filteredUsers.length)} of {filteredUsers.length}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        style={{
                          width: '28px', height: '28px', borderRadius: '6px', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', cursor: currentPage === 1 ? 'default' : 'pointer',
                          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                          color: currentPage === 1 ? '#334155' : '#94A3B8', fontFamily: 'inherit',
                        }}
                        aria-label="Previous page"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          style={{
                            width: '28px', height: '28px', borderRadius: '6px', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                            background: page === currentPage ? 'rgba(14,165,233,0.15)' : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${page === currentPage ? 'rgba(14,165,233,0.3)' : 'rgba(255,255,255,0.08)'}`,
                            color: page === currentPage ? '#38BDF8' : '#94A3B8',
                            fontSize: '0.72rem', fontWeight: 500, fontFamily: 'inherit',
                          }}
                          aria-label={`Page ${page}`}
                          aria-pressed={page === currentPage}
                        >
                          {page}
                        </button>
                      ))}
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        style={{
                          width: '28px', height: '28px', borderRadius: '6px', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', cursor: currentPage === totalPages ? 'default' : 'pointer',
                          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                          color: currentPage === totalPages ? '#334155' : '#94A3B8', fontFamily: 'inherit',
                        }}
                        aria-label="Next page"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Sidebar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                {/* AI Access Auditor */}
                <div style={{
                  borderRadius: '12px', padding: '1.125rem', position: 'relative', overflow: 'hidden',
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(14,165,233,0.04) 100%)',
                  border: '1px solid rgba(139,92,246,0.15)',
                }}>
                  {/* Purple orb decoration */}
                  <div style={{
                    position: 'absolute', top: '-20px', right: '-20px', width: '80px', height: '80px',
                    borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%)',
                    filter: 'blur(10px)',
                  }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', position: 'relative' }}>
                    <Sparkles size={14} style={{ color: '#A78BFA' }} />
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#F1F5F9' }}>AI Access Auditor</span>
                  </div>
                  <p style={{ fontSize: '0.65rem', color: '#64748B', margin: '0 0 0.875rem 0', position: 'relative' }}>
                    Automated permission and security analysis
                  </p>

                  {/* Alert 1: Stale Permissions */}
                  <div style={{
                    padding: '0.75rem', borderRadius: '8px', marginBottom: '0.625rem',
                    background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.375rem' }}>
                      <AlertTriangle size={12} style={{ color: '#EF4444' }} />
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#F1F5F9' }}>Stale Permissions</span>
                    </div>
                    <p style={{ fontSize: '0.65rem', color: '#94A3B8', margin: '0 0 0.5rem 0', lineHeight: 1.4 }}>
                      3 users with &apos;Admin&apos; roles haven&apos;t accessed sensitive modules in 90+ days.
                    </p>
                    <button aria-label="Review & Downgrade inactive admins" style={{
                      padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 500,
                      background: 'rgba(239,68,68,0.12)', color: '#EF4444',
                      border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      Review & Downgrade
                    </button>
                  </div>

                  {/* Alert 2: Role Optimization */}
                  <div style={{
                    padding: '0.75rem', borderRadius: '8px',
                    background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.375rem' }}>
                      <Info size={12} style={{ color: '#38BDF8' }} />
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#F1F5F9' }}>Role Optimization</span>
                    </div>
                    <p style={{ fontSize: '0.65rem', color: '#94A3B8', margin: '0 0 0.5rem 0', lineHeight: 1.4 }}>
                      Based on usage patterns, create a new &apos;Project Lead&apos; role to consolidate 15 custom permission sets.
                    </p>
                    <button aria-label="Generate Role" style={{
                      padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 500,
                      background: 'rgba(16,185,129,0.12)', color: '#34D399',
                      border: '1px solid rgba(16,185,129,0.25)', cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      Generate Role
                    </button>
                  </div>
                </div>

                {/* Role Distribution */}
                <div className="section-card" style={{ padding: '1rem 1.125rem' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#F1F5F9', marginBottom: '0.875rem' }}>Role Distribution</div>

                  {/* Simple donut via CSS conic-gradient */}
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.875rem' }}>
                    <div style={{
                      width: '90px', height: '90px', borderRadius: '50%',
                      background: `conic-gradient(
                        #0EA5E9 0% 50%,
                        #F59E0B 50% 70%,
                        #A78BFA 70% 85%,
                        #EF4444 85% 100%
                      )`,
                      position: 'relative',
                    }}>
                      <div style={{
                        position: 'absolute', inset: '18px', borderRadius: '50%',
                        background: '#0C1220',
                      }} />
                    </div>
                  </div>

                  {/* Legend */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.375rem' }}>
                    {roleDistribution.map(r => (
                      <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: r.color, flexShrink: 0 }} />
                        <span style={{ fontSize: '0.65rem', color: '#94A3B8' }}>{r.label}</span>
                        <span style={{ fontSize: '0.65rem', color: '#64748B', marginLeft: 'auto' }}>{r.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Security & Access */}
                <div className="section-card" style={{ padding: '0.75rem 0' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#F1F5F9', padding: '0 1.125rem', marginBottom: '0.5rem' }}>Security & Access</div>
                  {[
                    { icon: <Lock size={14} />, title: 'Audit Logs', desc: 'Track all system changes' },
                    { icon: <Key size={14} />, title: 'SSO & SAML', desc: 'Identity provider settings' },
                    { icon: <Shield size={14} />, title: 'MFA Policies', desc: 'Enforce 2-factor auth' },
                  ].map((item) => (
                    <div
                      key={item.title}
                      onClick={item.title === 'Audit Logs' ? () => setActiveSection('security') : undefined}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.625rem 1.125rem', cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '6px',
                        background: 'rgba(148,163,184,0.08)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', color: '#64748B', flexShrink: 0,
                      }}>
                        {item.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 500, color: '#F1F5F9' }}>{item.title}</div>
                        <div style={{ fontSize: '0.62rem', color: '#475569' }}>{item.desc}</div>
                      </div>
                      <ChevronRight size={14} style={{ color: '#334155', flexShrink: 0 }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ Integrations ═══ */}
        {activeSection === 'integrations' && (
          <div>
            <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#F1F5F9', margin: 0, marginBottom: '0.25rem' }}>Integrations</h2>
                <p style={{ fontSize: '0.8rem', color: '#64748B', margin: 0 }}>
                  {integrations.filter(i => i.status === 'Connected').length} connected · {integrations.filter(i => i.status === 'Disconnected').length} available
                </p>
              </div>
              <button
                className="btn-ghost"
                aria-label="Copy integration status to clipboard"
                onClick={handleCopyIntegrationStatus}
                style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem', height: '30px', flexShrink: 0 }}
              >
                <ClipboardCopy size={12} /> {integrationStatusCopied ? 'Copied!' : 'Copy Status'}
              </button>
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
                            <span style={{ display: 'flex', color: 'inherit' }}>{integration.logo}</span>
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
                        <div style={{ display: 'flex', gap: '0.5rem', position: 'relative' }}>
                          {integration.status === 'Connected' ? (
                            <>
                              <button
                                className="btn-ghost"
                                style={{ flex: 1, height: '26px', fontSize: '0.7rem', justifyContent: 'center' }}
                                onClick={() => { if (integration.name === 'Trello') setShowTrelloConfig(v => !v); }}
                              >
                                <Settings size={10} /> Configure
                              </button>
                              <button
                                className="btn-ghost"
                                style={{ height: '26px', fontSize: '0.7rem', padding: '0 0.5rem' }}
                                onClick={() => { if (integration.name === 'Trello') handleTrelloRefresh(); }}
                                aria-label={`Refresh ${integration.name} integration`}
                              >
                                <RefreshCw size={10} />
                              </button>
                            </>
                          ) : (
                            <button className="btn-primary" style={{ flex: 1, height: '26px', fontSize: '0.7rem', justifyContent: 'center' }}>
                              <Plus size={10} /> Connect
                            </button>
                          )}
                        </div>

                        {/* Trello refresh toast */}
                        {integration.name === 'Trello' && trelloRefreshMsg && (
                          <div style={{
                            marginTop: '0.5rem', padding: '6px 10px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 500,
                            background: trelloRefreshMsg.includes('successful') ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                            color: trelloRefreshMsg.includes('successful') ? '#34D399' : '#EF4444',
                            border: `1px solid ${trelloRefreshMsg.includes('successful') ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                          }}>
                            {trelloRefreshMsg}
                          </div>
                        )}

                        {/* Trello config panel */}
                        {integration.name === 'Trello' && showTrelloConfig && (
                          <div style={{
                            marginTop: '0.75rem', padding: '0.875rem', borderRadius: '10px',
                            background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
                          }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#F1F5F9', marginBottom: '0.625rem' }}>Trello Configuration</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.72rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#64748B' }}>Board ID</span>
                                <span style={{ color: '#CBD5E1', fontFamily: 'monospace', fontSize: '0.68rem' }}>66c5d907fffd4029f08565a4</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#64748B' }}>API Status</span>
                                <span style={{ color: '#34D399', fontWeight: 600 }}>Connected</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#64748B' }}>Last synced</span>
                                <span style={{ color: '#CBD5E1' }}>{new Date().toLocaleTimeString()}</span>
                              </div>
                            </div>
                            <button
                              onClick={handleTrelloTest}
                              disabled={trelloTesting}
                              aria-label="Test Connection"
                              style={{
                                marginTop: '0.75rem', padding: '5px 12px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 500,
                                background: 'rgba(14,165,233,0.12)', color: '#38BDF8',
                                border: '1px solid rgba(14,165,233,0.25)', cursor: trelloTesting ? 'wait' : 'pointer',
                                fontFamily: 'inherit', width: '100%',
                              }}
                            >
                              {trelloTesting ? 'Testing...' : 'Test Connection'}
                            </button>
                            {trelloTestResult && (
                              <div style={{
                                marginTop: '0.5rem', padding: '5px 10px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 500, textAlign: 'center',
                                background: trelloTestResult.includes('successful') ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                                color: trelloTestResult.includes('successful') ? '#34D399' : '#EF4444',
                                border: `1px solid ${trelloTestResult.includes('successful') ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                              }}>
                                {trelloTestResult}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ Security (Audit Logs) ═══ */}
        {activeSection === 'security' && (
          <div>
            <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#F1F5F9', margin: 0, marginBottom: '0.25rem' }}>Security &amp; Audit Log</h2>
                <p style={{ fontSize: '0.8rem', color: '#64748B', margin: 0 }}>
                  {filteredAuditEvents.length} event{filteredAuditEvents.length !== 1 ? 's' : ''} ·
                  {auditEvents.filter(e => e.severity === 'critical').length} critical ·
                  {auditEvents.filter(e => e.severity === 'warning').length} warnings
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  className="btn-ghost"
                  aria-label="Copy audit log summary to clipboard"
                  onClick={handleCopyAuditSummary}
                  disabled={filteredAuditEvents.length === 0}
                  style={{ fontSize: '0.72rem', height: '32px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <ClipboardCopy size={11} /> {auditSummaryCopied ? 'Copied!' : 'Copy Summary'}
                </button>
                <button
                  className="btn-ghost"
                  aria-label="Export audit log to CSV"
                  onClick={handleExportAuditLogCSV}
                  disabled={filteredAuditEvents.length === 0}
                  style={{ fontSize: '0.72rem', height: '32px' }}
                >
                  <Download size={11} style={{ marginRight: '4px' }} /> {auditCsvExported ? 'Exported!' : 'Export CSV'}
                </button>
                <button
                  className="btn-ghost"
                  aria-label="Export audit log to TXT"
                  onClick={handleExportAuditLogTxt}
                  disabled={filteredAuditEvents.length === 0}
                  style={{ fontSize: '0.72rem', height: '32px' }}
                >
                  <FileText size={11} style={{ marginRight: '4px' }} /> {auditTxtExported ? 'Exported!' : 'Export TXT'}
                </button>
                <button
                  className="btn-ghost"
                  aria-label="Clear audit log"
                  onClick={clearAuditLog}
                  style={{ fontSize: '0.72rem', height: '32px', color: '#EF4444', borderColor: 'rgba(239,68,68,0.3)' }}
                >
                  <Trash2 size={11} style={{ marginRight: '4px' }} /> Clear Log
                </button>
              </div>
            </div>

            {/* Audit filters */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '160px' }}>
                <Search size={12} style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  className="input-field"
                  aria-label="Search audit log"
                  placeholder="Search actor, action, target…"
                  value={auditSearch}
                  onChange={e => setAuditSearch(e.target.value)}
                  style={{ paddingLeft: '2rem', height: '34px', fontSize: '0.78rem', width: '100%' }}
                />
              </div>
              {auditActors.length > 0 && (
                <select
                  className="input-field"
                  aria-label="Filter audit log by actor"
                  value={auditActorFilter}
                  onChange={e => setAuditActorFilter(e.target.value)}
                  style={{ height: '34px', fontSize: '0.72rem', paddingRight: '1.5rem', minWidth: '120px' }}
                >
                  <option value="All">All Actors</option>
                  {auditActors.map(actor => <option key={actor} value={actor}>{actor}</option>)}
                </select>
              )}
              {(['all', 'info', 'warning', 'critical'] as const).map(sev => (
                <button
                  key={sev}
                  className={`tab-item ${auditSeverityFilter === sev ? 'active' : ''}`}
                  onClick={() => setAuditSeverityFilter(sev)}
                  aria-label={`Filter audit log: ${sev}`}
                  aria-pressed={auditSeverityFilter === sev}
                  style={{
                    padding: '0.25rem 0.75rem', fontSize: '0.72rem', textTransform: 'capitalize',
                    color: sev === 'critical' && auditSeverityFilter === sev ? '#FCA5A5'
                      : sev === 'warning' && auditSeverityFilter === sev ? '#FCD34D'
                      : undefined,
                  }}
                >
                  {sev}
                </button>
              ))}
              {(['All', 'Today', 'This Week'] as const).map(d => (
                <button
                  key={d}
                  className={`tab-item ${auditDateFilter === d ? 'active' : ''}`}
                  onClick={() => setAuditDateFilter(d)}
                  aria-label={`Filter audit log by date: ${d}`}
                  aria-pressed={auditDateFilter === d}
                  style={{ padding: '0.25rem 0.75rem', fontSize: '0.72rem' }}
                >
                  {d}
                </button>
              ))}
              <select
                className="input-field"
                aria-label="Sort audit log"
                value={auditSort}
                onChange={e => setAuditSort(e.target.value as typeof auditSort)}
                style={{ height: '34px', fontSize: '0.72rem', paddingRight: '1.5rem', minWidth: '130px' }}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="severity">By Severity</option>
                <option value="actor">By Actor A–Z</option>
              </select>
            </div>

            {/* Audit log table */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              {filteredAuditEvents.length === 0 ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  <Shield size={28} style={{ margin: '0 auto 0.75rem', display: 'block', opacity: 0.3 }} />
                  No audit events found
                </div>
              ) : (
                filteredAuditEvents.map((evt, idx) => {
                  const sevColor = evt.severity === 'critical' ? '#EF4444' : evt.severity === 'warning' ? '#F59E0B' : '#0EA5E9';
                  const sevBg = evt.severity === 'critical' ? 'rgba(239,68,68,0.08)' : evt.severity === 'warning' ? 'rgba(245,158,11,0.08)' : 'transparent';
                  return (
                    <div
                      key={evt.id}
                      data-testid={`audit-event-${evt.id}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : '28px minmax(0,1fr) 120px 100px 80px',
                        gap: '0',
                        padding: '0.75rem 1rem',
                        borderBottom: idx < filteredAuditEvents.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        background: sevBg,
                        alignItems: 'center',
                      }}
                    >
                      {/* Severity dot */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: sevColor, display: 'inline-block', flexShrink: 0 }} />
                      </div>
                      {/* Action + target */}
                      <div style={{ minWidth: 0, paddingLeft: isMobile ? 0 : '0.5rem' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {evt.action}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {evt.target}
                        </div>
                      </div>
                      {!isMobile && (
                        <>
                          {/* Actor */}
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', padding: '0 0.5rem' }}>{evt.actor}</div>
                          {/* IP */}
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-faint)', fontFamily: 'monospace' }}>{evt.ip}</div>
                          {/* Time */}
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-faint)', textAlign: 'right' }}>{fmtAuditTime(evt.timestamp)}</div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>

    {/* ── Invite User Modal ──────────────────────────────────── */}
    {showInvite && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        onClick={e => { if (e.target === e.currentTarget) setShowInvite(false); }}>
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '14px', padding: '1.75rem', width: '100%', maxWidth: isMobile ? 'calc(100% - 1rem)' : '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
          onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Invite User</h2>
            <button onClick={() => setShowInvite(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex' }} aria-label="Close invite modal"><X size={16} /></button>
          </div>
          {inviteSuccess ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '8px', color: '#34D399', fontSize: '0.85rem' }}>
              <Check size={16} /> {inviteSuccess}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Full Name *</label>
                <input className="input-field" style={{ width: '100%' }} placeholder="e.g. Sarah Ahmed" value={inviteForm.name} onChange={e => setInviteForm(f => ({ ...f, name: e.target.value }))} aria-label="Full Name" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Email Address *</label>
                <input className="input-field" style={{ width: '100%' }} type="email" placeholder="e.g. sarah@firm.com" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} aria-label="Email Address" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Role</label>
                <select className="input-field" style={{ width: '100%' }} value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))} aria-label="User Role">
                  {Object.keys(roleColors).map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button className="btn-ghost" onClick={() => setShowInvite(false)} aria-label="Cancel invite">Cancel</button>
                <button className="btn-primary" onClick={handleInviteUser} disabled={inviteSaving || !inviteForm.name || !inviteForm.email} aria-label="Send Invite">
                  {inviteSaving ? 'Sending\u2026' : 'Send Invite'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )}

  {/* Reset Password toast */}
  {resetPwToast && (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 2000,
        background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.35)',
        borderRadius: '10px', padding: '0.75rem 1.25rem',
        color: '#A78BFA', fontSize: '0.82rem', fontWeight: 600,
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', gap: '0.5rem',
      }}
    >
      <Key size={13} /> {resetPwToast}
    </div>
  )}
  </>);
}
