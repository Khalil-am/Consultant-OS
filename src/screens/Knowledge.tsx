import { useState } from 'react';
import { useLayout } from '../hooks/useLayout';
import {
  Search, Sparkles, ExternalLink, TrendingUp, Filter,
  FileText, Video, CheckSquare, Brain, ArrowRight, Send
} from 'lucide-react';

const searchResults = [
  {
    id: 'k1',
    title: 'NCA API Gateway Performance Requirements',
    type: 'Requirement',
    typeColor: '#0EA5E9',
    workspace: 'NCA Digital Transformation',
    snippet: 'The API gateway shall handle a minimum of 5,000 concurrent requests with a response latency not exceeding 200 milliseconds under peak load conditions. All APIs shall comply with REST standards and support OAuth 2.0 authentication.',
    relevance: 97,
    source: 'NCA Enterprise Architecture BRD v2.3',
    date: '2026-03-12',
  },
  {
    id: 'k2',
    title: 'Decision: Proceed with Cloud-Native Architecture',
    type: 'Decision',
    typeColor: '#10B981',
    workspace: 'NCA Digital Transformation',
    snippet: 'The project steering committee resolved to adopt a cloud-native microservices architecture for the integration layer, overriding the original on-premises proposal. This decision was driven by scalability requirements and long-term cost analysis.',
    relevance: 91,
    source: 'NCA Architecture Review Workshop Minutes – Mar 8',
    date: '2026-03-08',
  },
  {
    id: 'k3',
    title: 'MOCI Vendor Shortlist – Scoring Summary',
    type: 'Evaluation',
    typeColor: '#F59E0B',
    workspace: 'MOCI Procurement Reform',
    snippet: 'Following technical and commercial evaluation, three vendors were shortlisted: Vendor A (score: 87.3/100), Vendor B (score: 82.1/100), Vendor C (score: 79.8/100). Vendor A led on technical compliance; Vendor B offered superior price-quality ratio.',
    relevance: 88,
    source: 'MOCI Vendor Evaluation – Shortlist',
    date: '2026-03-11',
  },
  {
    id: 'k4',
    title: 'Smart City Infrastructure – Critical Risk: Contractor Insolvency',
    type: 'Risk',
    typeColor: '#EF4444',
    workspace: 'Smart City Infrastructure PMO',
    snippet: 'Risk RISK-003 identified as Critical (P:3, I:5, Score:15). Contractor financial health indicators suggest potential insolvency risk for Package 3 contractor. Mitigation includes performance bond review and backup contractor identification.',
    relevance: 85,
    source: 'Smart City Risk Register v4',
    date: '2026-03-13',
  },
  {
    id: 'k5',
    title: 'Healthcare Digital Strategy – Phase 1 Key Findings',
    type: 'Report',
    typeColor: '#8B5CF6',
    workspace: 'Healthcare Digital Strategy',
    snippet: 'Phase 1 assessment identified significant gaps in digital maturity: EMR integration covers only 34% of facilities; telemedicine adoption at 12% below regional benchmark; patient data fragmentation across 6 incompatible systems.',
    relevance: 82,
    source: 'Healthcare Digital Strategy – Phase 1 Report',
    date: '2026-03-05',
  },
];

const aiAnswer = {
  query: 'What are the integration requirements across NCA and ADNOC projects?',
  answer: `Based on analysis of documents across the NCA Digital Transformation and ADNOC Supply Chain workspaces, here are the consolidated integration requirements:

**NCA Integration Requirements:**
• API Gateway: 5,000+ concurrent requests, <200ms latency (FR-002)
• SSO: SAML 2.0 across 14 enterprise systems (FR-001)
• Data format: JSON/REST with XML legacy support
• Security: OAuth 2.0, TLS 1.3, AES-256 encryption

**ADNOC Integration Requirements:**
• ERP Integration: SAP S/4HANA with existing MAXIMO (Asset Management)
• Supply chain visibility: Real-time inventory sync across 12 depots
• Vendor portal: EDI/API integration for 340+ vendors
• Reporting: Power BI embedded dashboards

**Common Patterns:**
Both projects require middleware orchestration layers, shared API management standards, and bilingual interface support for Arabic/English content.`,
  sources: [
    { title: 'NCA Enterprise Architecture BRD v2.3', page: 'pp. 34-67' },
    { title: 'ADNOC Supply Chain Process Map', page: 'pp. 89-112' },
    { title: 'NCA Architecture Review Workshop Minutes', page: 'pp. 5-8' },
  ],
};

