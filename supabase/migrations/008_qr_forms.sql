-- QR forms: admin-managed forms/links shown on user dashboard (Quick Access)
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

-- Only admin/staff can manage; all authenticated can read (for user dashboard)
drop policy if exists "Admin and staff can manage qr_forms" on public.qr_forms;
create policy "Admin and staff can manage qr_forms" on public.qr_forms for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'staff')));

drop policy if exists "Authenticated can read qr_forms" on public.qr_forms;
create policy "Authenticated can read qr_forms" on public.qr_forms for select
  using (auth.uid() is not null);

-- Optional: allow public read so login page / dashboard can show forms (if we want guests to see)
-- For now only authenticated users can read (user dashboard is after login).
