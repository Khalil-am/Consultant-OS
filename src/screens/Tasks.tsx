import { useState, useMemo, useEffect, useCallback } from 'react';
import { useLayout } from '../hooks/useLayout';
import {
  Search, ExternalLink, RefreshCw, Filter, CheckSquare,
  Clock, MessageSquare, Paperclip, DollarSign, User, AlertTriangle,
  ChevronDown, TrendingUp, X, BarChart2,
} from 'lucide-react';
import { BA_CARDS, BA_LISTS } from '../data/baTraffic';
import { fetchBATrafficBoard } from '../lib/trello';
import type { BACard } from '../lib/trello';

// ── Constants ─────────────────────────────────────────────────

const LIST_META: Record<string, { color: string; track: string; dot: string }> = {
  'In Progress':              { color: '#0EA5E9', track: 'rgba(14,165,233,0.12)',  dot: '#38BDF8' },
  'Documentation':            { color: '#8B5CF6', track: 'rgba(139,92,246,0.12)', dot: '#A78BFA' },
  'Design':                   { color: '#EC4899', track: 'rgba(236,72,153,0.12)', dot: '#F472B6' },
  'Ready For Configuration':  { color: '#10B981', track: 'rgba(16,185,129,0.12)', dot: '#34D399' },
  'Pending Client(Delivery)': { color: '#F59E0B', track: 'rgba(245,158,11,0.12)', dot: '#FCD34D' },
  "Next Week's Traffic":      { color: '#00D4FF', track: 'rgba(0,212,255,0.1)',   dot: '#00D4FF' },
  'Backlog':                  { color: '#475569', track: 'rgba(71,85,105,0.15)',   dot: '#94A3B8' },
  'On Hold':                  { color: '#EF4444', track: 'rgba(239,68,68,0.12)',   dot: '#FCA5A5' },
  'Done (Business)':          { color: '#10B981', track: 'rgba(16,185,129,0.08)', dot: '#34D399' },
};

const PRIORITY_META: Record<string, { color: string; bg: string; border: string; rank: number }> = {
  'Highest': { color: '#FCA5A5', bg: 'rgba(239,68,68,0.14)',  border: 'rgba(239,68,68,0.3)',   rank: 5 },
  'High':    { color: '#FCD34D', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.28)', rank: 4 },
  'Medium':  { color: '#38BDF8', bg: 'rgba(14,165,233,0.1)',  border: 'rgba(14,165,233,0.22)', rank: 3 },
  'Low':     { color: '#34D399', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.22)', rank: 2 },
  'Lowest':  { color: '#94A3B8', bg: 'rgba(71,85,105,0.1)',   border: 'rgba(71,85,105,0.2)',   rank: 1 },
};

const PRODUCT_META: Record<string, { color: string; bg: string; border: string }> = {
  'P+':      { color: '#93C5FD', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.25)' },
  'S+':      { color: '#C4B5FD', bg: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.25)' },
  'Meeting': { color: '#CBD5E1', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.22)' },
};

const DONE_LIST = 'Done (Business)';

function isOverdue(card: BACard): boolean {
  if (!card.dueDate || card.dueComplete) return false;
  return new Date(card.dueDate) < new Date();
}

function fmtDate(d: string): string {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

function memberInitials(m: string): string {
  // trello username → initials
  const map: Record<string, string> = {
    khalil_mushref: 'KM', khaldounalhaj2: 'KH', aalkayyali3: 'AA', hibataha4: 'HT',
    abdulazizalftaieh1: 'AZ', walaalsayed: 'WA', salehalmufadhi: 'SA', ranarahhal: 'RR',
  };
  return map[m] || m.slice(0, 2).toUpperCase();
}

// ── Sub-components ────────────────────────────────────────────

function PriorityBadge({ p }: { p: string }) {
  if (!p) return null;
  const m = PRIORITY_META[p] || PRIORITY_META.Medium;
  return (
    <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: '9999px', background: m.bg, color: m.color, border: `1px solid ${m.border}`, whiteSpace: 'nowrap' }}>
      {p}
    </span>
  );
}

