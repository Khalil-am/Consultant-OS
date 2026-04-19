import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, ChevronRight, X, AlertCircle, Briefcase } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLayout } from '../hooks/useLayout';
import {
  getWorkspaces, getWorkspaceFinancials, getWorkspaceRagStatuses, createWorkspace,
  upsertWorkspaceFinancial,
  type WorkspaceRow, type WorkspaceFinancialRow, type WorkspaceRagStatusRow,
} from '../lib/db';
import { Badge, Progress, cn, fadeUp, stagger } from '../components/ui';

const filterTabs = ['All', 'Client', 'Project', 'Internal', 'Procurement', 'Committee'] as const;
type Filter = typeof filterTabs[number];

const sectorColors: Record<string, string> = {
  Government: '#7877C6', Energy: '#F5B544', Healthcare: '#34D399',
  Infrastructure: '#A78BFA', 'Financial Services': '#F0A875',
  Internal: '#8790A8', Retail: '#F472B6', Technology: '#7DD3FC', Education: '#63E6BE',
};

const RAG_COLORS: Record<string, string> = { Green: '#34D399', Amber: '#F5B544', Red: '#FF6B6B' };

const SECTORS = ['Government', 'Energy', 'Healthcare', 'Infrastructure', 'Financial Services', 'Retail', 'Technology', 'Education', 'Internal'];
const TYPES = ['Client', 'Project', 'Internal', 'Procurement', 'Committee'] as const;
const LANGUAGES = ['EN', 'AR', 'Bilingual'] as const;

interface NewWorkspaceForm {
  name: string; client: string; sector: string; type: typeof TYPES[number];
  language: typeof LANGUAGES[number]; description: string;
}

const defaultForm: NewWorkspaceForm = {
  name: '', client: '', sector: 'Government', type: 'Client', language: 'EN', description: '',
};

