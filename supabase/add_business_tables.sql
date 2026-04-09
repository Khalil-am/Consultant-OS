-- ============================================================
-- CONSULTANT OS – Business Tables Migration
-- automations catalog, board_decisions, team_members
-- Run this in the Supabase SQL Editor after schema.sql
-- ============================================================

-- ============================================================
-- AUTOMATIONS (catalog of available automations)
-- ============================================================
create table if not exists automations (
  id text primary key,
  name text not null,
  description text not null default '',
  category text not null,
  category_color text not null default '#00D4FF',
  input_type text not null default '',
  output_type text not null default '',
  run_count integer not null default 0,
  last_run text not null default 'Never',
  status text not null check (status in ('Active', 'Draft', 'Paused')) default 'Active',
  starred boolean not null default false,
  success_rate numeric(5,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- BOARD DECISIONS
-- ============================================================
create table if not exists board_decisions (
  id text primary key,
  title text not null,
  committee text not null,
  date text not null,
  status text not null check (status in ('Closed', 'Pending Implementation', 'Deferred', 'In Progress')) default 'In Progress',
  owner text not null,
  due_date text not null,
  workspace_id text references workspaces(id) on delete set null,
  priority text not null check (priority in ('Critical', 'High', 'Medium')) default 'Medium',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- TEAM MEMBERS (for Admin screen user management)
-- ============================================================
create table if not exists team_members (
  id text primary key,
  name text not null,
  email text not null unique,
  role text not null check (role in ('Admin', 'Consultant', 'Manager', 'Viewer', 'Analyst')) default 'Analyst',
  workspaces_count integer not null default 0,
  last_active text not null default 'Never',
  status text not null check (status in ('Active', 'Inactive')) default 'Active',
  initials text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_automations_category on automations(category);
create index if not exists idx_automations_status on automations(status);
create index if not exists idx_board_decisions_status on board_decisions(status);
create index if not exists idx_board_decisions_workspace on board_decisions(workspace_id);
create index if not exists idx_team_members_role on team_members(role);
create index if not exists idx_team_members_status on team_members(status);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table automations enable row level security;
alter table board_decisions enable row level security;
alter table team_members enable row level security;

do $$ declare t text; begin
  foreach t in array array['automations', 'board_decisions', 'team_members'] loop
    execute format(
      'create policy if not exists "anon_all_%s" on %s for all using (true) with check (true)',
      t, t
    );
  end loop;
end $$;

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
do $$ declare t text; begin
  foreach t in array array['automations', 'board_decisions', 'team_members'] loop
    execute format('drop trigger if exists set_updated_at on %s', t);
    execute format(
      'create trigger set_updated_at before update on %s for each row execute function update_updated_at()',
      t
    );
  end loop;
end $$;
