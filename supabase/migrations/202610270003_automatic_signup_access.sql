-- Allow every account to access the workspace once Supabase email confirmation completes.
alter table public.profiles
  alter column approval_status set default 'approved';

update public.profiles
set approval_status = 'approved', updated_at = now()
where approval_status = 'pending';

create or replace function private.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, approval_status)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)),
    'approved'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function private.create_profile_for_auth_user() from public, anon, authenticated;
