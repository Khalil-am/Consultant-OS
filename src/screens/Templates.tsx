import { useState, useRef, useEffect } from 'react';
import { useLayout } from '../hooks/useLayout';
import {
  Search, Eye, Plus, Star, FileText, BarChart3, Users,
  BookOpen, Table, AlertTriangle, CheckSquare, Globe,
  X, Copy, Sparkles, Loader2, Check, Edit3,
  ChevronRight, Download, Layers, Zap,
} from 'lucide-react';
import { templates as initialTemplates, type Template } from '../data/mockData';
import { chatWithDocument } from '../lib/openrouter';
import { getWorkspaces } from '../lib/db';
import type { WorkspaceRow } from '../lib/db';

// ── Extended local type ───────────────────────────────────────
interface TemplateItem extends Template {
  author?: string;
  createdAt?: string;
  isCustom?: boolean;
}

// ── Per-template section lists ────────────────────────────────
const TEMPLATE_SECTIONS: Record<string, string[]> = {
  'tpl-001': ['Executive Summary', 'Project Scope & Objectives', 'Stakeholder Register', 'Functional Requirements', 'Non-Functional Requirements', 'Use Cases', 'Data Requirements', 'Assumptions & Constraints', 'Sign-off Section'],
  'tpl-002': ['System Context Diagram', 'Process Flow Descriptions', 'Screen Wireframe Placeholders', 'Data Dictionary', 'Integration Requirements', 'Technical Appendix'],
  'tpl-003': ['Meeting Header & Quorum', 'Attendees Register', 'Agenda Items', 'Discussion Notes', 'Decisions & Resolutions', 'Action Table', 'Next Meeting Date'],
  'tpl-004': ['RAG Status Summary', 'Milestone Tracker', 'Financial Snapshot', 'Risk & Issues Summary', 'Upcoming Activities', 'Key Decisions Required'],
  'tpl-005': ['Evaluation Criteria Overview', 'Technical Scoring Matrix', 'Commercial Scoring Matrix', 'Compliance Checklist', 'Vendor Comparison Table', 'Recommendation Summary'],
  'tpl-006': ['Risk Register Header', 'Risk Identification Table', 'Probability/Impact Matrix', 'Risk Response Plans', 'Risk Owner Register', 'Review Schedule'],
  'tpl-007': ['User Persona Definition', 'Story Narrative (As a/I want/So that)', 'Acceptance Criteria', 'Dependencies', 'Story Points Estimation', 'Definition of Done'],
  'tpl-008': ['Workshop Objectives (EN/AR)', 'Participant Register (EN/AR)', 'Agenda (EN/AR)', 'Facilitation Notes', 'Key Outputs & Decisions', 'Action Items (EN/AR)'],
  'tpl-009': ['Current State Assessment', 'Target State Definition', 'Gap Identification Table', 'Capability Assessment Matrix', 'Prioritized Gap List', 'Remediation Roadmap'],
  'tpl-010': ['Executive Summary', 'Financial Tracker', 'Deliverables Status Table', 'Resource Utilisation', 'Risks & Issues Update', 'Lessons Learned', 'Forward Look'],
  'tpl-011': ['Decision Reference Register', 'Options Analysis', 'Decision Rationale', 'Owner & Date', 'Implementation Status', 'Review Dates'],
  'tpl-012': ['Project Overview (EN/AR)', 'Objectives & Scope (EN/AR)', 'Governance Structure (EN/AR)', 'Budget & Timeline (EN/AR)', 'Stakeholder Sign-off Pages'],
};

// ── Static data ───────────────────────────────────────────────
const CATEGORIES = ['BRD', 'FRD', 'Meetings', 'Reports', 'Procurement', 'Risk Register', 'User Stories', 'Bilingual', 'Other'];
const FORMATS = ['Word', 'PDF', 'Excel', 'PowerPoint'];
const LANGS = ['EN', 'AR'];
const ICONS = ['FileText', 'BarChart3', 'BookOpen', 'Table', 'AlertTriangle', 'CheckSquare', 'Users', 'Globe'];

const filterTabs = ['All', ...CATEGORIES];

const iconMap: Record<string, React.ReactNode> = {
  FileText: <FileText size={18} />,
  FileCode: <FileText size={18} />,
  ClipboardList: <CheckSquare size={18} />,
  BarChart3: <BarChart3 size={18} />,
  Table: <Table size={18} />,
  AlertTriangle: <AlertTriangle size={18} />,
  BookOpen: <BookOpen size={18} />,
  Users: <Users size={18} />,
  GitCompare: <FileText size={18} />,
  TrendingUp: <BarChart3 size={18} />,
  CheckSquare: <CheckSquare size={18} />,
  Globe: <Globe size={18} />,
};

