-- Add tracking numbers to appointments so they can be tracked like document requests.

-- Add column (nullable first so we can backfill)
alter table public.appointments
  add column if not exists tracking_number text unique;

-- Function to generate appointment tracking number (e.g. APT-123456)
create or replace function public.generate_appointment_tracking_number()
returns text as $$
declare
  num int;
  t text;
begin
  num := floor(random() * 900000 + 100000)::int;
  t := 'APT-' || num;
  while exists (select 1 from public.appointments where appointments.tracking_number = t) loop
    num := floor(random() * 900000 + 100000)::int;
    t := 'APT-' || num;
  end loop;
  return t;
end;
$$ language plpgsql;

-- Backfill existing rows with unique tracking numbers
do $$
declare
  r record;
  n int := 100000;
begin
  for r in select id from public.appointments where tracking_number is null order by created_at
  loop
    update public.appointments
    set tracking_number = 'APT-' || n
    where id = r.id;
    n := n + 1;
  end loop;
end $$;

-- Now set NOT NULL and default for new rows
alter table public.appointments
  alter column tracking_number set not null,
  alter column tracking_number set default public.generate_appointment_tracking_number();

-- Ensure default for new inserts (in case of re-run)
alter table public.appointments
  alter column tracking_number set default public.generate_appointment_tracking_number();

create index if not exists idx_appointments_tracking_number on public.appointments(tracking_number);
