import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Star, Play, Settings, TrendingUp, Clock, Zap, CheckCircle
} from 'lucide-react';
import { automations } from '../data/mockData';

const categories = ['All', 'BA & Requirements', 'Meetings', 'Product', 'Procurement', 'PMO', 'Reporting', 'Knowledge', 'Productivity'];

const categoryIcons: Record<string, string> = {
  'BA & Requirements': '📋',
  'Meetings': '🎥',
  'Product': '💻',
  'Procurement': '🏛️',
  'PMO': '📊',
  'Reporting': '📈',
  'Knowledge': '🧠',
  'Productivity': '⚡',
};

export default function Automations() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [starred, setStarred] = useState<Set<string>>(new Set(automations.filter(a => a.starred).map(a => a.id)));

  const filtered = automations.filter(a => {
    const matchCat = activeCategory === 'All' || a.category === activeCategory;
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const toggleStar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStarred(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.875rem' }}>
        {[
          { label: 'Total Automations', value: '14', icon: <Zap size={16} />, color: '#00D4FF' },
          { label: 'Runs This Month', value: '1,284', icon: <Play size={16} />, color: '#10B981' },
          { label: 'Success Rate', value: '96.8%', icon: <CheckCircle size={16} />, color: '#34D399' },
          { label: 'Hours Saved', value: '384 hrs', icon: <TrendingUp size={16} />, color: '#8B5CF6' },
        ].map(stat => (
          <div key={stat.label} className="metric-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.625rem', borderRadius: '8px', background: `${stat.color}15`, color: stat.color }}>
              {stat.icon}
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#F1F5F9' }}>{stat.value}</div>
              <div style={{ fontSize: '0.72rem', color: '#475569' }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        {/* Category Tabs */}
        <div style={{ display: 'flex', gap: '0.25rem', overflowX: 'auto', background: 'rgba(255,255,255,0.03)', padding: '0.25rem', borderRadius: '0.625rem', border: '1px solid rgba(255,255,255,0.06)' }}>
          {categories.map(cat => (
            <button
              key={cat}
              className={`tab-item ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
              style={{ padding: '0.375rem 0.875rem', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
            >
              {cat !== 'All' && <span style={{ marginRight: '0.375rem' }}>{categoryIcons[cat]}</span>}
              {cat}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 0.75rem', height: '36px', borderRadius: '0.5rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', minWidth: '240px' }}>
          <Search size={14} style={{ color: '#475569' }} />
          <input
            type="text"
            placeholder="Search automations..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '0.8rem', color: '#F1F5F9', width: '100%', fontFamily: 'inherit' }}
          />
        </div>
      </div>

      {/* Automation Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        {filtered.map(auto => (
          <div
            key={auto.id}
            className="section-card"
            style={{ cursor: 'pointer', overflow: 'hidden' }}
            onClick={() => navigate(`/automations/${auto.id}`)}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = `${auto.categoryColor}30`;
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)';
              (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLElement).style.boxShadow = 'none';
            }}
          >
            {/* Top color strip */}
            <div style={{ height: '3px', background: `linear-gradient(90deg, ${auto.categoryColor}, transparent)` }} />

            <div style={{ padding: '1.125rem' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flex: 1 }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '10px',
                    background: `${auto.categoryColor}18`,
                    border: `1px solid ${auto.categoryColor}25`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.25rem', flexShrink: 0,
                  }}>
                    {categoryIcons[auto.category] || '⚡'}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#F1F5F9', margin: 0, lineHeight: 1.3 }}>{auto.name}</h3>
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 600, padding: '1px 6px', borderRadius: '3px',
                      background: `${auto.categoryColor}15`, color: auto.categoryColor,
                      border: `1px solid ${auto.categoryColor}25`,
                    }}>
                      {auto.category}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => toggleStar(auto.id, e)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', flexShrink: 0 }}
                >
                  <Star size={15} style={{ color: starred.has(auto.id) ? '#F59E0B' : '#334155', fill: starred.has(auto.id) ? '#F59E0B' : 'none' }} />
                </button>
              </div>

              {/* Description */}
              <p style={{ fontSize: '0.78rem', color: '#475569', margin: '0 0 1rem', lineHeight: 1.5 }}>
                {auto.description.slice(0, 100)}...
              </p>

              {/* Input/Output Chips */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.25rem 0.5rem', borderRadius: '4px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: '0.6rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>IN</span>
                  <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{auto.inputType}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.25rem 0.5rem', borderRadius: '4px', background: `${auto.categoryColor}10`, border: `1px solid ${auto.categoryColor}20` }}>
                  <span style={{ fontSize: '0.6rem', color: auto.categoryColor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>OUT</span>
                  <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{auto.outputType}</span>
                </div>
              </div>

              {/* Stats Row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <Play size={11} style={{ color: '#475569' }} />
                  <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{auto.runCount.toLocaleString()} runs</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <Clock size={11} style={{ color: '#475569' }} />
                  <span style={{ fontSize: '0.72rem', color: '#475569' }}>{auto.lastRun}</span>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <div style={{ width: '24px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ width: `${auto.successRate}%`, height: '100%', background: '#10B981', borderRadius: '2px' }} />
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#34D399' }}>{auto.successRate}%</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.5rem' }} onClick={e => e.stopPropagation()}>
                <button
                  className="btn-primary"
                  style={{ flex: 1, height: '32px', fontSize: '0.78rem', justifyContent: 'center' }}
                  onClick={(e) => { e.stopPropagation(); navigate(`/automations/${auto.id}`); }}
                >
                  <Play size={12} /> Run Now
                </button>
                <button
                  className="btn-ghost"
                  style={{ height: '32px', fontSize: '0.78rem', padding: '0 0.75rem' }}
                  onClick={(e) => { e.stopPropagation(); navigate(`/automations/${auto.id}`); }}
                >
                  <Settings size={12} /> Configure
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
