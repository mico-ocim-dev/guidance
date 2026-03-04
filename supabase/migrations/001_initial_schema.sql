-- Profiles: extended user data (linked to auth.users via id)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  mi text,
  last_name text not null,
  username text unique not null,
  email text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Appointments (can be from guests or logged-in users)
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  email text not null,
  phone text,
  appointment_type text not null check (appointment_type in (
    'Online', 'Walk-in', 'Consultation', 'Counseling', 'Document Request', 'Others'
  )),
  purpose text,
  preferred_date date not null,
  preferred_time time not null,
  status text default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'completed')),
  created_at timestamptz default now()
);

-- Document requests with tracking number (default added after function exists)
create table if not exists public.document_requests (
  id uuid primary key default gen_random_uuid(),
  tracking_number text unique not null,
  user_id uuid references auth.users(id) on delete set null,
  requester_name text not null,
  requester_email text not null,
  document_type text,
  status text default 'pending' check (status in ('pending', 'processing', 'ready', 'released', 'cancelled')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Generate tracking number (e.g. GCO-XXXXXX)
create or replace function public.generate_tracking_number()
returns text as $$
declare
  num int;
  t text;
begin
  num := floor(random() * 900000 + 100000)::int;
  t := 'GCO-' || num;
  while exists (select 1 from public.document_requests where document_requests.tracking_number = t) loop
    num := floor(random() * 900000 + 100000)::int;
    t := 'GCO-' || num;
  end loop;
  return t;
end;
$$ language plpgsql;

-- Now set the column default so new rows get a tracking number automatically
alter table public.document_requests
  alter column tracking_number set default public.generate_tracking_number();

-- RLS
alter table public.profiles enable row level security;
alter table public.appointments enable row level security;
alter table public.document_requests enable row level security;

-- Profiles: users can read/update own
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Appointments: anyone can insert (book), users see own, service role can manage all
create policy "Anyone can create appointment" on public.appointments for insert with check (true);
create policy "Users can view own appointments" on public.appointments for select using (auth.uid() = user_id);
create policy "Public can view appointments by email" on public.appointments for select using (true);

-- Document requests: anyone can create; anyone can read by tracking number (for track page)
create policy "Anyone can create document request" on public.document_requests for insert with check (true);
create policy "Anyone can read document requests (for track by tracking_number)" on public.document_requests for select using (true);

-- Trigger: create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, first_name, mi, last_name, username, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    new.raw_user_meta_data->>'mi',
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce(new.raw_user_meta_data->>'username', new.email),
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
