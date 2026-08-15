-- INSERT on time_sessions (has FKs) needs the same RPC workaround as
-- create_project/create_column/create_task (see rpc_writes.sql). Ending the
-- previous session happens in the same transaction as starting the new one,
-- so switching tasks can't race the one-active-session-per-user constraint.
create function public.start_task_timer(p_task_id uuid)
returns public.time_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  target_project_id uuid;
  new_session public.time_sessions;
begin
  select project_id into target_project_id from public.tasks where id = p_task_id;
  if target_project_id is null then
    raise exception 'Task not found';
  end if;

  if not public.is_project_member(target_project_id, auth.uid()) then
    raise exception 'Not a member of this project';
  end if;

  update public.time_sessions
  set ended_at = now()
  where user_id = auth.uid() and ended_at is null;

  insert into public.time_sessions (project_id, task_id, user_id, started_at)
  values (target_project_id, p_task_id, auth.uid(), now())
  returning * into new_session;

  return new_session;
end;
$$;
