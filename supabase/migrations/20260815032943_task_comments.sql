create table public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

-- Realtime DELETE filtering needs the full row (see CLAUDE.md note on
-- REPLICA IDENTITY); harmless for a table this size.
alter table public.comments replica identity full;
alter publication supabase_realtime add table public.comments;

create function public.set_comment_project_id()
returns trigger language plpgsql as $$
begin
  select project_id into new.project_id from public.tasks where id = new.task_id;
  return new;
end;
$$;

create trigger comments_set_project_id
  before insert on public.comments
  for each row execute function public.set_comment_project_id();

alter table public.comments enable row level security;

create policy "members can read comments"
  on public.comments for select to authenticated
  using (public.is_project_member(project_id, auth.uid()));

create policy "members can create comments"
  on public.comments for insert to authenticated
  with check (public.is_project_member(project_id, auth.uid()) and user_id = auth.uid());

create policy "authors can delete their own comments"
  on public.comments for delete to authenticated
  using (user_id = auth.uid());

-- INSERT goes through an RPC — see CLAUDE.md note on FK-bearing table inserts.
create function public.create_comment(p_task_id uuid, p_body text)
returns public.comments
language plpgsql
security definer
set search_path = public
as $$
declare
  target_project_id uuid;
  new_comment public.comments;
begin
  select project_id into target_project_id from public.tasks where id = p_task_id;
  if not public.is_project_member(target_project_id, auth.uid()) then
    raise exception 'Not a member of this project';
  end if;

  insert into public.comments (task_id, user_id, body)
  values (p_task_id, auth.uid(), p_body)
  returning * into new_comment;

  return new_comment;
end;
$$;
