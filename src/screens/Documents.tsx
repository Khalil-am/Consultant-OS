import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLayout } from '../hooks/useLayout';
import {
  Search, Upload, GitCompare, FileText, Download, Filter,
  ChevronRight, ExternalLink, Sparkles, Eye
} from 'lucide-react';
import { documents } from '../data/mockData';

const folders = [
  { label: 'All Documents', count: 847, active: true },
  { label: 'BRD', count: 124 },
  { label: 'FRD', count: 89 },
  { label: 'Meeting Minutes', count: 203 },
  { label: 'Proposals', count: 67 },
  { label: 'Evaluations', count: 45 },
  { label: 'Contracts', count: 38 },
  { label: 'Policies', count: 22 },
  { label: 'Technical Specs', count: 56 },
  { label: 'Reports', count: 167 },
  { label: 'Charters', count: 36 },
];

const statusFilters = ['All', 'Draft', 'Under Review', 'Approved', 'Final'];

export default function Documents() {
  const navigate = useNavigate();
  const { width, isMobile, isTablet } = useLayout();
  const [activeFolder, setActiveFolder] = useState('All Documents');
  const [activeStatus, setActiveStatus] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);

  const filtered = documents.filter(doc => {
    const matchFolder = activeFolder === 'All Documents' || doc.type === activeFolder;
    const matchStatus = activeStatus === 'All' || doc.status === activeStatus;
    const matchSearch = doc.name.toLowerCase().includes(search.toLowerCase()) ||
      doc.workspace.toLowerCase().includes(search.toLowerCase());
    return matchFolder && matchStatus && matchSearch;
  });

  const selected = documents.find(d => d.id === selectedDoc);

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      {/* Left sidebar - Folders */}
      <div style={{
        width: '200px', minWidth: '200px', borderRight: '1px solid rgba(255,255,255,0.06)',
        display: isTablet ? 'none' : 'flex', flexDirection: 'column', overflowY: 'auto', background: '#0D1527',
        padding: '1rem 0.75rem',
      }}>
        <div style={{ fontSize: '0.68rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.625rem', paddingLeft: '0.25rem' }}>
          Folders
        </div>
        {folders.map(folder => (
          <div
            key={folder.label}
            onClick={() => setActiveFolder(folder.label)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0.5rem 0.625rem', borderRadius: '0.5rem', cursor: 'pointer',
              background: activeFolder === folder.label ? 'rgba(0,212,255,0.08)' : 'transparent',
              borderLeft: activeFolder === folder.label ? '2px solid #00D4FF' : '2px solid transparent',
              transition: 'all 0.15s',
              marginBottom: '1px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={13} style={{ color: activeFolder === folder.label ? '#00D4FF' : '#475569' }} />
              <span style={{ fontSize: '0.78rem', color: activeFolder === folder.label ? '#00D4FF' : '#475569', fontWeight: activeFolder === folder.label ? 500 : 400 }}>
                {folder.label}
              </span>
            </div>
            <span style={{ fontSize: '0.65rem', color: '#334155' }}>{folder.count}</span>
          </div>
        ))}
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Toolbar */}
        <div style={{
          padding: '0.875rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0,
          background: '#0A0F1E',
        }}>
          <button className="btn-primary" style={{ height: '34px', fontSize: '0.8rem' }}>
            <Upload size={13} /> Upload
          </button>
          <button className="btn-ghost" style={{ height: '34px', fontSize: '0.8rem' }}>
            <GitCompare size={13} /> Compare
          </button>
          <button className="btn-ghost" style={{ height: '34px', fontSize: '0.8rem' }}>
            <Sparkles size={13} /> Summarize
          </button>
          <button className="btn-ai" style={{ height: '34px', fontSize: '0.8rem' }}>
            <FileText size={13} /> Generate
          </button>
          <button className="btn-ghost" style={{ height: '34px', fontSize: '0.8rem' }}>
            <Download size={13} /> Export
          </button>

          <div style={{ flex: 1 }} />

          {/* Status filters */}
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {statusFilters.map(s => (
              <button
                key={s}
                className={`tab-item ${activeStatus === s ? 'active' : ''}`}
                onClick={() => setActiveStatus(s)}
                style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 0.75rem',
            height: '34px', borderRadius: '0.5rem', background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)', width: '200px',
          }}>
            <Search size={13} style={{ color: '#475569' }} />
            <input
              type="text"
              placeholder="Search docs..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '0.78rem', color: '#F1F5F9', width: '100%', fontFamily: 'inherit' }}
            />
          </div>
        </div>

        {/* Document List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table className="data-table" style={{ tableLayout: 'fixed' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#0A0F1E', zIndex: 1 }}>
              <tr>
                <th style={{ width: '35%' }}>Document</th>
                <th style={{ width: '15%' }}>Workspace</th>
                <th style={{ width: '8%' }}>Type</th>
                <th style={{ width: '8%' }}>Date</th>
                <th style={{ width: '6%' }}>Lang</th>
                <th style={{ width: '8%' }}>Status</th>
                <th style={{ width: '5%' }}>Pages</th>
                <th style={{ width: '5%' }}>Size</th>
                <th style={{ width: '10%' }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc) => (
                <tr
                  key={doc.id}
                  onClick={() => setSelectedDoc(selectedDoc === doc.id ? null : doc.id)}
                  style={{
                    cursor: 'pointer',
                    background: selectedDoc === doc.id ? 'rgba(0,212,255,0.05)' : 'transparent',
                  }}
                >
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <div style={{
                        padding: '0.375rem', borderRadius: '6px',
                        background: `${doc.typeColor}15`, color: doc.typeColor, flexShrink: 0,
                      }}>
                        <FileText size={13} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {doc.name}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#334155' }}>{doc.author}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.72rem', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                      {doc.workspace.split(' ').slice(0, 3).join(' ')}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.68rem', padding: '2px 5px', borderRadius: '3px', background: `${doc.typeColor}15`, color: doc.typeColor }}>
                      {doc.type}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.72rem' }}>{doc.date}</td>
                  <td>
                    <span style={{ fontSize: '0.7rem', color: '#38BDF8' }}>{doc.language}</span>
                  </td>
                  <td>
                    <span className={`status-${doc.status === 'Approved' ? 'approved' : doc.status === 'Under Review' ? 'review' : 'draft'}`} style={{ fontSize: '0.62rem' }}>
                      {doc.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.72rem' }}>{doc.pages}</td>
                  <td style={{ fontSize: '0.72rem' }}>{doc.size}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                      <button
                        onClick={() => navigate(`/documents/${doc.id}`)}
                        style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: '#475569', borderRadius: '4px', transition: 'color 0.15s' }}
                        title="Open"
                      >
                        <ExternalLink size={13} />
                      </button>
                      <button style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: '#475569', borderRadius: '4px' }} title="Download">
                        <Download size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: '#334155' }}>
                    No documents match your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right Preview Panel */}
      {selected && (
        <div style={{
          width: '280px', minWidth: '280px', borderLeft: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column', overflowY: 'auto', background: '#0D1527',
          padding: '1rem', animation: 'fadeIn 0.2s ease-out',
        }}>
          {/* Doc header */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{
              padding: '0.5rem', borderRadius: '8px', background: `${selected.typeColor}15`,
              color: selected.typeColor, display: 'inline-flex', marginBottom: '0.5rem',
            }}>
              <FileText size={18} />
            </div>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#F1F5F9', margin: 0, marginBottom: '0.25rem', lineHeight: 1.3 }}>
              {selected.name}
            </h3>
            <p style={{ fontSize: '0.72rem', color: '#475569', margin: 0 }}>{selected.workspace}</p>
          </div>

          {/* Meta */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '1rem', padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {[
              { label: 'Type', value: selected.type },
              { label: 'Author', value: selected.author },
              { label: 'Date', value: selected.date },
              { label: 'Pages', value: `${selected.pages} pages` },
              { label: 'Size', value: selected.size },
              { label: 'Language', value: selected.language },
            ].map(m => (
              <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.7rem', color: '#334155' }}>{m.label}</span>
                <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 500 }}>{m.value}</span>
              </div>
            ))}
          </div>

          {/* AI Summary */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.5rem' }}>
              <Sparkles size={13} style={{ color: '#8B5CF6' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8' }}>AI Summary</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#475569', lineHeight: 1.5, margin: 0 }}>{selected.summary}</p>
          </div>

          {/* Tags */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.72rem', color: '#334155', marginBottom: '0.375rem' }}>Tags</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
              {selected.tags.map(tag => (
                <span key={tag} style={{
                  fontSize: '0.68rem', padding: '2px 7px', borderRadius: '4px',
                  background: 'rgba(255,255,255,0.05)', color: '#94A3B8',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: 'auto' }}>
            <button className="btn-primary" style={{ fontSize: '0.78rem', justifyContent: 'center' }} onClick={() => navigate(`/documents/${selected.id}`)}>
              <Eye size={13} /> Open Document
            </button>
            <button className="btn-ai" style={{ fontSize: '0.78rem', justifyContent: 'center' }}>
              <Sparkles size={13} /> Generate Deliverables
            </button>
            <button className="btn-ghost" style={{ fontSize: '0.78rem', justifyContent: 'center' }}>
              <Download size={13} /> Download
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