const filters = [
  { label: 'Workspaces', options: ['All', 'NCA Digital Transformation', 'ADNOC Supply Chain', 'MOCI Procurement'] },
  { label: 'Document Type', options: ['All Types', 'BRD', 'FRD', 'Minutes', 'Risk Register', 'Report'] },
  { label: 'Content Type', options: ['All Content', 'Requirements', 'Decisions', 'Risks', 'Actions'] },
  { label: 'Date Range', options: ['All Time', 'Last 7 Days', 'Last 30 Days', 'Last Quarter'] },
];

export default function Knowledge() {
  const { width, isMobile, isTablet } = useLayout();
  const [query, setQuery] = useState('integration requirements NCA ADNOC');
  const [hasResults, setHasResults] = useState(true);
  const [chatInput, setChatInput] = useState('');

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      {/* Left Filter Panel */}
      <div style={{
        width: isTablet ? '100%' : '220px', minWidth: isTablet ? undefined : '220px',
        borderRight: isTablet ? 'none' : '1px solid rgba(255,255,255,0.06)',
        display: isTablet ? 'none' : 'block',
        padding: '1rem 0.875rem', overflowY: 'auto', background: '#0D1527',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Filter size={13} style={{ color: '#475569' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Filters</span>
        </div>

        {filters.map(filter => (
          <div key={filter.label} style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.68rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.375rem' }}>
              {filter.label}
            </div>
            {filter.options.map((opt, i) => (
              <div
                key={opt}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0',
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  width: '13px', height: '13px', borderRadius: '3px', flexShrink: 0,
                  background: i === 0 ? 'rgba(0,212,255,0.2)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${i === 0 ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                }} />
                <span style={{ fontSize: '0.75rem', color: i === 0 ? '#94A3B8' : '#475569' }}>{opt}</span>
              </div>
            ))}
          </div>
        ))}

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.875rem' }}>
          <div style={{ fontSize: '0.68rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
            Knowledge Stats
          </div>
          {[
            { label: 'Documents indexed', value: '847' },
            { label: 'Requirements extracted', value: '2,341' },
            { label: 'Decisions logged', value: '186' },
            { label: 'Risks tracked', value: '74' },
          ].map(stat => (
            <div key={stat.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0' }}>
              <span style={{ fontSize: '0.72rem', color: '#334155' }}>{stat.label}</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#475569' }}>{stat.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Search Bar */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.75rem 1rem',
            borderRadius: '0.75rem',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(0,212,255,0.2)',
            boxShadow: '0 0 16px rgba(0,212,255,0.06)',
          }}>
            <Brain size={18} style={{ color: '#8B5CF6', flexShrink: 0 }} />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setHasResults(true)}
              placeholder="Search knowledge base semantically... (e.g. 'integration requirements' or 'risks in smart city')"
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontSize: '0.9rem', color: '#F1F5F9', fontFamily: 'inherit',
              }}
            />
            <button className="btn-primary" style={{ height: '34px', fontSize: '0.8rem', flexShrink: 0 }}>
              <Search size={13} /> Search
            </button>
          </div>
          {hasResults && (
            <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '0.5rem', paddingLeft: '0.25rem' }}>
              Showing {searchResults.length} results for "<span style={{ color: '#00D4FF' }}>{query}</span>" · Semantic search across 847 documents
            </div>
          )}
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {searchResults.map(result => (
            <div
              key={result.id}
              className="section-card"
              style={{ padding: '1rem', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <div style={{ padding: '0.3rem', borderRadius: '5px', background: `${result.typeColor}15`, color: result.typeColor }}>
                    <FileText size={13} />
                  </div>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1F5F9', margin: 0 }}>{result.title}</h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                  {/* Relevance bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <div style={{ width: '48px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${result.relevance}%`, background: '#8B5CF6', borderRadius: '2px' }} />
                    </div>
                    <span style={{ fontSize: '0.68rem', color: '#8B5CF6', fontWeight: 600 }}>{result.relevance}%</span>
                  </div>
                  <ExternalLink size={12} style={{ color: '#334155' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.625rem' }}>
                <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '3px', background: `${result.typeColor}12`, color: result.typeColor, border: `1px solid ${result.typeColor}20` }}>
                  {result.type}
                </span>
                <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '3px', background: 'rgba(255,255,255,0.04)', color: '#475569', border: '1px solid rgba(255,255,255,0.06)' }}>
                  {result.workspace}
                </span>
                <span style={{ fontSize: '0.65rem', color: '#334155', marginLeft: 'auto' }}>{result.date}</span>
              </div>

              <p style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.6, margin: 0, marginBottom: '0.5rem' }}>
                {result.snippet}
              </p>

              <div style={{ fontSize: '0.68rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <FileText size={10} />
                Source: {result.source}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right AI Answer Panel */}
      <div style={{
        width: isTablet ? '100%' : '320px', minWidth: isTablet ? undefined : '320px',
        borderLeft: isTablet ? 'none' : '1px solid rgba(255,255,255,0.06)',
        display: isTablet ? 'none' : 'flex', flexDirection: 'column', overflowY: 'auto', background: '#0D1527',
      }}>
        {/* AI Answer */}
        <div style={{
          padding: '1rem',
          borderBottom: '1px solid rgba(139,92,246,0.15)',
          background: 'linear-gradient(160deg, #0D1527, #130D2A)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
            <div style={{ padding: '0.3rem', borderRadius: '6px', background: 'rgba(139,92,246,0.15)' }}>
              <Sparkles size={14} style={{ color: '#8B5CF6' }} />
            </div>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#F1F5F9' }}>AI Answer</span>
          </div>

          <div style={{
            fontSize: '0.78rem', color: '#94A3B8', lineHeight: 1.7, whiteSpace: 'pre-wrap',
            maxHeight: '320px', overflowY: 'auto', marginBottom: '0.875rem',
          }}>
            {aiAnswer.answer}
          </div>

          {/* Sources */}
          <div style={{ marginBottom: '0.875rem' }}>
            <div style={{ fontSize: '0.68rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.375rem' }}>Sources</div>
            {aiAnswer.sources.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.5rem', padding: '0.25rem 0', cursor: 'pointer' }}>
                <FileText size={11} style={{ color: '#475569', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{s.title}</div>
                  <div style={{ fontSize: '0.65rem', color: '#334155' }}>{s.page}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <button className="btn-ai" style={{ width: '100%', justifyContent: 'center', fontSize: '0.78rem', marginBottom: '0.5rem' }}>
            <FileText size={13} /> Generate Memo from Answer
          </button>
          <button className="btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: '0.78rem' }}>
            <Sparkles size={13} /> Suggested Automations
          </button>
        </div>

        {/* Ask Follow-up */}
        <div style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', marginBottom: '0.625rem' }}>Ask a Follow-up</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
            {[
              'What are the security risks of API integration?',
              'Compare NCA and ADNOC integration timelines',
              'What standards apply to both projects?',
            ].map((suggestion, i) => (
              <button
                key={i}
                onClick={() => setChatInput(suggestion)}
                style={{
                  textAlign: 'left', padding: '0.5rem 0.625rem', borderRadius: '6px', fontSize: '0.75rem',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                  color: '#475569', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', gap: '0.375rem',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(139,92,246,0.08)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(139,92,246,0.2)'; (e.currentTarget as HTMLElement).style.color = '#94A3B8'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#475569'; }}
              >
                <ArrowRight size={10} style={{ flexShrink: 0 }} />
                {suggestion}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <input
              type="text"
              placeholder="Ask anything..."
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              className="input-field"
              style={{ flex: 1, fontSize: '0.78rem' }}
            />
            <button className="btn-ai" style={{ height: '36px', padding: '0 0.75rem' }}>
              <Send size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