function fmtSAR(val: number): string {
  if (val >= 1_000_000) return `SAR ${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `SAR ${(val / 1_000).toFixed(0)}K`;
  return `SAR ${val.toLocaleString()}`;
}

export default function Workspaces() {
  const navigate = useNavigate();
  const { width, isMobile } = useLayout();

  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [financials, setFinancials] = useState<WorkspaceFinancialRow[]>([]);
  const [ragData, setRagData] = useState<WorkspaceRagStatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeFilter, setActiveFilter] = useState<Filter>('All');
  const [search, setSearch] = useState('');

  const [showNewModal, setShowNewModal] = useState(false);
  const [form, setForm] = useState<NewWorkspaceForm>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ws, fin, rag] = await Promise.all([
        getWorkspaces(),
        getWorkspaceFinancials().catch(() => [] as WorkspaceFinancialRow[]),
        getWorkspaceRagStatuses().catch(() => [] as WorkspaceRagStatusRow[]),
      ]);
      setWorkspaces(ws);
      setFinancials(fin);
      setRagData(rag);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = workspaces.filter((ws) => {
    const matchFilter = activeFilter === 'All' || ws.type === activeFilter;
    const q = search.toLowerCase();
    const matchSearch = ws.name.toLowerCase().includes(q) || ws.client.toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  const gridCols = width >= 1200 ? 3 : width >= 768 ? 2 : 1;

  const handleCreateWorkspace = async () => {
    if (!form.name.trim() || !form.client.trim()) {
      setFormError('Name and client are required.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const id = `ws-${Date.now()}`;
      const sectorColor = sectorColors[form.sector] ?? '#7877C6';
      const newWs = await createWorkspace({
        id, name: form.name.trim(), client: form.client.trim(),
        sector: form.sector, sector_color: sectorColor, type: form.type,
        language: form.language, progress: 0, status: 'Active',
        docs_count: 0, meetings_count: 0, tasks_count: 0,
        contributors: [], last_activity: 'Just now',
        description: form.description.trim(),
      });
      await upsertWorkspaceFinancial({
        id: `fin-${Date.now()}`, workspace_id: newWs.id, workspace_name: newWs.name,
        contract_value: 0, spent: 0, forecast: 0, variance: 0,
        currency: 'SAR', billing_model: 'Fixed Fee', last_invoice: '', next_milestone_value: 0,
      });
      setShowNewModal(false);
      setForm(defaultForm);
      await loadData();
    } catch (e: unknown) {
      setFormError((e as Error).message ?? 'Failed to create workspace');
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <div className="screen-container items-center pt-20">
        <div className="w-14 h-14 rounded-full bg-[rgba(255,107,107,0.12)] flex items-center justify-center mb-2">
          <AlertCircle size={22} className="text-[#FCA5A5]" />
        </div>
        <div className="text-[0.95rem] font-semibold text-[#FCA5A5]">Failed to load workspaces</div>
        <div className="text-[0.78rem] text-[color:var(--text-muted)] max-w-md text-center">{error}</div>
        <button className="btn-ghost" onClick={() => loadData()}>Retry</button>
      </div>
    );
  }

  const totalContract = financials.reduce((s, f) => s + f.contract_value, 0);

  return (
    <motion.div
      initial="hidden" animate="show"
      variants={{ hidden: {}, show: { transition: stagger(0.05, 0.08) } }}
      className="screen-container"
    >
      {/* ── Header ──────────────────────────────────── */}
      <motion.div variants={fadeUp} className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-[1.5rem] md:text-[1.75rem] font-semibold tracking-[-0.025em] leading-tight text-white">Workspaces</h1>
          <p className="text-[0.82rem] text-[color:var(--text-muted)] mt-1">
            {workspaces.length} total {totalContract > 0 && <>· {fmtSAR(totalContract)} portfolio</>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex items-center gap-2 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-md px-3.5 h-[38px] w-full sm:w-[280px]">
            <Search size={14} className="text-[color:var(--text-muted)] flex-shrink-0" />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search workspaces…"
              className="flex-1 bg-transparent border-0 outline-none text-[0.83rem] text-white placeholder:text-[color:var(--text-faint)] min-w-0"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-[color:var(--text-muted)] hover:text-white transition-colors">
                <X size={13} />
              </button>
            )}
          </div>
          <button onClick={() => setShowNewModal(true)} className="btn-primary">
            <Plus size={14} />
            New workspace
          </button>
        </div>
      </motion.div>

      {/* ── Filter pills ─────────────────────────────── */}
      <motion.div variants={fadeUp} className="flex items-center gap-1.5 flex-wrap">
        {filterTabs.map((tab) => {
          const count = tab === 'All' ? workspaces.length : workspaces.filter((w) => w.type === tab).length;
          const isActive = activeFilter === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={cn(
                'relative px-3.5 py-1.5 rounded-full text-[0.78rem] font-medium transition-colors flex items-center gap-1.5',
                isActive
                  ? 'bg-[rgba(120,119,198,0.18)] text-white border border-[rgba(120,119,198,0.35)]'
                  : 'bg-white/[0.03] text-[color:var(--text-muted)] border border-white/[0.06] hover:text-white hover:bg-white/[0.06]',
              )}
            >
              {tab}
              <span className={cn('text-[0.65rem] font-bold tabular-nums', isActive ? 'text-[#C4B5FD]' : 'text-[color:var(--text-faint)]')}>{count}</span>
            </button>
          );
        })}
      </motion.div>

      {/* ── Grid ─────────────────────────────────────── */}
      {loading ? (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0,1fr))` }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-white/[0.025] border border-white/[0.06] p-4 h-[140px] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div variants={fadeUp} className="section-card p-10 flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center">
            <Briefcase size={18} className="text-[color:var(--text-muted)]" />
          </div>
          <div className="text-[0.95rem] font-semibold text-white">No workspaces found</div>
          <div className="text-[0.78rem] text-[color:var(--text-muted)] max-w-sm">
            {search ? `No workspaces match "${search}".` : activeFilter !== 'All' ? `No ${activeFilter} workspaces yet.` : 'Create your first workspace to get started.'}
          </div>
          {!search && activeFilter === 'All' && (
            <button onClick={() => setShowNewModal(true)} className="btn-primary mt-1">
              <Plus size={14} /> New workspace
            </button>
          )}
        </motion.div>
      ) : (
        <motion.div
          variants={{ hidden: {}, show: { transition: stagger(0.04, 0.05) } }}
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0,1fr))` }}
        >
          {filtered.map((ws) => {
            const fin = financials.find((f) => f.workspace_id === ws.id);
            const rag = ragData.find((r) => r.workspace_id === ws.id);
            const sectorColor = sectorColors[ws.sector] ?? '#7877C6';
            const ragColor = rag ? RAG_COLORS[rag.rag] ?? '#8790A8' : null;
            const progressTone = ws.progress >= 80 ? 'mint' : ws.progress >= 50 ? 'brand' : 'amber';
            return (
              <motion.button
                key={ws.id}
                variants={fadeUp}
                whileHover={{ y: -2, transition: { type: 'spring', stiffness: 320, damping: 24 } }}
                onClick={() => navigate(`/workspaces/${ws.id}`)}
                className="group text-left rounded-2xl bg-white/[0.025] border border-white/[0.06] hover:border-white/[0.14] hover:bg-white/[0.04] transition-colors p-4"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <span className="w-1 self-stretch rounded-full flex-shrink-0 mt-1" style={{ background: sectorColor }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <h3 className="text-[0.92rem] font-semibold text-white tracking-tight truncate">{ws.name}</h3>
                        {ragColor && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: ragColor, boxShadow: `0 0 6px ${ragColor}99` }} />}
                      </div>
                      <div className="text-[0.74rem] text-[color:var(--text-muted)] truncate">{ws.client}</div>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-[color:var(--text-faint)] group-hover:text-white transition-colors flex-shrink-0 mt-1" />
                </div>

                <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                  <span className="text-[0.66rem] font-semibold px-2 py-0.5 rounded-md" style={{ background: `${sectorColor}20`, color: sectorColor }}>{ws.sector}</span>
                  <span className="text-[0.66rem] font-medium px-2 py-0.5 rounded-md bg-white/[0.04] text-[color:var(--text-muted)]">{ws.type}</span>
                </div>

                <div className="flex items-center justify-between text-[0.7rem] mb-1.5">
                  <span className="text-[color:var(--text-muted)]">Progress</span>
                  <span className="text-white font-semibold tabular-nums">{ws.progress}%</span>
                </div>
                <Progress value={ws.progress} tone={progressTone} size="sm" className="mb-3" />

                <div className="flex items-center justify-between text-[0.72rem]">
                  <span className="text-[color:var(--text-faint)]">{ws.last_activity || '—'}</span>
                  {fin && <span className="text-[color:var(--text-secondary)] font-semibold tabular-nums">{fmtSAR(fin.contract_value)}</span>}
                </div>
              </motion.button>
            );
          })}
        </motion.div>
      )}

      {/* ── New Workspace Modal ──────────────────── */}
      <AnimatePresence>
        {showNewModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowNewModal(false); }}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              className="glass-elevated w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between mb-5">
                <div>
                  <div className="text-[1.05rem] font-semibold text-white tracking-tight">New workspace</div>
                  <div className="text-[0.76rem] text-[color:var(--text-muted)] mt-0.5">Create a new client engagement.</div>
                </div>
                <button
                  onClick={() => { setShowNewModal(false); setForm(defaultForm); setFormError(''); }}
                  className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[color:var(--text-muted)] hover:bg-white/[0.08] hover:text-white transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {formError && (
                <div className="flex items-center gap-2 px-3.5 py-2.5 mb-4 rounded-xl bg-[rgba(255,107,107,0.08)] border border-[rgba(255,107,107,0.2)] text-[#FCA5A5] text-[0.78rem]">
                  <AlertCircle size={13} className="flex-shrink-0" />{formError}
                </div>
              )}

              <div className="space-y-4">
                <Field label="Workspace name *">
                  <input
                    type="text" value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. ADNOC Digital Transformation"
                    className="input-field"
                  />
                </Field>
                <Field label="Client / organization *">
                  <input
                    type="text" value={form.client}
                    onChange={(e) => setForm((f) => ({ ...f, client: e.target.value }))}
                    placeholder="e.g. Abu Dhabi National Oil Company"
                    className="input-field"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Sector">
                    <select value={form.sector} onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))} className="input-field">
                      {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="Type">
                    <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as typeof TYPES[number] }))} className="input-field">
                      {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Language">
                  <div className="grid grid-cols-3 gap-2">
                    {LANGUAGES.map((l) => (
                      <button
                        key={l}
                        onClick={() => setForm((f) => ({ ...f, language: l }))}
                        className={cn(
                          'py-2 rounded-lg text-[0.78rem] font-semibold transition-colors border',
                          form.language === l
                            ? 'bg-[rgba(120,119,198,0.18)] border-[rgba(120,119,198,0.35)] text-white'
                            : 'bg-white/[0.03] border-white/[0.08] text-[color:var(--text-muted)] hover:text-white',
                        )}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Description">
                  <textarea
                    rows={3} value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Brief description of scope and objectives…"
                    className="input-field resize-y"
                  />
                </Field>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button className="btn-ghost" onClick={() => { setShowNewModal(false); setForm(defaultForm); setFormError(''); }}>Cancel</button>
                  <button className="btn-primary min-w-[140px] justify-center" onClick={handleCreateWorkspace} disabled={saving}>
                    {saving ? (
                      <>
                        <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        Creating…
                      </>
                    ) : (
                      <><Plus size={14} /> Create</>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[0.7rem] font-semibold tracking-[0.08em] uppercase text-[color:var(--text-muted)] mb-1.5">{label}</label>
      {children}
    </div>
  );
}
