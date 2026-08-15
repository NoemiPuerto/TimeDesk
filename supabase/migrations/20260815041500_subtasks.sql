create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  is_done boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- Realtime DELETE filtering needs the full row (see CLAUDE.md note on
-- REPLICA IDENTITY); harmless for a table this size.
alter table public.subtasks replica identity full;
alter publication supabase_realtime add table public.subtasks;

create function public.set_subtask_project_id()
returns trigger language plpgsql as $$
begin
  select project_id into new.project_id from public.tasks where id = new.task_id;
  return new;
end;
$$;

create trigger subtasks_set_project_id
  before insert on public.subtasks
  for each row execute function public.set_subtask_project_id();

alter table public.subtasks enable row level security;

create policy "members can read subtasks"
  on public.subtasks for select to authenticated
  using (public.is_project_member(project_id, auth.uid()));

create policy "members can update subtasks"
  on public.subtasks for update to authenticated
  using (public.is_project_member(project_id, auth.uid()));

create policy "members can delete subtasks"
  on public.subtasks for delete to authenticated
  using (public.is_project_member(project_id, auth.uid()));

-- INSERT goes through an RPC — see CLAUDE.md note on FK-bearing table inserts.
create function public.create_subtask(p_task_id uuid, p_title text)
returns public.subtasks
language plpgsql
security definer
set search_path = public
as $$
declare
  target_project_id uuid;
  next_position integer;
  new_subtask public.subtasks;
begin
  select project_id into target_project_id from public.tasks where id = p_task_id;
  if not public.is_project_member(target_project_id, auth.uid()) then
    raise exception 'Not a member of this project';
  end if;

  select coalesce(max(position) + 1, 0) into next_position from public.subtasks where task_id = p_task_id;

  insert into public.subtasks (task_id, title, position)
  values (p_task_id, p_title, next_position)
  returning * into new_subtask;

  return new_subtask;
end;
$$;
