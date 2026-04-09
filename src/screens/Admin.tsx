import { useState, useEffect, useMemo } from 'react';
import { useLayout } from '../hooks/useLayout';
import {
  Users, Briefcase, Zap, Shield,
  Check, X, Settings, Plus, RefreshCw, ExternalLink,
  Share2, HardDrive, Cloud, Mail, MessageSquare, Hash,
  LayoutDashboard, BookOpen, Github, ScanLine, Sparkles, Brain,
  CheckCircle, ChevronLeft, ChevronRight, Download, Filter,
  Lock, Key, AlertTriangle, Info, Code2,
} from 'lucide-react';
import { getTeamMembers, createTeamMember, updateTeamMember } from '../lib/db';
import { fetchBATrafficBoard } from '../lib/trello';

const adminSections = [
  { id: 'users', label: 'Users & Roles', icon: <Users size={15} /> },
  { id: 'integrations', label: 'Integrations', icon: <Zap size={15} /> },
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

const INTEGRATIONS_BASE: { name: string; category: string; logo: React.ReactNode; desc: string }[] = [
  { name: 'Trello', category: 'Project Management', logo: <LayoutDashboard size={18} />, desc: 'BA Traffic Board — live task sync from Trello API' },
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
  const [userList, setUserList] = useState<LocalUser[]>([]);

  // Load team members from Supabase on mount
  useEffect(() => {
    getTeamMembers().then(data => {
      setUserList(data.map(m => ({
        id: m.id,
        name: m.name,
        email: m.email,
        role: m.role,
        workspaces: m.workspaces_count,
        lastActive: m.last_active,
        status: m.status,
        initials: m.initials,
      })));
    }).catch(() => {});
  }, []);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'Analyst' });
  const [inviteSaving, setInviteSaving] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [showTrelloConfig, setShowTrelloConfig] = useState(false);
  const [trelloTestResult, setTrelloTestResult] = useState<string | null>(null);
  const [trelloTesting, setTrelloTesting] = useState(false);
  const [trelloRefreshMsg, setTrelloRefreshMsg] = useState<string | null>(null);
  const [trelloStatus, setTrelloStatus] = useState<'Checking' | 'Connected' | 'Disconnected'>('Checking');

  // Check Trello connectivity on mount
  useEffect(() => {
    fetchBATrafficBoard()
      .then(() => setTrelloStatus('Connected'))
      .catch(() => setTrelloStatus('Disconnected'));
  }, []);

  const integrations = INTEGRATIONS_BASE.map(i =>
    i.name === 'Trello' ? { ...i, status: trelloStatus } : { ...i, status: 'Connected' }
  );


  const filteredUsers = useMemo(() => {
    if (roleFilter === 'All') return userList;
    if (roleFilter === 'Admins') return userList.filter(u => u.role === 'Admin');
    if (roleFilter === 'Consultants') return userList.filter(u => u.role === 'Consultant' || u.role === 'Manager');
    if (roleFilter === 'Clients') return userList.filter(u => u.role === 'Viewer');
    return userList;
  }, [userList, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * USERS_PER_PAGE, currentPage * USERS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [roleFilter]);

  function handleInviteUser() {
    if (!inviteForm.name || !inviteForm.email) return;
    setInviteSaving(true);
    setInviteError('');
    const newId = crypto.randomUUID();
    const initials = inviteForm.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
    createTeamMember({
      id: newId,
      name: inviteForm.name,
      email: inviteForm.email,
      role: inviteForm.role as 'Admin' | 'Consultant' | 'Manager' | 'Viewer' | 'Analyst',
      workspaces_count: 0,
      last_active: 'Just now',
      status: 'Active',
      initials,
    }).then(saved => {
      const newUser: LocalUser = {
        id: saved.id,
        name: saved.name,
        email: saved.email,
        role: saved.role,
        workspaces: saved.workspaces_count,
        lastActive: saved.last_active,
        status: saved.status,
        initials: saved.initials,
      };
      setUserList(prev => [...prev, newUser]);
      setInviteSuccess(`Invite sent to ${inviteForm.email}`);
      setInviteForm({ name: '', email: '', role: 'Analyst' });
      setInviteSaving(false);
      setTimeout(() => { setShowInvite(false); setInviteSuccess(''); }, 1500);
    }).catch((e: unknown) => {
      setInviteSaving(false);
      setInviteError(e instanceof Error ? e.message : 'Failed to send invite. Please try again.');
    });
  }

  function handleToggleUserStatus(userId: string) {
    const target = userList.find(u => u.id === userId);
    if (!target) return;
    const newStatus: 'Active' | 'Inactive' = target.status === 'Active' ? 'Inactive' : 'Active';
    setUserList(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    updateTeamMember(userId, { status: newStatus }).catch(() => {});
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
              <button className="btn-primary" style={{ height: '34px', fontSize: '0.8rem' }} onClick={() => setShowInvite(true)}>
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
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', display: 'flex', padding: '4px' }}>
                        <Filter size={14} />
                      </button>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', display: 'flex', padding: '4px' }}>
                        <Download size={14} />
                      </button>
                    </div>
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
                        <button style={{
                          padding: '3px 10px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 500,
                          background: 'rgba(255,255,255,0.06)', color: '#94A3B8',
                          border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontFamily: 'inherit',
                        }}>Change Role</button>
                        <button style={{
                          padding: '3px 10px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 500,
                          background: 'rgba(255,255,255,0.06)', color: '#94A3B8',
                          border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontFamily: 'inherit',
                        }}>Reset Password</button>
                        <button style={{
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
                                  >
                                    {user.status === 'Active' ? 'Suspend' : 'Activate'}
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
                    <button style={{
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
                    <button style={{
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
            <button onClick={() => { setShowInvite(false); setInviteError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex' }}><X size={16} /></button>
          </div>
          {inviteSuccess ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '8px', color: '#34D399', fontSize: '0.85rem' }}>
              <Check size={16} /> {inviteSuccess}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {inviteError && (
                <div style={{ padding: '0.625rem 0.875rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', color: '#FCA5A5', fontSize: '0.78rem' }}>
                  {inviteError}
                </div>
              )}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Full Name *</label>
                <input className="input-field" style={{ width: '100%' }} placeholder="e.g. Sarah Ahmed" value={inviteForm.name} onChange={e => setInviteForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Email Address *</label>
                <input className="input-field" style={{ width: '100%' }} type="email" placeholder="e.g. sarah@firm.com" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Role</label>
                <select className="input-field" style={{ width: '100%' }} value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}>
                  {Object.keys(roleColors).map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button className="btn-ghost" onClick={() => { setShowInvite(false); setInviteError(''); }}>Cancel</button>
                <button className="btn-primary" onClick={handleInviteUser} disabled={inviteSaving || !inviteForm.name || !inviteForm.email}>
                  {inviteSaving ? 'Sending\u2026' : 'Send Invite'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )}
  </>);
}
