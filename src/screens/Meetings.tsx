import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLayout } from '../hooks/useLayout';
import {
  Plus, Video, Users, Clock, CheckCircle, FileText,
  ChevronRight, Calendar, MapPin, Activity, TrendingUp,
} from 'lucide-react';
import { meetings } from '../data/mockData';

const filterTabs = ['All', 'Upcoming', 'In Progress', 'Completed', 'Committee'];

const typeColors: Record<string, { bg: string; text: string; border: string; accent: string }> = {
  Workshop: { bg: 'rgba(14,165,233,0.1)', text: '#38BDF8', border: 'rgba(14,165,233,0.2)', accent: '#0EA5E9' },
  Committee: { bg: 'rgba(139,92,246,0.15)', text: '#A78BFA', border: 'rgba(139,92,246,0.25)', accent: '#8B5CF6' },
  Steering: { bg: 'rgba(239,68,68,0.1)', text: '#FCA5A5', border: 'rgba(239,68,68,0.2)', accent: '#EF4444' },
  Review: { bg: 'rgba(16,185,129,0.1)', text: '#34D399', border: 'rgba(16,185,129,0.2)', accent: '#10B981' },
  Kickoff: { bg: 'rgba(0,212,255,0.1)', text: '#00D4FF', border: 'rgba(0,212,255,0.2)', accent: '#00D4FF' },
  Standup: { bg: 'rgba(148,163,184,0.1)', text: '#94A3B8', border: 'rgba(148,163,184,0.15)', accent: '#475569' },
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

const statsCards = [
  { label: 'Meetings This Month', value: '12', color: '#8B5CF6', trend: '+3' },
  { label: 'Decisions Logged', value: '28', color: '#0EA5E9', trend: '+7' },
  { label: 'Actions Extracted', value: '67', color: '#10B981', trend: '+12' },
  { label: 'Avg Resolution Time', value: '4.2d', color: '#F59E0B', trend: '-0.8d' },
];

export default function Meetings() {
  const navigate = useNavigate();
  const { width, isMobile, isTablet } = useLayout();
  const [activeFilter, setActiveFilter] = useState('All');

  const filtered = meetings.filter(m => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Committee') return m.type === 'Committee' || m.type === 'Steering';
    return m.status === activeFilter;
  });

  return (
    <div style={{ padding: isMobile ? '0.875rem' : '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${width >= 768 ? 4 : 2}, 1fr)`, gap: '0.875rem' }}>
        {statsCards.map(s => (
          <div key={s.label} className="metric-card" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${s.color}, transparent)` }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.65rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
              <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#34D399' }}>{s.trend}</span>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: s.color, lineHeight: 1, letterSpacing: '-0.02em' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Governance Health Panel */}
      <div style={{ background: 'linear-gradient(135deg, #0D1B3E 0%, #0A0F1E 50%, #0D1527 100%)', border: '1px solid rgba(14,165,233,0.12)', borderRadius: '12px', padding: '1rem 1.5rem' }}>
        <div style={{ fontSize: '0.72rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity size={12} style={{ color: '#00D4FF' }} />
          Governance Health Indicators
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${width >= 768 ? 4 : 2}, 1fr)`, gap: '0.875rem' }}>
          {governanceMetrics.map(m => (
            <div key={m.label} className="governance-metric">
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: m.color, lineHeight: 1, letterSpacing: '-0.02em' }}>{m.value}</div>
              <div style={{ fontSize: '0.65rem', color: '#475569', marginTop: '3px' }}>{m.unit}</div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#94A3B8', marginTop: '4px' }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main 2-col Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: isTablet ? '1fr' : '1fr 300px', gap: '1.25rem', alignItems: 'start' }}>

        {/* Left: Meeting List */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(255,255,255,0.03)', padding: '0.25rem', borderRadius: '0.625rem', border: '1px solid rgba(255,255,255,0.06)', overflowX: 'auto' }}>
              {filterTabs.map(tab => (
                <button key={tab} className={`tab-item ${activeFilter === tab ? 'active' : ''}`} onClick={() => setActiveFilter(tab)} style={{ padding: '0.375rem 0.875rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                  {tab}
                </button>
              ))}
            </div>
            <button className="btn-primary" style={{ height: '36px' }}>
              <Plus size={14} /> New Meeting
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filtered.map((meeting) => {
              const tc = typeColors[meeting.type] || typeColors.Standup;
              return (
                <div
                  key={meeting.id}
                  className="section-card"
                  style={{ cursor: 'pointer', overflow: 'hidden', transition: 'all 0.2s' }}
                  onClick={() => navigate(`/meetings/${meeting.id}`)}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = tc.border; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 20px rgba(0,0,0,0.3)`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                >
                  {/* Type color strip */}
                  <div style={{ height: '3px', background: `linear-gradient(90deg, ${tc.accent}, transparent)` }} />

                  <div style={{ display: 'flex', alignItems: 'flex-start', padding: '1rem 1.125rem', gap: '1rem' }}>
                    {/* Icon */}
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0, background: tc.bg, border: `1px solid ${tc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                      <Video size={16} style={{ color: tc.text }} />
                      {meeting.status === 'In Progress' && (
                        <div style={{ position: 'absolute', top: '-3px', right: '-3px', width: '10px', height: '10px', borderRadius: '9999px', background: '#EF4444', border: '2px solid #0A0F1E', animation: 'pulseDot 2s ease-in-out infinite' }} />
                      )}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#F1F5F9', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{meeting.title}</h3>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0, marginLeft: '1rem' }}>
                          <span style={{ fontSize: '0.7rem', padding: '2px 7px', borderRadius: '4px', background: tc.bg, color: tc.text, border: `1px solid ${tc.border}` }}>{meeting.type}</span>
                          <span style={{ fontSize: '0.7rem', padding: '2px 7px', borderRadius: '4px', background: meeting.status === 'Upcoming' ? 'rgba(14,165,233,0.1)' : meeting.status === 'In Progress' ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.1)', color: meeting.status === 'Upcoming' ? '#38BDF8' : meeting.status === 'In Progress' ? '#FCA5A5' : '#34D399' }}>
                            {meeting.status}
                          </span>
                          {meeting.status === 'Completed' && meeting.minutesGenerated && (
                            <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '3px', background: 'rgba(16,185,129,0.1)', color: '#34D399', display: 'flex', alignItems: 'center', gap: '3px', border: '1px solid rgba(16,185,129,0.2)' }}>
                              <FileText size={9} /> Minutes Ready
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.625rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.75rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Calendar size={11} /> {meeting.date} · {meeting.time}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Clock size={11} /> {meeting.duration}
                        </span>
                        {meeting.location && (
                          <span style={{ fontSize: '0.75rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <MapPin size={11} /> {meeting.location}
                          </span>
                        )}
                        <span style={{ fontSize: '0.75rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Users size={11} /> {meeting.participants.length}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.72rem', color: '#334155', padding: '2px 7px', borderRadius: '4px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          {meeting.workspace}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          {/* Avatar stack */}
                          <div style={{ display: 'flex' }}>
                            {meeting.participants.slice(0, 4).map((p, i) => (
                              <div key={i} style={{ width: '22px', height: '22px', borderRadius: '9999px', background: avatarBgs[i % avatarBgs.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.58rem', fontWeight: 700, color: 'white', border: '2px solid #0D1527', marginLeft: i > 0 ? '-5px' : 0 }}>
                                {p}
                              </div>
                            ))}
                          </div>
                          {/* Completed meeting action/decision counts */}
                          {meeting.status === 'Completed' && (
                            <div style={{ display: 'flex', gap: '0.375rem' }}>
                              {meeting.actionsExtracted && (
                                <span style={{ fontSize: '0.65rem', padding: '2px 5px', borderRadius: '3px', background: 'rgba(245,158,11,0.1)', color: '#FCD34D', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                  <CheckCircle size={9} /> {meeting.actionsExtracted}a
                                </span>
                              )}
                              {meeting.decisionsLogged && (
                                <span style={{ fontSize: '0.65rem', padding: '2px 5px', borderRadius: '3px', background: 'rgba(14,165,233,0.1)', color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                  <TrendingUp size={9} /> {meeting.decisionsLogged}d
                                </span>
                              )}
                            </div>
                          )}
                          <ChevronRight size={14} style={{ color: '#334155' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Mini Calendar */}
          <div className="section-card" style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#F1F5F9' }}>March 2026</span>
              <Calendar size={13} style={{ color: '#475569' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: '0.375rem' }}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} style={{ fontSize: '0.65rem', color: '#334155', padding: '3px 0' }}>{d}</div>
              ))}
            </div>
            {[0, 1, 2, 3, 4].map(week => (
              <div key={week} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center' }}>
                {miniCalendar.map((col, dayIdx) => {
                  const date = col.dates[week];
                  const isToday = date === 15;
                  const hasMeeting = date && meetingDates.has(String(date));
                  return (
                    <div key={dayIdx} style={{ padding: '3px 2px', borderRadius: '4px', cursor: date ? 'pointer' : 'default', position: 'relative' }}>
                      {date && (
                        <>
                          <div style={{ width: '22px', height: '22px', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', background: isToday ? '#0EA5E9' : 'transparent', fontSize: '0.72rem', fontWeight: isToday ? 700 : 400, color: isToday ? 'white' : hasMeeting ? '#F1F5F9' : '#475569' }}>
                            {date}
                          </div>
                          {hasMeeting && !isToday && (
                            <div style={{ width: '4px', height: '4px', borderRadius: '9999px', background: '#8B5CF6', margin: '2px auto 0' }} />
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
                <Calendar size={13} style={{ color: '#0EA5E9' }} />
                <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#F1F5F9' }}>Today's Agenda</span>
              </div>
              <span style={{ fontSize: '0.65rem', color: '#475569' }}>15 Mar</span>
            </div>
            <div style={{ padding: '0.375rem 0' }}>
              {meetings.filter(m => m.status === 'Upcoming' || m.status === 'In Progress').slice(0, 3).map((m, i) => {
                const tc = typeColors[m.type] || typeColors.Standup;
                return (
                  <div key={m.id} style={{ display: 'flex', gap: '0.625rem', alignItems: 'flex-start', padding: '0.625rem 1rem', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none', cursor: 'pointer' }}
                    onClick={() => navigate(`/meetings/${m.id}`)}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ width: '3px', height: '100%', minHeight: '36px', borderRadius: '9999px', background: tc.accent, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</div>
                      <div style={{ fontSize: '0.68rem', color: '#475569', marginTop: '2px' }}>{m.time} · {m.duration}</div>
                    </div>
                    <span style={{ fontSize: '0.62rem', padding: '1px 5px', borderRadius: '3px', background: tc.bg, color: tc.text, border: `1px solid ${tc.border}`, flexShrink: 0 }}>{m.type}</span>
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
                <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#F1F5F9' }}>Pending Follow-ups</span>
              </div>
              <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '9999px', background: 'rgba(245,158,11,0.15)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.2)' }}>
                {pendingFollowUps.length}
              </span>
            </div>
            <div style={{ padding: '0.375rem 0' }}>
              {pendingFollowUps.map((item, i) => (
                <div key={i} style={{ padding: '0.625rem 1rem', borderBottom: i < pendingFollowUps.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                    {item.urgent && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#EF4444', flexShrink: 0, marginTop: '5px' }} />}
                    {!item.urgent && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#475569', flexShrink: 0, marginTop: '5px' }} />}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.75rem', color: '#F1F5F9', lineHeight: 1.4, marginBottom: '3px' }}>{item.title}</div>
                      <div style={{ fontSize: '0.65rem', color: '#475569' }}>From: {item.meeting} · {item.owner} · Due {item.due}</div>
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
