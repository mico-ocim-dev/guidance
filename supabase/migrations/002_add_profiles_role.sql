-- Add role column to profiles ('user' | 'admin')
alter table public.profiles
  add column if not exists role text not null default 'user' check (role in ('user', 'admin'));

-- Optional: set a specific user as admin (replace with the real email)
-- update public.profiles set role = 'admin' where email = 'your-admin@gmail.com';
