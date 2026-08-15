-- Fase 10: Teams. Model (confirmed with the user): a team works like a
-- WhatsApp group — someone creates it and invites people to the TEAM, not to
-- a project. Team members can see which projects exist under the team but
-- have NO access to a project's content until the team admin explicitly
-- assigns them (reusing project_members/RLS, just gated differently for
-- team-owned projects). Standalone (non-team) projects are untouched — same
-- owner + up to 4 members flow as before.

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

alter table public.projects add column team_id uuid references public.teams (id) on delete set null;

alter table public.teams replica identity full;
alter table public.team_members replica identity full;
alter publication supabase_realtime add table public.teams;
alter publication supabase_realtime add table public.team_members;

create function public.is_team_member(p_team_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.team_members where team_id = p_team_id and user_id = p_user_id
  );
$$;

create function public.is_team_admin(p_team_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = p_user_id and role = 'admin'
  );
$$;

create function public.add_team_owner_as_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.team_members (team_id, user_id, role) values (new.id, new.owner_id, 'admin');
  return new;
end;
$$;

create trigger on_team_created
  after insert on public.teams
  for each row execute function public.add_team_owner_as_admin();

alter table public.teams enable row level security;
alter table public.team_members enable row level security;

create policy "team members can read their team"
  on public.teams for select to authenticated
  using (public.is_team_member(id, auth.uid()));

create policy "authenticated users can create teams"
  on public.teams for insert to authenticated
  with check (owner_id = auth.uid());

create policy "team owner can update the team"
  on public.teams for update to authenticated
  using (owner_id = auth.uid());

create policy "team owner can delete the team"
  on public.teams for delete to authenticated
  using (owner_id = auth.uid());

create policy "team members can read membership"
  on public.team_members for select to authenticated
  using (public.is_team_member(team_id, auth.uid()));

create policy "team admins can add members"
  on public.team_members for insert to authenticated
  with check (public.is_team_admin(team_id, auth.uid()));

create policy "admins remove members, members remove themselves"
  on public.team_members for delete to authenticated
  using (public.is_team_admin(team_id, auth.uid()) or user_id = auth.uid());

-- Team members can see that a project exists (name only, via this SELECT
-- policy) without being a project_member — full content (tasks/columns/time)
-- stays gated by is_project_member on those tables, unaffected here.
drop policy "members can read their projects" on public.projects;
create policy "members can read their projects"
  on public.projects for select to authenticated
  using (
    public.is_project_member(id, auth.uid())
    or (team_id is not null and public.is_team_member(team_id, auth.uid()))
  );

-- A team admin can assign any team member to any project owned by the team,
-- not just projects they personally created.
drop policy "owners can invite members" on public.project_members;
create policy "owners can invite members"
  on public.project_members for insert to authenticated
  with check (
    public.is_project_owner(project_id, auth.uid())
    or exists (
      select 1 from public.projects p
      where p.id = project_id and p.team_id is not null and public.is_team_admin(p.team_id, auth.uid())
    )
  );

-- Time visibility: for team-owned projects, only the team admin can see
-- other members' sessions — everyone always sees their own. Non-team
-- projects keep the original "any project member sees everyone" behavior.
drop policy "members can read time sessions in their projects" on public.time_sessions;
create policy "time visibility respects team admin restriction"
  on public.time_sessions for select to authenticated
  using (
    user_id = auth.uid()
    or (
      public.is_project_member(project_id, auth.uid())
      and (
        (select p.team_id from public.projects p where p.id = project_id) is null
        or public.is_team_admin((select p.team_id from public.projects p where p.id = project_id), auth.uid())
      )
    )
  );

-- INSERT on FK-bearing tables goes through RPCs — see CLAUDE.md.

create function public.create_team(p_name text)
returns public.teams
language plpgsql
security definer
set search_path = public
as $$
declare
  new_team public.teams;
begin
  insert into public.teams (name, owner_id) values (p_name, auth.uid()) returning * into new_team;
  return new_team;
end;
$$;

create function public.invite_team_member(p_team_id uuid, p_email text)
returns public.team_members
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
  new_member public.team_members;
begin
  if not public.is_team_admin(p_team_id, auth.uid()) then
    raise exception 'Only the team admin can invite members';
  end if;

  select id into target_user_id from public.profiles where email = lower(trim(p_email));
  if target_user_id is null then
    raise exception 'No hay ninguna cuenta de TimeDesk con ese email todavía.';
  end if;

  insert into public.team_members (team_id, user_id, role) values (p_team_id, target_user_id, 'member')
  returning * into new_member;

  return new_member;
exception
  when unique_violation then
    raise exception 'Esa persona ya es miembro del equipo.';
end;
$$;

create or replace function public.create_project(p_name text, p_description text default null, p_team_id uuid default null)
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

  if p_team_id is not null and not public.is_team_admin(p_team_id, auth.uid()) then
    raise exception 'Only the team admin can create projects in this team';
  end if;

  insert into public.projects (name, description, owner_id, team_id)
  values (p_name, p_description, auth.uid(), p_team_id)
  returning * into new_project;

  return new_project;
end;
$$;

create or replace function public.invite_project_member(p_project_id uuid, p_email text)
returns public.project_members
language plpgsql
security definer
set search_path = public
as $$
declare
  target_team_id uuid;
  target_user_id uuid;
  new_member public.project_members;
begin
  select team_id into target_team_id from public.projects where id = p_project_id;

  if target_team_id is not null then
    if not public.is_team_admin(target_team_id, auth.uid()) then
      raise exception 'Only the team admin can assign project access';
    end if;

    select tm.user_id into target_user_id
    from public.team_members tm
    join public.profiles p on p.id = tm.user_id
    where tm.team_id = target_team_id and p.email = lower(trim(p_email));

    if target_user_id is null then
      raise exception 'Esa persona no es miembro del equipo todavía.';
    end if;
  else
    if not public.is_project_owner(p_project_id, auth.uid()) then
      raise exception 'Only the project owner can invite members';
    end if;

    select id into target_user_id from public.profiles where email = lower(trim(p_email));
    if target_user_id is null then
      raise exception 'No hay ninguna cuenta de TimeDesk con ese email todavía.';
    end if;
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

-- Lets a team member see every project under their team, including ones they
-- don't have content access to yet (has_access = false). SECURITY INVOKER so
-- it's still governed by the projects SELECT policy above per-caller.
create function public.list_team_projects(p_team_id uuid)
returns table (
  id uuid,
  name text,
  description text,
  team_id uuid,
  owner_id uuid,
  created_at timestamptz,
  has_access boolean
)
language sql
security invoker
stable
set search_path = public
as $$
  select
    p.id, p.name, p.description, p.team_id, p.owner_id, p.created_at,
    exists (
      select 1 from public.project_members pm where pm.project_id = p.id and pm.user_id = auth.uid()
    ) as has_access
  from public.projects p
  where p.team_id = p_team_id;
$$;
