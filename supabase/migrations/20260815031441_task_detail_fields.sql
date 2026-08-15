alter table public.tasks add column priority text check (priority in ('low', 'medium', 'high'));
alter table public.tasks add column due_date date;
alter table public.tasks drop column assigned_to;

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  color text not null,
  created_at timestamptz not null default now(),
  unique (project_id, name)
);

create table public.task_tags (
  task_id uuid not null references public.tasks (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (task_id, tag_id)
);

-- Multiple people can be assigned to (share) the same task.
create table public.task_assignees (
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

alter table public.tags enable row level security;
alter table public.task_tags enable row level security;
alter table public.task_assignees enable row level security;

create policy "members can read tags"
  on public.tags for select to authenticated
  using (public.is_project_member(project_id, auth.uid()));

create policy "members can create tags"
  on public.tags for insert to authenticated
  with check (public.is_project_member(project_id, auth.uid()));

create policy "members can delete tags"
  on public.tags for delete to authenticated
  using (public.is_project_member(project_id, auth.uid()));

create policy "members can read task_tags"
  on public.task_tags for select to authenticated
  using (exists (
    select 1 from public.tasks t where t.id = task_id and public.is_project_member(t.project_id, auth.uid())
  ));

create policy "members can create task_tags"
  on public.task_tags for insert to authenticated
  with check (exists (
    select 1 from public.tasks t where t.id = task_id and public.is_project_member(t.project_id, auth.uid())
  ));

create policy "members can delete task_tags"
  on public.task_tags for delete to authenticated
  using (exists (
    select 1 from public.tasks t where t.id = task_id and public.is_project_member(t.project_id, auth.uid())
  ));

create policy "members can read task_assignees"
  on public.task_assignees for select to authenticated
  using (exists (
    select 1 from public.tasks t where t.id = task_id and public.is_project_member(t.project_id, auth.uid())
  ));

create policy "members can create task_assignees"
  on public.task_assignees for insert to authenticated
  with check (exists (
    select 1 from public.tasks t where t.id = task_id and public.is_project_member(t.project_id, auth.uid())
  ));

create policy "members can delete task_assignees"
  on public.task_assignees for delete to authenticated
  using (exists (
    select 1 from public.tasks t where t.id = task_id and public.is_project_member(t.project_id, auth.uid())
  ));

-- INSERT on these tables goes through RPCs (see rpc_writes.sql / CLAUDE.md note
-- about FK-bearing tables). All are SECURITY DEFINER and check membership
-- manually since the WITH CHECK above never actually gets exercised for INSERT.

create function public.create_tag(p_project_id uuid, p_name text)
returns public.tags
language plpgsql
security definer
set search_path = public
as $$
declare
  new_tag public.tags;
  tag_count int;
  palette text[] := array['#eb3619', '#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#06b6d4'];
begin
  if not public.is_project_member(p_project_id, auth.uid()) then
    raise exception 'Not a member of this project';
  end if;

  select count(*) into tag_count from public.tags where project_id = p_project_id;

  insert into public.tags (project_id, name, color)
  values (p_project_id, p_name, palette[(tag_count % array_length(palette, 1)) + 1])
  returning * into new_tag;

  return new_tag;
exception
  when unique_violation then
    raise exception 'Ya existe una categoría con ese nombre.';
end;
$$;

create function public.add_task_tag(p_task_id uuid, p_tag_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_project_id uuid;
begin
  select project_id into target_project_id from public.tasks where id = p_task_id;
  if not public.is_project_member(target_project_id, auth.uid()) then
    raise exception 'Not a member of this project';
  end if;

  insert into public.task_tags (task_id, tag_id) values (p_task_id, p_tag_id)
  on conflict do nothing;
end;
$$;

create function public.add_task_assignee(p_task_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_project_id uuid;
begin
  select project_id into target_project_id from public.tasks where id = p_task_id;
  if not public.is_project_member(target_project_id, auth.uid()) then
    raise exception 'Not a member of this project';
  end if;
  if not public.is_project_member(target_project_id, p_user_id) then
    raise exception 'Esa persona no es miembro del proyecto.';
  end if;

  insert into public.task_assignees (task_id, user_id) values (p_task_id, p_user_id)
  on conflict do nothing;
end;
$$;