function ProductBadge({ p }: { p: string }) {
  const m = PRODUCT_META[p] || PRODUCT_META['P+'];
  return (
    <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', background: m.bg, color: m.color, border: `1px solid ${m.border}` }}>
      {p}
    </span>
  );
}

function BACardTile({ card, compact }: { card: BACard; compact?: boolean }) {
  const lm = LIST_META[card.listName] || LIST_META['Backlog'];
  const overdue = isOverdue(card);

  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
      borderLeft: `3px solid ${lm.color}`,
      borderRadius: '8px', padding: compact ? '0.625rem' : '0.75rem',
      transition: 'box-shadow 0.15s, border-color 0.15s', cursor: 'default',
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 20px rgba(0,0,0,0.35)`; (e.currentTarget as HTMLElement).style.borderColor = lm.color; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}
    >
      {/* Top row: client + products */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.45rem', flexWrap: 'wrap' }}>
        {card.client && (
          <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '1px 6px', borderRadius: '3px', background: 'rgba(0,212,255,0.1)', color: '#00D4FF', border: '1px solid rgba(0,212,255,0.2)', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {card.client}
          </span>
        )}
        {card.products.map(p => <ProductBadge key={p} p={p} />)}
        {card.relatedToPayment && (
          <span style={{ fontSize: '0.58rem', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: 'rgba(16,185,129,0.1)', color: '#34D399', border: '1px solid rgba(16,185,129,0.22)', display: 'flex', alignItems: 'center', gap: '2px' }}>
            <DollarSign size={7} />PAY
          </span>
        )}
      </div>

      {/* Card name */}
      <div style={{ fontSize: compact ? '0.75rem' : '0.78rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: '0.5rem' }}>
        {card.name.slice(0, compact ? 60 : 80)}{card.name.length > (compact ? 60 : 80) ? '…' : ''}
      </div>

      {/* Priority + PM row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.45rem', flexWrap: 'wrap' }}>
        {card.priority && <PriorityBadge p={card.priority} />}
        {card.pm && (
          <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '2px' }}>
            <User size={9} />{card.pm.split(' ').slice(-1)[0]}
          </span>
        )}
        {card.estimation && (
          <span style={{ fontSize: '0.62rem', color: 'var(--text-faint)', marginLeft: 'auto' }}>
            {card.estimation}h
          </span>
        )}
      </div>

      {/* Footer: due date + meta */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.35rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {card.dueDate && (
            <span style={{ fontSize: '0.63rem', display: 'flex', alignItems: 'center', gap: '2px', color: overdue ? '#FCA5A5' : card.dueComplete ? '#34D399' : 'var(--text-muted)', fontWeight: overdue ? 700 : 400 }}>
              <Clock size={9} style={{ color: overdue ? '#EF4444' : card.dueComplete ? '#10B981' : 'var(--text-faint)' }} />
              {fmtDate(card.dueDate)}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {card.commentCount > 0 && (
            <span style={{ fontSize: '0.6rem', color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: '2px' }}>
              <MessageSquare size={8} />{card.commentCount}
            </span>
          )}
          {card.attachmentCount > 0 && (
            <span style={{ fontSize: '0.6rem', color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: '2px' }}>
              <Paperclip size={8} />{card.attachmentCount}
            </span>
          )}
          {card.checklistTotal > 0 && (
            <span style={{ fontSize: '0.6rem', color: card.checklistDone === card.checklistTotal ? '#34D399' : 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: '2px' }}>
              <CheckSquare size={8} />{card.checklistDone}/{card.checklistTotal}
            </span>
          )}
          <a href={card.url} target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--text-faint)', display: 'flex', alignItems: 'center' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#38BDF8')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-faint)')}
            onClick={e => e.stopPropagation()}>
            <ExternalLink size={10} />
          </a>
        </div>
      </div>

      {/* Delivery date if different from due */}
      {card.deliveryDate && card.deliveryDate !== card.dueDate && (
        <div style={{ marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.6rem', color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: '2px' }}>
          <TrendingUp size={8} />Plan Delivery: {fmtDate(card.deliveryDate)}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────

export default function Tasks() {
  const { width } = useLayout();
  const [search, setSearch] = useState('');
  const [activeList, setActiveList] = useState<string>('All Active');
  const [filterPM, setFilterPM] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [showFilters, setShowFilters] = useState(false);

  // Live Trello state
  const [cards, setCards] = useState<BACard[]>(BA_CARDS);
  const [trelloLists, setTrelloLists] = useState<string[]>(BA_LISTS);
  const [loading, setLoading] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [lastSync, setLastSync] = useState('Loading from Trello…');

  const sync = useCallback(async () => {
    setLoading(true);
    setSyncError('');
    try {
      const data = await fetchBATrafficBoard();
      setCards(data.cards);
      // Derive unique list names in order from live data
      const seen = new Set<string>();
      const liveLists: string[] = [];
      for (const l of data.lists) {
        if (!seen.has(l.name)) { seen.add(l.name); liveLists.push(l.name); }
      }
      setTrelloLists(liveLists);
      const now = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
      setLastSync(`Live · synced ${now}`);
    } catch (e) {
      setSyncError((e as Error).message ?? 'Trello sync failed');
      setLastSync('Trello unavailable · using CSV snapshot');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { sync(); }, [sync]);

  const activeLists = useMemo(() => trelloLists.filter(l => l !== DONE_LIST), [trelloLists]);

  const activeCards = useMemo(() => cards.filter(c => c.listName !== DONE_LIST), [cards]);
  const doneCards = useMemo(() => cards.filter(c => c.listName === DONE_LIST), [cards]);

  const ALL_PMS = useMemo(() => Array.from(new Set(activeCards.map(c => c.pm).filter(Boolean))).sort(), [activeCards]);
  const ALL_CLIENTS = useMemo(() => Array.from(new Set(cards.map(c => c.client).filter(Boolean))).sort(), [cards]);

  const filtered = useMemo(() => {
    const pool = showDone ? doneCards : activeCards;
    return pool.filter(c => {
      if (activeList !== 'All Active' && activeList !== 'All Done' && c.listName !== activeList) return false;
      if (filterPM && c.pm !== filterPM) return false;
      if (filterPriority && c.priority !== filterPriority) return false;
      if (filterClient && c.client !== filterClient) return false;
      if (search) {
        const q = search.toLowerCase();
        return c.name.toLowerCase().includes(q) || (c.client ?? '').toLowerCase().includes(q) || (c.pm ?? '').toLowerCase().includes(q) || (c.desc ?? '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [activeCards, doneCards, showDone, activeList, filterPM, filterPriority, filterClient, search]);

  // Stats
  const inProgressCount = activeCards.filter(c => c.listName === 'In Progress').length;
  const pendingDelivery = activeCards.filter(c => c.listName === 'Pending Client(Delivery)').length;
  const highestCount = activeCards.filter(c => c.priority === 'Highest').length;
  const overdueCount = activeCards.filter(c => isOverdue(c)).length;
  const totalHours = activeCards.reduce((s, c) => s + (parseFloat(c.estimation) || 0), 0);
  const paymentCards = activeCards.filter(c => c.relatedToPayment).length;

  const hasActiveFilter = filterPM || filterPriority || filterClient;

  return (
    <div className="screen-container animate-fade-in">

      {/* Stats Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${width >= 1024 ? 6 : width >= 768 ? 3 : 2}, 1fr)`, gap: '0.75rem' }}>
        {[
          { label: 'Active Cards',       value: activeCards.length, color: '#0EA5E9', sub: `${doneCards.length} done` },
          { label: 'In Progress',        value: inProgressCount,    color: '#00D4FF', sub: 'being worked on' },
          { label: 'Pending Delivery',   value: pendingDelivery,    color: '#F59E0B', sub: 'awaiting client' },
          { label: 'Highest Priority',   value: highestCount,       color: '#EF4444', sub: `${overdueCount} overdue` },
          { label: 'Est. Hours',         value: Math.round(totalHours), color: '#8B5CF6', sub: 'remaining work' },
          { label: 'Payment Linked',     value: paymentCards,       color: '#10B981', sub: 'billable cards' },
        ].map(s => (
          <div key={s.label} className="metric-card" style={{ position: 'relative', overflow: 'hidden', padding: '0.875rem' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${s.color}, transparent)` }} />
            <div className="hero-number" style={{ color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', marginTop: '2px' }}>{s.label}</div>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-faint)', marginTop: '1px' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Board Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0,82,204,0.08), var(--bg-elevated) 60%, rgba(0,212,255,0.05))',
        border: '1px solid rgba(0,121,191,0.18)', borderRadius: 'var(--radius-lg)',
        padding: '1rem 1.25rem', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #0052CC, #0079BF 60%, transparent)' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <div style={{ width: '38px', height: '38px', background: 'rgba(0,82,204,0.15)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(0,82,204,0.28)' }}>
              <svg viewBox="0 0 32 32" width="20" height="20" fill="none"><rect x="2" y="2" width="12" height="28" rx="3" fill="#0052CC"/><rect x="18" y="2" width="12" height="18" rx="3" fill="#0079BF"/></svg>
            </div>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>BA Traffic Board</div>
              <div style={{ fontSize: '0.67rem', color: syncError ? '#FCA5A5' : 'var(--text-faint)', marginTop: '1px', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <RefreshCw size={9} className={loading ? 'animate-spin' : ''} />
                {lastSync}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              className="btn-ghost"
              style={{ height: '32px', fontSize: '0.75rem' }}
              onClick={sync}
              disabled={loading}
              title="Sync from Trello">
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Syncing…' : 'Sync'}
            </button>
            <button
              className={`btn-ghost`}
              style={{ height: '32px', fontSize: '0.75rem', background: showDone ? 'rgba(16,185,129,0.1)' : undefined, color: showDone ? '#34D399' : undefined, border: showDone ? '1px solid rgba(16,185,129,0.22)' : undefined }}
              onClick={() => { setShowDone(d => !d); setActiveList(showDone ? 'All Active' : 'All Done'); }}>
              <CheckSquare size={12} /> {showDone ? 'Show Active' : `Done (${doneCards.length})`}
            </button>
            <button className={`btn-ghost ${viewMode === 'kanban' ? 'active' : ''}`} style={{ height: '32px', fontSize: '0.75rem' }} onClick={() => setViewMode('kanban')}>
              <BarChart2 size={12} /> Kanban
            </button>
            <button className={`btn-ghost ${viewMode === 'list' ? 'active' : ''}`} style={{ height: '32px', fontSize: '0.75rem' }} onClick={() => setViewMode('list')}>
              <Filter size={12} /> List
            </button>
          </div>
        </div>

        {/* PM Distribution mini */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.875rem', flexWrap: 'wrap' }}>
          {ALL_PMS.map(pm => {
            const cnt = activeCards.filter(c => c.pm === pm).length;
            if (!cnt) return null;
            return (
              <button key={pm} onClick={() => setFilterPM(filterPM === pm ? '' : pm)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '3px 8px', borderRadius: '9999px', border: `1px solid ${filterPM === pm ? 'rgba(0,212,255,0.4)' : 'var(--border-subtle)'}`, background: filterPM === pm ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.03)', cursor: 'pointer', transition: 'all 0.15s' }}>
                <div className="avatar" style={{ width: '18px', height: '18px', fontSize: '0.5rem', flexShrink: 0 }}>{pm.split(' ').map(w => w[0]).join('').slice(0, 2)}</div>
                <span style={{ fontSize: '0.67rem', fontWeight: 600, color: filterPM === pm ? '#00D4FF' : 'var(--text-secondary)' }}>{pm.split(' ')[0]}</span>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-faint)' }}>{cnt}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={12} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input className="input-field" placeholder="Search cards, client, PM…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: '2.25rem', height: '34px', fontSize: '0.78rem', width: '100%' }} />
          {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}><X size={12} /></button>}
        </div>

        {/* List filter tabs */}
        <div style={{ display: 'flex', gap: '0.2rem', background: 'rgba(255,255,255,0.03)', padding: '0.2rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', overflowX: 'auto', maxWidth: '100%' }}>
          {(showDone ? ['All Done'] : ['All Active', ...activeLists]).map(list => {
            const lm = LIST_META[list];
            const cnt = list === 'All Active' ? activeCards.length : list === 'All Done' ? doneCards.length : cards.filter(c => c.listName === list).length;
            return (
              <button key={list} onClick={() => setActiveList(list)}
                style={{ padding: '0.25rem 0.625rem', fontSize: '0.7rem', fontWeight: 600, borderRadius: '5px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
                  background: activeList === list ? (lm ? `${lm.color}18` : 'rgba(255,255,255,0.08)') : 'transparent',
                  color: activeList === list ? (lm ? lm.color : 'var(--text-primary)') : 'var(--text-muted)',
                }}>
                {list === 'All Active' ? 'All' : list === 'All Done' ? 'All Done' : list} <span style={{ opacity: 0.65 }}>({cnt})</span>
              </button>
            );
          })}
        </div>

        {/* Extra filters toggle */}
        <button className={`btn-ghost ${hasActiveFilter ? 'active' : ''}`} style={{ height: '34px', fontSize: '0.75rem', flexShrink: 0, background: hasActiveFilter ? 'rgba(14,165,233,0.1)' : undefined, color: hasActiveFilter ? '#38BDF8' : undefined }} onClick={() => setShowFilters(s => !s)}>
          <Filter size={12} /> Filters {hasActiveFilter && <span style={{ fontSize: '0.6rem', background: '#38BDF8', color: '#000', borderRadius: '9999px', padding: '0 4px', fontWeight: 800 }}>{[filterPM, filterPriority, filterClient].filter(Boolean).length}</span>}
          <ChevronDown size={10} style={{ transform: showFilters ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
      </div>

      {/* Extended filter row */}
      {showFilters && (
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem' }} className="animate-fade-in">
          <div>
            <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.3rem' }}>Priority</label>
            <select className="input-field" value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={{ height: '30px', fontSize: '0.75rem', minWidth: '120px' }}>
              <option value="">All</option>
              {['Highest', 'High', 'Medium', 'Low', 'Lowest'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.3rem' }}>Client</label>
            <select className="input-field" value={filterClient} onChange={e => setFilterClient(e.target.value)} style={{ height: '30px', fontSize: '0.75rem', minWidth: '140px' }}>
              <option value="">All Clients</option>
              {ALL_CLIENTS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {(filterPM || filterPriority || filterClient) && (
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="btn-ghost" style={{ height: '30px', fontSize: '0.72rem' }} onClick={() => { setFilterPM(''); setFilterPriority(''); setFilterClient(''); }}>
                <X size={11} /> Clear all
              </button>
            </div>
          )}
        </div>
      )}

      {/* Results count */}
      <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        Showing <strong style={{ color: 'var(--text-secondary)' }}>{filtered.length}</strong> cards
        {(search || hasActiveFilter) && <span>· filtered</span>}
        {filtered.length > 0 && <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><AlertTriangle size={10} style={{ color: '#EF4444' }} />{filtered.filter(isOverdue).length} overdue</span>}
      </div>

      {/* ── KANBAN VIEW ── */}
      {viewMode === 'kanban' && !showDone && (
        <div style={{ overflowX: 'auto', paddingBottom: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', minWidth: 'max-content' }}>
            {activeLists.filter(list => activeList === 'All Active' || list === activeList).map(list => {
              const lm = LIST_META[list] || LIST_META['Backlog'];
              const colCards = filtered.filter(c => c.listName === list);
              return (
                <div key={list} style={{ width: '248px', flexShrink: 0 }}>
                  {/* Column header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.625rem', padding: '0 0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: lm.color, boxShadow: `0 0 6px ${lm.color}80` }} />
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{list}</span>
                    </div>
                    <span style={{ fontSize: '0.63rem', fontWeight: 800, padding: '1px 6px', borderRadius: '9999px', background: `${lm.color}18`, color: lm.color, border: `1px solid ${lm.color}30` }}>{colCards.length}</span>
                  </div>

                  {/* Column track */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: '100px', padding: '0.5rem', borderRadius: 'var(--radius-md)', background: lm.track, border: `1px dashed ${lm.color}22` }}>
                    {colCards.map(card => <BACardTile key={card.id} card={card} compact />)}
                    {colCards.length === 0 && (
                      <div style={{ padding: '1.5rem 0', textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-faint)' }}>No cards</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── KANBAN VIEW (Done) ── */}
      {viewMode === 'kanban' && showDone && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${width >= 1024 ? 3 : width >= 640 ? 2 : 1}, 1fr)`, gap: '0.625rem' }}>
          {filtered.slice(0, 60).map(card => <BACardTile key={card.id} card={card} />)}
          {filtered.length > 60 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '1rem', fontSize: '0.78rem', color: 'var(--text-muted)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              Showing 60 of {filtered.length} completed cards
            </div>
          )}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {viewMode === 'list' && (
        <div className="section-card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ minWidth: '900px' }}>
              <thead>
                <tr>
                  <th>Card</th>
                  <th style={{ width: '110px' }}>Client</th>
                  <th style={{ width: '80px' }}>Product</th>
                  <th style={{ width: '90px' }}>List</th>
                  <th style={{ width: '85px' }}>Priority</th>
                  <th style={{ width: '130px' }}>PM</th>
                  <th style={{ width: '90px' }}>Due Date</th>
                  <th style={{ width: '90px' }}>Plan Date</th>
                  <th style={{ width: '60px' }}>Hrs</th>
                  <th style={{ width: '70px' }}>Meta</th>
                  <th style={{ width: '40px' }} />
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map(card => {
                  const lm = LIST_META[card.listName] || LIST_META['Backlog'];
                  const overdue = isOverdue(card);
                  return (
                    <tr key={card.id} style={{ borderLeft: `3px solid ${lm.color}40` }}>
                      <td style={{ maxWidth: '280px' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>{card.name.slice(0, 72)}{card.name.length > 72 ? '…' : ''}</div>
                        {card.desc && <div style={{ fontSize: '0.65rem', color: 'var(--text-faint)', marginTop: '1px', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.desc}</div>}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(0,212,255,0.08)', color: '#00D4FF', border: '1px solid rgba(0,212,255,0.18)', display: 'inline-block', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.client}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                          {card.products.map(p => <ProductBadge key={p} p={p} />)}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: '9999px', background: `${lm.color}14`, color: lm.color, border: `1px solid ${lm.color}28`, whiteSpace: 'nowrap' }}>
                          {card.listName === 'Pending Client(Delivery)' ? 'Pending' : card.listName === 'Ready For Configuration' ? 'Ready Config' : card.listName === "Next Week's Traffic" ? "Next Week" : card.listName}
                        </span>
                      </td>
                      <td>{card.priority ? <PriorityBadge p={card.priority} /> : <span style={{ color: 'var(--text-faint)', fontSize: '0.72rem' }}>—</span>}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          {card.pm && <div className="avatar" style={{ width: '20px', height: '20px', fontSize: '0.52rem', flexShrink: 0 }}>{card.pm.split(' ').map(w => w[0]).join('').slice(0, 2)}</div>}
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{card.pm || '—'}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.72rem', color: overdue ? '#FCA5A5' : 'var(--text-secondary)', fontWeight: overdue ? 700 : 400 }}>
                          {fmtDate(card.dueDate)}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{fmtDate(card.deliveryDate)}</td>
                      <td style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textAlign: 'center' }}>{card.estimation || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          {card.commentCount > 0 && <span style={{ fontSize: '0.6rem', color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: '1px' }}><MessageSquare size={8} />{card.commentCount}</span>}
                          {card.attachmentCount > 0 && <span style={{ fontSize: '0.6rem', color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: '1px' }}><Paperclip size={8} />{card.attachmentCount}</span>}
                          {card.relatedToPayment && <DollarSign size={10} style={{ color: '#34D399' }} />}
                        </div>
                      </td>
                      <td>
                        <a href={card.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-faint)', display: 'flex', alignItems: 'center' }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#38BDF8')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-faint)')}>
                          <ExternalLink size={12} />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length > 200 && (
              <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Showing 200 of {filtered.length} cards — use filters to narrow down
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── No results ── */}
      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-default)' }}>
          <CheckSquare size={32} style={{ color: 'var(--text-faint)', margin: '0 auto 0.75rem', display: 'block' }} />
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>No cards match your filters</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Try adjusting the search or clearing filters</div>
        </div>
      )}

    </div>
  );
}
