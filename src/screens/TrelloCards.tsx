import { useState, useEffect, useMemo } from 'react';
import {
  RefreshCw, Loader2, AlertCircle, Search, ExternalLink,
  Calendar, User,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useLayout } from '../hooks/useLayout';
import { fetchBATrafficBoard, type BACard, type TrelloList } from '../lib/trello';
import { Badge, cn, fadeUp, stagger } from '../components/ui';

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function isOverdue(dueDate: string): boolean {
  return new Date(dueDate) < new Date();
}

export default function TrelloCards() {
  const { isMobile } = useLayout();
  const [cards, setCards] = useState<BACard[]>([]);
  const [lists, setLists] = useState<TrelloList[]>([]);
  const [boardName, setBoardName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [search, setSearch] = useState('');
  const [activeList, setActiveList] = useState<string>('');

  async function load() {
    try {
      const data = await fetchBATrafficBoard();
      setCards(data.cards);
      setLists(data.lists);
      setBoardName(data.boardName);
      setLastSynced(new Date());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Trello board');
    }
  }

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, []);

  async function handleSync() {
    setSyncing(true);
    await load();
    setSyncing(false);
  }

  const uniqueLists = useMemo(() => [...new Set(cards.map((c) => c.listName))].sort(), [cards]);

  const filtered = useMemo(() => cards.filter((c) => {
    if (activeList && c.listName !== activeList) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.client.toLowerCase().includes(q) ||
        c.members.some((m) => m.toLowerCase().includes(q)) ||
        c.labels.some((l) => l.toLowerCase().includes(q))
      );
    }
    return true;
  }), [cards, activeList, search]);

  return (
    <motion.div
      initial="hidden" animate="show"
      variants={{ hidden: {}, show: { transition: stagger(0.05, 0.08) } }}
      className="screen-container"
    >
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-[1.5rem] md:text-[1.75rem] font-semibold tracking-[-0.025em] leading-tight text-white">Trello Cards</h1>
          <p className="text-[0.78rem] text-[color:var(--text-muted)] mt-1">
            {boardName ? `${boardName} · ` : ''}{cards.length} cards · {lists.length} lists
            {lastSynced && <> · Synced {lastSynced.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex items-center gap-2 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-md px-3.5 h-[38px] w-full sm:w-[240px]">
            <Search size={14} className="text-[color:var(--text-muted)] flex-shrink-0" />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cards…"
              className="flex-1 bg-transparent border-0 outline-none text-[0.83rem] text-white placeholder:text-[color:var(--text-faint)] min-w-0"
            />
          </div>
          <button type="button" onClick={handleSync} disabled={syncing} className="btn-ghost h-[38px]">
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : 'Sync'}
          </button>
        </div>
      </motion.div>

      {/* List filter pills */}
      {uniqueLists.length > 0 && (
        <motion.div variants={fadeUp} className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveList('')}
            className={cn(
              'px-3 py-1.5 rounded-full text-[0.76rem] font-medium transition-colors border',
              activeList === ''
                ? 'bg-[rgba(120,119,198,0.18)] text-white border-[rgba(120,119,198,0.35)]'
                : 'bg-white/[0.025] border-white/[0.06] text-[color:var(--text-muted)] hover:text-white',
            )}
          >
            All lists ({cards.length})
          </button>
          {uniqueLists.map((l) => {
            const count = cards.filter((c) => c.listName === l).length;
            const isActive = activeList === l;
            return (
              <button
                key={l}
                type="button"
                onClick={() => setActiveList(l)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-[0.76rem] font-medium transition-colors border',
                  isActive
                    ? 'bg-[rgba(120,119,198,0.18)] text-white border-[rgba(120,119,198,0.35)]'
                    : 'bg-white/[0.025] border-white/[0.06] text-[color:var(--text-muted)] hover:text-white',
                )}
              >
                {l} <span className="text-[color:var(--text-faint)]">({count})</span>
              </button>
            );
          })}
        </motion.div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-14 text-[color:var(--text-muted)] text-[0.82rem]">
          <Loader2 size={15} className="animate-spin" /> Loading Trello board…
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-[rgba(255,107,107,0.08)] border border-[rgba(255,107,107,0.22)] text-[#FCA5A5] text-[0.82rem]">
          <AlertCircle size={14} /> {error}
          <button className="btn-ghost ml-auto h-[30px] text-[0.72rem]" onClick={handleSync}>Retry</button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="section-card p-12 flex flex-col items-center gap-2 text-center">
          <div className="text-[0.92rem] font-semibold text-white">No cards found</div>
          <div className="text-[0.76rem] text-[color:var(--text-muted)]">Try clearing filters or re-syncing.</div>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <motion.div
          variants={{ hidden: {}, show: { transition: stagger(0.03, 0.04) } }}
          className="grid gap-3"
          style={{ gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))' }}
        >
          {filtered.map((card) => {
            const overdue = card.dueDate && !card.dueComplete && isOverdue(card.dueDate);
            return (
              <motion.a
                key={card.id}
                variants={fadeUp}
                whileHover={{ y: -2, transition: { type: 'spring', stiffness: 320, damping: 24 } }}
                href={card.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-2xl bg-white/[0.025] border border-white/[0.06] hover:border-white/[0.14] hover:bg-white/[0.04] transition-colors p-4 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[0.88rem] font-semibold text-white leading-snug flex-1">{card.name}</h3>
                  <ExternalLink size={12} className="text-[color:var(--text-faint)] group-hover:text-white transition-colors flex-shrink-0 mt-1" />
                </div>

                <div className="flex items-center gap-2 text-[0.7rem] text-[color:var(--text-muted)] flex-wrap">
                  <span className="font-semibold text-[color:var(--text-secondary)] truncate">{card.listName}</span>
                  {card.client && (<><span>·</span><span className="truncate">{card.client}</span></>)}
                </div>

                {card.labels.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {card.labels.slice(0, 4).map((l) => (
                      <span key={l} className="text-[0.6rem] font-semibold px-1.5 py-0.5 rounded bg-white/[0.05] text-[color:var(--text-muted)] uppercase tracking-[0.04em]">
                        {l}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between text-[0.7rem] pt-1.5 border-t border-white/[0.04]">
                  {card.members.length > 0 ? (
                    <span className="flex items-center gap-1 text-[color:var(--text-muted)] truncate">
                      <User size={10} />{card.members.slice(0, 2).join(', ')}{card.members.length > 2 && ` +${card.members.length - 2}`}
                    </span>
                  ) : <span />}
                  {card.dueDate && (
                    <span className={cn('flex items-center gap-1', overdue ? 'text-[#FCA5A5] font-semibold' : card.dueComplete ? 'text-[#63E6BE]' : 'text-[color:var(--text-muted)]')}>
                      <Calendar size={10} />{fmtDate(card.dueDate)}
                    </span>
                  )}
                </div>

                {overdue && (
                  <div className="mt-1">
                    <Badge tone="critical">Overdue</Badge>
                  </div>
                )}
              </motion.a>
            );
          })}
        </motion.div>
      )}
    </motion.div>
  );
}
