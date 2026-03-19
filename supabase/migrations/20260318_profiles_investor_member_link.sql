alter table if exists public.profiles
  add column if not exists investor_member_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_investor_member_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_investor_member_id_fkey
      foreign key (investor_member_id)
      references public.investor_members(id)
      on delete set null;
  end if;
end
$$;

create index if not exists profiles_investor_member_id_idx
  on public.profiles (investor_member_id);
