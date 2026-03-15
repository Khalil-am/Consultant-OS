import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileText, GitCompare, BarChart3, Sparkles, Check,
  Download, Share, Clock, User, Calendar, Tag, Link, Send
} from 'lucide-react';
import { documents } from '../data/mockData';

const tabs = ['Overview', 'Full Text', 'Summary', 'Extracted Fields', 'Requirements', 'Tasks', 'Versions', 'AI Chat'];

const extractedFields = [
  { field: 'Project Name', value: 'NCA Digital Transformation Programme' },
  { field: 'Client Organization', value: 'National Communications Authority' },
  { field: 'Document Version', value: 'v2.3' },
  { field: 'Prepared By', value: 'Ahmed Al-Mahmoud, Accel Consulting' },
  { field: 'Review Date', value: '2026-03-20' },
  { field: 'Approval Required By', value: 'NCA CTO, Programme Director' },
  { field: 'Scope Boundary', value: 'Enterprise Systems Layer (excludes network infrastructure)' },
  { field: 'Total Requirements', value: '312 (FR: 218, NFR: 94)' },
  { field: 'Priority Breakdown', value: 'Must Have: 156, Should Have: 98, Nice to Have: 58' },
  { field: 'Key Stakeholders', value: 'NCA CTO, IT Director, Change Management Lead, 12 dept heads' },
];

const linkedRequirements = [
  { id: 'FR-001', text: 'System shall support SSO via SAML 2.0 for all enterprise applications', priority: 'Must Have', status: 'Approved' },
  { id: 'FR-002', text: 'API gateway shall handle minimum 5,000 concurrent requests with <200ms latency', priority: 'Must Have', status: 'Approved' },
  { id: 'FR-015', text: 'Document management system shall support Arabic OCR with 98% accuracy', priority: 'Must Have', status: 'Review' },
  { id: 'NFR-001', text: 'System availability shall be 99.9% uptime excluding planned maintenance', priority: 'Must Have', status: 'Approved' },
  { id: 'NFR-008', text: 'All data shall be encrypted at rest using AES-256 and in transit using TLS 1.3', priority: 'Must Have', status: 'Approved' },
];

const versions = [
  { version: 'v2.3', date: '2026-03-12', author: 'Ahmed Al-Mahmoud', note: 'Added Section 7 NFRs; updated stakeholder register', isCurrent: true },
  { version: 'v2.2', date: '2026-03-05', author: 'Sara Al-Khalidi', note: 'Incorporated NCA review comments; revised integration scope' },
  { version: 'v2.1', date: '2026-02-26', author: 'Ahmed Al-Mahmoud', note: 'Added use case diagrams; expanded glossary' },
  { version: 'v2.0', date: '2026-02-15', author: 'Rania Taher', note: 'Major revision post workshop; restructured FR sections' },
  { version: 'v1.0', date: '2026-01-28', author: 'Ahmed Al-Mahmoud', note: 'Initial draft submitted for client review' },
];

const chatMessages = [
  { role: 'user', text: 'What are the top 3 critical requirements in this document?' },
  { role: 'ai', text: 'Based on my analysis of the BRD, the three most critical requirements are:\n\n1. **SSO Integration (FR-001)** — Mandatory for user adoption. Must support SAML 2.0 across 14 enterprise systems, impacting all 2,800+ users.\n\n2. **API Gateway Performance (FR-002)** — Core to integration architecture. 5,000 concurrent requests with <200ms latency is aggressive and may require infrastructure review.\n\n3. **Arabic OCR Capability (FR-015)** — Critical for government compliance. Currently rated Medium risk due to accuracy requirements (98%) being above market standard for Arabic script.' },
  { role: 'user', text: 'Are there any gaps or missing requirements?' },
  { role: 'ai', text: 'I identified 4 potential gaps:\n\n1. **Disaster Recovery RTO/RPO** — NFR section mentions HA but doesn\'t specify RTO/RPO targets for each system tier.\n\n2. **Data Residency Requirements** — No explicit requirement for data sovereignty / UAE data residency compliance (mandatory for government).\n\n3. **Accessibility Standards** — WCAG 2.1 AA is referenced but no specific requirements for Arabic RTL interface accessibility.\n\n4. **Vendor Management API** — Section 4 references vendor portals but no API requirements are specified for vendor onboarding integration.\n\nWould you like me to draft these as requirement statements?' },
];

