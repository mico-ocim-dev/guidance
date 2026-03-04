-- Run this entire script in Supabase Dashboard → SQL Editor (creates qr_forms table + policies).
-- Run once. Safe to re-run (uses "if not exists" / "drop policy if exists").

-- 1. Create table
create table if not exists public.qr_forms (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  form_url text not null,
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_qr_forms_sort on public.qr_forms(sort_order);

alter table public.qr_forms enable row level security;

-- 2. Add image column (optional QR image)
alter table public.qr_forms
  add column if not exists image_url text;

-- 3. Helper to avoid RLS recursion (profiles policies reference profiles; this bypasses RLS)
create or replace function public.current_user_is_admin_or_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'staff'));
$$;

-- 4. RLS policies (use function so we don't recurse into profiles RLS)
drop policy if exists "Admin and staff can manage qr_forms" on public.qr_forms;
create policy "Admin and staff can manage qr_forms" on public.qr_forms for all
  using (public.current_user_is_admin_or_staff());

drop policy if exists "Authenticated can read qr_forms" on public.qr_forms;
create policy "Authenticated can read qr_forms" on public.qr_forms for select
  using (auth.uid() is not null);

-- Helper so policy can check admin@demo.com without authenticated role reading auth.users
create or replace function public.current_user_is_demo_admin()
returns boolean language sql security definer set search_path = public stable
as $$ select lower(trim((select email::text from auth.users where id = auth.uid()))) = 'admin@demo.com'; $$;

drop policy if exists "Admin email can manage qr_forms" on public.qr_forms;
create policy "Admin email can manage qr_forms" on public.qr_forms for all
  using (public.current_user_is_demo_admin())
  with check (public.current_user_is_demo_admin());
