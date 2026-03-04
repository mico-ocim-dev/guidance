-- ============================================================
-- FULL OFFICE MANAGEMENT SCHEMA (Supabase)
-- GCO - LSPU Sta. Cruz | Keep existing tables; add new ones
-- ============================================================

-- Extend document_requests: processing time, archive
alter table public.document_requests
  add column if not exists completed_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id);

create index if not exists idx_document_requests_status on public.document_requests(status);
create index if not exists idx_document_requests_created_at on public.document_requests(created_at);
create index if not exists idx_document_requests_archived_at on public.document_requests(archived_at) where archived_at is null;

-- request_status_logs: history for document request status changes
create table if not exists public.request_status_logs (
  id uuid primary key default gen_random_uuid(),
  document_request_id uuid not null references public.document_requests(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_request_status_logs_doc on public.request_status_logs(document_request_id);

alter table public.request_status_logs enable row level security;

drop policy if exists "Anyone can read request_status_logs" on public.request_status_logs;
create policy "Anyone can read request_status_logs"
  on public.request_status_logs for select using (true);
drop policy if exists "Admins and staff can insert request_status_logs" on public.request_status_logs;
create policy "Admins and staff can insert request_status_logs"
  on public.request_status_logs for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'staff')));

-- users: staff/admin listing (synced from profiles; id = auth.users.id)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'user' check (role in ('user', 'staff', 'admin')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_users_role on public.users(role);

alter table public.users enable row level security;

drop policy if exists "Users can view users list" on public.users;
create policy "Users can view users list" on public.users for select using (true);
drop policy if exists "Admins can manage users" on public.users;
create policy "Admins can manage users" on public.users for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Sync users from profiles (run once; trigger handles ongoing)
create or replace function public.sync_users_from_profiles()
returns void as $$
  insert into public.users (id, email, full_name, role)
  select p.id, p.email, trim(p.first_name || ' ' || coalesce(p.mi || ' ', '') || p.last_name), coalesce((p.role)::text, 'user')
  from public.profiles p
  on conflict (id) do update set email = excluded.email, full_name = excluded.full_name, role = excluded.role, updated_at = now();
$$ language sql security definer;

-- tickets: help desk / ticketing
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text unique,
  subject text not null,
  description text,
  requester_email text not null,
  requester_name text,
  status text not null default 'open' check (status in ('open', 'assigned', 'in_progress', 'resolved', 'closed')),
  priority text default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  resolved_at timestamptz
);

create index if not exists idx_tickets_status on public.tickets(status);
create index if not exists idx_tickets_created_at on public.tickets(created_at);
create index if not exists idx_tickets_assigned_to on public.tickets(assigned_to);

-- ticket number generator
create or replace function public.generate_ticket_number()
returns text as $$
declare
  n bigint;
  t text;
begin
  n := (select count(*) + 1 from public.tickets);
  t := 'TKT-' || to_char(now(), 'YYYYMM') || '-' || lpad(n::text, 4, '0');
  return t;
end;
$$ language plpgsql;

alter table public.tickets alter column ticket_number set default public.generate_ticket_number();

alter table public.tickets enable row level security;

drop policy if exists "Staff and admin can manage tickets" on public.tickets;
create policy "Staff and admin can manage tickets" on public.tickets for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'staff')));
drop policy if exists "Anyone can create ticket" on public.tickets;
create policy "Anyone can create ticket" on public.tickets for insert with check (true);
drop policy if exists "Users can view own tickets by email" on public.tickets;
create policy "Users can view own tickets by email" on public.tickets for select using (true);

-- ticket_attachments: store file paths (Supabase Storage)
create table if not exists public.ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  file_path text not null,
  file_name text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.ticket_attachments enable row level security;

drop policy if exists "Staff and admin manage attachments" on public.ticket_attachments;
create policy "Staff and admin manage attachments" on public.ticket_attachments for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'staff')));
drop policy if exists "Anyone can insert attachment for own ticket" on public.ticket_attachments;
create policy "Anyone can insert attachment for own ticket" on public.ticket_attachments for insert with check (true);

-- surveys
create table if not exists public.surveys (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- survey_questions
create table if not exists public.survey_questions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  question_text text not null,
  question_type text not null default 'scale' check (question_type in ('scale', 'text', 'choice', 'yesno')),
  options jsonb,
  sort_order int default 0,
  created_at timestamptz default now()
);

create index if not exists idx_survey_questions_survey on public.survey_questions(survey_id);

