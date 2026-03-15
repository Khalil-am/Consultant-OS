-- Run this in Supabase SQL Editor to add missing tables
-- Do NOT re-run schema.sql (triggers already exist)

create table if not exists workspace_rag_status (
  id text primary key,
  workspace_id text not null unique references workspaces(id) on delete cascade,
  rag text not null check (rag in ('Green','Amber','Red')) default 'Green',
  budget text not null check (budget in ('Green','Amber','Red')) default 'Green',
  schedule text not null check (schedule in ('Green','Amber','Red')) default 'Green',
  risk text not null check (risk in ('Green','Amber','Red')) default 'Green',
  last_updated text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists milestones (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  title text not null,
  due_date text not null,
  status text not null check (status in ('Completed','On Track','At Risk','Delayed','Upcoming')) default 'Upcoming',
  value numeric not null default 0,
  owner text not null default '',
  completion_pct integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table risks add column if not exists workspace_id text references workspaces(id) on delete cascade;

alter table workspace_rag_status enable row level security;
alter table milestones enable row level security;

drop policy if exists "anon_all_workspace_rag_status" on workspace_rag_status;
drop policy if exists "anon_all_milestones" on milestones;

create policy "anon_all_workspace_rag_status" on workspace_rag_status for all using (true) with check (true);
create policy "anon_all_milestones" on milestones for all using (true) with check (true);
