-- Run this in Supabase SQL Editor
-- Adds file_url column and sets up storage bucket for document attachments

-- 1. Add file_url to documents table
alter table documents add column if not exists file_url text;

-- 2. Create storage bucket for document files
insert into storage.buckets (id, name, public)
values ('workspace-docs', 'workspace-docs', true)
on conflict (id) do nothing;

-- 3. Allow public read + authenticated write on the bucket
drop policy if exists "Public read workspace-docs" on storage.objects;
drop policy if exists "Anon upload workspace-docs" on storage.objects;
drop policy if exists "Anon delete workspace-docs" on storage.objects;

create policy "Public read workspace-docs"
  on storage.objects for select
  using (bucket_id = 'workspace-docs');

create policy "Anon upload workspace-docs"
  on storage.objects for insert
  with check (bucket_id = 'workspace-docs');

create policy "Anon delete workspace-docs"
  on storage.objects for delete
  using (bucket_id = 'workspace-docs');
