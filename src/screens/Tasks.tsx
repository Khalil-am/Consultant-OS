import { useState, useEffect, useMemo } from 'react';
import {
  Search, Loader2, X, RefreshCw, AlertTriangle, CheckSquare,
  User, CalendarDays, ExternalLink, Paperclip, MessageSquare,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useLayout } from '../hooks/useLayout';
import { fetchBATrafficBoard } from '../lib/trello';
import type { BACard, BATrafficData, TrelloList } from '../lib/trello';
import { Badge, cn, fadeUp, stagger } from '../components/ui';

function mapListToStatus(listName: string): string {
  const n = listName.toLowerCase();
  if (n.includes('done') || n.includes('complete') || n.includes('finished') || n.includes('closed')) return 'Completed';
  if (n.includes('review') || n.includes('testing') || n.includes('qa') || n.includes('approval')) return 'In Review';
  if (n.includes('progress') || n.includes('doing') || n.includes('active') || n.includes('wip')) return 'In Progress';
  if (n.includes('overdue') || n.includes('blocked') || n.includes('escalat')) return 'Overdue';
  return 'Backlog';
}

const FILTER_TABS = ['All', 'Backlog', 'In Progress', 'In Review', 'Completed', 'Overdue'] as const;

const STATUS_COLOR: Record<string, string> = {
  'Backlog':     '#8790A8',
  'In Progress': '#A78BFA',
  'In Review':   '#C4B5FD',
  'Completed':   '#34D399',
  'Overdue':     '#FF6B6B',
};

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function isOverdue(card: BACard): boolean {
  if (!card.dueDate || card.dueComplete) return false;
  return new Date(card.dueDate) < new Date();
}

function priorityTone(priority: string): 'critical' | 'high' | 'medium' | 'low' | 'neutral' {
  if (priority === 'Highest' || priority === 'High') return 'critical';
  if (priority === 'Medium') return 'high';
  if (priority === 'Low') return 'low';
  return 'neutral';
}

function statusTone(status: string): 'brand' | 'mint' | 'critical' | 'neutral' | 'review' {
  if (status === 'Completed') return 'mint';
  if (status === 'Overdue') return 'critical';
  if (status === 'In Progress') return 'brand';
  if (status === 'In Review') return 'review';
  return 'neutral';
}

