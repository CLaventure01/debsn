-- Owner-checked member approval RPC for a future management screen.
create or replace function public.approve_workspace_member(target_user_id uuid, target_role text default 'dispatcher')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.approve_workspace_member(target_user_id, target_role);
end;
$$;
revoke all on function public.approve_workspace_member(uuid, text) from public, anon;
grant execute on function public.approve_workspace_member(uuid, text) to authenticated;
