-- Allow admin@demo.com to manage qr_forms even if profiles.role is not admin (e.g. before running make_admin.sql).
drop policy if exists "Admin email can manage qr_forms" on public.qr_forms;
create policy "Admin email can manage qr_forms" on public.qr_forms for all
  using (
    lower(trim((select email::text from auth.users where id = auth.uid()))) = 'admin@demo.com'
  )
  with check (
    lower(trim((select email::text from auth.users where id = auth.uid()))) = 'admin@demo.com'
  );