const categoryColors: Record<string, string> = {
  BRD: '#0EA5E9',
  FRD: '#8B5CF6',
  Meetings: '#10B981',
  Reports: '#F59E0B',
  Procurement: '#EF4444',
  'Risk Register': '#F97316',
  'User Stories': '#06B6D4',
  Bilingual: '#EC4899',
  Other: '#64748B',
};

const formatColors: Record<string, { bg: string; text: string }> = {
  Word:       { bg: 'rgba(14,165,233,0.12)',  text: '#38BDF8' },
  PDF:        { bg: 'rgba(239,68,68,0.12)',   text: '#FCA5A5' },
  Excel:      { bg: 'rgba(16,185,129,0.12)',  text: '#34D399' },
  PowerPoint: { bg: 'rgba(245,158,11,0.12)',  text: '#FCD34D' },
};

// ── Empty form states ─────────────────────────────────────────
const emptyAddForm = {
  name: '',
  category: 'BRD',
  description: '',
  formats: ['Word'] as string[],
  languages: ['EN'] as string[],
  icon: 'FileText',
  sections: '',
  author: 'You',
};

const emptyUseForm = {
  workspaceId: '',
  client: '',
  projectName: '',
  context: '',
  requirements: '',
  language: 'EN' as 'EN' | 'AR' | 'Bilingual',
};

// ── Small helpers ─────────────────────────────────────────────
function SectionPill({ label }: { label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.375rem',
      padding: '0.3rem 0.625rem', borderRadius: '6px',
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
      fontSize: '0.72rem', color: '#94A3B8',
    }}>
      <ChevronRight size={10} style={{ color: '#475569', flexShrink: 0 }} />
      {label}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button onClick={handle} style={{
      display: 'flex', alignItems: 'center', gap: '0.375rem',
      padding: '0.4rem 0.875rem', borderRadius: '8px',
      background: copied ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.06)',
      border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}`,
      color: copied ? '#34D399' : '#94A3B8', fontSize: '0.78rem', fontWeight: 600,
      cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
    }}>
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
export default function Templates() {
  const { width, isMobile } = useLayout();
  const p = isMobile ? '0.875rem' : '1.5rem';

  // ── State ─────────────────────────────────────────────────
  const [allTemplates, setAllTemplates] = useState<TemplateItem[]>(
    initialTemplates.map(t => ({ ...t, author: 'System', createdAt: '2025-01-01', isCustom: false }))
  );
  const [starred, setStarred] = useState<Set<string>>(
    new Set(initialTemplates.filter(t => t.featured).map(t => t.id))
  );
  const [activeFilter, setActiveFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);

  // Modals
  const [previewTemplate, setPreviewTemplate] = useState<TemplateItem | null>(null);
  const [useTemplate, setUseTemplate] = useState<TemplateItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Add form
  const [addForm, setAddForm] = useState(emptyAddForm);
  const [addSaving, setAddSaving] = useState(false);

  // Use/Generate form
  const [useForm, setUseForm] = useState(emptyUseForm);
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [genError, setGenError] = useState('');

  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getWorkspaces().then(setWorkspaces).catch(() => {});
  }, []);

  // ── Derived ───────────────────────────────────────────────
  const featuredTemplates = allTemplates.filter(t => starred.has(t.id));

  const filtered = allTemplates.filter(t => {
    const matchFilter = activeFilter === 'All' || t.category === activeFilter;
    const matchSearch = !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  // ── Handlers ──────────────────────────────────────────────
  const toggleStar = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setStarred(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setAllTemplates(prev => prev.map(t => t.id === id ? { ...t, featured: !starred.has(id) } : t));
  };

  const handleAddTemplate = async () => {
    if (!addForm.name.trim() || !addForm.description.trim()) return;
    setAddSaving(true);
    await new Promise(r => setTimeout(r, 400)); // simulate save
    const newTpl: TemplateItem = {
      id: `tpl-custom-${Date.now()}`,
      name: addForm.name.trim(),
      category: addForm.category,
      description: addForm.description.trim(),
      formats: addForm.formats,
      languages: addForm.languages,
      icon: addForm.icon,
      usageCount: 0,
      featured: false,
      author: addForm.author || 'You',
      createdAt: new Date().toISOString().slice(0, 10),
      isCustom: true,
    };
    setAllTemplates(prev => [newTpl, ...prev]);
    setAddSaving(false);
    setShowAddModal(false);
    setAddForm(emptyAddForm);
  };

  const openUseModal = (tpl: TemplateItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setUseTemplate(tpl);
    setUseForm(emptyUseForm);
    setGeneratedContent('');
    setGenError('');
  };

  const handleGenerate = async () => {
    if (!useTemplate) return;
    setGenerating(true);
    setGeneratedContent('');
    setGenError('');

    const ws = workspaces.find(w => w.id === useForm.workspaceId);
    const wsName = ws?.name || useForm.client || 'the project';
    const sections = TEMPLATE_SECTIONS[useTemplate.id]?.join(', ') || useTemplate.description;

    const systemPrompt = `You are a senior consulting document specialist with 15+ years of experience in management consulting across GCC and MENA markets. You generate professional, comprehensive consulting documents that match Big-4 consulting firm quality standards.

