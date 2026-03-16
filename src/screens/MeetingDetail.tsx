import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLayout } from '../hooks/useLayout';
import {
  ArrowLeft, Video, Users, Clock, MapPin, Calendar,
  Sparkles, CheckSquare, FileText, Plus, Check, AlertCircle
} from 'lucide-react';
import { getMeeting, updateMeeting } from '../lib/db';
import type { MeetingRow } from '../lib/db';
import { chatWithDocument } from '../lib/openrouter';

const tabs = ['Meeting Info', 'Agenda', 'Notes', 'Decisions', 'Action Items', 'Attachments', 'Generated Outputs'];

const decisionRows = [
  { id: 'DEC-001', decision: 'Proceed with Phase 2 integration work as planned in the architecture BRD', owner: 'AM', status: 'Ratified', dueDate: 'N/A' },
  { id: 'DEC-002', decision: 'Engage independent security consultant for penetration testing', owner: 'SK', status: 'Approved', dueDate: '2026-04-01' },
  { id: 'DEC-003', decision: 'Approve additional budget of SAR 180,000 for cloud infrastructure', owner: 'RT', status: 'Deferred', dueDate: 'Next SC' },
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
  const { width, isMobile, isTablet } = useLayout();
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Meeting Info');
  const [meeting, setMeeting] = useState<MeetingRow | null>(null);
  const [loadingMeeting, setLoadingMeeting] = useState(true);
  const [generatingMinutes, setGeneratingMinutes] = useState(false);
  const [generatedMinutes, setGeneratedMinutes] = useState('');
  const [minutesError, setMinutesError] = useState('');

  useEffect(() => {
    if (id) {
      getMeeting(id)
        .then(data => { setMeeting(data); setLoadingMeeting(false); })
        .catch(() => setLoadingMeeting(false));
    }
  }, [id]);

  if (loadingMeeting) {
    return <div style={{ padding: '2rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading meeting…</div>;
  }
  if (!meeting) {
    return <div style={{ padding: '2rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Meeting not found.</div>;
  }

  const isCommittee = meeting.type === 'Committee' || meeting.type === 'Steering';

  async function handleGenerateMinutes() {
    if (!meeting) return;
    setGeneratingMinutes(true);
    setGeneratedMinutes('');
    setMinutesError('');
    setActiveTab('Generated Outputs');
    try {
      const agendaText = sampleAgenda.map(a => `${a.time} (${a.duration}) – ${a.item} [${a.facilitator}]`).join('\n');
      const decisionText = decisionRows.map(d => `${d.id}: ${d.decision} — ${d.status}`).join('\n');
      const actionText = actionItems.map(a => `${a.id}: ${a.title} (Owner: ${a.owner}, Due: ${a.dueDate})`).join('\n');
      const systemPrompt = `You are a professional meeting secretary. Generate formal, structured meeting minutes in markdown format. Be concise and professional.`;
      const userMsg = `Generate meeting minutes for:\n\nMeeting: ${meeting.title}\nDate: ${meeting.date} at ${meeting.time}\nDuration: ${meeting.duration}\nWorkspace: ${meeting.workspace}\nType: ${meeting.type}\nParticipants: ${meeting.participants.join(', ')}\nLocation: ${meeting.location || 'Not specified'}\nQuorum Status: ${meeting.quorum_status || 'N/A'}\n\nAGENDA:\n${agendaText}\n\nDECISIONS MADE:\n${decisionText}\n\nACTION ITEMS:\n${actionText}\n\nGenerate formal meeting minutes with sections: Opening, Attendees, Agenda Items (with key points), Decisions, Action Items, and Close.`;
      const result = await chatWithDocument([{ role: 'user', content: userMsg }], systemPrompt);
      setGeneratedMinutes(result);
      // Mark minutes as generated in DB
      await updateMeeting(meeting.id, { minutes_generated: true });
      setMeeting(prev => prev ? { ...prev, minutes_generated: true } : prev);
    } catch (e) {
      setMinutesError(e instanceof Error ? e.message : 'Failed to generate minutes');
    } finally {
      setGeneratingMinutes(false);
    }
  }

  // suppress unused warning
  void width;

  return (
    <div style={{ padding: isMobile ? '0.875rem' : '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Back */}
      <div>
        <button
          onClick={() => navigate('/meetings')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', fontSize: '0.78rem', fontWeight: 500, padding: '0.375rem 0', marginBottom: '0.875rem', fontFamily: 'inherit', transition: 'color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#94A3B8')}
          onMouseLeave={e => (e.currentTarget.style.color = '#64748B')}
        >
          <ArrowLeft size={13} /> Back to Meetings
        </button>

        {/* Header Card */}
        <div style={{
          padding: '1.5rem',
          borderRadius: '14px',
          background: 'linear-gradient(135deg, #0D1628 0%, #101828 60%, #0F1D30 100%)',
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
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
                  {isCommittee && meeting.quorum_status && (
                    <span style={{
                      fontSize: '0.7rem', padding: '2px 7px', borderRadius: '4px',
                      background: meeting.quorum_status === 'Met' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                      color: meeting.quorum_status === 'Met' ? '#34D399' : '#FCA5A5',
                      border: `1px solid ${meeting.quorum_status === 'Met' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                    }}>
                      Quorum {meeting.quorum_status}
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
                    <span key={i} style={{ fontSize: '0.75rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
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
              <button className="btn-ai" style={{ fontSize: '0.78rem', height: '32px' }} onClick={handleGenerateMinutes} disabled={generatingMinutes}>
                <Sparkles size={13} /> {generatingMinutes ? 'Generating…' : 'Generate Minutes'}
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
              borderTop: '1px solid rgba(255,255,255,0.05)',
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
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)', overflowX: 'auto' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: isTablet ? '1fr' : '2fr 1fr', gap: '1.25rem' }}>
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
                  { label: 'Quorum Status', value: meeting.quorum_status || 'Pending' },
                  { label: 'Circular Number', value: 'SC-10/2026' },
                ] : []),
              ].map(field => (
                <div key={field.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.625rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748B' }}>{field.label}</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94A3B8' }}>{field.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="section-card">
            <div className="section-card-header">
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Participants</span>
              <span style={{ fontSize: '0.72rem', color: '#64748B' }}>{meeting.participants.length} members</span>
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
          <div style={{ overflowX: 'auto' }}>
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
                  <td style={{ color: '#64748B' }}>{item.duration}</td>
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
          <div style={{ overflowX: 'auto' }}>
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
                  <td style={{ fontSize: '0.75rem', color: '#64748B' }}>{d.dueDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
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
          <div style={{ overflowX: 'auto' }}>
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

      {/* Attachments Tab */}
      {activeTab === 'Attachments' && (
        <div className="section-card">
          <div className="section-card-header">
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Meeting Attachments</span>
            <button className="btn-ghost" style={{ padding: '0.25rem 0.75rem', fontSize: '0.72rem', height: '28px', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <FileText size={12} /> Upload
            </button>
          </div>
          <div style={{ padding: '0.5rem 0' }}>
            {[
              { name: 'NCA Enterprise Architecture BRD v2.3.pdf', size: '4.2 MB', type: 'PDF', uploaded: '12 Mar 2026', uploader: 'AM' },
              { name: 'SC-09 Meeting Minutes APPROVED.docx', size: '1.1 MB', type: 'DOCX', uploaded: '11 Mar 2026', uploader: 'DN' },
              { name: 'Phase 2 Architecture Slides.pptx', size: '8.7 MB', type: 'PPTX', uploaded: '12 Mar 2026', uploader: 'SK' },
              { name: 'Budget Variance Analysis Q1.xlsx', size: '0.9 MB', type: 'XLSX', uploaded: '10 Mar 2026', uploader: 'RT' },
            ].map((file, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1.25rem', borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none', cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ padding: '0.5rem', borderRadius: '6px', background: file.type === 'PDF' ? 'rgba(239,68,68,0.1)' : file.type === 'PPTX' ? 'rgba(245,158,11,0.1)' : file.type === 'XLSX' ? 'rgba(16,185,129,0.1)' : 'rgba(14,165,233,0.1)', color: file.type === 'PDF' ? '#FCA5A5' : file.type === 'PPTX' ? '#FCD34D' : file.type === 'XLSX' ? '#34D399' : '#38BDF8', flexShrink: 0, fontSize: '0.6rem', fontWeight: 700 }}>
                  {file.type}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748B' }}>{file.size} · Uploaded {file.uploaded} by {file.uploader}</div>
                </div>
                <button style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: '6px', padding: '0.25rem 0.625rem', color: '#38BDF8', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Download</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generated Outputs Tab */}
      {activeTab === 'Generated Outputs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* AI Minutes result */}
          {(generatingMinutes || generatedMinutes || minutesError) && (
            <div className="section-card" style={{ border: '1px solid rgba(139,92,246,0.25)' }}>
              <div className="section-card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sparkles size={14} style={{ color: '#8B5CF6' }} />
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>AI Meeting Minutes</span>
                </div>
                {generatedMinutes && (
                  <button className="btn-ghost" style={{ height: '28px', fontSize: '0.72rem' }} onClick={() => navigator.clipboard.writeText(generatedMinutes)}>
                    Copy
                  </button>
                )}
              </div>
              <div style={{ padding: '1rem 1.25rem' }}>
                {generatingMinutes && <div style={{ color: '#A78BFA', fontSize: '0.82rem' }}>Generating minutes with AI…</div>}
                {minutesError && <div style={{ color: '#FCA5A5', fontSize: '0.82rem' }}>{minutesError}</div>}
                {generatedMinutes && (
                  <pre style={{ margin: 0, fontSize: '0.8rem', lineHeight: 1.65, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{generatedMinutes}</pre>
                )}
              </div>
            </div>
          )}

          <div className="section-card">
            <div className="section-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={14} style={{ color: '#8B5CF6' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>AI-Generated Outputs</span>
              </div>
              <button className="btn-ai" style={{ padding: '0.25rem 0.875rem', fontSize: '0.72rem', height: '28px', display: 'flex', alignItems: 'center', gap: '0.375rem' }} onClick={handleGenerateMinutes} disabled={generatingMinutes}>
                <Sparkles size={11} /> {generatingMinutes ? 'Generating…' : 'Regenerate'}
              </button>
            </div>
            <div style={{ padding: '0.5rem 0' }}>
              {[
                { name: 'SC-09 Meeting Minutes – Final.docx', type: 'Minutes', status: 'Ready', generated: '12 Mar 2026 14:32', pages: 8, color: '#10B981' },
                { name: 'Action Items Register – SC-09.xlsx', type: 'Action Items', status: 'Ready', generated: '12 Mar 2026 14:33', pages: 2, color: '#0EA5E9' },
                { name: 'Decision Log Update – March 2026.docx', type: 'Decision Log', status: 'Ready', generated: '12 Mar 2026 14:34', pages: 4, color: '#8B5CF6' },
                { name: 'SC-09 Executive Summary.pdf', type: 'Executive Summary', status: 'Draft', generated: '12 Mar 2026 14:35', pages: 3, color: '#F59E0B' },
              ].map((output, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.875rem 1.25rem', borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none', cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div style={{ padding: '0.375rem', borderRadius: '6px', background: `${output.color}15`, color: output.color, flexShrink: 0 }}>
                    <FileText size={14} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{output.name}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748B' }}>{output.pages} pages · Generated {output.generated}</div>
                  </div>
                  <span style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: '4px', background: output.status === 'Ready' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', color: output.status === 'Ready' ? '#34D399' : '#FCD34D', border: `1px solid ${output.status === 'Ready' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`, flexShrink: 0 }}>{output.status}</span>
                  <button style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: '6px', padding: '0.25rem 0.625rem', color: '#38BDF8', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Download</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
