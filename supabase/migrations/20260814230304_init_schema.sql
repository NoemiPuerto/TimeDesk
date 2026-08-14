-- TimeDesk schema: projects -> boards -> columns -> tasks -> time_sessions
-- project_id is denormalized onto columns/tasks/time_sessions (filled by triggers,
-- never supplied by the app) purely to keep RLS policies and realtime filters
-- single-table instead of multi-level joins.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.columns (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  position integer not null,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  column_id uuid not null references public.columns (id) on delete cascade,
  title text not null,
  description text,
  position integer not null default 0,
  created_by uuid not null references public.profiles (id),
  assigned_to uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.time_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

-- A running session has ended_at = null. This index makes "one active timer
-- per user" a hard DB constraint instead of app-level logic that could race.
create unique index one_active_session_per_user
  on public.time_sessions (user_id)
  where ended_at is null;

-- ── Derived columns via triggers (never set by the client) ─────────────────

create function public.set_column_project_id()
returns trigger language plpgsql as $$
begin
  select project_id into new.project_id from public.boards where id = new.board_id;
  return new;
end;
$$;

create trigger columns_set_project_id
  before insert on public.columns
  for each row execute function public.set_column_project_id();

create function public.set_task_project_id()
returns trigger language plpgsql as $$
begin
  select project_id into new.project_id from public.columns where id = new.column_id;
  return new;
end;
$$;

create trigger tasks_set_project_id
  before insert on public.tasks
  for each row execute function public.set_task_project_id();

create function public.set_session_project_id()
returns trigger language plpgsql as $$
begin
  select project_id into new.project_id from public.tasks where id = new.task_id;
  return new;
end;
$$;

create trigger sessions_set_project_id
  before insert on public.time_sessions
  for each row execute function public.set_session_project_id();

create function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_touch_updated_at
  before update on public.projects
  for each row execute function public.touch_updated_at();

create trigger tasks_touch_updated_at
  before update on public.tasks
  for each row execute function public.touch_updated_at();

-- ── Auth/profile bootstrap ──────────────────────────────────────────────────

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Project bootstrap: owner membership + default board/columns ────────────

create function public.enforce_project_member_limit()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.project_members where project_id = new.project_id) >= 4 then
    raise exception 'A project cannot have more than 4 members';
  end if;
  return new;
end;
$$;

create trigger project_member_limit
  before insert on public.project_members
  for each row execute function public.enforce_project_member_limit();

create function public.setup_new_project()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_board_id uuid;
begin
  insert into public.project_members (project_id, user_id, role)
  values (new.id, new.owner_id, 'owner');

  insert into public.boards (project_id) values (new.id)
  returning id into new_board_id;

  insert into public.columns (board_id, project_id, name, position) values
    (new_board_id, new.id, 'To Do', 0),
    (new_board_id, new.id, 'In Progress', 1),
    (new_board_id, new.id, 'Done', 2);

  return new;
end;
$$;

create trigger on_project_created
  after insert on public.projects
  for each row execute function public.setup_new_project();

-- ── RLS ──────────────────────────────────────────────────────────────────

create function public.is_project_member(p_project_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project_id and user_id = p_user_id
  );
$$;

create function public.is_project_owner(p_project_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.projects
    where id = p_project_id and owner_id = p_user_id
  );
$$;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.boards enable row level security;
alter table public.columns enable row level security;
alter table public.tasks enable row level security;
alter table public.time_sessions enable row level security;

create policy "profiles are readable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid());

create policy "members can read their projects"
  on public.projects for select
  to authenticated
  using (public.is_project_member(id, auth.uid()));

create policy "authenticated users can create projects"
  on public.projects for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "owners can update their projects"
  on public.projects for update
  to authenticated
  using (owner_id = auth.uid());

create policy "owners can delete their projects"
  on public.projects for delete
  to authenticated
  using (owner_id = auth.uid());

create policy "members can read project membership"
  on public.project_members for select
  to authenticated
  using (public.is_project_member(project_id, auth.uid()));

create policy "owners can invite members"
  on public.project_members for insert
  to authenticated
  with check (public.is_project_owner(project_id, auth.uid()));

create policy "owners remove members, members remove themselves"
  on public.project_members for delete
  to authenticated
  using (public.is_project_owner(project_id, auth.uid()) or user_id = auth.uid());

create policy "members can read boards"
  on public.boards for select
  to authenticated
  using (public.is_project_member(project_id, auth.uid()));

create policy "members can read columns"
  on public.columns for select
  to authenticated
  using (public.is_project_member(project_id, auth.uid()));

create policy "members can manage columns"
  on public.columns for insert
  to authenticated
  with check (public.is_project_member(project_id, auth.uid()));

create policy "members can update columns"
  on public.columns for update
  to authenticated
  using (public.is_project_member(project_id, auth.uid()));

create policy "members can delete columns"
  on public.columns for delete
  to authenticated
  using (public.is_project_member(project_id, auth.uid()));

create policy "members can read tasks"
  on public.tasks for select
  to authenticated
  using (public.is_project_member(project_id, auth.uid()));

create policy "members can create tasks"
  on public.tasks for insert
  to authenticated
  with check (public.is_project_member(project_id, auth.uid()));

create policy "members can update tasks"
  on public.tasks for update
  to authenticated
  using (public.is_project_member(project_id, auth.uid()));

create policy "members can delete tasks"
  on public.tasks for delete
  to authenticated
  using (public.is_project_member(project_id, auth.uid()));

create policy "members can read time sessions in their projects"
  on public.time_sessions for select
  to authenticated
  using (public.is_project_member(project_id, auth.uid()));

create policy "users can log their own time"
  on public.time_sessions for insert
  to authenticated
  with check (user_id = auth.uid() and public.is_project_member(project_id, auth.uid()));

create policy "users can update their own time sessions"
  on public.time_sessions for update
  to authenticated
  using (user_id = auth.uid());

create policy "users can delete their own time sessions"
  on public.time_sessions for delete
  to authenticated
  using (user_id = auth.uid());
