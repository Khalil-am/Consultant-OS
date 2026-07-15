-- Phase 4: New tables for Approvals and Chat Threads
-- Run this in Supabase SQL Editor

-- ── Approvals table ──────────────────────────────────────────
create table if not exists approvals (
  id text primary key,
  title text not null,
  requester text not null default 'AM',
  type text not null,
  urgency text not null check (urgency in ('High', 'Medium', 'Low')) default 'Medium',
  status text not null check (status in ('pending', 'approved', 'rejected')) default 'pending',
  workspace_id text references workspaces(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table approvals enable row level security;
drop policy if exists "anon_all_approvals" on approvals;
create policy "anon_all_approvals" on approvals for all using (true) with check (true);

-- Seed initial approvals
insert into approvals (id, title, requester, type, urgency, status) values
  ('appr-001', 'NCA BRD v2.3', 'AM', 'Document Approval', 'High', 'pending'),
  ('appr-002', 'SC-10 Budget SAR 2.4M', 'RT', 'Budget Approval', 'High', 'pending'),
  ('appr-003', 'MOCI Vendor Shortlist', 'FH', 'Procurement Decision', 'Medium', 'pending'),
  ('appr-004', 'Healthcare Strategy Report', 'SK', 'Report Sign-off', 'Low', 'pending')
on conflict (id) do nothing;

-- ── Chat threads table ────────────────────────────────────────
create table if not exists chat_threads (
  id text primary key,
  title text not null,
  persona_id text not null,
  model_id text not null,
  messages jsonb not null default '[]',
  time text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table chat_threads enable row level security;
drop policy if exists "anon_all_chat_threads" on chat_threads;
create policy "anon_all_chat_threads" on chat_threads for all using (true) with check (true);
