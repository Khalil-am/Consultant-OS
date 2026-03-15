-- Recreate workspace_financials with correct columns
-- Safe to run: table had no real data yet

drop table if exists workspace_financials cascade;

create table workspace_financials (
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

alter table workspace_financials enable row level security;
drop policy if exists "anon_all_workspace_financials" on workspace_financials;
create policy "anon_all_workspace_financials" on workspace_financials for all using (true) with check (true);
