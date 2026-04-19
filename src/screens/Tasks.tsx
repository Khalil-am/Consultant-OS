import { useState, useEffect, useMemo } from 'react';
import { useLayout } from '../hooks/useLayout';
import {
  Search, Loader2, X, RefreshCw,
  Clock, AlertTriangle, CheckCircle, CheckSquare,
  ListTodo, User, CalendarDays, Layers, ExternalLink,
  ChevronDown, Paperclip, MessageSquare,
} from 'lucide-react';
import { fetchBATrafficBoard } from '../lib/trello';
import type { BACard, BATrafficData, TrelloList } from '../lib/trello';

// ── Status mapping from Trello list names ────────────────────
function mapListToStatus(listName: string): string {
  const n = listName.toLowerCase();
  if (n.includes('done') || n.includes('complete') || n.includes('finished') || n.includes('closed')) return 'Completed';
  if (n.includes('review') || n.includes('testing') || n.includes('qa') || n.includes('approval')) return 'In Review';
  if (n.includes('progress') || n.includes('doing') || n.includes('active') || n.includes('wip')) return 'In Progress';
  if (n.includes('overdue') || n.includes('blocked') || n.includes('escalat')) return 'Overdue';
  return 'Backlog';
}

type TaskStatus = 'Backlog' | 'In Progress' | 'In Review' | 'Completed' | 'Overdue';

const FILTER_TABS = ['All', 'Backlog', 'In Progress', 'In Review', 'Completed', 'Overdue'] as const;

const STATUS_META: Record<string, { color: string; bg: string; border: string; dot: string }> = {
  'Backlog':     { color: '#8790A8', bg: 'rgba(71,85,105,0.12)',   border: 'rgba(71,85,105,0.25)',   dot: '#4E566E' },
  'In Progress': { color: '#7DD3FC', bg: 'rgba(120,119,198,0.1)',   border: 'rgba(120,119,198,0.22)',  dot: '#7877C6' },
  'In Review':   { color: '#A78BFA', bg: 'rgba(167,139,250,0.12)',  border: 'rgba(167,139,250,0.25)',  dot: '#A78BFA' },
  'Completed':   { color: '#34D399', bg: 'rgba(52,211,153,0.1)',   border: 'rgba(52,211,153,0.22)',  dot: '#34D399' },
  'Overdue':     { color: '#FCA5A5', bg: 'rgba(255,107,107,0.1)',    border: 'rgba(255,107,107,0.22)',   dot: '#FF6B6B' },
};

const PRIORITY_META: Record<string, { color: string; bg: string; border: string }> = {
  'Highest':  { color: '#FCA5A5', bg: 'rgba(255,107,107,0.12)',  border: 'rgba(255,107,107,0.25)'  },
  'High':     { color: '#FCA5A5', bg: 'rgba(255,107,107,0.1)',   border: 'rgba(255,107,107,0.22)'  },
  'Medium':   { color: '#FDCE78', bg: 'rgba(245,181,68,0.1)',  border: 'rgba(245,181,68,0.22)' },
  'Low':      { color: '#34D399', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.2)'  },
  'Lowest':   { color: '#8790A8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.15)' },
};

// ── Helpers ───────────────────────────────────────────────────
function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

function isOverdue(card: BACard): boolean {
  if (!card.dueDate) return false;
  if (card.dueComplete) return false;
  return new Date(card.dueDate) < new Date();
}

// ── Sub-components ────────────────────────────────────────────
function PriorityBadge({ priority }: { priority: string }) {
  const m = PRIORITY_META[priority] ?? PRIORITY_META['Medium'];
  return (
    <span style={{
      fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px',
      borderRadius: '9999px', background: m.bg, color: m.color,
      border: `1px solid ${m.border}`, whiteSpace: 'nowrap', letterSpacing: '0.02em',
    }}>
      {priority || 'Medium'}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META['Backlog'];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      fontSize: '0.65rem', fontWeight: 600, padding: '2px 8px',
      borderRadius: '9999px', background: m.bg, color: m.color,
      border: `1px solid ${m.border}`, whiteSpace: 'nowrap',
    }}>
      {status === 'In Progress' && (
        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: m.dot, animation: 'pulseDot 2s ease-in-out infinite', display: 'inline-block' }} />
      )}
      {status}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────
