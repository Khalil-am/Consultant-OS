-- ============================================================
-- CONSULTANT OS – Supabase Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
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
  time text not null,
  type text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- WORKSPACE FINANCIALS
-- ============================================================
create table if not exists workspace_financials (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  workspace_name text not null,
  contract_value numeric not null default 0,
  invoiced numeric not null default 0,
  collected numeric not null default 0,
  outstanding numeric not null default 0,
  budget_spent numeric not null default 0,
  budget_total numeric not null default 0,
  forecast_completion numeric not null default 0,
  rag_status text not null check (rag_status in ('Green', 'Amber', 'Red')) default 'Green',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY (open read for anon, restrict writes)
-- ============================================================
alter table workspaces enable row level security;
alter table documents enable row level security;
alter table meetings enable row level security;
alter table tasks enable row level security;
alter table risks enable row level security;
alter table reports enable row level security;
alter table activities enable row level security;
alter table workspace_financials enable row level security;

-- Allow anon read access to all tables
create policy "Allow anon read workspaces" on workspaces for select using (true);
create policy "Allow anon read documents" on documents for select using (true);
create policy "Allow anon read meetings" on meetings for select using (true);
create policy "Allow anon read tasks" on tasks for select using (true);
create policy "Allow anon read risks" on risks for select using (true);
create policy "Allow anon read reports" on reports for select using (true);
create policy "Allow anon read activities" on activities for select using (true);
create policy "Allow anon read workspace_financials" on workspace_financials for select using (true);

-- Allow anon insert/update/delete (remove in production, add auth)
create policy "Allow anon write workspaces" on workspaces for all using (true);
create policy "Allow anon write documents" on documents for all using (true);
create policy "Allow anon write meetings" on meetings for all using (true);
create policy "Allow anon write tasks" on tasks for all using (true);
create policy "Allow anon write risks" on risks for all using (true);
create policy "Allow anon write reports" on reports for all using (true);
create policy "Allow anon write activities" on activities for all using (true);
create policy "Allow anon write workspace_financials" on workspace_financials for all using (true);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on workspaces for each row execute function update_updated_at();
create trigger set_updated_at before update on documents for each row execute function update_updated_at();
create trigger set_updated_at before update on meetings for each row execute function update_updated_at();
create trigger set_updated_at before update on tasks for each row execute function update_updated_at();
create trigger set_updated_at before update on risks for each row execute function update_updated_at();
create trigger set_updated_at before update on reports for each row execute function update_updated_at();
create trigger set_updated_at before update on workspace_financials for each row execute function update_updated_at();
