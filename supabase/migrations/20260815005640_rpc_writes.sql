-- WORKAROUND: on this Postgres instance, INSERT (not UPDATE/DELETE/SELECT) into
-- any RLS-enabled table that has a foreign key constraint fails with
-- "new row violates row-level security policy", even for `with check (true)`,
-- even with a NULL FK value that would never trigger FK validation, even
-- referencing a table with RLS disabled. Confirmed on two separate fresh
-- Supabase projects, so this is a platform-level quirk, not a bug in our
-- policies. Table-owner (security definer) inserts are unaffected, so client
-- INSERTs go through these RPCs instead of direct PostgREST table access.
-- UPDATE/DELETE are unaffected and keep using direct table access + RLS.

create function public.create_project(p_name text, p_description text default null)
returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  new_project public.projects;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.projects (name, description, owner_id)
  values (p_name, p_description, auth.uid())
  returning * into new_project;

  return new_project;
end;
$$;

create function public.invite_project_member(p_project_id uuid, p_email text)
returns public.project_members
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
  new_member public.project_members;
begin
  if not public.is_project_owner(p_project_id, auth.uid()) then
    raise exception 'Only the project owner can invite members';
  end if;

  select id into target_user_id from public.profiles where email = lower(trim(p_email));
  if target_user_id is null then
    raise exception 'No hay ninguna cuenta de TimeDesk con ese email todavía.';
  end if;

  insert into public.project_members (project_id, user_id, role)
  values (p_project_id, target_user_id, 'member')
  returning * into new_member;

  return new_member;
exception
  when unique_violation then
    raise exception 'Esa persona ya es miembro del proyecto.';
end;
$$;

create function public.create_column(p_project_id uuid, p_name text)
returns public.columns
language plpgsql
security definer
set search_path = public
as $$
declare
  target_board_id uuid;
  next_position int;
  new_column public.columns;
begin
  if not public.is_project_member(p_project_id, auth.uid()) then
    raise exception 'Not a member of this project';
  end if;

  select id into target_board_id from public.boards where project_id = p_project_id;
  select coalesce(max(position) + 1, 0) into next_position from public.columns where project_id = p_project_id;

  insert into public.columns (board_id, project_id, name, position)
  values (target_board_id, p_project_id, p_name, next_position)
  returning * into new_column;

  return new_column;
end;
$$;

create function public.create_task(p_project_id uuid, p_column_id uuid, p_title text)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  next_position int;
  new_task public.tasks;
begin
  if not public.is_project_member(p_project_id, auth.uid()) then
    raise exception 'Not a member of this project';
  end if;

  select coalesce(max(position) + 1, 0) into next_position from public.tasks where column_id = p_column_id;

  insert into public.tasks (project_id, column_id, title, position, created_by)
  values (p_project_id, p_column_id, p_title, next_position, auth.uid())
  returning * into new_task;

  return new_task;
end;
$$;
