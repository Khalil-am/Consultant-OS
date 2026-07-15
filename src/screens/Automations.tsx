import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Star, Play, Settings2, TrendingUp, Clock, Zap, CheckCircle,
  ArrowRight, Loader2, ClipboardList, Video, Monitor, Building2,
  BarChart2, Brain,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useLayout } from '../hooks/useLayout';
import { getAutomations, updateAutomation } from '../lib/db';
import type { AutomationRow } from '../lib/db';
import { cn, fadeUp, stagger } from '../components/ui';

const CATEGORIES = ['All', 'BA & Requirements', 'Meetings', 'Product', 'Procurement', 'PMO', 'Reporting', 'Knowledge', 'Productivity'] as const;

function getCategoryIcon(cat: string, size = 13): React.ReactNode {
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
  'BA & Requirements': '#7877C6',
  'Meetings':          '#A78BFA',
  'Product':           '#34D399',
  'Procurement':       '#F5B544',
  'PMO':               '#F472B6',
  'Reporting':         '#7DD3FC',
  'Knowledge':         '#C4B5FD',
  'Productivity':      '#63E6BE',
};

export default function Automations() {
  const navigate = useNavigate();
  const { isMobile, width } = useLayout();
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [automations, setAutomations] = useState<AutomationRow[]>([]);
  const [starred, setStarred] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('automation_starred');
      if (saved) return new Set(JSON.parse(saved) as string[]);
    } catch { /* ignore */ }
    return new Set<string>();
  });
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runTimer, setRunTimer] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getAutomations().then((data) => {
      setAutomations(data);
      const saved = localStorage.getItem('automation_starred');
      if (!saved) setStarred(new Set(data.filter((a) => a.starred).map((a) => a.id)));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (runningId) {
      setRunTimer(0);
      timerRef.current = setInterval(() => setRunTimer((t) => t + 1), 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
    setRunTimer(0);
    if (timerRef.current) clearInterval(timerRef.current);
  }, [runningId]);

  const handleRun = useCallback((id: string) => {
    if (id === 'auto-001') { navigate('/automations/brd/run'); return; }
    if (id === 'auto-diwan') { navigate('/automations/diwan/run'); return; }
    setToast('No webhook URL configured for this automation. Set one up in the automation settings.');
    setTimeout(() => setToast(null), 4000);
  }, [navigate]);

  const totalAutomations = automations.length;
  const activeCount = automations.filter((a) => a.status === 'Active').length;
  const totalRuns = automations.reduce((sum, a) => sum + a.run_count, 0);
  const avgSuccessRate = automations.length > 0
    ? (automations.reduce((sum, a) => sum + a.success_rate, 0) / automations.length).toFixed(1)
    : '0';

  const filtered = automations.filter((a) => {
    const matchCat = activeCategory === 'All' || a.category === activeCategory;
    const q = search.toLowerCase();
    const matchSearch = a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) || a.category.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const toggleStar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStarred((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem('automation_starred', JSON.stringify([...next])); } catch { /* ignore */ }
      updateAutomation(id, { starred: next.has(id) }).catch(() => {});
      return next;
    });
  };

  const cols = width >= 1100 ? 3 : width >= 680 ? 2 : 1;

  return (
    <motion.div
      initial="hidden" animate="show"
      variants={{ hidden: {}, show: { transition: stagger(0.05, 0.08) } }}
      className="screen-container"
    >
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-[1.5rem] md:text-[1.75rem] font-semibold tracking-[-0.025em] leading-tight text-white">Automations</h1>
          <p className="text-[0.78rem] text-[color:var(--text-muted)] mt-1">
            {totalAutomations} automations · {totalRuns.toLocaleString()} runs · {avgSuccessRate}% success
          </p>
        </div>
        <div className="relative flex items-center gap-2 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-md px-3.5 h-[38px] w-full sm:w-[260px]">
          <Search size={14} className="text-[color:var(--text-muted)] flex-shrink-0" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search automations..."
            className="flex-1 bg-transparent border-0 outline-none text-[0.83rem] text-white placeholder:text-[color:var(--text-faint)] min-w-0"
          />
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div
        variants={{ hidden: {}, show: { transition: stagger(0.04, 0.05) } }}
        className={cn('grid gap-3', isMobile ? 'grid-cols-2' : 'grid-cols-4')}
      >
        {[
          { label: 'Total Automations', value: String(totalAutomations), color: '#A78BFA', Icon: Zap },
          { label: 'Active',            value: String(activeCount),      color: '#63E6BE', Icon: Play },
          { label: 'Total Runs',        value: totalRuns.toLocaleString(), color: '#7DD3FC', Icon: CheckCircle },
          { label: 'Avg Success Rate',  value: `${avgSuccessRate}%`,     color: '#F0A875', Icon: TrendingUp },
        ].map((s) => {
          const Icon = s.Icon;
          return (
            <motion.div key={s.label} variants={fadeUp} className="rounded-2xl bg-white/[0.025] border border-white/[0.06] p-3.5">
              <div className="flex items-start justify-between mb-2">
                <div className="text-[0.62rem] font-semibold tracking-[0.1em] uppercase text-[color:var(--text-muted)]">{s.label}</div>
                <Icon size={14} style={{ color: s.color }} className="opacity-70" />
              </div>
              <div className="text-[1.25rem] md:text-[1.4rem] font-bold tabular-nums leading-none" style={{ color: s.color }}>{s.value}</div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Category pills */}
      <motion.div variants={fadeUp} className="flex items-center gap-1.5 flex-wrap overflow-x-auto">
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat;
          const count = cat === 'All' ? automations.length : automations.filter((a) => a.category === cat).length;
          return (
            <button
              key={cat}
              type="button"
              aria-label={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[0.76rem] font-medium transition-colors border whitespace-nowrap',
                isActive
                  ? 'bg-[rgba(120,119,198,0.18)] text-white border-[rgba(120,119,198,0.35)]'
                  : 'bg-white/[0.025] border-white/[0.06] text-[color:var(--text-muted)] hover:text-white hover:bg-white/[0.05]',
              )}
            >
              {cat !== 'All' && <span className="flex" aria-hidden>{getCategoryIcon(cat, 12)}</span>}
              {cat}
              {count > 0 && <span aria-hidden className={cn('text-[0.62rem] tabular-nums font-bold', isActive ? 'text-[#C4B5FD]' : 'text-[color:var(--text-faint)]')}>{count}</span>}
            </button>
          );
        })}
      </motion.div>

      {/* Grid */}
      <motion.div
        variants={{ hidden: {}, show: { transition: stagger(0.035, 0.05) } }}
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
      >
        {filtered.map((auto) => {
          const isRunning = runningId === auto.id;
          const isStarred = starred.has(auto.id);
          const catColor = categoryColors[auto.category] ?? auto.category_color ?? '#A78BFA';
          return (
            <motion.div
              key={auto.id}
              variants={fadeUp}
              whileHover={{ y: -2, transition: { type: 'spring', stiffness: 320, damping: 24 } }}
              onClick={() =>
                auto.id === 'auto-001' ? navigate('/automations/brd/run')
                : auto.id === 'auto-diwan' ? navigate('/automations/diwan/run')
                : navigate(`/automations/${auto.id}`)
              }
              className="cursor-pointer rounded-2xl bg-white/[0.025] border border-white/[0.06] hover:border-white/[0.14] transition-colors p-4"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${catColor}20`, color: catColor, boxShadow: `inset 0 0 0 1px ${catColor}30` }}>
                    {getCategoryIcon(auto.category, 17)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[0.9rem] font-semibold text-white tracking-tight leading-tight mb-1 truncate">{auto.name}</h3>
                    <span className="text-[0.66rem] font-semibold px-2 py-0.5 rounded-md" style={{ background: `${catColor}1A`, color: catColor, border: `1px solid ${catColor}2A` }}>
                      {auto.category}
                    </span>
                  </div>
                </div>
                <button type="button" onClick={(e) => toggleStar(auto.id, e)} className="p-1" style={{ background: 'none', border: 'none' }}>
                  <Star size={14} style={{ color: isStarred ? '#F5B544' : 'var(--text-faint)', fill: isStarred ? '#F5B544' : 'none' }} />
                </button>
              </div>

              <p className="text-[0.78rem] text-[color:var(--text-muted)] leading-relaxed mb-3 line-clamp-2">
                {auto.description.length > 110 ? auto.description.slice(0, 110) + '…' : auto.description}
              </p>

              <div className="flex items-center gap-1.5 mb-3">
                <span className="flex items-center gap-1 text-[0.66rem] px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.07]">
                  <span className="uppercase tracking-[0.05em] text-[color:var(--text-faint)] font-semibold">IN</span>
                  <span className="text-[color:var(--text-secondary)]">{auto.input_type}</span>
                </span>
                <ArrowRight size={11} className="text-[color:var(--text-faint)]" />
                <span className="flex items-center gap-1 text-[0.66rem] px-2 py-0.5 rounded-md" style={{ background: `${catColor}10`, border: `1px solid ${catColor}22` }}>
                  <span className="uppercase tracking-[0.05em] font-semibold" style={{ color: catColor }}>OUT</span>
                  <span className="text-[color:var(--text-secondary)]">{auto.output_type}</span>
                </span>
              </div>

              {isRunning && (
                <div className="mb-2.5">
                  <div className="flex items-center justify-between mb-1 text-[0.7rem]">
                    <span className="flex items-center gap-1 text-[#A78BFA]"><Loader2 size={10} className="animate-spin" /> Processing… {runTimer}s</span>
                    <span className="text-[color:var(--text-faint)]">Est. {Math.max(0, 3 - runTimer)}s</span>
                  </div>
                  <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#7877C6] to-[#A78BFA] transition-all" style={{ width: `${Math.min(100, (runTimer / 3) * 100)}%` }} />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2.5 mb-2.5 border-t border-white/[0.05]">
                <span className="flex items-center gap-1 text-[0.7rem] text-[color:var(--text-faint)]">
                  <Clock size={10} /> {auto.last_run}
                </span>
                <span className="flex items-center gap-1 text-[0.7rem] font-semibold text-[#34D399]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
                  {auto.success_rate}%
                </span>
              </div>

              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleRun(auto.id); }}
                  disabled={!!runningId}
                  className={cn(
                    'flex-1 h-[34px] rounded-[10px] flex items-center justify-center gap-1.5 text-[0.78rem] font-semibold transition-all',
                    isRunning
                      ? 'bg-[rgba(120,119,198,0.12)] text-[#A78BFA]'
                      : 'bg-gradient-to-br from-[#7877C6] to-[#635BFF] text-white shadow-[0_2px_10px_rgba(99,91,255,0.35),inset_0_1px_0_rgba(255,255,255,0.2)] hover:shadow-[0_4px_18px_rgba(99,91,255,0.5)]',
                    runningId && !isRunning && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  {isRunning ? (<><Loader2 size={12} className="animate-spin" /> Running</>) : (<><Play size={12} /> Run Now</>)}
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); navigate(`/automations/${auto.id}`); }}
                  className="w-[34px] h-[34px] rounded-[10px] bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:text-white text-[color:var(--text-muted)] flex items-center justify-center transition-colors"
                  aria-label="Settings"
                >
                  <Settings2 size={13} />
                </button>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 right-6 z-[999] flex items-center gap-2 px-4 py-3 rounded-xl bg-[rgba(99,230,190,0.15)] border border-[rgba(99,230,190,0.3)] text-[#63E6BE] text-[0.82rem] font-semibold shadow-[var(--shadow-lg)]"
        >
          <CheckCircle size={15} /> {toast}
        </motion.div>
      )}
    </motion.div>
  );
}
