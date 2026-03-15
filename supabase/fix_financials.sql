-- Fix workspace_financials columns to match the app
-- Run this BEFORE seed.sql

alter table workspace_financials
  add column if not exists spent numeric not null default 0,
  add column if not exists forecast numeric not null default 0,
  add column if not exists variance numeric not null default 0,
  add column if not exists billing_model text not null default 'Fixed Fee',
  add column if not exists last_invoice text not null default '',
  add column if not exists next_milestone_value numeric not null default 0;