-- survey_responses
create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  question_id uuid not null references public.survey_questions(id) on delete cascade,
  response_value text,
  response_number numeric,
  respondent_id uuid references auth.users(id) on delete set null,
  respondent_email text,
  created_at timestamptz default now()
);

create index if not exists idx_survey_responses_survey on public.survey_responses(survey_id);
create index if not exists idx_survey_responses_question on public.survey_responses(question_id);

alter table public.surveys enable row level security;
alter table public.survey_questions enable row level security;
alter table public.survey_responses enable row level security;

drop policy if exists "Anyone can read active surveys" on public.surveys;
create policy "Anyone can read active surveys" on public.surveys for select using (true);
drop policy if exists "Admin can manage surveys" on public.surveys;
create policy "Admin can manage surveys" on public.surveys for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
drop policy if exists "Anyone can read survey_questions" on public.survey_questions;
create policy "Anyone can read survey_questions" on public.survey_questions for select using (true);
drop policy if exists "Admin can manage survey_questions" on public.survey_questions;
create policy "Admin can manage survey_questions" on public.survey_questions for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
drop policy if exists "Anyone can submit survey_responses" on public.survey_responses;
create policy "Anyone can submit survey_responses" on public.survey_responses for insert with check (true);
drop policy if exists "Admin can read survey_responses" on public.survey_responses;
create policy "Admin can read survey_responses" on public.survey_responses for select using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- logbook_entries: digital logbook (check-in/out)
create table if not exists public.logbook_entries (
  id uuid primary key default gen_random_uuid(),
  visitor_name text not null,
  visitor_email text,
  visitor_phone text,
  purpose text,
  check_in_at timestamptz default now(),
  check_out_at timestamptz,
  checked_in_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_logbook_check_in on public.logbook_entries(check_in_at);
create index if not exists idx_logbook_check_out on public.logbook_entries(check_out_at);

alter table public.logbook_entries enable row level security;

drop policy if exists "Staff and admin can manage logbook" on public.logbook_entries;
create policy "Staff and admin can manage logbook" on public.logbook_entries for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'staff')));
drop policy if exists "Anyone can read logbook (for display)" on public.logbook_entries;
create policy "Anyone can read logbook (for display)" on public.logbook_entries for select using (true);

-- monthly_reports: stored aggregated reports
create table if not exists public.monthly_reports (
  id uuid primary key default gen_random_uuid(),
  report_month date not null,
  report_type text not null,
  data jsonb not null,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique(report_month, report_type)
);

create index if not exists idx_monthly_reports_month on public.monthly_reports(report_month);

alter table public.monthly_reports enable row level security;

drop policy if exists "Admin can manage monthly_reports" on public.monthly_reports;
create policy "Admin can manage monthly_reports" on public.monthly_reports for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
drop policy if exists "Staff can read monthly_reports" on public.monthly_reports;
create policy "Staff can read monthly_reports" on public.monthly_reports for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'staff')));

-- import_logs: CSV/Excel import history
create table if not exists public.import_logs (
  id uuid primary key default gen_random_uuid(),
  import_type text not null,
  file_name text,
  total_rows int,
  imported_rows int,
  failed_rows int,
  errors jsonb,
  imported_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists idx_import_logs_created on public.import_logs(created_at);

alter table public.import_logs enable row level security;

drop policy if exists "Staff and admin can manage import_logs" on public.import_logs;
create policy "Staff and admin can manage import_logs" on public.import_logs for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'staff')));

-- Add 'staff' to profiles.role if not already
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'role') then
    alter table public.profiles drop constraint if exists profiles_role_check;
    alter table public.profiles add constraint profiles_role_check check (role in ('user', 'staff', 'admin'));
  end if;
end $$;

-- Sync users from profiles on profile change
create or replace function public.sync_user_from_profile()
returns trigger as $$
begin
  insert into public.users (id, email, full_name, role)
  values (
    new.id,
    new.email,
    trim(new.first_name || ' ' || coalesce(new.mi || ' ', '') || new.last_name),
    coalesce(new.role, 'user')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    role = excluded.role,
    updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists sync_user_on_profile_change on public.profiles;
create trigger sync_user_on_profile_change
  after insert or update on public.profiles
  for each row execute function public.sync_user_from_profile();

-- Backfill users from existing profiles (function name: sync_users_from_profiles, no space)
select public.sync_users_from_profiles();
