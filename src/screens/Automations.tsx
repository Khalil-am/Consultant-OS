import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLayout } from '../hooks/useLayout';
import {
  Search, Star, Play, Settings2, TrendingUp, Clock, Zap, CheckCircle,
  ArrowRight, Loader2, ClipboardList, Video, Monitor, Building2,
  BarChart2, Brain, History, ClipboardCopy, Download, FileText,
} from 'lucide-react';
import { automations as initialAutomations } from '../data/mockData';
import { insertAutomationRun, insertActivity, getAutomationRuns } from '../lib/db';
import type { AutomationRunRow } from '../lib/db';

const categories = ['All', 'BA & Requirements', 'Meetings', 'Product', 'Procurement', 'PMO', 'Reporting', 'Knowledge', 'Productivity'];

function getCategoryIcon(cat: string, size = 14): React.ReactNode {
  const icons: Record<string, React.ReactElement> = {
    'BA & Requirements': <ClipboardList size={size} />,
    'Meetings':          <Video size={size} />,
    'Product':           <Monitor size={size} />,
    'Procurement':       <Building2 size={size} />,
    'PMO':               <BarChart2 size={size} />,
    'Reporting':         <TrendingUp size={size} />,
    'Knowledge':         <Brain size={size} />,
    'Productivity':      <Zap size={size} />,
  };
  return icons[cat] ?? <Zap size={size} />;
}

const categoryColors: Record<string, string> = {
  'BA & Requirements': '#0EA5E9',
  'Meetings':          '#8B5CF6',
  'Product':           '#10B981',
  'Procurement':       '#F59E0B',
  'PMO':               '#EC4899',
  'Reporting':         '#06B6D4',
  'Knowledge':         '#6366F1',
  'Productivity':      '#00D4FF',
};

