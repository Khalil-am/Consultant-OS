import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLayout } from '../hooks/useLayout';
import {
  Plus, Video, Users, Clock, CheckCircle, FileText,
  ChevronRight, Calendar, MapPin, Activity, TrendingUp, Search,
} from 'lucide-react';
import { getMeetings, updateMeeting } from '../lib/db';
import type { MeetingRow } from '../lib/db';

const filterTabs = ['All', 'Upcoming', 'In Progress', 'Completed', 'Committee'];

const typeColors: Record<string, { bg: string; text: string; border: string; accent: string }> = {
  Workshop:  { bg: 'rgba(14,165,233,0.1)',   text: '#38BDF8',  border: 'rgba(14,165,233,0.22)',  accent: '#0EA5E9' },
  Committee: { bg: 'rgba(139,92,246,0.12)',  text: '#A78BFA',  border: 'rgba(139,92,246,0.25)',  accent: '#8B5CF6' },
  Steering:  { bg: 'rgba(239,68,68,0.1)',    text: '#FCA5A5',  border: 'rgba(239,68,68,0.22)',   accent: '#EF4444' },
  Review:    { bg: 'rgba(16,185,129,0.1)',   text: '#34D399',  border: 'rgba(16,185,129,0.22)',  accent: '#10B981' },
  Kickoff:   { bg: 'rgba(0,212,255,0.1)',    text: '#00D4FF',  border: 'rgba(0,212,255,0.22)',   accent: '#00D4FF' },
  Standup:   { bg: 'rgba(148,163,184,0.08)', text: '#94A3B8',  border: 'rgba(148,163,184,0.15)', accent: '#475569' },
};

const avatarBgs = ['#0EA5E9', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'];

const miniCalendar = [
  { day: 'Sun', dates: [1, 8, 15, 22, 29] },
  { day: 'Mon', dates: [2, 9, 16, 23, 30] },
  { day: 'Tue', dates: [3, 10, 17, 24, 31] },
  { day: 'Wed', dates: [4, 11, 18, 25] },
  { day: 'Thu', dates: [5, 12, 19, 26] },
  { day: 'Fri', dates: [6, 13, 20, 27] },
  { day: 'Sat', dates: [7, 14, 21, 28] },
];

const meetingDates = new Set(['14', '15', '18', '20', '22']);

const pendingFollowUps = [
  { title: 'Share updated risk register with NCA steering committee', meeting: 'NCA Steering #14', due: '16 Mar 2026', owner: 'AM', urgent: true },
  { title: 'Confirm Smart City Package 3 new contractor mobilization plan', meeting: 'Smart City PMO Review', due: '18 Mar 2026', owner: 'JL', urgent: true },
  { title: 'Circulate ADNOC ERP integration scope document for sign-off', meeting: 'ADNOC Kickoff', due: '20 Mar 2026', owner: 'RT', urgent: false },
  { title: 'Update ENB UAT test results dashboard and share with client', meeting: 'ENB Progress Review', due: '22 Mar 2026', owner: 'DN', urgent: false },
];

const governanceMetrics = [
  { label: 'Decision Velocity', value: '7.2', unit: '/meeting', color: '#00D4FF' },
  { label: 'Action Closure Rate', value: '84%', unit: 'this quarter', color: '#10B981' },
  { label: 'Quorum Achievement', value: '100%', unit: 'last 30 days', color: '#8B5CF6' },
  { label: 'Avg. Attendance', value: '7.3', unit: 'participants', color: '#F59E0B' },
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; border: string; dot: string }> = {
    'Upcoming':    { bg: 'rgba(14,165,233,0.1)',  color: '#38BDF8',  border: 'rgba(14,165,233,0.22)',  dot: '#38BDF8' },
    'In Progress': { bg: 'rgba(239,68,68,0.12)',  color: '#FCA5A5',  border: 'rgba(239,68,68,0.25)',   dot: '#EF4444' },
    'Completed':   { bg: 'rgba(16,185,129,0.1)',  color: '#34D399',  border: 'rgba(16,185,129,0.22)',  dot: '#10B981' },
  };
  const s = map[status] || map['Upcoming'];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      fontSize: '0.68rem', fontWeight: 600, padding: '2px 8px',
      borderRadius: '9999px', background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      letterSpacing: '0.02em', whiteSpace: 'nowrap',
    }}>
      {status === 'In Progress' && (
        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: s.dot, animation: 'pulseDot 2s ease-in-out infinite', display: 'inline-block' }} />
      )}
      {status}
    </span>
  );
}

