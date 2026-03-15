import { useState } from 'react';
import {
  Search, Eye, Plus, Star, FileText, BarChart3, Users,
  BookOpen, Table, AlertTriangle, CheckSquare, Globe
} from 'lucide-react';
import { templates } from '../data/mockData';

const filterTabs = ['All', 'BRD', 'FRD', 'Meetings', 'Reports', 'Procurement', 'Risk Register', 'User Stories', 'Bilingual'];

const iconMap: Record<string, React.ReactNode> = {
  FileText: <FileText size={20} />,
  FileCode: <FileText size={20} />,
  ClipboardList: <CheckSquare size={20} />,
  BarChart3: <BarChart3 size={20} />,
  Table: <Table size={20} />,
  AlertTriangle: <AlertTriangle size={20} />,
  BookOpen: <BookOpen size={20} />,
  Users: <Users size={20} />,
  GitCompare: <FileText size={20} />,
  TrendingUp: <BarChart3 size={20} />,
  CheckSquare: <CheckSquare size={20} />,
  Globe: <Globe size={20} />,
};

const categoryColors: Record<string, string> = {
  BRD: '#0EA5E9',
  FRD: '#8B5CF6',
  Meetings: '#10B981',
  Reports: '#F59E0B',
  Procurement: '#EF4444',
  'Risk Register': '#EF4444',
  'User Stories': '#06B6D4',
  Bilingual: '#EC4899',
};

const formatColors: Record<string, { bg: string; text: string }> = {
  Word: { bg: 'rgba(14,165,233,0.1)', text: '#38BDF8' },
  PDF: { bg: 'rgba(239,68,68,0.1)', text: '#FCA5A5' },
  Excel: { bg: 'rgba(16,185,129,0.1)', text: '#34D399' },
  PowerPoint: { bg: 'rgba(245,158,11,0.1)', text: '#FCD34D' },
};

