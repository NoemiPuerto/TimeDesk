-- Private bucket for task file attachments. Client enforces a 20MB per-file
-- cap (see attachments.ts) to keep this well inside the Supabase free tier.
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

-- Storage object paths follow `{project_id}/{task_id}/{uuid}-{filename}`, so
-- storage.foldername(name)[1] is always the owning project's id.
create policy "project members can read attachment files"
  on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and public.is_project_member((storage.foldername(name))[1]::uuid, auth.uid()));

create policy "project members can upload attachment files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and public.is_project_member((storage.foldername(name))[1]::uuid, auth.uid()));

create policy "project members can delete attachment files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and public.is_project_member((storage.foldername(name))[1]::uuid, auth.uid()));

-- Metadata table: lets us list/count attachments per task or project without
-- listing Storage folders one task at a time, same convenience the app
-- already gets from `comments`/`subtasks` over their raw data.
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  storage_path text not null,
  filename text not null,
  size_bytes bigint not null,
  content_type text,
  uploaded_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.attachments replica identity full;
alter publication supabase_realtime add table public.attachments;

create function public.set_attachment_project_id()
returns trigger language plpgsql as $$
begin
  select project_id into new.project_id from public.tasks where id = new.task_id;
  return new;
end;
$$;

create trigger attachments_set_project_id
  before insert on public.attachments
  for each row execute function public.set_attachment_project_id();

alter table public.attachments enable row level security;

create policy "members can read attachment metadata"
  on public.attachments for select to authenticated
  using (public.is_project_member(project_id, auth.uid()));

create policy "authors can delete their own attachment metadata"
  on public.attachments for delete to authenticated
  using (uploaded_by = auth.uid());

-- INSERT goes through an RPC — see CLAUDE.md note on FK-bearing table inserts.
create function public.create_attachment(
  p_task_id uuid,
  p_storage_path text,
  p_filename text,
  p_size_bytes bigint,
  p_content_type text default null
)
returns public.attachments
language plpgsql
security definer
set search_path = public
as $$
declare
  target_project_id uuid;
  new_attachment public.attachments;
begin
  select project_id into target_project_id from public.tasks where id = p_task_id;
  if not public.is_project_member(target_project_id, auth.uid()) then
    raise exception 'Not a member of this project';
  end if;

  insert into public.attachments (task_id, storage_path, filename, size_bytes, content_type, uploaded_by)
  values (p_task_id, p_storage_path, p_filename, p_size_bytes, p_content_type, auth.uid())
  returning * into new_attachment;

  return new_attachment;
end;
$$;