export default function Meetings() {
  const navigate = useNavigate();
  const { width, isMobile, isTablet } = useLayout();
  const [activeFilter, setActiveFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMeetings().then(data => { setMeetings(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const statsCards = [
    { label: 'Total Meetings', value: String(meetings.length), color: '#8B5CF6', trend: '+' + meetings.filter(m => m.status === 'Upcoming').length + ' upcoming' },
    { label: 'Decisions Logged', value: String(meetings.reduce((s, m) => s + (m.decisions_logged ?? 0), 0)), color: '#0EA5E9', trend: 'cumulative' },
    { label: 'Actions Extracted', value: String(meetings.reduce((s, m) => s + (m.actions_extracted ?? 0), 0)), color: '#10B981', trend: 'from minutes' },
    { label: 'Completed', value: String(meetings.filter(m => m.status === 'Completed').length), color: '#F59E0B', trend: 'this quarter' },
  ];

  const filtered = meetings.filter(m => {
    const matchesFilter = activeFilter === 'All'
      ? true
      : activeFilter === 'Committee'
      ? (m.type === 'Committee' || m.type === 'Steering')
      : m.status === activeFilter;
    const matchesSearch = !search || m.title.toLowerCase().includes(search.toLowerCase()) || m.workspace.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // suppress unused import warning
  void updateMeeting;

  return (
    <div className="screen-container animate-fade-in">

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${width >= 768 ? 4 : 2}, 1fr)`, gap: '0.875rem' }}>
        {statsCards.map(s => (
          <div key={s.label} className="metric-card" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${s.color}, transparent)` }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.625rem' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{s.label}</div>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#34D399', background: 'rgba(16,185,129,0.1)', padding: '1px 5px', borderRadius: '4px', border: '1px solid rgba(16,185,129,0.2)' }}>{s.trend}</span>
            </div>
            <div className="hero-number" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Governance Health Panel */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(14,165,233,0.05) 0%, var(--bg-elevated) 50%, rgba(139,92,246,0.04) 100%)',
        border: '1px solid rgba(14,165,233,0.12)', borderRadius: 'var(--radius-lg)', padding: '1.125rem 1.5rem',
      }}>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity size={12} style={{ color: '#00D4FF' }} />
          Governance Health Indicators
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${width >= 768 ? 4 : 2}, 1fr)`, gap: '0.75rem' }}>
          {governanceMetrics.map(m => (
            <div key={m.label} className="governance-metric">
              <div className="hero-number" style={{ color: m.color }}>{m.value}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '3px' }}>{m.unit}</div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '5px' }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main 2-col Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: isTablet ? '1fr' : '1fr 300px', gap: '1.25rem', alignItems: 'start' }}>

        {/* Left: Meeting List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
              <Search size={13} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                className="input-field"
                placeholder="Search meetings..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: '2.25rem', height: '36px', fontSize: '0.8rem' }}
              />
            </div>
            {/* Filter pills */}
            <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(255,255,255,0.03)', padding: '0.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', overflowX: 'auto' }}>
              {filterTabs.map(tab => (
                <button key={tab} className={`tab-item ${activeFilter === tab ? 'active' : ''}`} onClick={() => setActiveFilter(tab)} style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                  {tab}
                </button>
              ))}
            </div>
            <button className="btn-primary" style={{ height: '36px', flexShrink: 0 }}>
              <Plus size={14} /> New Meeting
            </button>
          </div>

          {/* Meeting Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {loading && (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                Loading meetings…
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-default)' }}>
                <Video size={32} style={{ color: 'var(--text-faint)', marginBottom: '0.75rem', margin: '0 auto 0.75rem' }} />
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>No meetings found</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Adjust your filters or create a new meeting</div>
              </div>
            )}
            {filtered.map((meeting) => {
              const tc = typeColors[meeting.type] || typeColors.Standup;
              return (
                <div
                  key={meeting.id}
                  className="section-card card-hover"
                  style={{ cursor: 'pointer', overflow: 'hidden' }}
                  onClick={() => navigate(`/meetings/${meeting.id}`)}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = tc.border;
                    (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 24px rgba(0,0,0,0.35)`;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)';
                    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                  }}
                >
                  {/* Accent strip */}
                  <div style={{ height: '2px', background: `linear-gradient(90deg, ${tc.accent} 0%, ${tc.accent}44 60%, transparent 100%)` }} />

                  <div style={{ display: 'flex', alignItems: 'flex-start', padding: '0.875rem 1.125rem', gap: '0.875rem' }}>
                    {/* Icon block */}
                    <div style={{
                      width: '42px', height: '42px', borderRadius: '10px', flexShrink: 0,
                      background: tc.bg, border: `1px solid ${tc.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                    }}>
                      <Video size={16} style={{ color: tc.text }} />
                      {meeting.status === 'In Progress' && (
                        <div style={{
                          position: 'absolute', top: '-3px', right: '-3px',
                          width: '10px', height: '10px', borderRadius: '50%',
                          background: '#EF4444', border: '2px solid var(--bg-elevated)',
                          animation: 'pulseDot 2s ease-in-out infinite',
                        }} />
                      )}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Title row */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.375rem' }}>
                        <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {meeting.title}
                        </h3>
                        <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', flexShrink: 0 }}>
                          {/* Type badge */}
                          <span style={{
                            fontSize: '0.68rem', fontWeight: 600, padding: '2px 7px', borderRadius: '9999px',
                            background: tc.bg, color: tc.text, border: `1px solid ${tc.border}`,
                            letterSpacing: '0.01em', whiteSpace: 'nowrap',
                          }}>{meeting.type}</span>
                          {/* Status badge */}
                          <StatusBadge status={meeting.status} />
                          {meeting.status === 'Completed' && meeting.minutes_generated && (
                            <span style={{
                              fontSize: '0.65rem', fontWeight: 600, padding: '2px 6px', borderRadius: '9999px',
                              background: 'rgba(16,185,129,0.1)', color: '#34D399',
                              display: 'inline-flex', alignItems: 'center', gap: '3px',
                              border: '1px solid rgba(16,185,129,0.2)', whiteSpace: 'nowrap',
                            }}>
                              <FileText size={9} /> Minutes
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Meta row */}
                      <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.625rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Calendar size={11} style={{ color: 'var(--text-faint)' }} /> {meeting.date} · {meeting.time}
                        </span>
                        <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Clock size={11} style={{ color: 'var(--text-faint)' }} /> {meeting.duration}
                        </span>
                        {meeting.location && (
                          <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <MapPin size={11} style={{ color: 'var(--text-faint)' }} /> {meeting.location}
                          </span>
                        )}
                        <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Users size={11} style={{ color: 'var(--text-faint)' }} /> {meeting.participants.length} attendees
                        </span>
                      </div>

                      {/* Footer row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{
                          fontSize: '0.68rem', fontWeight: 500, color: 'var(--text-muted)',
                          padding: '2px 7px', borderRadius: '4px',
                          background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)',
                        }}>
                          {meeting.workspace}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          {/* Avatar stack */}
                          <div style={{ display: 'flex' }}>
                            {meeting.participants.slice(0, 4).map((p, i) => (
                              <div key={i} style={{
                                width: '22px', height: '22px', borderRadius: '50%',
                                background: avatarBgs[i % avatarBgs.length],
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.55rem', fontWeight: 700, color: 'white',
                                border: '2px solid var(--bg-elevated)',
                                marginLeft: i > 0 ? '-5px' : 0, zIndex: 4 - i,
                              }}>
                                {p}
                              </div>
                            ))}
                          </div>
                          {/* Completed action/decision counts */}
                          {meeting.status === 'Completed' && (
                            <div style={{ display: 'flex', gap: '0.375rem' }}>
                              {meeting.actions_extracted && (
                                <span style={{
                                  fontSize: '0.65rem', fontWeight: 600, padding: '2px 6px', borderRadius: '4px',
                                  background: 'rgba(245,158,11,0.1)', color: '#FCD34D',
                                  display: 'inline-flex', alignItems: 'center', gap: '3px',
                                  border: '1px solid rgba(245,158,11,0.2)',
                                }}>
                                  <CheckCircle size={9} /> {meeting.actions_extracted}a
                                </span>
                              )}
                              {meeting.decisions_logged && (
                                <span style={{
                                  fontSize: '0.65rem', fontWeight: 600, padding: '2px 6px', borderRadius: '4px',
                                  background: 'rgba(14,165,233,0.1)', color: '#38BDF8',
                                  display: 'inline-flex', alignItems: 'center', gap: '3px',
                                  border: '1px solid rgba(14,165,233,0.2)',
                                }}>
                                  <TrendingUp size={9} /> {meeting.decisions_logged}d
                                </span>
                              )}
                            </div>
                          )}
                          <ChevronRight size={13} style={{ color: 'var(--text-faint)' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Mini Calendar */}
          <div className="section-card" style={{ padding: '1rem 1.125rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>March 2026</span>
              <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: '0.25rem' }}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-faint)', padding: '3px 0', letterSpacing: '0.04em' }}>{d}</div>
              ))}
            </div>
            {[0, 1, 2, 3, 4].map(week => (
              <div key={week} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center' }}>
                {miniCalendar.map((col, dayIdx) => {
                  const date = col.dates[week];
                  const isToday = date === 15;
                  const hasMeeting = date && meetingDates.has(String(date));
                  return (
                    <div key={dayIdx} style={{ padding: '2px 1px', cursor: date ? 'pointer' : 'default' }}>
                      {date && (
                        <>
                          <div style={{
                            width: '24px', height: '24px', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto',
                            background: isToday ? 'linear-gradient(135deg, #0EA5E9, #00D4FF)' : hasMeeting ? 'rgba(139,92,246,0.12)' : 'transparent',
                            fontSize: '0.7rem', fontWeight: isToday ? 700 : hasMeeting ? 600 : 400,
                            color: isToday ? 'white' : hasMeeting ? '#A78BFA' : 'var(--text-muted)',
                            boxShadow: isToday ? '0 2px 8px rgba(0,212,255,0.3)' : 'none',
                          }}>
                            {date}
                          </div>
                          {hasMeeting && !isToday && (
                            <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#8B5CF6', margin: '2px auto 0' }} />
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Today's Agenda */}
          <div className="section-card">
            <div className="section-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#0EA5E9', boxShadow: '0 0 6px rgba(14,165,233,0.5)' }} />
                <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-primary)' }}>Today's Agenda</span>
              </div>
              <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', padding: '2px 7px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>15 Mar</span>
            </div>
            <div>
              {meetings.filter(m => m.status === 'Upcoming' || m.status === 'In Progress').slice(0, 3).map((m, i, arr) => {
                const tc = typeColors[m.type] || typeColors.Standup;
                return (
                  <div key={m.id}
                    style={{
                      display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                      padding: '0.75rem 1.125rem',
                      borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      cursor: 'pointer', transition: 'background var(--transition-fast)',
                    }}
                    onClick={() => navigate(`/meetings/${m.id}`)}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ width: '3px', minHeight: '36px', borderRadius: '9999px', background: tc.accent, flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>{m.time} · {m.duration}</div>
                    </div>
                    <span style={{ fontSize: '0.62rem', fontWeight: 600, padding: '2px 6px', borderRadius: '9999px', background: tc.bg, color: tc.text, border: `1px solid ${tc.border}`, flexShrink: 0 }}>{m.type}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pending Follow-ups */}
          <div className="section-card">
            <div className="section-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle size={13} style={{ color: '#F59E0B' }} />
                <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-primary)' }}>Pending Follow-ups</span>
              </div>
              <span style={{
                fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: '9999px',
                background: 'rgba(245,158,11,0.12)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.22)',
              }}>
                {pendingFollowUps.length}
              </span>
            </div>
            <div>
              {pendingFollowUps.map((item, i) => (
                <div key={i} style={{
                  padding: '0.75rem 1.125rem',
                  borderBottom: i < pendingFollowUps.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  transition: 'background var(--transition-fast)',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
                    <div style={{
                      width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, marginTop: '5px',
                      background: item.urgent ? '#EF4444' : 'var(--text-faint)',
                      boxShadow: item.urgent ? '0 0 6px rgba(239,68,68,0.5)' : 'none',
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.45, marginBottom: '4px' }}>{item.title}</div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.63rem', color: 'var(--text-muted)' }}>From: {item.meeting}</span>
                        <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'var(--text-faint)', display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.63rem', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>{item.owner}</span>
                        <span style={{ fontSize: '0.63rem', color: item.urgent ? '#FCA5A5' : 'var(--text-muted)' }}>Due {item.due}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
