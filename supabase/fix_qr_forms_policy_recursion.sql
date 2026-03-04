-- Run in Supabase SQL Editor.
-- Fixes: "infinite recursion" (policy on qr_forms reading profiles) and "permission denied for table users".

-- 1. Helper that checks admin/staff without triggering profiles RLS (security definer bypasses RLS)
create or replace function public.current_user_is_admin_or_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'staff'));
$$;

-- 2. Helper for admin@demo.com check (reads auth.users with definer rights to avoid "permission denied for table users")
create or replace function public.current_user_is_demo_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select lower(trim((select email::text from auth.users where id = auth.uid()))) = 'admin@demo.com';
$$;

-- 3. Replace policies so they use functions (no direct read of profiles or auth.users by authenticated role)
drop policy if exists "Admin and staff can manage qr_forms" on public.qr_forms;
create policy "Admin and staff can manage qr_forms" on public.qr_forms for all
  using (public.current_user_is_admin_or_staff());

drop policy if exists "Admin email can manage qr_forms" on public.qr_forms;
create policy "Admin email can manage qr_forms" on public.qr_forms for all
  using (public.current_user_is_demo_admin())
  with check (public.current_user_is_demo_admin());

-- 5. Ensure sync trigger can write to public.users (if error was about public.users)
do $$
declare
  fn_owner name;
begin
  select proowner::regrole::name into fn_owner
  from pg_proc where proname = 'sync_user_from_profile';
  if fn_owner is not null then
    execute format('grant select, insert, update, delete on public.users to %I', fn_owner);
  end if;
end $$;

-- 6. Ensure authenticated can read public.users (for app code that lists users)
grant select on public.users to authenticated;
grant select on public.users to anon;
