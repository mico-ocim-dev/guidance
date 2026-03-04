-- Run this entire script in Supabase SQL Editor.
-- Lets admin/staff (and admin@demo.com) update and delete document_requests.

-- 1. Helpers (same as qr_forms fix; safe to create or replace)
create or replace function public.current_user_is_admin_or_staff()
returns boolean language sql security definer set search_path = public stable
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'staff')); $$;

create or replace function public.current_user_is_demo_admin()
returns boolean language sql security definer set search_path = public stable
as $$ select lower(trim((select email::text from auth.users where id = auth.uid()))) = 'admin@demo.com'; $$;

-- 2. Update policy
drop policy if exists "Admins can update document_requests" on public.document_requests;
create policy "Admin or staff or demo admin can update document_requests"
  on public.document_requests for update
  using (public.current_user_is_admin_or_staff() or public.current_user_is_demo_admin())
  with check (public.current_user_is_admin_or_staff() or public.current_user_is_demo_admin());

-- 3. Delete policy (so admin can delete requests)
drop policy if exists "Admin or staff or demo admin can delete document_requests" on public.document_requests;
create policy "Admin or staff or demo admin can delete document_requests"
  on public.document_requests for delete
  using (public.current_user_is_admin_or_staff() or public.current_user_is_demo_admin());

-- 4. request_status_logs: allow insert for admin/staff/demo admin (avoids 500 when logging status change)
drop policy if exists "Admins and staff can insert request_status_logs" on public.request_status_logs;
create policy "Admin or staff or demo admin can insert request_status_logs"
  on public.request_status_logs for insert
  with check (public.current_user_is_admin_or_staff() or public.current_user_is_demo_admin());