export default function Tasks() {
  const { isMobile } = useLayout();
  const [cards, setCards] = useState<BACard[]>([]);
  const [lists, setLists] = useState<TrelloList[]>([]);
  const [boardName, setBoardName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<string>('All');

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

  const enriched = useMemo(
    () => cards.map((c) => ({ ...c, status: c.dueComplete ? 'Completed' : isOverdue(c) ? 'Overdue' : mapListToStatus(c.listName) })),
    [cards],
  );

  const totalCount      = enriched.length;
  const inProgressCount = enriched.filter((c) => c.status === 'In Progress').length;
  const overdueCount    = enriched.filter((c) => c.status === 'Overdue').length;
  const completedCount  = enriched.filter((c) => c.status === 'Completed').length;

  const filtered = useMemo(() => {
    return enriched.filter((c) => {
      if (activeTab !== 'All' && c.status !== activeTab) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.client.toLowerCase().includes(q) ||
          c.members.some((m) => m.toLowerCase().includes(q)) ||
          c.listName.toLowerCase().includes(q) ||
          c.labels.some((l) => l.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [enriched, activeTab, search]);

  return (
    <motion.div
      initial="hidden" animate="show"
      variants={{ hidden: {}, show: { transition: stagger(0.05, 0.08) } }}
      className="screen-container"
    >
      {/* ── Header ───────────────────────────────────── */}
      <motion.div variants={fadeUp} className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-[1.5rem] md:text-[1.75rem] font-semibold tracking-[-0.025em] leading-tight text-white">Tasks &amp; Risks</h1>
          {boardName ? (
            <p className="text-[0.78rem] text-[color:var(--text-muted)] mt-1">
              <span>{boardName}</span> · {totalCount} cards
              {lastSynced && <> · Synced {lastSynced.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</>}
            </p>
          ) : (
            <p className="text-[0.78rem] text-[color:var(--text-muted)] mt-1">{totalCount} cards across {new Set(cards.map((c) => c.listName)).size} lists</p>
          )}
        </div>
        <button
          type="button"
          aria-label="Sync"
          className="btn-ghost h-[34px] text-[0.76rem]"
          onClick={handleSync}
          disabled={syncing}
        >
          <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing…' : 'Sync'}
        </button>
      </motion.div>

      {/* ── Compact stats ───────────────────────────── */}
      <motion.div
        variants={{ hidden: {}, show: { transition: stagger(0.04, 0.05) } }}
        className={cn('grid gap-3', isMobile ? 'grid-cols-2' : 'grid-cols-4')}
      >
        {[
          { label: 'Total Cards', value: totalCount,      color: '#A78BFA' },
          { label: 'In Progress', value: inProgressCount, color: '#7DD3FC' },
          { label: 'Overdue',     value: overdueCount,    color: '#FF6B6B' },
          { label: 'Completed',   value: completedCount,  color: '#34D399' },
        ].map((s) => (
          <motion.div
            key={s.label}
            variants={fadeUp}
            className="rounded-2xl bg-white/[0.025] border border-white/[0.06] p-3.5"
          >
            <div className="text-[0.62rem] font-semibold tracking-[0.1em] uppercase text-[color:var(--text-muted)] mb-2">{s.label}</div>
            <div className="hero-number text-[1.25rem] md:text-[1.4rem] font-bold tabular-nums leading-none" style={{ color: s.color }}>{s.value}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Toolbar ──────────────────────────────────── */}
      <motion.div variants={fadeUp} className="flex items-center gap-2 flex-wrap">
        <div className="relative flex items-center gap-2 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-md px-3.5 h-[36px] flex-1 min-w-[220px]">
          <Search size={13} className="text-[color:var(--text-muted)] flex-shrink-0" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cards, client, members…"
            className="flex-1 bg-transparent border-0 outline-none text-[0.82rem] text-white placeholder:text-[color:var(--text-faint)] min-w-0"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-[color:var(--text-muted)] hover:text-white transition-colors">
              <X size={13} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 p-1 rounded-full bg-white/[0.03] border border-white/[0.06] overflow-x-auto">
          {FILTER_TABS.map((tab) => {
            const count = tab === 'All' ? totalCount : enriched.filter((c) => c.status === tab).length;
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'tab-item relative flex items-center gap-1.5 px-3 py-1 rounded-full text-[0.74rem] font-medium transition-colors whitespace-nowrap',
                  active ? 'active bg-[rgba(120,119,198,0.18)] text-white border border-[rgba(120,119,198,0.35)]' : 'text-[color:var(--text-muted)] hover:text-white',
                )}
                style={active ? { color: STATUS_COLOR[tab] || '#fff' } : undefined}
              >
                {tab}
                <span className={cn('text-[0.64rem] tabular-nums', active ? 'opacity-70' : 'text-[color:var(--text-faint)]')}>({count})</span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* ── States ───────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-[color:var(--text-muted)] text-[0.82rem]">
          <Loader2 size={15} className="animate-spin" /> Loading Trello board…
        </div>
      )}
      {!loading && error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-[rgba(255,107,107,0.08)] border border-[rgba(255,107,107,0.22)] text-[#FCA5A5] text-[0.82rem]">
          <AlertTriangle size={14} /> {error}
          <button className="btn-ghost ml-auto h-[30px] text-[0.72rem]" onClick={handleSync}>Retry</button>
        </div>
      )}
      {!loading && !error && filtered.length === 0 && (
        <div className="section-card p-12 flex flex-col items-center gap-2 text-center">
          <CheckSquare size={26} className="text-[color:var(--text-faint)]" />
          <div className="text-[0.92rem] font-semibold text-white">
            {cards.length === 0 ? 'No cards found on this board' : 'No cards match your filters'}
          </div>
          <div className="text-[0.76rem] text-[color:var(--text-muted)] max-w-md">
            {cards.length === 0 ? 'Check your Trello board connection.' : 'Try adjusting the search or clearing filters.'}
          </div>
        </div>
      )}

      {/* ── Card table ───────────────────────────── */}
      {!loading && !error && filtered.length > 0 && (
        <motion.div variants={fadeUp} className="section-card">
          <div className="divide-y divide-white/[0.04]">
            {filtered.slice(0, 100).map((card) => {
              const sc = STATUS_COLOR[card.status] ?? '#8790A8';
              const overdue = isOverdue(card);
              const dueColor = card.dueComplete ? '#34D399' : overdue ? '#FCA5A5' : 'var(--text-muted)';
              return (
                <a
                  key={card.id}
                  href={card.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group grid items-center gap-3 px-4 py-3 hover:bg-white/[0.025] transition-colors"
                  style={{
                    gridTemplateColumns: isMobile
                      ? '1fr auto'
                      : 'minmax(0,2fr) 90px 110px minmax(80px,120px) 80px auto',
                    borderLeft: `3px solid ${sc}40`,
                  }}
                >
                  <div className="min-w-0">
                    <div className="text-[0.84rem] font-semibold text-white truncate">{card.name}</div>
                    <div className="flex items-center gap-2.5 mt-1 flex-wrap text-[0.67rem] text-[color:var(--text-muted)]">
                      {card.members.length > 0 && (
                        <span className="flex items-center gap-1">
                          <User size={9} />{card.members.slice(0, 2).join(', ')}{card.members.length > 2 && ` +${card.members.length - 2}`}
                        </span>
                      )}
                      {card.commentCount > 0 && <span className="flex items-center gap-0.5"><MessageSquare size={9} />{card.commentCount}</span>}
                      {card.attachmentCount > 0 && <span className="flex items-center gap-0.5"><Paperclip size={9} />{card.attachmentCount}</span>}
                      {card.checklistTotal > 0 && (
                        <span className={cn('flex items-center gap-0.5', card.checklistDone === card.checklistTotal && 'text-[#63E6BE]')}>
                          <CheckSquare size={9} />{card.checklistDone}/{card.checklistTotal}
                        </span>
                      )}
                    </div>
                  </div>

                  {isMobile ? (
                    <Badge tone={priorityTone(card.priority || 'Medium')}>{card.priority || 'Medium'}</Badge>
                  ) : (
                    <>
                      <div className="flex justify-center"><Badge tone={priorityTone(card.priority || 'Medium')}>{card.priority || 'Medium'}</Badge></div>
                      <div className="flex justify-center"><Badge tone={statusTone(card.status)}>{card.status}</Badge></div>
                      <div className="flex justify-center text-[0.72rem] text-[color:var(--text-muted)] truncate">
                        {card.client || '—'}
                      </div>
                      <div className="flex items-center justify-center gap-1 text-[0.72rem]" style={{ color: dueColor }}>
                        <CalendarDays size={10} />{fmtDate(card.dueDate)}
                      </div>
                      <ExternalLink size={12} className="text-[color:var(--text-faint)] group-hover:text-white transition-colors justify-self-end" />
                    </>
                  )}
                </a>
              );
            })}
          </div>
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/[0.05] bg-white/[0.01]">
            <span className="text-[0.7rem] text-[color:var(--text-faint)]">
              Showing <strong className="text-[color:var(--text-secondary)]">{Math.min(filtered.length, 100)}</strong> of {enriched.length} cards{filtered.length > 100 && ' (limited to 100)'}
            </span>
            {overdueCount > 0 && (
              <span className="text-[0.7rem] text-[#FCA5A5] flex items-center gap-1">
                <AlertTriangle size={11} /> {overdueCount} overdue
              </span>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
