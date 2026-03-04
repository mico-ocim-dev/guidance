-- Ensure new signups from the public register form always get role = 'user' only.
-- Admin and staff roles can only be set by an existing admin (User roles page) or by claiming admin (first user).
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, first_name, mi, last_name, username, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    new.raw_user_meta_data->>'mi',
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce(new.raw_user_meta_data->>'username', new.email),
    new.email,
    'user'
  );
  return new;
end;
$$ language plpgsql security definer;
