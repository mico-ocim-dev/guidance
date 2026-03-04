-- Storage policies for bucket "qr-images" (create the bucket in Dashboard or via API first).
-- Authenticated users (e.g. admin) can upload; public can read for dashboard display.

drop policy if exists "Allow authenticated uploads to qr-images" on storage.objects;
create policy "Allow authenticated uploads to qr-images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'qr-images');

drop policy if exists "Allow authenticated updates in qr-images" on storage.objects;
create policy "Allow authenticated updates in qr-images"
  on storage.objects for update to authenticated
  using (bucket_id = 'qr-images');

drop policy if exists "Allow authenticated deletes in qr-images" on storage.objects;
create policy "Allow authenticated deletes in qr-images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'qr-images');

drop policy if exists "Public read qr-images" on storage.objects;
create policy "Public read qr-images"
  on storage.objects for select to public
  using (bucket_id = 'qr-images');
