-- ============================================================
-- CONSULTANT OS – Automation Tables Migration
-- BRD Processing System — Phase 1
-- Run this in the Supabase SQL Editor after schema.sql
-- ============================================================

-- ============================================================
-- PROMPT TEMPLATES
-- Stores versioned prompt templates for each automation type
-- ============================================================
create table if not exists prompt_templates (
  id text primary key,
  name text not null,
  automation_type text not null,
  version text not null default 'v1',
  system_prompt text not null default '',
  user_prompt_template text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- AUTOMATION RUNS
-- One record per BRD processing run
-- ============================================================
create table if not exists automation_runs (
  id text primary key,
  workspace_id text references workspaces(id) on delete set null,
  user_id text not null,
  automation_type text not null,
  prompt_template_id text references prompt_templates(id) on delete set null,
  status text not null default 'draft' check (status in (
    'draft', 'queued', 'running', 'parsing', 'quality_check',
    'analyzing_sample', 'extracting_requirements', 'generating_sections',
    'validating', 'exporting', 'completed', 'needs_review', 'failed'
  )),
  options_json text not null default '{}',
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- AUTOMATION RUN FILES
-- Tracks every file associated with a run (input, sample, output, intermediate)
-- ============================================================
create table if not exists automation_run_files (
  id uuid primary key default uuid_generate_v4(),
  run_id text not null references automation_runs(id) on delete cascade,
  file_role text not null check (file_role in ('input', 'sample', 'output', 'intermediate')),
  file_name text not null,
  mime_type text not null default 'application/octet-stream',
  storage_url text not null,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

-- ============================================================
-- AUTOMATION RUN EVENTS
-- Audit log of every stage transition, artifact storage, and callback
-- Used by n8n to store intermediate JSON artifacts
-- ============================================================
create table if not exists automation_run_events (
  id uuid primary key default uuid_generate_v4(),
  run_id text not null references automation_runs(id) on delete cascade,
  event_type text not null,
  stage_name text not null,
  payload_json text not null default '{}',
  created_at timestamptz not null default now()
);

-- ============================================================
-- AUTOMATION RUN SECTIONS
-- One row per generated BRD section, allowing section-level retries
-- ============================================================
create table if not exists automation_run_sections (
  id uuid primary key default uuid_generate_v4(),
  run_id text not null references automation_runs(id) on delete cascade,
  section_name text not null,
  section_index integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'approved', 'rejected', 'regenerating')),
  content text not null default '',
  confidence numeric(4,3) not null default 0.8 check (confidence >= 0 and confidence <= 1),
  validation_notes text not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(run_id, section_name)
);

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_automation_runs_workspace on automation_runs(workspace_id);
create index if not exists idx_automation_runs_status on automation_runs(status);
create index if not exists idx_automation_runs_created on automation_runs(created_at desc);
create index if not exists idx_automation_run_files_run on automation_run_files(run_id);
create index if not exists idx_automation_run_events_run on automation_run_events(run_id);
create index if not exists idx_automation_run_events_type on automation_run_events(event_type);
create index if not exists idx_automation_run_sections_run on automation_run_sections(run_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table prompt_templates enable row level security;
alter table automation_runs enable row level security;
alter table automation_run_files enable row level security;
alter table automation_run_events enable row level security;
alter table automation_run_sections enable row level security;

-- Allow full anon access (tighten to auth-based policies in production)
do $$ declare t text; begin
  foreach t in array array[
    'prompt_templates','automation_runs','automation_run_files',
    'automation_run_events','automation_run_sections'
  ] loop
    execute format('create policy "anon_all_%s" on %s for all using (true) with check (true)', t, t);
  end loop;
end $$;

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
do $$ declare t text; begin
  foreach t in array array['automation_runs','automation_run_sections','prompt_templates'] loop
    execute format('drop trigger if exists set_updated_at on %s', t);
    execute format('create trigger set_updated_at before update on %s for each row execute function update_updated_at()', t);
  end loop;
end $$;

-- ============================================================
-- SEED: PROMPT TEMPLATES
-- ============================================================
insert into prompt_templates (id, name, automation_type, version, system_prompt, user_prompt_template, active) values
(
  'brd_standard_v1',
  'BRD Standard Generator',
  'brd_generator',
  'v1',
  'You are a senior consulting business analyst and enterprise documentation specialist.
Your task is to generate high-quality Business Requirements Documents from uploaded source BRDs or meeting requirement notes.
Always preserve factual alignment with the source material.
Use the sample document as a structural and stylistic guide, not as a source of invented facts.
Never hallucinate project facts that are not grounded in the source.
If data is missing, write a clearly marked assumption or open question.
Return structured outputs exactly in the requested schema.',
  'Generate a comprehensive BRD from the provided source document following the standard consulting format. Input: {{input_document}}',
  true
),
(
  'brd_government_v1',
  'BRD Government/Public Sector',
  'brd_generator',
  'v1',
  'You are a senior consulting business analyst specializing in government digital transformation projects.
Generate formal Business Requirements Documents appropriate for public sector clients.
Use formal Arabic/English bilingual-ready language where indicated.
Apply numbered requirements (FR-001, NFR-001) with Must/Should/Nice priority levels.',
  'Generate a government-sector BRD from the provided requirements document. Input: {{input_document}}',
  true
),
(
  'brd_agile_v1',
  'BRD Agile / Product Format',
  'brd_generator',
  'v1',
  'You are a senior product manager and business analyst.
Generate BRDs structured for agile delivery teams, with user stories, acceptance criteria, and sprint-ready requirements.
Keep language clear, concise, and developer-friendly.',
  'Generate an agile-format BRD with user stories and acceptance criteria from the provided requirements. Input: {{input_document}}',
  true
)
on conflict (id) do nothing;