export default function DocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Overview');
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState(chatMessages);

  const doc = documents.find(d => d.id === id) || documents[0];

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    setMessages(prev => [...prev, { role: 'user', text: chatInput }]);
    setChatInput('');
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'ai',
        text: `Based on the document analysis, I can see that "${chatInput}" relates to several sections in the BRD. Let me extract the relevant information for you...`,
      }]);
    }, 800);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#0D1527', flexShrink: 0 }}>
        <button
          onClick={() => navigate('/documents')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: '0.8rem', padding: 0, marginBottom: '0.75rem', fontFamily: 'inherit' }}
        >
          <ArrowLeft size={14} /> Documents
        </button>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
            <div style={{ padding: '0.625rem', borderRadius: '10px', background: `${doc.typeColor}18`, color: doc.typeColor, flexShrink: 0 }}>
              <FileText size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.375rem' }}>
                <span style={{
                  fontSize: '0.7rem', padding: '2px 7px', borderRadius: '4px',
                  background: `${doc.typeColor}15`, color: doc.typeColor, border: `1px solid ${doc.typeColor}25`,
                }}>
                  {doc.type}
                </span>
                <span style={{ color: '#334155', fontSize: '0.75rem' }}>·</span>
                <span style={{ fontSize: '0.75rem', color: '#475569' }}>{doc.workspace}</span>
              </div>
              <h1 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#F1F5F9', margin: 0, marginBottom: '0.25rem' }}>{doc.name}</h1>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <span style={{ fontSize: '0.72rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <User size={11} /> {doc.author}
                </span>
                <span style={{ fontSize: '0.72rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Calendar size={11} /> {doc.date}
                </span>
                <span style={{ fontSize: '0.72rem', color: '#475569' }}>{doc.pages} pages · {doc.size}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-ghost" style={{ fontSize: '0.78rem', height: '32px' }}>
              <GitCompare size={13} /> Compare
            </button>
            <button className="btn-ghost" style={{ fontSize: '0.78rem', height: '32px' }}>
              <BarChart3 size={13} /> Create Report
            </button>
            <button className="btn-ai" style={{ fontSize: '0.78rem', height: '32px' }}>
              <Sparkles size={13} /> Ask AI
            </button>
            <button className="btn-primary" style={{ fontSize: '0.78rem', height: '32px' }}>
              <Check size={13} /> Mark Approved
            </button>
            <button className="btn-ghost" style={{ fontSize: '0.78rem', height: '32px', padding: '0 0.625rem' }}>
              <Download size={13} />
            </button>
            <button className="btn-ghost" style={{ fontSize: '0.78rem', height: '32px', padding: '0 0.625rem' }}>
              <Share size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, padding: '0 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#0A0F1E', flexShrink: 0 }}>
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

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>
        {/* Overview */}
        {activeTab === 'Overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="section-card">
                <div className="section-card-header">
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Document Summary</span>
                  <span className="status-review" style={{ fontSize: '0.65rem' }}>{doc.status}</span>
                </div>
                <div style={{ padding: '1.25rem' }}>
                  <p style={{ fontSize: '0.875rem', color: '#94A3B8', lineHeight: 1.7, margin: 0 }}>{doc.summary}</p>
                </div>
              </div>
              <div className="section-card">
                <div className="section-card-header">
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Linked Requirements</span>
                  <span style={{ fontSize: '0.75rem', color: '#475569' }}>312 total</span>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Requirement</th>
                      <th>Priority</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkedRequirements.map(req => (
                      <tr key={req.id}>
                        <td style={{ color: '#0EA5E9', fontWeight: 500 }}>{req.id}</td>
                        <td style={{ color: '#94A3B8', fontSize: '0.78rem', maxWidth: '300px' }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.text}</div>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: '3px', background: 'rgba(14,165,233,0.1)', color: '#38BDF8' }}>
                            {req.priority}
                          </span>
                        </td>
                        <td>
                          <span className={req.status === 'Approved' ? 'status-approved' : 'status-review'} style={{ fontSize: '0.65rem' }}>
                            {req.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right meta panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="section-card" style={{ padding: '1.125rem' }}>
                <div style={{ marginBottom: '0.875rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', marginBottom: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Document Info</div>
                  {[
                    { icon: <Tag size={12} />, label: 'Type', value: doc.type },
                    { icon: <User size={12} />, label: 'Author', value: doc.author },
                    { icon: <Calendar size={12} />, label: 'Created', value: doc.date },
                    { icon: <Link size={12} />, label: 'Workspace', value: doc.workspace },
                    { icon: <Clock size={12} />, label: 'Language', value: doc.language },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.375rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: '#334155' }}>
                        {item.icon}
                        <span style={{ fontSize: '0.72rem' }}>{item.label}</span>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{item.value}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                  {doc.tags.map(tag => (
                    <span key={tag} style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: '4px', background: 'rgba(255,255,255,0.04)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.07)' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="section-card" style={{ padding: '1.125rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quick Actions</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <button className="btn-ai" style={{ width: '100%', justifyContent: 'center', fontSize: '0.78rem' }}>
                    <Sparkles size={13} /> Generate Deliverables
                  </button>
                  <button className="btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: '0.78rem' }}>
                    <BarChart3 size={13} /> Create Status Report
                  </button>
                  <button className="btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: '0.78rem' }}>
                    <GitCompare size={13} /> Compare Versions
                  </button>
                  <button className="btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: '0.78rem' }}>
                    <Download size={13} /> Export PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Extracted Fields */}
        {activeTab === 'Extracted Fields' && (
          <div className="section-card">
            <div className="section-card-header">
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>AI-Extracted Fields</span>
              <span style={{ fontSize: '0.72rem', color: '#475569' }}>Extracted by GPT-4o</span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Field</th>
                  <th>Value</th>
                  <th style={{ width: '10%' }}>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {extractedFields.map((field, i) => (
                  <tr key={i}>
                    <td style={{ color: '#94A3B8', fontWeight: 500 }}>{field.field}</td>
                    <td style={{ color: '#F1F5F9' }}>{field.value}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${85 + Math.random() * 15}%`, background: '#10B981', borderRadius: '2px' }} />
                        </div>
                        <span style={{ fontSize: '0.7rem', color: '#34D399' }}>High</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Versions */}
        {activeTab === 'Versions' && (
          <div className="section-card">
            <div className="section-card-header">
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Version History</span>
            </div>
            <div style={{ padding: '1rem 1.5rem' }}>
              {versions.map((v, i) => (
                <div key={v.version} style={{ display: 'flex', gap: '1rem', paddingBottom: '1.5rem', position: 'relative' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                    <div style={{
                      width: '12px', height: '12px', borderRadius: '9999px',
                      background: v.isCurrent ? '#00D4FF' : '#334155',
                      border: `2px solid ${v.isCurrent ? '#00D4FF' : '#334155'}`,
                      flexShrink: 0, marginTop: '3px',
                      boxShadow: v.isCurrent ? '0 0 8px rgba(0,212,255,0.5)' : 'none',
                    }} />
                    {i < versions.length - 1 && (
                      <div style={{ width: '1px', flex: 1, background: 'rgba(255,255,255,0.06)', marginTop: '4px' }} />
                    )}
                  </div>
                  <div style={{ flex: 1, paddingBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.375rem' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: v.isCurrent ? '#00D4FF' : '#94A3B8' }}>
                        {v.version}
                      </span>
                      {v.isCurrent && <span className="status-active" style={{ fontSize: '0.65rem' }}>Current</span>}
                      <span style={{ fontSize: '0.72rem', color: '#334155' }}>{v.date}</span>
                      <span style={{ fontSize: '0.72rem', color: '#475569' }}>by {v.author}</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: '#475569', margin: 0 }}>{v.note}</p>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button className="btn-ghost" style={{ fontSize: '0.72rem', height: '26px', padding: '0 0.625rem' }}>
                        <Download size={11} /> Download
                      </button>
                      {!v.isCurrent && (
                        <button className="btn-ghost" style={{ fontSize: '0.72rem', height: '26px', padding: '0 0.625rem' }}>
                          <GitCompare size={11} /> Compare with current
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Chat */}
        {activeTab === 'AI Chat' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: 'calc(100vh - 280px)' }}>
            <div className="section-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className="section-card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sparkles size={15} style={{ color: '#8B5CF6' }} />
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>AI Document Chat</span>
                </div>
                <span style={{ fontSize: '0.72rem', color: '#475569' }}>Powered by GPT-4o</span>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {messages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.75rem', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    {msg.role === 'ai' && (
                      <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg, #7C3AED, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Sparkles size={13} style={{ color: 'white' }} />
                      </div>
                    )}
                    <div style={{
                      maxWidth: '75%',
                      padding: '0.75rem 1rem',
                      borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '4px 12px 12px 12px',
                      background: msg.role === 'user' ? 'rgba(14,165,233,0.15)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${msg.role === 'user' ? 'rgba(14,165,233,0.2)' : 'rgba(255,255,255,0.07)'}`,
                      fontSize: '0.82rem',
                      color: '#94A3B8',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                    }}>
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '0.75rem' }}>
                <input
                  type="text"
                  placeholder="Ask anything about this document..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                  className="input-field"
                  style={{ flex: 1 }}
                />
                <button className="btn-ai" style={{ height: '38px', padding: '0 1rem' }} onClick={handleSendMessage}>
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Full Text tab */}
        {activeTab === 'Full Text' && (
          <div className="section-card">
            <div className="section-card-header">
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9' }}>Document Content</span>
            </div>
            <div style={{ padding: '2rem', lineHeight: 1.8 }}>
              {['1. Executive Summary', '2. Project Scope and Objectives', '3. Stakeholder Register', '4. Functional Requirements', '5. Non-Functional Requirements'].map(section => (
                <div key={section} style={{ marginBottom: '2rem' }}>
                  <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#F1F5F9', marginBottom: '0.75rem' }}>{section}</h2>
                  <p style={{ fontSize: '0.875rem', color: '#94A3B8', margin: 0 }}>
                    The {section.toLowerCase()} section of this Business Requirements Document outlines the key requirements, objectives, and stakeholder expectations for the {doc.workspace} initiative. This content has been processed and extracted from the original document.
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Placeholder tabs */}
        {!['Overview', 'Extracted Fields', 'Versions', 'AI Chat', 'Full Text'].includes(activeTab) && (
          <div className="section-card" style={{ padding: '3rem', textAlign: 'center' }}>
            <div style={{ color: '#475569', fontSize: '0.875rem' }}>{activeTab} content for {doc.name}</div>
          </div>
        )}
      </div>
    </div>
  );
}
