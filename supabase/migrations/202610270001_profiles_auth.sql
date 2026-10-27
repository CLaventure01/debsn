-- Debsn authentication foundation. New signups remain pending until an owner approves them.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'dispatcher' check (role in ('owner', 'dispatcher', 'driver')),
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

create or replace function private.is_workspace_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'owner'
      and p.approval_status = 'approved'
  );
$$;
revoke all on function private.is_workspace_owner() from public, anon;
grant execute on function private.is_workspace_owner() to authenticated;

create policy "Profiles are visible to their user and workspace owners"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_workspace_owner()));

create or replace function private.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function private.create_profile_for_auth_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function private.create_profile_for_auth_user();

create or replace function private.approve_workspace_member(target_user_id uuid, target_role text default 'dispatcher')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_workspace_owner()) then
    raise exception 'Only an approved workspace owner can approve members';
  end if;
  if target_role not in ('dispatcher', 'driver') then
    raise exception 'Role must be dispatcher or driver';
  end if;
  update public.profiles
  set role = target_role, approval_status = 'approved', updated_at = now()
  where id = target_user_id;
end;
$$;
revoke all on function private.approve_workspace_member(uuid, text) from public, anon;
grant execute on function private.approve_workspace_member(uuid, text) to authenticated;

