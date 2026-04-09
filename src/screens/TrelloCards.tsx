import { useState, useEffect, useMemo } from 'react';
import { useLayout } from '../hooks/useLayout';
import {
  RefreshCw, Loader2, AlertCircle, Search, ExternalLink,
  Calendar, Tag, User, List, Clock,
} from 'lucide-react';
import { fetchBATrafficBoard, type BACard } from '../lib/trello';

// ── Helpers ───────────────────────────────────────────────────

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

function isOverdue(dueDate: string): boolean {
  return new Date(dueDate) < new Date();
}

// ── Label Badge ───────────────────────────────────────────────

const LABEL_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  automation: { bg: 'rgba(99,102,241,0.15)', color: '#818CF8', border: 'rgba(99,102,241,0.3)' },
  default:    { bg: 'rgba(148,163,184,0.1)',  color: '#94A3B8', border: 'rgba(148,163,184,0.2)' },
};

function LabelBadge({ name }: { name: string }) {
  const isAutomation = name.toLowerCase() === 'automation';
  const meta = isAutomation ? LABEL_COLORS.automation : LABEL_COLORS.default;
  return (
    <span style={{
      fontSize: '0.6rem', fontWeight: 700, padding: '2px 7px',
      borderRadius: '9999px', background: meta.bg, color: meta.color,
      border: `1px solid ${meta.border}`, whiteSpace: 'nowrap',
      letterSpacing: '0.03em', textTransform: 'uppercase',
    }}>
      {name}
    </span>
  );
}

// ── Card Component ────────────────────────────────────────────

function TrelloCardItem({ card }: { card: BACard }) {
  const overdue = card.dueDate && !card.dueComplete && isOverdue(card.dueDate);

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '12px',
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.625rem',
      transition: 'border-color 0.2s, background 0.2s',
    }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(99,102,241,0.35)';
        (e.currentTarget as HTMLDivElement).style.background = 'rgba(99,102,241,0.04)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.07)';
        (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)';
      }}
    >
      {/* Title + external link */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
        <h3 style={{
          margin: 0, fontSize: '0.875rem', fontWeight: 600,
          color: '#E2E8F0', lineHeight: 1.4, flex: 1,
        }}>
          {card.name}
        </h3>
        <a
          href={card.url}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in Trello"
          style={{ color: '#475569', flexShrink: 0, marginTop: '2px' }}
          onClick={e => e.stopPropagation()}
        >
          <ExternalLink size={14} />
        </a>
      </div>

      {/* Description */}
      {card.desc && (
        <p style={{
          margin: 0, fontSize: '0.75rem', color: '#64748B',
          lineHeight: 1.5, display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {card.desc}
        </p>
      )}

      {/* Labels */}
      {card.labels.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {card.labels.map(l => <LabelBadge key={l} name={l} />)}
        </div>
      )}

      {/* Meta row */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '0.75rem',
        fontSize: '0.7rem', color: '#475569',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        paddingTop: '0.5rem', marginTop: 'auto',
      }}>
        {/* List */}
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <List size={11} />
          {card.listName}
        </span>

        {/* Due date */}
        {card.dueDate && (
          <span style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            color: card.dueComplete ? '#34D399' : overdue ? '#FCA5A5' : '#475569',
          }}>
            <Calendar size={11} />
            {card.dueComplete ? '✓ ' : ''}{fmtDate(card.dueDate)}
          </span>
        )}

        {/* Members */}
        {card.members.length > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <User size={11} />
            {card.members.join(', ')}
          </span>
        )}

        {/* Last activity */}
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
          <Clock size={11} />
          {fmtDate(card.lastActivity)}
        </span>
      </div>
    </div>
  );
}

// ── Main Screen ────────────────────────────────────────────────

export default function TrelloCards() {
  const { isMobile } = useLayout();
  const [cards, setCards] = useState<BACard[]>([]);
  const [boardName, setBoardName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  async function fetchCards() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBATrafficBoard();
      // Filter cards that have the "automation" label
      const automationCards = data.cards.filter(c =>
        c.labels.some(l => l.toLowerCase() === 'automation')
      );
      setCards(automationCards);
      setBoardName(data.boardName);
      setLastFetched(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch Trello cards');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchCards(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return cards;
    const q = search.toLowerCase();
    return cards.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.desc.toLowerCase().includes(q) ||
      c.listName.toLowerCase().includes(q) ||
      c.members.some(m => m.toLowerCase().includes(q))
    );
  }, [cards, search]);

  return (
    <div style={{ padding: isMobile ? '0.875rem' : '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#F1F5F9' }}>
            Trello — Automation Cards
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#475569' }}>
            {boardName ? `Board: ${boardName}` : 'Cards labelled "automation"'}
            {lastFetched && ` · Last synced ${lastFetched.toLocaleTimeString()}`}
          </p>
        </div>
        <button
          onClick={fetchCards}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '0.5rem 1rem', borderRadius: '8px',
            background: 'rgba(99,102,241,0.12)', color: '#818CF8',
            border: '1px solid rgba(99,102,241,0.25)',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '0.8rem', fontWeight: 600, opacity: loading ? 0.6 : 1,
          }}
        >
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      {!loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
          {[
            { label: 'Total Cards', value: cards.length, color: '#818CF8' },
            { label: 'Open', value: cards.filter(c => !c.dueComplete).length, color: '#38BDF8' },
            { label: 'Completed', value: cards.filter(c => c.dueComplete).length, color: '#34D399' },
            { label: 'Overdue', value: cards.filter(c => c.dueDate && !c.dueComplete && isOverdue(c.dueDate)).length, color: '#FCA5A5' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '10px', padding: '0.75rem 1rem',
            }}>
              <div style={{ fontSize: '1.375rem', fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: '2px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      {!loading && !error && cards.length > 0 && (
        <div style={{ position: 'relative', maxWidth: '360px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search cards…"
            style={{
              width: '100%', paddingLeft: '32px', paddingRight: '12px',
              paddingTop: '0.5rem', paddingBottom: '0.5rem',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px', color: '#E2E8F0', fontSize: '0.8rem',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '3rem 0', color: '#475569' }}>
          <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: '#818CF8' }} />
          <span style={{ fontSize: '0.875rem' }}>Fetching Trello cards…</span>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: '10px', padding: '1.25rem',
          display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
        }}>
          <AlertCircle size={18} style={{ color: '#FCA5A5', flexShrink: 0, marginTop: '1px' }} />
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#FCA5A5' }}>Failed to load cards</div>
            <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginTop: '4px' }}>{error}</div>
            <button
              onClick={fetchCards}
              style={{
                marginTop: '0.75rem', padding: '0.375rem 0.875rem',
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: '6px', color: '#FCA5A5', fontSize: '0.75rem',
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && cards.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: '#475569' }}>
          <Tag size={32} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
          <div style={{ fontSize: '0.875rem' }}>No cards found with the "automation" label</div>
        </div>
      )}

      {/* No search results */}
      {!loading && !error && cards.length > 0 && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem 0', color: '#475569', fontSize: '0.875rem' }}>
          No cards match "<strong style={{ color: '#94A3B8' }}>{search}</strong>"
        </div>
      )}

      {/* Cards grid */}
      {!loading && !error && filtered.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? '100%' : '300px'}, 1fr))`,
          gap: '0.875rem',
        }}>
          {filtered.map(card => <TrelloCardItem key={card.id} card={card} />)}
        </div>
      )}

      {/* Spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