export default function Tasks() {
  const { isMobile, isTablet } = useLayout();

  const [cards, setCards] = useState<BACard[]>([]);
  const [lists, setLists] = useState<TrelloList[]>([]);
  const [boardName, setBoardName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);

  // UI state
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<string>('All');
  const [listFilter, setListFilter] = useState('');

  // ── Data loading from Trello ────────────────────────────────
  async function loadFromTrello() {
    try {
      const data: BATrafficData = await fetchBATrafficBoard();
      setCards(data.cards);
      setLists(data.lists);
      setBoardName(data.boardName);
      setLastSynced(new Date());
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load Trello board');
    }
  }

  useEffect(() => {
    setLoading(true);
    loadFromTrello().finally(() => setLoading(false));
  }, []);

  async function handleSync() {
    setSyncing(true);
    await loadFromTrello();
    setSyncing(false);
  }

  // ── Enriched cards with status ──────────────────────────────
  const enrichedCards = useMemo(() => {
    return cards.map(card => ({
      ...card,
      status: card.dueComplete ? 'Completed' : isOverdue(card) ? 'Overdue' : mapListToStatus(card.listName),
    }));
  }, [cards]);

  // ── Stats ───────────────────────────────────────────────────
  const totalCount = enrichedCards.length;
  const inProgressCount = enrichedCards.filter(c => c.status === 'In Progress').length;
  const overdueCount = enrichedCards.filter(c => c.status === 'Overdue').length;
  const completedCount = enrichedCards.filter(c => c.status === 'Completed').length;

  // ── Unique lists for filter ─────────────────────────────────
  const uniqueLists = useMemo(() => {
    const listNames = [...new Set(cards.map(c => c.listName))].sort();
    return listNames;
  }, [cards]);

  // ── Filtered cards ──────────────────────────────────────────
  const filtered = useMemo(() => {
    return enrichedCards.filter(c => {
      if (activeTab !== 'All' && c.status !== activeTab) return false;
      if (listFilter && c.listName !== listFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.client.toLowerCase().includes(q) ||
          c.members.some(m => m.toLowerCase().includes(q)) ||
          c.listName.toLowerCase().includes(q) ||
          c.labels.some(l => l.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [enrichedCards, activeTab, listFilter, search]);

  const colCount = isMobile ? 1 : isTablet ? 2 : 4;

  return (
    <div className="screen-container animate-fade-in">

      {/* ── Board Header ───────────────────────────────────────── */}
      {boardName && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.75rem 1rem', borderRadius: 'var(--radius-lg)',
          background: 'linear-gradient(135deg, rgba(120,119,198,0.06) 0%, rgba(167,139,250,0.04) 100%)',
          border: '1px solid rgba(120,119,198,0.12)', flexWrap: 'wrap', gap: '0.5rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div style={{ padding: '0.375rem', borderRadius: '8px', background: 'rgba(120,119,198,0.12)', color: '#7877C6' }}>
              <Layers size={15} />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{boardName}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                Trello Board · {totalCount} cards
                {lastSynced && <> · Last synced {lastSynced.toLocaleTimeString()}</>}
              </div>
            </div>
          </div>
          <button
            className="btn-ghost"
            style={{ height: '32px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
            onClick={handleSync}
            disabled={syncing}
          >
            <RefreshCw size={12} style={{ animation: syncing ? 'spin 0.8s linear infinite' : 'none' }} />
            {syncing ? 'Syncing…' : 'Sync'}
          </button>
        </div>
      )}

      {/* ── Stat Cards ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${colCount}, 1fr)`, gap: '0.875rem' }}>
        {[
          { label: 'Total Cards',   value: totalCount,      color: '#A78BFA', sub: `${uniqueLists.length} lists`, icon: <ListTodo size={14} /> },
          { label: 'In Progress',   value: inProgressCount, color: '#7877C6', sub: 'actively being worked',       icon: <Clock size={14} /> },
          { label: 'Overdue',       value: overdueCount,    color: '#FF6B6B', sub: 'past due date',               icon: <AlertTriangle size={14} /> },
          { label: 'Completed',     value: completedCount,  color: '#34D399', sub: 'finished cards',              icon: <CheckCircle size={14} /> },
        ].map(s => (
          <div key={s.label} className="metric-card" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${s.color}, transparent)` }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
              <div>
                <div className="hero-number" style={{ color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', marginTop: '2px' }}>{s.label}</div>
                <div style={{ fontSize: '0.62rem', color: 'var(--text-faint)', marginTop: '1px' }}>{s.sub}</div>
              </div>
              <div style={{ color: s.color, opacity: 0.45, marginTop: '0.2rem', flexShrink: 0 }}>{s.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter Tabs + Toolbar ──────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: isMobile ? '100%' : '180px' }}>
          <Search size={13} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            className="input-field"
            placeholder="Search cards, client, members…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: '2.25rem', height: '36px', fontSize: '0.8rem', width: '100%' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 0 }}>
              <X size={12} />
            </button>
          )}
        </div>

        {/* List filter */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <Layers size={12} style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <select
            className="input-field"
            value={listFilter}
            onChange={e => setListFilter(e.target.value)}
            style={{ height: '36px', fontSize: '0.78rem', paddingLeft: '1.875rem', paddingRight: '1.875rem', minWidth: '160px', appearance: 'none' }}
          >
            <option value="">All Lists</option>
            {uniqueLists.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <ChevronDown size={11} style={{ position: 'absolute', right: '0.625rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        </div>
      </div>

      {/* Status filter tabs */}
      <div style={{ display: 'flex', gap: '0.2rem', background: 'rgba(255,255,255,0.03)', padding: '0.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', overflowX: 'auto', WebkitOverflowScrolling: 'touch', flexShrink: 0 }}>
        {FILTER_TABS.map(tab => {
          const m = tab !== 'All' ? STATUS_META[tab] : null;
          const count = tab === 'All' ? enrichedCards.length : enrichedCards.filter(c => c.status === tab).length;
          return (
            <button
              key={tab}
              className={`tab-item ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
              style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem', whiteSpace: 'nowrap', color: activeTab === tab && m ? m.color : undefined }}
            >
              {tab}
              <span style={{ marginLeft: '0.3rem', fontSize: '0.65rem', opacity: 0.7 }}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* ── Loading / Error states ─────────────────────────────── */}
      {loading && (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <Loader2 size={16} className="animate-spin" /> Loading Trello board…
        </div>
      )}

      {!loading && error && (
        <div style={{ padding: '1.25rem', background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.2)', borderRadius: 'var(--radius-lg)', color: '#FCA5A5', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={15} />
          {error}
          <button className="btn-ghost" style={{ marginLeft: 'auto', fontSize: '0.72rem' }} onClick={handleSync}>Retry</button>
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────────── */}
      {!loading && !error && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3.5rem 1rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-subtle)' }}>
          <CheckSquare size={36} style={{ color: 'var(--text-faint)', margin: '0 auto 0.875rem', display: 'block' }} />
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
            {cards.length === 0 ? 'No cards found on this board' : 'No cards match your filters'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {cards.length === 0 ? 'Check your Trello board connection' : 'Try adjusting the search or clearing filters'}
          </div>
        </div>
      )}

      {/* ── Card List (Table) ──────────────────────────────────── */}
      {!loading && !error && filtered.length > 0 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr auto' : 'minmax(0, 2fr) 90px 110px minmax(100px, 140px) minmax(80px, 120px) 90px auto',
            gap: '0', padding: '0.6rem 1rem',
            background: 'var(--bg-elevated)',
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            {['Card', ...(isMobile ? [] : ['Priority', 'Status', 'List', 'Client', 'Due Date', ''])].map((h, i) => (
              <div key={i} style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 0.5rem', textAlign: i > 0 && i < 6 ? 'center' : 'left' }}>
                {h}
              </div>
            ))}
          </div>

          {/* Card rows */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filtered.slice(0, 100).map((card, idx) => {
              const sm = STATUS_META[card.status] ?? STATUS_META['Backlog'];
              const overdue = isOverdue(card);
              const dueDateColor = card.dueComplete ? '#34D399' : overdue ? '#FCA5A5' : 'var(--text-secondary)';

              return (
                <a
                  key={card.id}
                  href={card.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr auto' : 'minmax(0, 2fr) 90px 110px minmax(100px, 140px) minmax(80px, 120px) 90px auto',
                    gap: '0',
                    padding: '0.75rem 1rem',
                    borderBottom: idx < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    borderLeft: `3px solid ${sm.dot}30`,
                    transition: 'background 0.12s',
                    alignItems: 'center',
                    cursor: 'pointer',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  {/* Title + members + meta */}
                  <div style={{ padding: '0 0.5rem', minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {card.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '3px', flexWrap: 'wrap' }}>
                      {card.members.length > 0 && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <User size={9} /> {card.members.slice(0, 2).join(', ')}
                          {card.members.length > 2 && ` +${card.members.length - 2}`}
                        </span>
                      )}
                      {card.commentCount > 0 && (
                        <span style={{ fontSize: '0.62rem', color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <MessageSquare size={9} /> {card.commentCount}
                        </span>
                      )}
                      {card.attachmentCount > 0 && (
                        <span style={{ fontSize: '0.62rem', color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <Paperclip size={9} /> {card.attachmentCount}
                        </span>
                      )}
                      {card.checklistTotal > 0 && (
                        <span style={{ fontSize: '0.62rem', color: card.checklistDone === card.checklistTotal ? '#34D399' : 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <CheckSquare size={9} /> {card.checklistDone}/{card.checklistTotal}
                        </span>
                      )}
                    </div>
                  </div>

                  {isMobile ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0 0.25rem' }}>
                      <PriorityBadge priority={card.priority || 'Medium'} />
                    </div>
                  ) : (
                    <>
                      {/* Priority */}
                      <div style={{ padding: '0 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <PriorityBadge priority={card.priority || 'Medium'} />
                      </div>

                      {/* Status */}
                      <div style={{ padding: '0 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <StatusBadge status={card.status} />
                      </div>

                      {/* List */}
                      <div style={{ padding: '0 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 600, padding: '2px 7px', borderRadius: '4px',
                          background: 'rgba(120,119,198,0.07)', color: '#7DD3FC', border: '1px solid rgba(120,119,198,0.16)',
                          maxWidth: '128px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
                        }}>
                          {card.listName}
                        </span>
                      </div>

                      {/* Client */}
                      <div style={{ padding: '0 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {card.client ? (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '110px' }}>
                            {card.client}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>—</span>
                        )}
                      </div>

                      {/* Due Date */}
                      <div style={{ padding: '0 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                        <CalendarDays size={10} style={{ color: dueDateColor, flexShrink: 0 }} />
                        <span style={{ fontSize: '0.72rem', color: dueDateColor, fontWeight: overdue ? 700 : 400 }}>
                          {fmtDate(card.dueDate)}
                        </span>
                      </div>

                      {/* Actions */}
                      <div style={{ padding: '0 0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ExternalLink size={12} style={{ color: 'var(--text-muted)' }} />
                      </div>
                    </>
                  )}
                </a>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{ padding: '0.625rem 1.25rem', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-faint)' }}>
              Showing <strong style={{ color: 'var(--text-secondary)' }}>{Math.min(filtered.length, 100)}</strong> of {enrichedCards.length} cards
              {filtered.length > 100 && <> (limited to 100)</>}
            </span>
            {overdueCount > 0 && (
              <span style={{ fontSize: '0.7rem', color: '#FCA5A5', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <AlertTriangle size={11} /> {overdueCount} overdue
              </span>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
