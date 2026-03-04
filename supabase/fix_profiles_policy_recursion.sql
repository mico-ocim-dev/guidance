-- Run this entire script in Supabase SQL Editor.
-- Fixes 500 errors when loading pages that read profiles or users (RLS recursion).

-- 1. Helper: is current user's profile role = 'admin' (security definer = no recursion)
create or replace function public.current_user_has_admin_role()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select (select role from public.profiles where id = auth.uid()) = 'admin';
$$;

-- 2. Helper: is current user email = admin@demo.com (for demo admin without role in DB)
create or replace function public.current_user_is_demo_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select lower(trim((select email::text from auth.users where id = auth.uid()))) = 'admin@demo.com';
$$;

-- 3. Replace profiles policies so they don't read profiles in USING (stops recursion)
drop policy if exists "Admins can select all profiles" on public.profiles;
create policy "Admins can select all profiles"
  on public.profiles for select
  using (public.current_user_has_admin_role() or public.current_user_is_demo_admin());

drop policy if exists "Admins can update any profile" on public.profiles;
create policy "Admins can update any profile"
  on public.profiles for update
  using (public.current_user_has_admin_role() or public.current_user_is_demo_admin());

-- 4. users table: same fix so admin/staff checks don't recurse into profiles
drop policy if exists "Admins can manage users" on public.users;
create policy "Admins can manage users" on public.users for all
  using (public.current_user_has_admin_role() or public.current_user_is_demo_admin())
  with check (public.current_user_has_admin_role() or public.current_user_is_demo_admin());