export default function Automations() {
  const navigate = useNavigate();
  const { width, isMobile } = useLayout();
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [autoSort, setAutoSort] = useState<'name' | 'category' | 'success' | 'lastRun' | 'runCount' | 'status' | 'starred'>('name');
  const [automations, setAutomations] = useState(() => {
    try {
      const savedCounts = localStorage.getItem('automation_run_counts');
      if (savedCounts) {
        const counts = JSON.parse(savedCounts) as Record<string, number>;
        return initialAutomations.map(a => ({ ...a, runCount: counts[a.id] ?? a.runCount }));
      }
    } catch { /* ignore */ }
    return initialAutomations;
  });
  const [starred, setStarred] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('automation_starred');
      if (saved) return new Set(JSON.parse(saved) as string[]);
    } catch { /* ignore */ }
    return new Set(initialAutomations.filter(a => a.starred).map(a => a.id));
  });
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runTimer, setRunTimer] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [recentRuns, setRecentRuns] = useState<AutomationRunRow[]>([]);
  const [showRunHistory, setShowRunHistory] = useState(false);
  const [starredOnly, setStarredOnly] = useState(false);
  const [neverRunOnly, setNeverRunOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [highSuccessOnly, setHighSuccessOnly] = useState(false);
  const [minRunsFilter, setMinRunsFilter] = useState<0 | 1 | 5 | 10>(0);
  const [summaryCopied, setSummaryCopied] = useState(false);
  const [automationsCsvExported, setAutomationsCsvExported] = useState(false);
  const [automationsTxtExported, setAutomationsTxtExported] = useState(false);

  // Count-up timer while running
  useEffect(() => {
    if (runningId) {
      setRunTimer(0);
      timerRef.current = setInterval(() => setRunTimer(t => t + 1), 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    } else {
      setRunTimer(0);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [runningId]);

  // Load recent runs from DB on mount
  useEffect(() => {
    getAutomationRuns().then(runs => setRecentRuns(runs)).catch(() => {});
  }, []);

  const handleRun = useCallback((id: string) => {
    if (runningId) return;
    setRunningId(id);
    const startTime = Date.now();
    setTimeout(() => {
      const durationMs = Date.now() - startTime;
      setRunningId(null);
      setAutomations(prev => {
        const next = prev.map(a => a.id === id ? { ...a, runCount: a.runCount + 1 } : a);
        try {
          const counts: Record<string, number> = {};
          next.forEach(a => { counts[a.id] = a.runCount; });
          localStorage.setItem('automation_run_counts', JSON.stringify(counts));
        } catch { /* ignore */ }
        return next;
      });
      const name = automations.find(a => a.id === id)?.name ?? 'Automation';
      // Persist run record and activity to DB (best-effort)
      insertAutomationRun({
        id: `run-${Date.now()}`,
        automation_id: id,
        automation_name: name,
        status: 'success',
        duration_ms: durationMs,
        run_at: new Date().toISOString(),
      }).catch(() => {});
      insertActivity({
        id: `act-${Date.now()}`,
        user: 'System',
        action: 'ran automation',
        target: name,
        workspace: null,
        workspace_id: null,
        time: 'Just now',
        type: 'automation',
      }).catch(() => {});
      // Refresh run history
      getAutomationRuns().then(runs => setRecentRuns(runs)).catch(() => {});
      setToast(`${name} completed successfully`);
      setTimeout(() => setToast(null), 3000);
    }, 3000);
  }, [runningId, automations]);

  // Computed stats
  const totalAutomations = automations.length;
  const activeCount = automations.filter(a => a.status === 'Active').length;
  const totalRuns = automations.reduce((sum, a) => sum + a.runCount, 0);
  const avgSuccessRate = automations.length > 0
    ? (automations.reduce((sum, a) => sum + a.successRate, 0) / automations.length).toFixed(1)
    : '0';

  const filtered = (() => {
    const base = automations.filter(a => {
      const matchCat  = activeCategory === 'All' || a.category === activeCategory;
      const q = search.toLowerCase();
      const matchSearch = a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q);
      const matchStarred = !starredOnly || starred.has(a.id);
      const matchStatus = statusFilter === 'All' || a.status === statusFilter;
      const matchNeverRun = !neverRunOnly || (a.runCount ?? 0) === 0;
      const matchHighSuccess = !highSuccessOnly || (a.successRate ?? 0) >= 90;
      const matchMinRuns = (a.runCount ?? 0) >= minRunsFilter;
      return matchCat && matchSearch && matchStarred && matchStatus && matchNeverRun && matchHighSuccess && matchMinRuns;
    });
    if (autoSort === 'category') return [...base].sort((a, b) => a.category.localeCompare(b.category));
    if (autoSort === 'success') return [...base].sort((a, b) => (b.successRate ?? 0) - (a.successRate ?? 0));
    if (autoSort === 'runCount') return [...base].sort((a, b) => (b.runCount ?? 0) - (a.runCount ?? 0));
    if (autoSort === 'lastRun') return [...base].sort((a, b) => {
      const aRun = recentRuns.find(r => r.automation_id === a.id)?.run_at ?? '';
      const bRun = recentRuns.find(r => r.automation_id === b.id)?.run_at ?? '';
      return bRun.localeCompare(aRun);
    });
    if (autoSort === 'status') return [...base].sort((a, b) => (a.status ?? '').localeCompare(b.status ?? ''));
    if (autoSort === 'starred') return [...base].sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0));
    return [...base].sort((a, b) => a.name.localeCompare(b.name));
  })();

  function handleExportAutomationsCSV(automationsToExport: typeof filtered) {
    if (automationsToExport.length === 0) return;
    const headers = ['Name', 'Category', 'Status', 'Run Count', 'Success Rate', 'Last Run'];
    const rows = automationsToExport.map(a => [
      `"${a.name.replace(/"/g, '""')}"`,
      a.category,
      a.status,
      String(a.runCount),
      `${a.successRate}%`,
      `"${(a.lastRun ?? '').replace(/"/g, '""')}"`,
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `automations_export.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setAutomationsCsvExported(true);
    setTimeout(() => setAutomationsCsvExported(false), 2000);
  }

  function handleExportAutomationsTxt(automationsToExport: typeof filtered) {
    if (automationsToExport.length === 0) return;
    const lines = [
      `Automations Export – Consultant OS`,
      `Total: ${automationsToExport.length}`,
      '',
      ...automationsToExport.map(a => [
        `Name: ${a.name}`,
        `Category: ${a.category} | Status: ${a.status}`,
        `Runs: ${a.runCount} | Success Rate: ${a.successRate}%`,
        a.lastRun ? `Last Run: ${a.lastRun}` : null,
        '',
      ].filter(Boolean).join('\n')),
    ].join('\n');
    const blob = new Blob([lines], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `automations_export.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setAutomationsTxtExported(true);
    setTimeout(() => setAutomationsTxtExported(false), 2000);
  }

  function handleCopyAutomationSummary() {
    const lines = [
      `Automation Summary – Consultant OS`,
      `Total Automations: ${totalAutomations}`,
      `Active: ${activeCount}`,
      `Total Runs: ${totalRuns.toLocaleString()}`,
      `Avg Success Rate: ${avgSuccessRate}%`,
    ].join('\n');
    navigator.clipboard.writeText(lines).then(() => {
      setSummaryCopied(true);
      setTimeout(() => setSummaryCopied(false), 2000);
    }).catch(() => {});
  }

  const toggleStar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStarred(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem('automation_starred', JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  };

  const cols = width >= 1100 ? 3 : width >= 680 ? 2 : 1;

  return (
    <div style={{ padding: isMobile ? '1rem' : '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${width >= 640 ? 4 : 2}, 1fr)`, gap: '0.875rem' }}>
        {[
          { label: 'Total Automations', value: String(totalAutomations), icon: <Zap size={16} />,         color: '#00D4FF' },
          { label: 'Active',            value: String(activeCount),      icon: <Play size={16} />,        color: '#10B981' },
          { label: 'Total Runs',        value: totalRuns.toLocaleString(), icon: <CheckCircle size={16} />, color: '#34D399' },
          { label: 'Avg Success Rate',  value: `${avgSuccessRate}%`,     icon: <TrendingUp size={16} />,  color: '#8B5CF6' },
        ].map(stat => (
          <div key={stat.label} style={{
            display: 'flex', alignItems: 'center', gap: '1rem',
            padding: '1rem 1.125rem', borderRadius: '12px',
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '10px',
              background: `${stat.color}15`,
              border: `1px solid ${stat.color}25`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: stat.color, flexShrink: 0,
            }}>
              {stat.icon}
            </div>
            <div>
              <div style={{ fontSize: '1.375rem', fontWeight: 900, color: '#F1F5F9', lineHeight: 1, letterSpacing: '-0.025em' }}>
                {stat.value}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: '3px' }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar: Category Tabs + Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flexWrap: 'wrap' }}>
        {/* Category Tabs */}
        <div style={{
          display: 'flex', gap: '0.25rem', overflowX: 'auto', flex: 1,
          background: 'rgba(255,255,255,0.025)', padding: '0.25rem',
          borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)',
          scrollbarWidth: 'none',
        }}>
          {categories.map(cat => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                aria-label={`Category: ${cat}`}
                aria-pressed={isActive}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.35rem 0.75rem', borderRadius: '7px', border: 'none', cursor: 'pointer',
                  fontSize: '0.775rem', fontWeight: isActive ? 600 : 400, whiteSpace: 'nowrap',
                  fontFamily: 'inherit', transition: 'all 0.15s',
                  background: isActive ? 'rgba(0,212,255,0.12)' : 'transparent',
                  color: isActive ? '#00D4FF' : '#64748B',
                  outline: isActive ? '1px solid rgba(0,212,255,0.25)' : 'none',
                }}
              >
                {cat !== 'All' && <span style={{ display: 'flex', opacity: 0.8 }}>{getCategoryIcon(cat, 13)}</span>}
                {cat}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0 0.75rem', height: '36px', borderRadius: '8px',
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          minWidth: '200px',
        }}>
          <Search size={13} style={{ color: '#475569', flexShrink: 0 }} />
          <input
            type="text"
            aria-label="Search automations"
            placeholder="Search automations..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              fontSize: '0.8rem', color: '#F1F5F9', width: '100%', fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Sort */}
        <select
          aria-label="Sort automations"
          value={autoSort}
          onChange={e => setAutoSort(e.target.value as typeof autoSort)}
          style={{
            height: '36px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.78rem', color: '#94A3B8',
            paddingLeft: '0.5rem', paddingRight: '1.25rem', fontFamily: 'inherit', cursor: 'pointer',
          }}
        >
          <option value="name">Name</option>
          <option value="category">Category</option>
          <option value="success">Success Rate</option>
          <option value="lastRun">Last Run</option>
          <option value="runCount">Run Count</option>
          <option value="status">Status</option>
          <option value="starred">Starred First</option>
        </select>

        {/* Status quick filters */}
        {(['All', 'Active', 'Inactive'] as const).map(sf => (
          <button
            key={sf}
            onClick={() => setStatusFilter(sf)}
            aria-label={`Filter automations by status: ${sf}`}
            aria-pressed={statusFilter === sf}
            style={{
              padding: '0 0.75rem', height: '36px', borderRadius: '8px',
              border: statusFilter === sf ? '1px solid rgba(0,212,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
              background: statusFilter === sf ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.04)',
              color: statusFilter === sf ? '#00D4FF' : '#475569',
              cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: statusFilter === sf ? 700 : 500,
              transition: 'all 0.15s', flexShrink: 0, whiteSpace: 'nowrap',
            }}
          >
            {sf}
          </button>
        ))}

        {/* Starred Only Toggle */}
        <button
          onClick={() => setStarredOnly(v => !v)}
          aria-label="Starred Only"
          aria-pressed={starredOnly}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.35rem',
            padding: '0 0.75rem', height: '36px', borderRadius: '8px',
            border: starredOnly ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.08)',
            background: starredOnly ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.04)',
            color: starredOnly ? '#F59E0B' : '#475569',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 600,
            transition: 'all 0.15s', flexShrink: 0,
          }}
        >
          <Star size={13} style={{ fill: starredOnly ? '#F59E0B' : 'none', color: starredOnly ? '#F59E0B' : '#475569' }} />
          Starred
        </button>

        {/* Never Run Toggle */}
        <button
          onClick={() => setNeverRunOnly(v => !v)}
          aria-label="Never Run Only"
          aria-pressed={neverRunOnly}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.35rem',
            padding: '0 0.75rem', height: '36px', borderRadius: '8px',
            border: neverRunOnly ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.08)',
            background: neverRunOnly ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)',
            color: neverRunOnly ? '#FCA5A5' : '#475569',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 600,
            transition: 'all 0.15s', flexShrink: 0,
          }}
        >
          <History size={13} /> Never Run
        </button>

        {/* Min Runs Filter */}
        <select
          aria-label="Minimum runs filter"
          value={minRunsFilter}
          onChange={e => setMinRunsFilter(Number(e.target.value) as 0 | 1 | 5 | 10)}
          style={{ height: '36px', fontSize: '0.78rem', padding: '0 0.625rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#CBD5E1', fontFamily: 'inherit', cursor: 'pointer', outline: 'none', minWidth: 100 }}
        >
          <option value={0}>Any Runs</option>
          <option value={1}>1+ Runs</option>
          <option value={5}>5+ Runs</option>
          <option value={10}>10+ Runs</option>
        </select>

        {/* High Success Toggle */}
        <button
          onClick={() => setHighSuccessOnly(v => !v)}
          aria-label="High Success Only"
          aria-pressed={highSuccessOnly}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.35rem',
            padding: '0 0.75rem', height: '36px', borderRadius: '8px',
            border: highSuccessOnly ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(255,255,255,0.08)',
            background: highSuccessOnly ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
            color: highSuccessOnly ? '#34D399' : '#475569',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 600,
            transition: 'all 0.15s', flexShrink: 0,
          }}
        >
          ✓ High Success
        </button>

        {/* Export CSV */}
        <button
          onClick={() => handleExportAutomationsCSV(filtered)}
          disabled={filtered.length === 0}
          aria-label="Export automations to CSV"
          style={{
            display: 'flex', alignItems: 'center', gap: '0.35rem',
            padding: '0 0.75rem', height: '36px', borderRadius: '8px',
            border: automationsCsvExported ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(255,255,255,0.08)',
            background: automationsCsvExported ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
            color: automationsCsvExported ? '#10B981' : '#475569',
            cursor: filtered.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 600,
            transition: 'all 0.15s', flexShrink: 0,
          }}
        >
          <Download size={13} /> {automationsCsvExported ? 'Exported!' : 'Export CSV'}
        </button>

        {/* Export TXT */}
        <button
          onClick={() => handleExportAutomationsTxt(filtered)}
          disabled={filtered.length === 0}
          aria-label="Export automations to TXT"
          style={{
            display: 'flex', alignItems: 'center', gap: '0.35rem',
            padding: '0 0.75rem', height: '36px', borderRadius: '8px',
            border: automationsTxtExported ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(255,255,255,0.08)',
            background: automationsTxtExported ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
            color: automationsTxtExported ? '#10B981' : '#475569',
            cursor: filtered.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 600,
            transition: 'all 0.15s', flexShrink: 0,
          }}
        >
          <FileText size={13} /> {automationsTxtExported ? 'Exported!' : 'Export TXT'}
        </button>

        {/* Copy Summary */}
        <button
          onClick={handleCopyAutomationSummary}
          aria-label="Copy automation summary to clipboard"
          style={{
            display: 'flex', alignItems: 'center', gap: '0.35rem',
            padding: '0 0.75rem', height: '36px', borderRadius: '8px',
            border: summaryCopied ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(255,255,255,0.08)',
            background: summaryCopied ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
            color: summaryCopied ? '#10B981' : '#475569',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 600,
            transition: 'all 0.15s', flexShrink: 0,
          }}
        >
          <ClipboardCopy size={13} /> {summaryCopied ? 'Copied!' : 'Summary'}
        </button>
      </div>

      {/* Automation Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '0.875rem' }}>
        {filtered.map(auto => {
          const isRunning = runningId === auto.id;
          const isStarred = starred.has(auto.id);
          const catColor  = categoryColors[auto.category] ?? auto.categoryColor ?? '#00D4FF';

          return (
            <div
              key={auto.id}
              onClick={() => auto.id === 'auto-001' ? navigate('/automations/brd/run') : navigate(`/automations/${auto.id}`)}
              style={{
                borderRadius: '14px', cursor: 'pointer', overflow: 'hidden',
                background: isRunning
                  ? 'linear-gradient(145deg, rgba(0,212,255,0.06) 0%, rgba(8,12,24,0.95) 60%)'
                  : 'rgba(255,255,255,0.025)',
                border: isRunning
                  ? '1px solid rgba(0,212,255,0.25)'
                  : '1px solid rgba(255,255,255,0.06)',
                transition: 'all 0.2s ease',
                display: 'flex', flexDirection: 'column',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = `${catColor}30`;
                el.style.transform = 'translateY(-2px)';
                el.style.boxShadow = `0 8px 28px rgba(0,0,0,0.3), 0 0 0 1px ${catColor}15`;
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = isRunning ? 'rgba(0,212,255,0.25)' : 'rgba(255,255,255,0.06)';
                el.style.transform = 'translateY(0)';
                el.style.boxShadow = 'none';
              }}
            >
              <div style={{ padding: '1.125rem', flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>

                {/* Card Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                    {/* Icon */}
                    <div style={{
                      width: 44, height: 44, borderRadius: '12px', flexShrink: 0,
                      background: `${catColor}18`, border: `1px solid ${catColor}28`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.3rem',
                    }}>
                      <span style={{ display: 'flex', color: catColor }}>
                        {getCategoryIcon(auto.category, 20)}
                      </span>
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#F1F5F9', margin: '0 0 4px', lineHeight: 1.3, }}>
                        {auto.name}
                      </h3>
                      {/* Category Badge */}
                      <span style={{
                        fontSize: '0.65rem', fontWeight: 600, padding: '2px 7px', borderRadius: '4px',
                        background: `${catColor}15`, color: catColor, border: `1px solid ${catColor}25`,
                        letterSpacing: '0.01em',
                      }}>
                        {auto.category}
                      </span>
                    </div>
                  </div>
                  {/* Star */}
                  <button
                    onClick={e => toggleStar(auto.id, e)}
                    aria-label={`Star ${auto.name}`}
                    aria-pressed={isStarred}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', flexShrink: 0 }}
                  >
                    <Star size={15} style={{ color: isStarred ? '#F59E0B' : '#334155', fill: isStarred ? '#F59E0B' : 'none', transition: 'all 0.15s' }} />
                  </button>
                </div>

                {/* Description */}
                <p style={{ fontSize: '0.78rem', color: '#475569', margin: '0 0 0.875rem', lineHeight: 1.55, flex: 1 }}>
                  {auto.description.length > 110 ? auto.description.slice(0, 110) + '…' : auto.description}
                </p>

                {/* IN → OUT */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.375rem',
                    padding: '3px 8px', borderRadius: '5px',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                  }}>
                    <span style={{ fontSize: '0.6rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>IN</span>
                    <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{auto.inputType}</span>
                  </div>
                  <ArrowRight size={12} style={{ color: '#334155', flexShrink: 0 }} />
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.375rem',
                    padding: '3px 8px', borderRadius: '5px',
                    background: `${catColor}0E`, border: `1px solid ${catColor}20`,
                  }}>
                    <span style={{ fontSize: '0.6rem', color: catColor, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>OUT</span>
                    <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{auto.outputType}</span>
                  </div>
                </div>

                {/* Running progress bar (only for active running card) */}
                {isRunning && (
                  <div style={{ marginBottom: '0.875rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span style={{ fontSize: '0.7rem', color: '#00D4FF', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> Processing… {runTimer}s
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#475569' }}>Est. {Math.max(0, 3 - runTimer)}s remaining</span>
                    </div>
                    <div style={{ height: '4px', borderRadius: '9999px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, (runTimer / 3) * 100)}%`, height: '100%', borderRadius: '9999px', background: 'linear-gradient(90deg, #00D4FF, #0EA5E9)', boxShadow: '0 0 8px rgba(0,212,255,0.5)', transition: 'width 1s linear' }} />
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#475569', marginTop: '3px' }}>{Math.min(100, Math.round((runTimer / 3) * 100))}%</div>
                  </div>
                )}

                {/* Last run + success rate */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', paddingTop: '0.625rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <Clock size={11} style={{ color: '#334155' }} />
                    <span style={{ fontSize: '0.72rem', color: '#475569' }}>Last run: {auto.lastRun}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '9999px', background: '#10B981', boxShadow: '0 0 5px rgba(16,185,129,0.6)' }} />
                    <span style={{ fontSize: '0.72rem', color: '#34D399', fontWeight: 600 }}>{auto.successRate}%</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '0.5rem' }} onClick={e => e.stopPropagation()}>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handleRun(auto.id);
                    }}
                    aria-label={`Run Now: ${auto.name}`}
                    disabled={!!runningId}
                    style={{
                      flex: 1, height: '34px', borderRadius: '8px', border: 'none', cursor: runningId ? 'default' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
                      fontSize: '0.8rem', fontWeight: 600, fontFamily: 'inherit',
                      opacity: runningId && !isRunning ? 0.5 : 1,
                      background: isRunning
                        ? 'rgba(0,212,255,0.1)'
                        : 'linear-gradient(135deg, #00D4FF 0%, #0EA5E9 100%)',
                      color: isRunning ? '#00D4FF' : '#060C1A',
                      boxShadow: isRunning ? 'none' : '0 2px 12px rgba(0,212,255,0.3)',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => {
                      if (!runningId) (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,212,255,0.5)';
                    }}
                    onMouseLeave={e => {
                      if (!runningId) (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,212,255,0.3)';
                    }}
                  >
                    {isRunning
                      ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Running</>
                      : <><Play size={13} /> Run Now</>
                    }
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); navigate(`/automations/${auto.id}`); }}
                    aria-label={`Settings for ${auto.name}`}
                    style={{
                      width: '34px', height: '34px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(255,255,255,0.04)', color: '#475569', flexShrink: 0, fontFamily: 'inherit',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
                      (e.currentTarget as HTMLElement).style.color = '#94A3B8';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                      (e.currentTarget as HTMLElement).style.color = '#475569';
                    }}
                  >
                    <Settings2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Runs History */}
      {recentRuns.length > 0 && (
        <div style={{ borderRadius: '12px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <button
            onClick={() => setShowRunHistory(v => !v)}
            aria-label="Toggle Recent Runs"
            aria-expanded={showRunHistory}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1.125rem', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontFamily: 'inherit' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', fontWeight: 600 }}>
              <History size={14} style={{ color: '#475569' }} />
              Recent Runs
              <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(0,212,255,0.1)', color: '#00D4FF', border: '1px solid rgba(0,212,255,0.2)' }}>{recentRuns.length}</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: '#334155' }}>{showRunHistory ? '▲ Collapse' : '▼ Expand'}</span>
          </button>
          {showRunHistory && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              {recentRuns.slice(0, 10).map((run, i) => (
                <div key={run.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 1.125rem', borderBottom: i < Math.min(recentRuns.length, 10) - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: run.status === 'success' ? '#10B981' : run.status === 'failed' ? '#EF4444' : '#F59E0B', boxShadow: `0 0 5px ${run.status === 'success' ? 'rgba(16,185,129,0.5)' : run.status === 'failed' ? 'rgba(239,68,68,0.5)' : 'rgba(245,158,11,0.5)'}` }} />
                  <span style={{ fontSize: '0.78rem', color: '#94A3B8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{run.automation_name}</span>
                  {run.duration_ms != null && (
                    <span style={{ fontSize: '0.68rem', color: '#475569' }}>{run.duration_ms >= 1000 ? `${(run.duration_ms / 1000).toFixed(1)}s` : `${run.duration_ms}ms`}</span>
                  )}
                  <span style={{ fontSize: '0.68rem', color: '#334155' }}>{new Date(run.run_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Success Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 999,
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.875rem 1.25rem', borderRadius: '10px',
          background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
          color: '#34D399', fontSize: '0.82rem', fontWeight: 600,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          animation: 'fadeSlideUp 0.3s ease',
        }}>
          <CheckCircle size={16} /> {toast}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
