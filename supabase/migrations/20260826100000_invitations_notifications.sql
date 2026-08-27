-- Invitaciones con aceptar/rechazar + buzón de notificaciones (menciones).
--
-- Antes, `invite_team_member` / `invite_project_member` insertaban directo en
-- team_members / project_members: la otra persona quedaba dentro sin enterarse
-- y sin poder rechazar. Ahora esas RPC crean una fila *pendiente* en
-- `invitations`, y la membresía real se crea recién cuando la persona acepta
-- desde el buzón (`respond_invitation`).

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('team', 'project')),
  team_id uuid references public.teams (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  -- Nombre copiado al crear la invitación: quien la recibe todavía NO es
  -- miembro del equipo/proyecto, así que las políticas RLS de `teams` y
  -- `projects` no le dejarían leer el nombre por join.
  team_name text,
  project_name text,
  inviter_id uuid not null references public.profiles (id) on delete cascade,
  invitee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint invitation_target_matches_kind check (
    (kind = 'team' and team_id is not null and project_id is null)
    or (kind = 'project' and project_id is not null and team_id is null)
  )
);

create unique index invitations_one_pending_team
  on public.invitations (team_id, invitee_id)
  where status = 'pending' and kind = 'team';

create unique index invitations_one_pending_project
  on public.invitations (project_id, invitee_id)
  where status = 'pending' and kind = 'project';

