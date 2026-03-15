import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Video, Users, Clock, MapPin, Calendar,
  Sparkles, CheckSquare, FileText, Plus, Check, AlertCircle
} from 'lucide-react';
import { meetings } from '../data/mockData';

const tabs = ['Meeting Info', 'Agenda', 'Notes', 'Decisions', 'Action Items', 'Attachments', 'Generated Outputs'];

const decisionRows = [
  { id: 'DEC-001', decision: 'Proceed with Phase 2 integration work as planned in the architecture BRD', owner: 'AM', status: 'Ratified', dueDate: 'N/A' },
  { id: 'DEC-002', decision: 'Engage independent security consultant for penetration testing', owner: 'SK', status: 'Approved', dueDate: '2026-04-01' },
  { id: 'DEC-003', decision: 'Approve additional budget of AED 180,000 for cloud infrastructure', owner: 'RT', status: 'Deferred', dueDate: 'Next SC' },
  { id: 'DEC-004', decision: 'Accept risk register v4 with proposed mitigation plans', owner: 'JL', status: 'Approved', dueDate: 'N/A' },
];

const actionItems = [
  { id: 'ACT-001', title: 'Distribute revised integration architecture to NCA IT team', owner: 'AM', dueDate: '2026-03-20', status: 'Open', priority: 'High' },
  { id: 'ACT-002', title: 'Prepare RFP for security consultant services', owner: 'SK', dueDate: '2026-03-25', status: 'Open', priority: 'Medium' },
  { id: 'ACT-003', title: 'Prepare budget justification memo for deferred decision', owner: 'RT', dueDate: '2026-03-22', status: 'Open', priority: 'High' },
  { id: 'ACT-004', title: 'Update project schedule with Phase 2 milestones', owner: 'JL', dueDate: '2026-03-18', status: 'Completed', priority: 'Medium' },
  { id: 'ACT-005', title: 'Share BRD v2.3 with steering committee members', owner: 'AM', dueDate: '2026-03-19', status: 'Open', priority: 'High' },
];

const sampleAgenda = [
  { time: '09:00', duration: '10 min', item: 'Welcome and quorum confirmation', facilitator: 'AM' },
  { time: '09:10', duration: '15 min', item: 'Review and approval of previous minutes (SC-08)', facilitator: 'AM' },
  { time: '09:25', duration: '30 min', item: 'Phase 2 Architecture Review – BRD presentation', facilitator: 'SK' },
  { time: '09:55', duration: '20 min', item: 'Risk register update and escalations', facilitator: 'JL' },
  { time: '10:15', duration: '15 min', item: 'Budget discussion – cloud infrastructure request', facilitator: 'RT' },
  { time: '10:30', duration: '20 min', item: 'Decision items and voting', facilitator: 'AM' },
  { time: '10:50', duration: '10 min', item: 'AOB and next meeting date', facilitator: 'AM' },
];

