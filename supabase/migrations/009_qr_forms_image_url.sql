-- Optional QR image: URL or uploaded image (upload to Storage bucket "qr-images")
alter table public.qr_forms
  add column if not exists image_url text;

comment on column public.qr_forms.image_url is 'Optional: public URL of QR image (e.g. from Storage or external link)';
