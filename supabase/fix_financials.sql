-- Add missing currency column to workspace_financials
-- Run this once, then run seed.sql

alter table workspace_financials add column if not exists currency text not null default 'SAR';
