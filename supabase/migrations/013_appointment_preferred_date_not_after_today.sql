-- Prevent scheduling or editing appointment date to a date before today.
-- Only today and future dates are allowed. Applies to inserts and updates from any role (user, staff, admin).

create or replace function public.check_appointment_preferred_date_not_past()
returns trigger as $$
begin
  if new.preferred_date < current_date then
    raise exception 'Appointment date cannot be before today.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists appointment_preferred_date_not_future on public.appointments;
drop trigger if exists appointment_preferred_date_not_past on public.appointments;
create trigger appointment_preferred_date_not_past
  before insert or update of preferred_date on public.appointments
  for each row execute function public.check_appointment_preferred_date_not_past();
