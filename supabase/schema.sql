-- ============================================================
-- CONSULTANT OS – Supabase Schema (v2)
-- Run this in the Supabase SQL Editor
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- WORKSPACES
-- ============================================================
create table if not exists workspaces (
  id text primary key,
  name text not null,
  client text not null,
  sector text not null,
  sector_color text not null default '#0EA5E9',
  type text not null check (type in ('Client', 'Project', 'Internal', 'Procurement', 'Committee')),
  language text not null check (language in ('EN', 'AR', 'Bilingual')) default 'EN',
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  status text not null check (status in ('Active', 'On Hold', 'Completed')) default 'Active',
  docs_count integer not null default 0,
  meetings_count integer not null default 0,
  tasks_count integer not null default 0,
  contributors text[] not null default '{}',
  last_activity text not null default 'Just now',
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- WORKSPACE FINANCIALS
-- ============================================================
create table if not exists workspace_financials (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  contract_value numeric not null default 0,
  spent numeric not null default 0,
  forecast numeric not null default 0,
  variance numeric not null default 0,
  currency text not null default 'AED',
  billing_model text not null default 'Fixed Fee',
  last_invoice text not null default '',
  next_milestone_value numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- WORKSPACE RAG STATUS
-- ============================================================
create table if not exists workspace_rag_status (
  id text primary key,
  workspace_id text not null unique references workspaces(id) on delete cascade,
  rag text not null check (rag in ('Green', 'Amber', 'Red')) default 'Green',
  budget text not null check (budget in ('Green', 'Amber', 'Red')) default 'Green',
  schedule text not null check (schedule in ('Green', 'Amber', 'Red')) default 'Green',
  risk text not null check (risk in ('Green', 'Amber', 'Red')) default 'Green',
  last_updated text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- MILESTONES
-- ============================================================
create table if not exists milestones (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  title text not null,
  due_date text not null,
  status text not null check (status in ('Completed', 'On Track', 'At Risk', 'Delayed', 'Upcoming')) default 'Upcoming',
  value numeric not null default 0,
  owner text not null default '',
  completion_pct integer not null default 0 check (completion_pct >= 0 and completion_pct <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- DOCUMENTS
-- ============================================================
create table if not exists documents (
  id text primary key,
  name text not null,
  type text not null,
  type_color text not null default '#0EA5E9',
  workspace text not null,
  workspace_id text not null references workspaces(id) on delete cascade,
  date text not null,
  language text not null check (language in ('EN', 'AR', 'Bilingual')) default 'EN',
  status text not null check (status in ('Draft', 'Approved', 'Under Review', 'Final')) default 'Draft',
  size text not null default '0 KB',
  author text not null,
  pages integer not null default 1,
  summary text not null default '',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- MEETINGS
-- ============================================================
create table if not exists meetings (
  id text primary key,
  title text not null,
  date text not null,
  time text not null,
  duration text not null,
  type text not null check (type in ('Workshop', 'Committee', 'Steering', 'Review', 'Kickoff', 'Standup')),
  status text not null check (status in ('Upcoming', 'In Progress', 'Completed')) default 'Upcoming',
  participants text[] not null default '{}',
  workspace text not null,
  workspace_id text not null references workspaces(id) on delete cascade,
  minutes_generated boolean not null default false,
  actions_extracted integer not null default 0,
  decisions_logged integer not null default 0,
  location text,
  agenda text[],
  quorum_status text check (quorum_status in ('Met', 'Not Met')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- TASKS
-- ============================================================
create table if not exists tasks (
  id text primary key,
  title text not null,
  workspace text not null,
  workspace_id text not null references workspaces(id) on delete cascade,
  priority text not null check (priority in ('High', 'Medium', 'Low')) default 'Medium',
  status text not null check (status in ('Backlog', 'In Progress', 'In Review', 'Completed', 'Overdue')) default 'Backlog',
  due_date text not null,
  assignee text not null,
  linked_doc text,
  linked_meeting text,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- RISKS
-- ============================================================
create table if not exists risks (
  id text primary key,
  title text not null,
  workspace text not null,
  workspace_id text not null references workspaces(id) on delete cascade,
  probability integer not null check (probability >= 1 and probability <= 5),
  impact integer not null check (impact >= 1 and impact <= 5),
  severity text not null check (severity in ('Critical', 'High', 'Medium', 'Low')),
  status text not null check (status in ('Open', 'Mitigated', 'Closed', 'Monitoring')) default 'Open',
  owner text not null,
  mitigation text not null default '',
  date_identified text not null,
  category text not null,
  financial_exposure numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- REPORTS
-- ============================================================
create table if not exists reports (
  id text primary key,
  title text not null,
  type text not null,
  type_color text not null default '#0EA5E9',
  workspace text not null,
  workspace_id text references workspaces(id) on delete set null,
  date text not null,
  status text not null check (status in ('Generated', 'Scheduled', 'Draft')) default 'Draft',
  pages integer not null default 1,
  period text not null,
  author text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- ACTIVITIES
-- ============================================================
create table if not exists activities (
  id text primary key,
  "user" text not null,
  action text not null,
  target text not null,
  workspace text,
  workspace_id text references workspaces(id) on delete set null,
  time text not null,
  type text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table workspaces enable row level security;
alter table workspace_financials enable row level security;
alter table workspace_rag_status enable row level security;
alter table milestones enable row level security;
alter table documents enable row level security;
alter table meetings enable row level security;
alter table tasks enable row level security;
alter table risks enable row level security;
alter table reports enable row level security;
alter table activities enable row level security;

-- Allow full access (update to auth-based policies in production)
do $$ declare t text; begin
  foreach t in array array['workspaces','workspace_financials','workspace_rag_status','milestones','documents','meetings','tasks','risks','reports','activities'] loop
    execute format('create policy "anon_all_%s" on %s for all using (true) with check (true)', t, t);
  end loop;
end $$;

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

do $$ declare t text; begin
  foreach t in array array['workspaces','workspace_financials','workspace_rag_status','milestones','documents','meetings','tasks','risks','reports'] loop
    execute format('drop trigger if exists set_updated_at on %s', t);
    execute format('create trigger set_updated_at before update on %s for each row execute function update_updated_at()', t);
  end loop;
end $$;
