import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLayout } from '../hooks/useLayout';
import {
  Plus, Video, Users, Clock, CheckCircle, FileText,
  ChevronRight, Calendar, MapPin, Filter
} from 'lucide-react';
import { meetings } from '../data/mockData';

const filterTabs = ['All', 'Upcoming', 'In Progress', 'Completed', 'Committee'];

const typeColors: Record<string, { bg: string; text: string; border: string }> = {
  Workshop: { bg: 'rgba(14,165,233,0.1)', text: '#38BDF8', border: 'rgba(14,165,233,0.2)' },
  Committee: { bg: 'rgba(139,92,246,0.15)', text: '#A78BFA', border: 'rgba(139,92,246,0.25)' },
  Steering: { bg: 'rgba(239,68,68,0.1)', text: '#FCA5A5', border: 'rgba(239,68,68,0.2)' },
  Review: { bg: 'rgba(16,185,129,0.1)', text: '#34D399', border: 'rgba(16,185,129,0.2)' },
  Kickoff: { bg: 'rgba(0,212,255,0.1)', text: '#00D4FF', border: 'rgba(0,212,255,0.2)' },
  Standup: { bg: 'rgba(148,163,184,0.1)', text: '#94A3B8', border: 'rgba(148,163,184,0.15)' },
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
      {/* Header Row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem' }}>
        {/* Stats */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${width >= 768 ? 4 : 2}, 1fr)`, gap: '0.875rem' }}>
          {[
            { label: 'Total Meetings', value: meetings.length.toString(), color: '#8B5CF6' },
            { label: 'Upcoming', value: meetings.filter(m => m.status === 'Upcoming').length.toString(), color: '#0EA5E9' },
            { label: 'Completed', value: meetings.filter(m => m.status === 'Completed').length.toString(), color: '#10B981' },
            { label: 'Actions Generated', value: '25', color: '#F59E0B' },
          ].map(s => (
            <div key={s.label} className="metric-card" style={{ padding: '0.875rem' }}>
              <div style={{ fontSize: '1.375rem', fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '0.72rem', color: '#475569' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ display: 'grid', gridTemplateColumns: isTablet ? '1fr' : '1fr 220px', gap: '1.25rem', alignItems: 'start' }}>
        <div>
          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(255,255,255,0.03)', padding: '0.25rem', borderRadius: '0.625rem', border: '1px solid rgba(255,255,255,0.06)' }}>
              {filterTabs.map(tab => (
                <button
                  key={tab}
                  className={`tab-item ${activeFilter === tab ? 'active' : ''}`}
                  onClick={() => setActiveFilter(tab)}
                  style={{ padding: '0.375rem 0.875rem', fontSize: '0.8rem' }}
                >
                  {tab}
                </button>
              ))}
            </div>
            <button className="btn-primary" style={{ height: '36px' }}>
              <Plus size={14} /> New Meeting
            </button>
          </div>

          {/* Meeting Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filtered.map((meeting) => {
              const tc = typeColors[meeting.type] || typeColors.Standup;
              return (
                <div
                  key={meeting.id}
                  className="section-card"
                  style={{ cursor: 'pointer', overflow: 'hidden' }}
                  onClick={() => navigate(`/meetings/${meeting.id}`)}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)';
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)';
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', padding: '1.125rem', gap: '1rem',
                  }}>
                    {/* Status indicator */}
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                      background: tc.bg, border: `1px solid ${tc.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      position: 'relative',
                    }}>
                      <Video size={16} style={{ color: tc.text }} />
                      {meeting.status === 'In Progress' && (
                        <div style={{
                          position: 'absolute', top: '-3px', right: '-3px',
                          width: '10px', height: '10px', borderRadius: '9999px',
                          background: '#EF4444', border: '2px solid #0A0F1E',
                          animation: 'pulseDot 2s ease-in-out infinite',
                        }} />
                      )}
                    </div>

                    {/* Main Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#F1F5F9', margin: 0 }}>{meeting.title}</h3>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0, marginLeft: '1rem' }}>
                          <span style={{
                            fontSize: '0.7rem', padding: '2px 7px', borderRadius: '4px',
                            background: tc.bg, color: tc.text, border: `1px solid ${tc.border}`,
                          }}>
                            {meeting.type}
                          </span>
                          <span style={{
                            fontSize: '0.7rem', padding: '2px 7px', borderRadius: '4px',
                            background: meeting.status === 'Upcoming' ? 'rgba(14,165,233,0.1)' : meeting.status === 'In Progress' ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.1)',
                            color: meeting.status === 'Upcoming' ? '#38BDF8' : meeting.status === 'In Progress' ? '#FCA5A5' : '#34D399',
                          }}>
                            {meeting.status}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '0.75rem' }}>
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
                          <Users size={11} /> {meeting.participants.length} participants
                        </span>
                      </div>

                      {/* Workspace + Participants */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.72rem', color: '#334155', padding: '2px 7px', borderRadius: '4px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          {meeting.workspace}
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          {/* Avatar stack */}
                          <div style={{ display: 'flex' }}>
                            {meeting.participants.slice(0, 4).map((p, i) => (
                              <div key={i} style={{
                                width: '22px', height: '22px', borderRadius: '9999px',
                                background: avatarBgs[i % avatarBgs.length],
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.58rem', fontWeight: 700, color: 'white',
                                border: '2px solid #0D1527',
                                marginLeft: i > 0 ? '-5px' : 0,
                              }}>
                                {p}
                              </div>
                            ))}
                          </div>

                          {/* Completed meeting badges */}
                          {meeting.status === 'Completed' && (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              {meeting.minutesGenerated && (
                                <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '3px', background: 'rgba(16,185,129,0.1)', color: '#34D399', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  <FileText size={9} /> Minutes
                                </span>
                              )}
                              {meeting.actionsExtracted && (
                                <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '3px', background: 'rgba(245,158,11,0.1)', color: '#FCD34D', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  <CheckCircle size={9} /> {meeting.actionsExtracted} actions
                                </span>
                              )}
                              {meeting.decisionsLogged && (
                                <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '3px', background: 'rgba(14,165,233,0.1)', color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  <CheckCircle size={9} /> {meeting.decisionsLogged} decisions
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

        {/* Mini Calendar */}
        <div className="section-card" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#F1F5F9' }}>March 2026</span>
            <Calendar size={13} style={{ color: '#475569' }} />
          </div>

          {/* Days header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: '0.375rem' }}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={i} style={{ fontSize: '0.65rem', color: '#334155', padding: '3px 0' }}>{d}</div>
            ))}
          </div>

          {/* Dates grid */}
          {[0, 1, 2, 3, 4].map(week => (
            <div key={week} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center' }}>
              {miniCalendar.map((col, dayIdx) => {
                const date = col.dates[week];
                const isToday = date === 15;
                const hasMeeting = date && meetingDates.has(String(date));
                return (
                  <div
                    key={dayIdx}
                    style={{
                      padding: '4px 2px',
                      borderRadius: '4px',
                      cursor: date ? 'pointer' : 'default',
                      position: 'relative',
                    }}
                  >
                    {date && (
                      <>
                        <div style={{
                          width: '22px', height: '22px', borderRadius: '9999px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          margin: '0 auto',
                          background: isToday ? '#0EA5E9' : 'transparent',
                          fontSize: '0.72rem',
                          fontWeight: isToday ? 700 : 400,
                          color: isToday ? 'white' : hasMeeting ? '#F1F5F9' : '#475569',
                        }}>
                          {date}
                        </div>
                        {hasMeeting && !isToday && (
                          <div style={{
                            width: '4px', height: '4px', borderRadius: '9999px',
                            background: '#8B5CF6', margin: '2px auto 0',
                          }} />
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          <div style={{ marginTop: '1rem', paddingTop: '0.875rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#94A3B8', marginBottom: '0.5rem' }}>Upcoming This Week</div>
            {meetings.filter(m => m.status === 'Upcoming').slice(0, 2).map(m => (
              <div key={m.id} style={{ padding: '0.375rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }} onClick={() => navigate(`/meetings/${m.id}`)}>
                <div style={{ fontSize: '0.72rem', color: '#F1F5F9', marginBottom: '1px' }}>{m.title.slice(0, 28)}...</div>
                <div style={{ fontSize: '0.67rem', color: '#334155' }}>{m.date} · {m.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