export default function Templates() {
  const [activeFilter, setActiveFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [starred, setStarred] = useState<Set<string>>(new Set(templates.filter(t => t.featured).map(t => t.id)));

  const filtered = templates.filter(t => {
    const matchFilter = activeFilter === 'All' || t.category === activeFilter;
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const featured = templates.filter(t => t.featured);

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.875rem' }}>
        {[
          { label: 'Total Templates', value: templates.length, color: '#0EA5E9' },
          { label: 'Featured', value: templates.filter(t => t.featured).length, color: '#F59E0B' },
          { label: 'Bilingual Templates', value: templates.filter(t => t.languages.includes('AR')).length, color: '#10B981' },
          { label: 'Total Uses', value: templates.reduce((sum, t) => sum + t.usageCount, 0).toLocaleString(), color: '#8B5CF6' },
        ].map(s => (
          <div key={s.label} className="metric-card" style={{ padding: '1rem' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '2px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Featured Section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Star size={14} style={{ color: '#F59E0B', fill: '#F59E0B' }} />
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#F1F5F9' }}>Featured Templates</span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.875rem' }}>
          {featured.slice(0, 4).map(tpl => {
            const color = categoryColors[tpl.category] || '#0EA5E9';
            return (
              <div
                key={tpl.id}
                className="section-card"
                style={{ cursor: 'pointer', overflow: 'hidden', position: 'relative' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${color}30`; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
              >
                <div style={{ height: '3px', background: `linear-gradient(90deg, ${color}, transparent)` }} />
                <div style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <div style={{ padding: '0.625rem', borderRadius: '10px', background: `${color}18`, color: color }}>
                      {iconMap[tpl.icon] || <FileText size={20} />}
                    </div>
                    <Star size={14} style={{ color: '#F59E0B', fill: '#F59E0B' }} />
                  </div>
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#F1F5F9', margin: 0, marginBottom: '0.375rem', lineHeight: 1.3 }}>
                    {tpl.name}
                  </h3>
                  <p style={{ fontSize: '0.72rem', color: '#475569', margin: 0, marginBottom: '0.75rem', lineHeight: 1.5 }}>
                    {tpl.description.slice(0, 80)}...
                  </p>
                  <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                    {tpl.formats.map(fmt => (
                      <span key={fmt} style={{ fontSize: '0.62rem', padding: '1px 5px', borderRadius: '3px', background: formatColors[fmt]?.bg || 'rgba(255,255,255,0.05)', color: formatColors[fmt]?.text || '#94A3B8' }}>
                        {fmt}
                      </span>
                    ))}
                    {tpl.languages.map(lang => (
                      <span key={lang} style={{ fontSize: '0.62rem', padding: '1px 5px', borderRadius: '3px', background: lang === 'AR' ? 'rgba(139,92,246,0.1)' : 'rgba(14,165,233,0.08)', color: lang === 'AR' ? '#A78BFA' : '#38BDF8' }}>
                        {lang}
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn-ghost" style={{ flex: 1, height: '28px', fontSize: '0.72rem', justifyContent: 'center' }}>
                      <Eye size={11} /> Preview
                    </button>
                    <button className="btn-primary" style={{ flex: 1, height: '28px', fontSize: '0.72rem', justifyContent: 'center' }}>
                      Use
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter + Search */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(255,255,255,0.03)', padding: '0.25rem', borderRadius: '0.625rem', border: '1px solid rgba(255,255,255,0.06)', overflowX: 'auto' }}>
          {filterTabs.map(tab => (
            <button
              key={tab}
              className={`tab-item ${activeFilter === tab ? 'active' : ''}`}
              onClick={() => setActiveFilter(tab)}
              style={{ padding: '0.375rem 0.875rem', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
            >
              {tab}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 0.75rem', height: '34px', borderRadius: '0.5rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', width: '220px' }}>
            <Search size={13} style={{ color: '#475569' }} />
            <input
              type="text"
              placeholder="Search templates..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '0.78rem', color: '#F1F5F9', width: '100%', fontFamily: 'inherit' }}
            />
          </div>
          <button className="btn-ghost" style={{ height: '34px', fontSize: '0.8rem' }}>
            <Plus size={13} /> New Template
          </button>
        </div>
      </div>

      {/* All Templates Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.875rem' }}>
        {filtered.map(tpl => {
          const color = categoryColors[tpl.category] || '#0EA5E9';
          const isStarred = starred.has(tpl.id);
          return (
            <div
              key={tpl.id}
              className="section-card"
              style={{ cursor: 'pointer', overflow: 'hidden' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = `${color}25`}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'}
            >
              <div style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <div style={{ padding: '0.5rem', borderRadius: '8px', background: `${color}15`, color, flexShrink: 0 }}>
                      {iconMap[tpl.icon] || <FileText size={16} />}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#F1F5F9', margin: 0, marginBottom: '2px', lineHeight: 1.3 }}>{tpl.name}</h3>
                      <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '3px', background: `${color}12`, color, border: `1px solid ${color}20` }}>
                        {tpl.category}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setStarred(prev => {
                        const next = new Set(prev);
                        if (next.has(tpl.id)) next.delete(tpl.id);
                        else next.add(tpl.id);
                        return next;
                      });
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.125rem' }}
                  >
                    <Star size={13} style={{ color: isStarred ? '#F59E0B' : '#334155', fill: isStarred ? '#F59E0B' : 'none' }} />
                  </button>
                </div>

                <p style={{ fontSize: '0.75rem', color: '#475569', lineHeight: 1.5, margin: 0, marginBottom: '0.75rem' }}>
                  {tpl.description.slice(0, 90)}...
                </p>

                <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                  {tpl.formats.map(fmt => (
                    <span key={fmt} style={{ fontSize: '0.62rem', padding: '1px 5px', borderRadius: '3px', background: formatColors[fmt]?.bg || 'rgba(255,255,255,0.05)', color: formatColors[fmt]?.text || '#94A3B8' }}>
                      {fmt}
                    </span>
                  ))}
                  {tpl.languages.map(lang => (
                    <span key={lang} style={{ fontSize: '0.62rem', padding: '1px 5px', borderRadius: '3px', background: lang === 'AR' ? 'rgba(139,92,246,0.1)' : 'rgba(14,165,233,0.08)', color: lang === 'AR' ? '#A78BFA' : '#38BDF8' }}>
                      {lang}
                    </span>
                  ))}
                  <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: '#334155' }}>
                    {tpl.usageCount} uses
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn-ghost" style={{ flex: 1, height: '30px', fontSize: '0.75rem', justifyContent: 'center' }}>
                    <Eye size={12} /> Preview
                  </button>
                  <button className="btn-primary" style={{ flex: 1, height: '30px', fontSize: '0.75rem', justifyContent: 'center' }}>
                    Use Template
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