create index invitations_invitee_pending on public.invitations (invitee_id) where status = 'pending';

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('mention')),
  -- Si se borra el proyecto la notificación ya no significa nada (cascade),
  -- pero borrar la tarea o el comentario solo le quita el destino: la fila
  -- sobrevive con su copia del texto, así que `set null` y no `cascade`.
  project_id uuid references public.projects (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  comment_id uuid references public.comments (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete cascade,
  -- Snapshot del texto y del título: si el comentario o la tarea se borran, la
  -- notificación sigue siendo legible en el buzón.
  body text,
  task_title text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_recent on public.notifications (user_id, created_at desc);

-- Realtime necesita REPLICA IDENTITY FULL para que los filtros por columna
-- (user_id / invitee_id) hagan match también en DELETE — ver CLAUDE.md.
alter table public.invitations replica identity full;
alter table public.notifications replica identity full;
alter publication supabase_realtime add table public.invitations;
alter publication supabase_realtime add table public.notifications;

alter table public.invitations enable row level security;
alter table public.notifications enable row level security;

-- Sin política de INSERT: las invitaciones se crean solo por RPC.
create policy "invitee, inviter and admins can read invitations"
  on public.invitations for select to authenticated
  using (
    invitee_id = auth.uid()
    or inviter_id = auth.uid()
    or (kind = 'team' and public.is_team_admin(team_id, auth.uid()))
    or (kind = 'project' and public.is_project_owner(project_id, auth.uid()))
  );

-- Cancelar una invitación pendiente (o limpiar una ya respondida).
create policy "inviter, invitee and admins can delete invitations"
  on public.invitations for delete to authenticated
  using (
    inviter_id = auth.uid()
    or invitee_id = auth.uid()
    or (kind = 'team' and public.is_team_admin(team_id, auth.uid()))
    or (kind = 'project' and public.is_project_owner(project_id, auth.uid()))
  );

create policy "users read their own notifications"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

create policy "users update their own notifications"
  on public.notifications for update to authenticated
  using (user_id = auth.uid());

create policy "users delete their own notifications"
  on public.notifications for delete to authenticated
  using (user_id = auth.uid());

-- Menciones ------------------------------------------------------------------
-- No hay tabla de relación ni autocompletado: al guardar un comentario se busca
-- "@nombre" (case-insensitive) contra el display_name de cada miembro del
-- proyecto y se crea una notificación. Menciones NUEVAS escritas con un nombre
-- viejo (si alguien se renombra) dejan de hacer match — limitación aceptada.

create function public.notify_comment_mentions()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.notifications (user_id, type, project_id, task_id, comment_id, actor_id, body, task_title)
  select
    pm.user_id,
    'mention',
    new.project_id,
    new.task_id,
    new.id,
    new.user_id,
    new.body,
    (select t.title from public.tasks t where t.id = new.task_id)
  from public.project_members pm
  join public.profiles p on p.id = pm.user_id
  where pm.project_id = new.project_id
    and pm.user_id <> new.user_id
    and length(trim(p.display_name)) > 0
    and position(lower('@' || trim(p.display_name)) in lower(new.body)) > 0;

  return new;
end;
$fn$;

create trigger comments_notify_mentions
  after insert on public.comments
  for each row execute function public.notify_comment_mentions();

-- RPCs de invitación ---------------------------------------------------------
-- `create or replace` no alcanza: cambia el tipo de retorno
-- (team_members/project_members -> invitations) — ver CLAUDE.md.

drop function if exists public.invite_team_member(uuid, text);

create function public.invite_team_member(p_team_id uuid, p_email text)
returns public.invitations
language plpgsql
security definer
set search_path = public
as $fn$
declare
  target_user_id uuid;
  new_invitation public.invitations;
begin
  if not public.is_team_admin(p_team_id, auth.uid()) then
    raise exception 'Solo un admin del equipo puede invitar miembros.';
  end if;

  -- lower() en ambos lados: auth.users guarda el email en minúsculas, pero no
  -- damos por sentado cómo lo escribió quien invita.
  select id into target_user_id from public.profiles where lower(email) = lower(trim(p_email));
  if target_user_id is null then
    raise exception 'No hay ninguna cuenta de TimeDesk con ese email todavía.';
  end if;

  if public.is_team_member(p_team_id, target_user_id) then
    raise exception 'Esa persona ya es miembro del equipo.';
  end if;

  insert into public.invitations (kind, team_id, team_name, inviter_id, invitee_id)
  values ('team', p_team_id, (select name from public.teams where id = p_team_id), auth.uid(), target_user_id)
  returning * into new_invitation;

  return new_invitation;
exception
  when unique_violation then
    raise exception 'Esa persona ya tiene una invitación pendiente.';
end;
$fn$;

drop function if exists public.invite_project_member(uuid, text);

create function public.invite_project_member(p_project_id uuid, p_email text)
returns public.invitations
language plpgsql
security definer
set search_path = public
as $fn$
declare
  target_team_id uuid;
  target_user_id uuid;
  new_invitation public.invitations;
begin
  select team_id into target_team_id from public.projects where id = p_project_id;

  if target_team_id is not null then
    if not public.is_team_admin(target_team_id, auth.uid()) then
      raise exception 'Solo un admin del equipo puede dar acceso a este proyecto.';
    end if;

    select tm.user_id into target_user_id
    from public.team_members tm
    join public.profiles p on p.id = tm.user_id
    where tm.team_id = target_team_id and lower(p.email) = lower(trim(p_email));

    if target_user_id is null then
      raise exception 'Esa persona no es miembro del equipo todavía.';
    end if;
  else
    if not public.is_project_owner(p_project_id, auth.uid()) then
      raise exception 'Solo el dueño del proyecto puede invitar miembros.';
    end if;

    select id into target_user_id from public.profiles where lower(email) = lower(trim(p_email));
    if target_user_id is null then
      raise exception 'No hay ninguna cuenta de TimeDesk con ese email todavía.';
    end if;
  end if;

  if public.is_project_member(p_project_id, target_user_id) then
    raise exception 'Esa persona ya es miembro del proyecto.';
  end if;

  insert into public.invitations (kind, project_id, project_name, inviter_id, invitee_id)
  values ('project', p_project_id, (select name from public.projects where id = p_project_id), auth.uid(), target_user_id)
  returning * into new_invitation;

  return new_invitation;
exception
  when unique_violation then
    raise exception 'Esa persona ya tiene una invitación pendiente a este proyecto.';
end;
$fn$;

create function public.respond_invitation(p_invitation_id uuid, p_accept boolean)
returns public.invitations
language plpgsql
security definer
set search_path = public
as $fn$
declare
  inv public.invitations;
  target_team_id uuid;
begin
  select * into inv from public.invitations where id = p_invitation_id;

  if inv.id is null then
    raise exception 'Esa invitación ya no existe.';
  end if;
  if inv.invitee_id <> auth.uid() then
    raise exception 'Esa invitación no es tuya.';
  end if;
  if inv.status <> 'pending' then
    raise exception 'Esa invitación ya fue respondida.';
  end if;

  if p_accept then
    if inv.kind = 'team' then
      insert into public.team_members (team_id, user_id, role)
      values (inv.team_id, inv.invitee_id, 'member')
      on conflict (team_id, user_id) do nothing;
    else
      select team_id into target_team_id from public.projects where id = inv.project_id;
      -- Un proyecto de equipo solo puede tener miembros del equipo: si todavía
      -- no aceptó la invitación al equipo, esta no puede colarlo por la puerta
      -- de atrás.
      if target_team_id is not null and not public.is_team_member(target_team_id, inv.invitee_id) then
        raise exception 'Primero acepta la invitación al equipo.';
      end if;

      insert into public.project_members (project_id, user_id, role)
      values (inv.project_id, inv.invitee_id, 'member')
      on conflict (project_id, user_id) do nothing;
    end if;
  end if;

  update public.invitations
  set status = case when p_accept then 'accepted' else 'declined' end,
      responded_at = now()
  where id = p_invitation_id
  returning * into inv;

  return inv;
end;
$fn$;
