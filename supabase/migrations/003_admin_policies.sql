-- Allow admins to update appointments (e.g. set status to confirmed/completed)
create policy "Admins can update appointments"
  on public.appointments for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Allow admins to update document requests (e.g. set status to processing/ready/released)
create policy "Admins can update document_requests"
  on public.document_requests for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