Your output should be structured markdown with clear headings (##, ###), professional language, tables where appropriate, numbered lists for requirements/risks/decisions, and concrete placeholder guidance in [brackets] for client-specific information.`;

    const userMsg = `Generate a complete, professional "${useTemplate.name}" document.

Template Category: ${useTemplate.category}
Workspace / Project: ${wsName}
Client: ${useForm.client || wsName}
Project Name: ${useForm.projectName || wsName}
Language: ${useForm.language}
Context: ${useForm.context || 'Standard consulting engagement'}
Specific Requirements: ${useForm.requirements || 'Use standard sections'}

The document must include all these sections: ${sections}

Generate the full document in ${useForm.language === 'AR' ? 'Arabic' : useForm.language === 'Bilingual' ? 'both English and Arabic side-by-side' : 'English'}.

Output a professional, comprehensive, ready-to-use document. Use [CLIENT NAME], [DATE], [PROJECT NAME] etc. as placeholders where needed. Include realistic example content, not just headings.`;

    try {
      const result = await chatWithDocument([{ role: 'user', content: userMsg }], systemPrompt);
      setGeneratedContent(result);
      // Increment usage count
      setAllTemplates(prev => prev.map(t => t.id === useTemplate.id ? { ...t, usageCount: t.usageCount + 1 } : t));
      setTimeout(() => outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Generation failed. Please check your API key.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteCustom = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAllTemplates(prev => prev.filter(t => t.id !== id));
    setStarred(prev => { const next = new Set(prev); next.delete(id); return next; });
  };

  // ── Render helpers ────────────────────────────────────────
  const inputStyle = {
    width: '100%', padding: '0.6rem 0.875rem', background: '#080C18',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
    color: '#F1F5F9', fontSize: '0.82rem', fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box' as const,
  };
  const labelStyle = {
    fontSize: '0.72rem', fontWeight: 700 as const, color: '#64748B',
    display: 'block' as const, marginBottom: '0.375rem',
    textTransform: 'uppercase' as const, letterSpacing: '0.06em',
  };

  // ── RENDER ────────────────────────────────────────────────
  return (
    <div style={{ padding: p, display: 'flex', flexDirection: 'column', gap: '1.25rem', background: '#080C18', minHeight: '100%' }}>

      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#F1F5F9', letterSpacing: '-0.02em' }}>
            Template Library
          </h2>
          <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#475569' }}>
            {allTemplates.length} templates · {featuredTemplates.length} featured · AI-powered generation
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', fontWeight: 700 }}
        >
          <Plus size={15} /> New Template
        </button>
      </div>

      {/* ── Stats ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${width >= 900 ? 4 : 2}, 1fr)`, gap: '0.875rem' }}>
        {[
          { label: 'Total Templates', value: allTemplates.length, color: '#0EA5E9', icon: <Layers size={15} /> },
          { label: 'Featured', value: featuredTemplates.length, color: '#F59E0B', icon: <Star size={15} /> },
          { label: 'Bilingual', value: allTemplates.filter(t => t.languages.includes('AR')).length, color: '#10B981', icon: <Globe size={15} /> },
          { label: 'Total Uses', value: allTemplates.reduce((s, t) => s + t.usageCount, 0).toLocaleString(), color: '#8B5CF6', icon: <Zap size={15} /> },
        ].map(s => (
          <div key={s.label} style={{
            background: '#0C1220', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '12px', padding: '1rem 1.25rem',
            display: 'flex', alignItems: 'center', gap: '0.875rem',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${s.color}, transparent)` }} />
            <div style={{ padding: '0.5rem', borderRadius: '8px', background: `${s.color}18`, color: s.color, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: s.color, letterSpacing: '-0.02em', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: '0.68rem', color: '#475569', marginTop: '2px', fontWeight: 500 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Featured Templates ────────────────────────────── */}
      {featuredTemplates.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
            <Star size={13} style={{ color: '#F59E0B', fill: '#F59E0B' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#F1F5F9', letterSpacing: '-0.01em' }}>Featured Templates</span>
            <span style={{ fontSize: '0.68rem', padding: '1px 7px', borderRadius: '99px', background: 'rgba(245,158,11,0.12)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.2)', fontWeight: 700 }}>
              {featuredTemplates.length}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${width >= 1100 ? 4 : width >= 768 ? 3 : width >= 500 ? 2 : 1}, 1fr)`, gap: '0.875rem' }}>
            {featuredTemplates.slice(0, 8).map(tpl => {
              const color = categoryColors[tpl.category] || '#0EA5E9';
              return (
                <div
                  key={tpl.id}
                  style={{
                    background: '#0C1220', border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '12px', overflow: 'hidden', cursor: 'pointer',
                    transition: 'all 0.2s', position: 'relative',
                  }}
                  onClick={() => setPreviewTemplate(tpl)}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.borderColor = `${color}35`;
                    el.style.transform = 'translateY(-2px)';
                    el.style.boxShadow = `0 8px 24px ${color}15`;
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.borderColor = 'rgba(255,255,255,0.07)';
                    el.style.transform = 'translateY(0)';
                    el.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ height: '3px', background: `linear-gradient(90deg, ${color}, ${color}40)` }} />
                  <div style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <div style={{ padding: '0.575rem', borderRadius: '10px', background: `${color}18`, color }}>{iconMap[tpl.icon] || <FileText size={18} />}</div>
                      <button onClick={e => toggleStar(tpl.id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', lineHeight: 0 }}>
                        <Star size={13} style={{ color: '#F59E0B', fill: '#F59E0B' }} />
                      </button>
                    </div>
                    <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#F1F5F9', margin: '0 0 0.375rem', lineHeight: 1.35 }}>{tpl.name}</h3>
                    <p style={{ fontSize: '0.7rem', color: '#64748B', margin: '0 0 0.75rem', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {tpl.description}
                    </p>
                    <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                      {tpl.formats.slice(0, 2).map(fmt => (
                        <span key={fmt} style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: '3px', background: formatColors[fmt]?.bg, color: formatColors[fmt]?.text }}>{fmt}</span>
                      ))}
                      {tpl.languages.map(l => (
                        <span key={l} style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: '3px', background: l === 'AR' ? 'rgba(139,92,246,0.12)' : 'rgba(14,165,233,0.08)', color: l === 'AR' ? '#A78BFA' : '#38BDF8' }}>{l}</span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn-ghost"
                        style={{ flex: 1, height: '30px', fontSize: '0.72rem', justifyContent: 'center' }}
                        onClick={e => { e.stopPropagation(); setPreviewTemplate(tpl); }}
                      >
                        <Eye size={11} /> Preview
                      </button>
                      <button
                        className="btn-primary"
                        style={{ flex: 1, height: '30px', fontSize: '0.72rem', justifyContent: 'center' }}
                        onClick={e => openUseModal(tpl, e)}
                      >
                        <Sparkles size={11} /> Use
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Filter + Search bar ───────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.03)', padding: '3px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', overflowX: 'auto', maxWidth: '100%' }}>
          {filterTabs.map(tab => (
            <button key={tab} onClick={() => setActiveFilter(tab)} style={{
              padding: '0.35rem 0.75rem', borderRadius: '7px', border: 'none',
              cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
              fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.15s',
              background: activeFilter === tab ? 'rgba(0,212,255,0.12)' : 'transparent',
              color: activeFilter === tab ? '#00D4FF' : '#64748B',
            }}>
              {tab}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 0.875rem', height: '36px', borderRadius: '9px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', minWidth: '220px' }}>
          <Search size={13} style={{ color: '#64748B', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search templates…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '0.8rem', color: '#F1F5F9', width: '100%', fontFamily: 'inherit' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 0, lineHeight: 0 }}>
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ── All Templates Grid ────────────────────────────── */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#334155' }}>
          <FileText size={36} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
          <div style={{ fontWeight: 700, color: '#475569', marginBottom: '0.375rem' }}>No templates found</div>
          <div style={{ fontSize: '0.8rem' }}>Try a different filter or search term</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${width >= 1100 ? 3 : width >= 700 ? 2 : 1}, 1fr)`, gap: '0.875rem' }}>
          {filtered.map(tpl => {
            const color = categoryColors[tpl.category] || '#0EA5E9';
            const isStarred = starred.has(tpl.id);
            const sections = TEMPLATE_SECTIONS[tpl.id];
            return (
              <div
                key={tpl.id}
                style={{
                  background: '#0C1220', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '12px', overflow: 'hidden', cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onClick={() => setPreviewTemplate(tpl)}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = `${color}28`;
                  el.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = 'rgba(255,255,255,0.07)';
                  el.style.transform = 'translateY(0)';
                }}
              >
                {/* Color accent */}
                <div style={{ height: '2px', background: `linear-gradient(90deg, ${color}, transparent)` }} />
                <div style={{ padding: '1rem 1.125rem' }}>
                  {/* Header row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <div style={{ padding: '0.5rem', borderRadius: '8px', background: `${color}15`, color, flexShrink: 0 }}>
                        {iconMap[tpl.icon] || <FileText size={18} />}
                      </div>
                      <div>
                        <h3 style={{ fontSize: '0.84rem', fontWeight: 700, color: '#F1F5F9', margin: '0 0 3px', lineHeight: 1.3 }}>{tpl.name}</h3>
                        <span style={{ fontSize: '0.62rem', padding: '2px 7px', borderRadius: '4px', background: `${color}12`, color, border: `1px solid ${color}22`, fontWeight: 700 }}>
                          {tpl.category}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flexShrink: 0 }}>
                      {tpl.isCustom && (
                        <button
                          onClick={e => handleDeleteCustom(tpl.id, e)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#334155', lineHeight: 0, transition: 'color 0.15s' }}
                          title="Delete custom template"
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#EF4444'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#334155'; }}
                        >
                          <X size={12} />
                        </button>
                      )}
                      <button
                        onClick={e => toggleStar(tpl.id, e)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', lineHeight: 0 }}
                        title={isStarred ? 'Unfeature' : 'Feature this template'}
                      >
                        <Star size={13} style={{ color: isStarred ? '#F59E0B' : '#334155', fill: isStarred ? '#F59E0B' : 'none', transition: 'all 0.15s' }} />
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  <p style={{ fontSize: '0.75rem', color: '#64748B', lineHeight: 1.55, margin: '0 0 0.75rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {tpl.description}
                  </p>

                  {/* Sections preview */}
                  {sections && !isMobile && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.75rem' }}>
                      {sections.slice(0, 3).map(s => (
                        <span key={s} style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.04)', color: '#475569', border: '1px solid rgba(255,255,255,0.06)' }}>
                          {s}
                        </span>
                      ))}
                      {sections.length > 3 && (
                        <span style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.04)', color: '#334155' }}>
                          +{sections.length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Badges + usage */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '0.875rem' }}>
                    {tpl.formats.map(fmt => (
                      <span key={fmt} style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: '3px', background: formatColors[fmt]?.bg, color: formatColors[fmt]?.text }}>{fmt}</span>
                    ))}
                    {tpl.languages.map(l => (
                      <span key={l} style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: '3px', background: l === 'AR' ? 'rgba(139,92,246,0.12)' : 'rgba(14,165,233,0.08)', color: l === 'AR' ? '#A78BFA' : '#38BDF8' }}>{l}</span>
                    ))}
                    <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: '#334155' }}>{tpl.usageCount.toLocaleString()} uses</span>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="btn-ghost"
                      style={{ flex: 1, height: '32px', fontSize: '0.75rem', justifyContent: 'center' }}
                      onClick={e => { e.stopPropagation(); setPreviewTemplate(tpl); }}
                    >
                      <Eye size={12} /> Preview
                    </button>
                    <button
                      className="btn-primary"
                      style={{ flex: 1, height: '32px', fontSize: '0.75rem', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                      onClick={e => openUseModal(tpl, e)}
                    >
                      <Sparkles size={12} /> Use Template
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MODAL: Preview Template
      ══════════════════════════════════════════════════════ */}
      {previewTemplate && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(6px)' }}
          onClick={() => setPreviewTemplate(null)}
        >
          <div
            style={{ background: '#0C1220', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', width: '100%', maxWidth: '620px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.7)', position: 'relative' }}
            onClick={e => e.stopPropagation()}
          >
            {/* accent bar */}
            <div style={{ height: '3px', background: `linear-gradient(90deg, ${categoryColors[previewTemplate.category] || '#0EA5E9'}, transparent)`, flexShrink: 0 }} />

            {/* Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ padding: '0.75rem', borderRadius: '12px', background: `${categoryColors[previewTemplate.category] || '#0EA5E9'}18`, color: categoryColors[previewTemplate.category] || '#0EA5E9', flexShrink: 0 }}>
                  {iconMap[previewTemplate.icon] || <FileText size={22} />}
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#F1F5F9', letterSpacing: '-0.02em', marginBottom: '4px' }}>{previewTemplate.name}</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '5px', background: `${categoryColors[previewTemplate.category] || '#0EA5E9'}15`, color: categoryColors[previewTemplate.category] || '#0EA5E9', fontWeight: 700 }}>
                      {previewTemplate.category}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: '#475569' }}>{previewTemplate.usageCount.toLocaleString()} uses</span>
                    {previewTemplate.author && <span style={{ fontSize: '0.65rem', color: '#475569' }}>by {previewTemplate.author}</span>}
                    {previewTemplate.isCustom && <span style={{ fontSize: '0.62rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(16,185,129,0.12)', color: '#34D399', border: '1px solid rgba(16,185,129,0.2)' }}>Custom</span>}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setPreviewTemplate(null)}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', cursor: 'pointer', color: '#64748B', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#F1F5F9'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#64748B'; }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Description */}
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>Description</div>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#94A3B8', lineHeight: 1.65 }}>{previewTemplate.description}</p>
              </div>

              {/* Sections */}
              {TEMPLATE_SECTIONS[previewTemplate.id] && (
                <div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.625rem' }}>
                    Sections Included ({TEMPLATE_SECTIONS[previewTemplate.id].length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    {TEMPLATE_SECTIONS[previewTemplate.id].map((s, i) => (
                      <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.875rem', borderRadius: '8px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: categoryColors[previewTemplate.category] || '#0EA5E9', minWidth: '20px' }}>{String(i + 1).padStart(2, '0')}</span>
                        <span style={{ fontSize: '0.78rem', color: '#CBD5E1' }}>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Formats & Languages */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>Available Formats</div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {previewTemplate.formats.map(fmt => (
                      <span key={fmt} style={{ fontSize: '0.72rem', padding: '3px 9px', borderRadius: '5px', background: formatColors[fmt]?.bg, color: formatColors[fmt]?.text, fontWeight: 600 }}>{fmt}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>Languages</div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {previewTemplate.languages.map(l => (
                      <span key={l} style={{ fontSize: '0.72rem', padding: '3px 9px', borderRadius: '5px', background: l === 'AR' ? 'rgba(139,92,246,0.12)' : 'rgba(14,165,233,0.08)', color: l === 'AR' ? '#A78BFA' : '#38BDF8', fontWeight: 600 }}>{l === 'AR' ? 'Arabic' : 'English'}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '0.75rem', flexShrink: 0 }}>
              <button
                onClick={() => toggleStar(previewTemplate.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 700, transition: 'all 0.15s',
                  background: starred.has(previewTemplate.id) ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${starred.has(previewTemplate.id) ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.1)'}`,
                  color: starred.has(previewTemplate.id) ? '#FCD34D' : '#94A3B8',
                }}
              >
                <Star size={14} style={{ fill: starred.has(previewTemplate.id) ? '#FCD34D' : 'none' }} />
                {starred.has(previewTemplate.id) ? 'Unfeature' : 'Feature'}
              </button>
              <button
                onClick={() => { setPreviewTemplate(null); openUseModal(previewTemplate); }}
                className="btn-primary"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 700 }}
              >
                <Sparkles size={14} /> Use This Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MODAL: Use / Generate with AI
      ══════════════════════════════════════════════════════ */}
      {useTemplate && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(8px)' }}
          onClick={() => { if (!generating) setUseTemplate(null); }}
        >
          <div
            style={{ background: '#0A1220', border: '1px solid rgba(139,92,246,0.25)', borderRadius: '18px', width: '100%', maxWidth: '760px', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.8)', position: 'relative' }}
            onClick={e => e.stopPropagation()}
          >
            {/* top shimmer */}
            <div style={{ height: '2px', background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.8), rgba(0,212,255,0.6), transparent)', flexShrink: 0 }} />

            {/* Modal header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(0,212,255,0.15))', border: '1px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Sparkles size={18} style={{ color: '#A78BFA' }} />
                </div>
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#F1F5F9', letterSpacing: '-0.01em' }}>Generate with AI</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '1px' }}>{useTemplate.name}</div>
                </div>
              </div>
              <button
                onClick={() => { if (!generating) setUseTemplate(null); }}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', cursor: 'pointer', color: '#64748B', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                disabled={generating}
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable body */}
            <div style={{ overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Input form */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.875rem' }}>
                <div>
                  <label style={labelStyle}>Workspace</label>
                  <select
                    value={useForm.workspaceId}
                    onChange={e => setUseForm(f => ({ ...f, workspaceId: e.target.value }))}
                    style={inputStyle}
                    disabled={generating}
                  >
                    <option value="">Select workspace…</option>
                    {workspaces.map(ws => <option key={ws.id} value={ws.id}>{ws.name}</option>)}
                    <option value="custom">Other / Custom</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Client / Organisation</label>
                  <input
                    type="text"
                    placeholder="e.g. National Communications Authority"
                    value={useForm.client}
                    onChange={e => setUseForm(f => ({ ...f, client: e.target.value }))}
                    style={inputStyle}
                    disabled={generating}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Project Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Digital Transformation Phase 2"
                    value={useForm.projectName}
                    onChange={e => setUseForm(f => ({ ...f, projectName: e.target.value }))}
                    style={inputStyle}
                    disabled={generating}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Output Language</label>
                  <select
                    value={useForm.language}
                    onChange={e => setUseForm(f => ({ ...f, language: e.target.value as 'EN' | 'AR' | 'Bilingual' }))}
                    style={inputStyle}
                    disabled={generating}
                  >
                    <option value="EN">English</option>
                    {useTemplate.languages.includes('AR') && <option value="AR">Arabic</option>}
                    {useTemplate.languages.includes('AR') && <option value="Bilingual">Bilingual (EN + AR)</option>}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Context & Background</label>
                  <textarea
                    rows={3}
                    placeholder="Briefly describe the project context, objectives, current situation…"
                    value={useForm.context}
                    onChange={e => setUseForm(f => ({ ...f, context: e.target.value }))}
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.55 }}
                    disabled={generating}
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Specific Requirements (optional)</label>
                  <textarea
                    rows={2}
                    placeholder="Any specific sections, tone, constraints, or details to include…"
                    value={useForm.requirements}
                    onChange={e => setUseForm(f => ({ ...f, requirements: e.target.value }))}
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.55 }}
                    disabled={generating}
                  />
                </div>
              </div>

              {/* Sections to be generated */}
              {TEMPLATE_SECTIONS[useTemplate.id] && (
                <div style={{ padding: '0.875rem 1.125rem', borderRadius: '10px', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#A78BFA', marginBottom: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    AI will generate {TEMPLATE_SECTIONS[useTemplate.id].length} sections
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                    {TEMPLATE_SECTIONS[useTemplate.id].map(s => <SectionPill key={s} label={s} />)}
                  </div>
                </div>
              )}

              {/* Generate button */}
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="btn-primary"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.625rem', padding: '0.875rem', fontSize: '0.9rem', fontWeight: 800, borderRadius: '10px', opacity: generating ? 0.8 : 1 }}
              >
                {generating ? (
                  <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Generating document…</>
                ) : (
                  <><Sparkles size={16} /> Generate {useTemplate.name}</>
                )}
              </button>

              {/* Error */}
              {genError && (
                <div style={{ padding: '0.875rem 1.125rem', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#FCA5A5', fontSize: '0.8rem', lineHeight: 1.5 }}>
                  <strong>Error:</strong> {genError}
                </div>
              )}

              {/* Generated output */}
              {generatedContent && (
                <div ref={outputRef}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px rgba(16,185,129,0.8)' }} />
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#34D399' }}>Document Generated</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <CopyButton text={generatedContent} />
                      <button
                        onClick={() => {
                          const blob = new Blob([generatedContent], { type: 'text/markdown' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `${useTemplate.name.replace(/\s+/g, '_')}.md`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.375rem',
                          padding: '0.4rem 0.875rem', borderRadius: '8px',
                          background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.25)',
                          color: '#38BDF8', fontSize: '0.78rem', fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        <Download size={13} /> Download .md
                      </button>
                    </div>
                  </div>
                  <div style={{
                    background: '#060A12', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '10px', padding: '1.25rem',
                    fontSize: '0.82rem', color: '#CBD5E1', lineHeight: 1.75,
                    whiteSpace: 'pre-wrap', fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    maxHeight: '420px', overflowY: 'auto',
                  }}>
                    {generatedContent}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MODAL: Add New Template
      ══════════════════════════════════════════════════════ */}
      {showAddModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(6px)' }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            style={{ background: '#0C1220', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.7)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ height: '2px', background: 'linear-gradient(90deg, #0EA5E9, #8B5CF6)', flexShrink: 0 }} />

            {/* Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#F1F5F9' }}>New Template</h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.72rem', color: '#475569' }}>Create a reusable document template</p>
              </div>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', cursor: 'pointer', color: '#64748B', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <div style={{ overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Template Name *</label>
                <input type="text" placeholder="e.g. Change Request Form" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                <div>
                  <label style={labelStyle}>Category *</label>
                  <select value={addForm.category} onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))} style={inputStyle}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Icon</label>
                  <select value={addForm.icon} onChange={e => setAddForm(f => ({ ...f, icon: e.target.value }))} style={inputStyle}>
                    {ICONS.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Description *</label>
                <textarea rows={3} placeholder="Describe the template purpose, what it covers, and when to use it…" value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.55 }} />
              </div>

              <div>
                <label style={labelStyle}>Sections (comma separated)</label>
                <input type="text" placeholder="e.g. Executive Summary, Background, Analysis, Recommendations" value={addForm.sections} onChange={e => setAddForm(f => ({ ...f, sections: e.target.value }))} style={inputStyle} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                <div>
                  <label style={labelStyle}>Formats</label>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.375rem' }}>
                    {FORMATS.map(fmt => {
                      const active = addForm.formats.includes(fmt);
                      return (
                        <button key={fmt} onClick={() => setAddForm(f => ({ ...f, formats: active ? f.formats.filter(x => x !== fmt) : [...f.formats, fmt] }))} style={{
                          padding: '3px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, fontFamily: 'inherit', transition: 'all 0.15s',
                          background: active ? (formatColors[fmt]?.bg || 'rgba(255,255,255,0.1)') : 'rgba(255,255,255,0.04)',
                          color: active ? (formatColors[fmt]?.text || '#F1F5F9') : '#475569',
                          border: `1px solid ${active ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.07)'}`,
                        }}>
                          {fmt}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Languages</label>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.375rem' }}>
                    {LANGS.map(l => {
                      const active = addForm.languages.includes(l);
                      return (
                        <button key={l} onClick={() => setAddForm(f => ({ ...f, languages: active ? f.languages.filter(x => x !== l) : [...f.languages, l] }))} style={{
                          padding: '3px 14px', borderRadius: '5px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, fontFamily: 'inherit', transition: 'all 0.15s',
                          background: active ? (l === 'AR' ? 'rgba(139,92,246,0.15)' : 'rgba(14,165,233,0.12)') : 'rgba(255,255,255,0.04)',
                          color: active ? (l === 'AR' ? '#A78BFA' : '#38BDF8') : '#475569',
                          border: `1px solid ${active ? (l === 'AR' ? 'rgba(139,92,246,0.3)' : 'rgba(14,165,233,0.25)') : 'rgba(255,255,255,0.07)'}`,
                        }}>
                          {l === 'AR' ? 'Arabic' : 'English'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Author</label>
                <input type="text" placeholder="Your name" value={addForm.author} onChange={e => setAddForm(f => ({ ...f, author: e.target.value }))} style={inputStyle} />
              </div>

              {/* Preview of new template card */}
              {addForm.name && (
                <div style={{ padding: '0.875rem 1rem', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>Preview</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ padding: '0.5rem', borderRadius: '8px', background: `${categoryColors[addForm.category] || '#0EA5E9'}15`, color: categoryColors[addForm.category] || '#0EA5E9', flexShrink: 0 }}>
                      {iconMap[addForm.icon] || <FileText size={18} />}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#F1F5F9' }}>{addForm.name}</div>
                      <span style={{ fontSize: '0.62rem', padding: '2px 7px', borderRadius: '4px', background: `${categoryColors[addForm.category] || '#0EA5E9'}12`, color: categoryColors[addForm.category] || '#0EA5E9', fontWeight: 700 }}>
                        {addForm.category}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '0.75rem', flexShrink: 0 }}>
              <button className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowAddModal(false)}>Cancel</button>
              <button
                className="btn-primary"
                style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 800 }}
                onClick={handleAddTemplate}
                disabled={addSaving || !addForm.name.trim() || !addForm.description.trim()}
              >
                {addSaving ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</> : <><Edit3 size={14} /> Create Template</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
