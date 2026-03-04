-- Returns true when no admin exists yet (so first user can claim admin)
create or replace function public.can_claim_admin()
returns boolean as $$
  select not exists (select 1 from public.profiles where role = 'admin');
$$ language sql security definer stable;

grant execute on function public.can_claim_admin() to authenticated;
grant execute on function public.can_claim_admin() to anon;

-- Allow a user to set their own role to 'admin' only when no admin exists yet
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and (role <> 'admin' or public.can_claim_admin()));