export default function MeetingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Meeting Info');

  const meeting = meetings.find(m => m.id === id) || meetings[0];
  const isCommittee = meeting.type === 'Committee' || meeting.type === 'Steering';

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Back */}
      <div>
        <button
          onClick={() => navigate('/meetings')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: '0.8rem', padding: 0, marginBottom: '1rem', fontFamily: 'inherit' }}
        >
          <ArrowLeft size={14} /> Back to Meetings
        </button>

        {/* Header Card */}
        <div style={{
          padding: '1.5rem',
          borderRadius: '0.875rem',
          background: 'linear-gradient(135deg, #0D1527 0%, #111B35 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '1rem', flex: 1 }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '12px', flexShrink: 0,
                background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Video size={22} style={{ color: '#8B5CF6' }} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.375rem' }}>
                  <span style={{
                    fontSize: '0.7rem', padding: '2px 7px', borderRadius: '4px',
                    background: 'rgba(139,92,246,0.15)', color: '#A78BFA', border: '1px solid rgba(139,92,246,0.25)',
                  }}>
                    {meeting.type}
                  </span>
                  <span style={{
                    fontSize: '0.7rem', padding: '2px 7px', borderRadius: '4px',
                    background: meeting.status === 'Upcoming' ? 'rgba(14,165,233,0.1)' : meeting.status === 'Completed' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    color: meeting.status === 'Upcoming' ? '#38BDF8' : meeting.status === 'Completed' ? '#34D399' : '#FCA5A5',
                  }}>
                    {meeting.status}
                  </span>
                  {isCommittee && meeting.quorumStatus && (
                    <span style={{
                      fontSize: '0.7rem', padding: '2px 7px', borderRadius: '4px',
                      background: meeting.quorumStatus === 'Met' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                      color: meeting.quorumStatus === 'Met' ? '#34D399' : '#FCA5A5',
                      border: `1px solid ${meeting.quorumStatus === 'Met' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                    }}>
                      Quorum {meeting.quorumStatus}
                    </span>
                  )}
                </div>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#F1F5F9', margin: 0, marginBottom: '0.5rem' }}>
                  {meeting.title}
                </h1>
                <div style={{ display: 'flex', gap: '1.25rem' }}>
                  {[
                    { icon: <Calendar size={12} />, text: meeting.date },
                    { icon: <Clock size={12} />, text: `${meeting.time} · ${meeting.duration}` },
                    meeting.location && { icon: <MapPin size={12} />, text: meeting.location },
                    { icon: <Users size={12} />, text: `${meeting.participants.length} participants` },
                  ].filter(Boolean).map((item: any, i) => (
                    <span key={i} style={{ fontSize: '0.75rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      {item.icon} {item.text}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {meeting.status === 'Completed' && (
                <>
                  <button className="btn-ghost" style={{ fontSize: '0.78rem', height: '32px' }}>
                    <FileText size={13} /> View Minutes
                  </button>
                  <button className="btn-ghost" style={{ fontSize: '0.78rem', height: '32px' }}>
                    <CheckSquare size={13} /> View Actions
                  </button>
                </>
              )}
              <button className="btn-ai" style={{ fontSize: '0.78rem', height: '32px' }}>
                <Sparkles size={13} /> Generate Minutes
              </button>
              <button className="btn-primary" style={{ fontSize: '0.78rem', height: '32px' }}>
                <CheckSquare size={13} /> Extract Actions
              </button>
            </div>
          </div>

          {/* Committee specifics */}
          {isCommittee && (
            <div style={{
              display: 'flex', gap: '1.5rem', marginTop: '1rem', paddingTop: '1rem',
              borderTop: '1px solid rgba(255,255,255,0.06)',
            }}>
              {[
                { label: 'Circular No.', value: 'SC-10/2026' },
                { label: 'Resolution Ref.', value: 'RES-2026-031' },
                { label: 'Quorum Required', value: '5 members' },
                { label: 'Members Present', value: `${meeting.participants.length} of 7` },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ fontSize: '0.65rem', color: '#334155', marginBottom: '2px' }}>{item.label}</div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#94A3B8' }}>{item.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {tabs.map(tab => (
          <button
            key={tab}
            className={`tab-underline ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
            style={{ marginRight: '1.25rem', fontSize: '0.82rem' }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Meeting Info */}
      {activeTab === 'Meeting Info' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem' }}>
          <div className="section-card">
            <div className="section-card-header">
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Meeting Details</span>
            </div>
            <div style={{ padding: '1.25rem' }}>
              {[
                { label: 'Workspace', value: meeting.workspace },
                { label: 'Meeting Type', value: meeting.type },
                { label: 'Date & Time', value: `${meeting.date} at ${meeting.time}` },
                { label: 'Duration', value: meeting.duration },
                { label: 'Location', value: meeting.location || 'Virtual' },
                { label: 'Status', value: meeting.status },
                ...(isCommittee ? [
                  { label: 'Quorum Status', value: meeting.quorumStatus || 'Pending' },
                  { label: 'Circular Number', value: 'SC-10/2026' },
                ] : []),
              ].map(field => (
                <div key={field.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.625rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: '0.8rem', color: '#475569' }}>{field.label}</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94A3B8' }}>{field.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="section-card">
            <div className="section-card-header">
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Participants</span>
              <span style={{ fontSize: '0.72rem', color: '#475569' }}>{meeting.participants.length} members</span>
            </div>
            <div style={{ padding: '1rem' }}>
              {meeting.participants.map((p, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '0.625rem',
                  padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <div className="avatar" style={{ width: '28px', height: '28px', fontSize: '0.62rem' }}>{p}</div>
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 500, color: '#F1F5F9' }}>
                      {p === 'AM' ? 'Ahmed Al-Mahmoud' : p === 'SK' ? 'Sara Al-Khalidi' : p === 'RT' ? 'Rania Taher' : p === 'JL' ? 'James Liu' : p === 'MK' ? 'Mohammed Al-Karim' : p === 'DN' ? 'David Nkosi' : p === 'FH' ? 'Fatima Hassan' : p}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#334155' }}>
                      {isCommittee ? 'Committee Member' : 'Project Team'}
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto' }}>
                    <Check size={13} style={{ color: '#10B981' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Agenda */}
      {activeTab === 'Agenda' && (
        <div className="section-card">
          <div className="section-card-header">
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Meeting Agenda</span>
            <button className="btn-ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}>
              <Plus size={12} /> Add Item
            </button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '10%' }}>Time</th>
                <th style={{ width: '10%' }}>Duration</th>
                <th>Agenda Item</th>
                <th style={{ width: '15%' }}>Facilitator</th>
              </tr>
            </thead>
            <tbody>
              {sampleAgenda.map((item, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: 'monospace', color: '#00D4FF' }}>{item.time}</td>
                  <td style={{ color: '#475569' }}>{item.duration}</td>
                  <td style={{ color: '#F1F5F9', fontWeight: 500 }}>{item.item}</td>
                  <td>
                    <div className="avatar" style={{ width: '22px', height: '22px', fontSize: '0.6rem', display: 'inline-flex' }}>
                      {item.facilitator}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Decisions */}
      {activeTab === 'Decisions' && (
        <div className="section-card">
          <div className="section-card-header">
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Decisions Log</span>
            <button className="btn-ai" style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}>
              <Sparkles size={12} /> AI Extract Decisions
            </button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Decision</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Follow-up</th>
              </tr>
            </thead>
            <tbody>
              {decisionRows.map(d => (
                <tr key={d.id}>
                  <td style={{ color: '#8B5CF6', fontWeight: 500 }}>{d.id}</td>
                  <td style={{ color: '#94A3B8', maxWidth: '350px' }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{d.decision}</div>
                  </td>
                  <td>
                    <div className="avatar" style={{ width: '24px', height: '24px', fontSize: '0.62rem' }}>{d.owner}</div>
                  </td>
                  <td>
                    <span className={d.status === 'Approved' || d.status === 'Ratified' ? 'status-approved' : 'status-pending'} style={{ fontSize: '0.65rem' }}>
                      {d.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.75rem', color: '#475569' }}>{d.dueDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Action Items */}
      {activeTab === 'Action Items' && (
        <div className="section-card">
          <div className="section-card-header">
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Action Items</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-ai" style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}>
                <Sparkles size={12} /> Extract Actions
              </button>
              <button className="btn-ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}>
                <Plus size={12} /> Add Action
              </button>
            </div>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Action</th>
                <th>Owner</th>
                <th>Priority</th>
                <th>Due Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {actionItems.map(a => (
                <tr key={a.id}>
                  <td style={{ color: '#0EA5E9', fontWeight: 500 }}>{a.id}</td>
                  <td style={{ color: '#94A3B8', maxWidth: '300px', fontSize: '0.82rem' }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</div>
                  </td>
                  <td>
                    <div className="avatar" style={{ width: '24px', height: '24px', fontSize: '0.62rem' }}>{a.owner}</div>
                  </td>
                  <td>
                    <span style={{
                      fontSize: '0.68rem', padding: '1px 5px', borderRadius: '3px',
                      background: a.priority === 'High' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.1)',
                      color: a.priority === 'High' ? '#FCA5A5' : '#FCD34D',
                    }}>
                      {a.priority}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.78rem', color: '#94A3B8' }}>{a.dueDate}</td>
                  <td>
                    <span className={a.status === 'Completed' ? 'status-approved' : 'status-pending'} style={{ fontSize: '0.65rem' }}>
                      {a.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Notes */}
      {activeTab === 'Notes' && (
        <div className="section-card">
          <div className="section-card-header">
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Meeting Notes / Transcript</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}>
                <Plus size={12} /> Upload Transcript
              </button>
              <button className="btn-ai" style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}>
                <Sparkles size={12} /> Summarize Notes
              </button>
            </div>
          </div>
          <div style={{ padding: '1.25rem' }}>
            <textarea
              style={{
                width: '100%', minHeight: '300px', background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.5rem',
                color: '#94A3B8', fontSize: '0.875rem', lineHeight: 1.7,
                padding: '1rem', fontFamily: 'inherit', resize: 'vertical', outline: 'none',
              }}
              placeholder="Paste meeting transcript or notes here..."
              defaultValue={meeting.status === 'Completed' ? `Meeting commenced at ${meeting.time}.\n\nChair: ${meeting.title} — let's begin.\n\nItem 1: Previous minutes were reviewed and approved with one minor correction to action ACT-007 owner.\n\nItem 2: Phase 2 architecture was presented by the technical team. Key points discussed included the API gateway capacity planning and the need for a dedicated DBA resource during migration.\n\nDecision: The committee resolved to proceed with the proposed architecture subject to a final security review.\n\n[... Additional meeting notes ...]` : ''}
            />
          </div>
        </div>
      )}

      {/* Placeholder tabs */}
      {!['Meeting Info', 'Agenda', 'Decisions', 'Action Items', 'Notes'].includes(activeTab) && (
        <div className="section-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <div style={{ color: '#475569', fontSize: '0.875rem' }}>{activeTab} for {meeting.title}</div>
        </div>
      )}
    </div>
  );
}
