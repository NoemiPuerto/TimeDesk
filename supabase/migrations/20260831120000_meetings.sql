-- Juntas de equipo.
--
-- Las agenda CUALQUIER miembro del equipo, no solo los admin: es la petición
-- explícita. Lo que sí se controla es a quién se puede invitar — solo a gente
-- del mismo equipo — y quién puede verlas después: quien la creó y los
-- invitados, nadie más del equipo.

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes > 0 and duration_minutes <= 1440),
  created_at timestamptz not null default now()
);

create table public.meeting_attendees (
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (meeting_id, user_id)
);

create index meetings_team_upcoming on public.meetings (team_id, starts_at);
create index meeting_attendees_user on public.meeting_attendees (user_id);

alter table public.meetings replica identity full;
alter table public.meeting_attendees replica identity full;
alter publication supabase_realtime add table public.meetings;
alter publication supabase_realtime add table public.meeting_attendees;

-- SECURITY DEFINER para cortar la recursión: la política de `meetings`
-- consulta a los invitados y la de `meeting_attendees` consultaría a las
-- juntas. Mismo patrón que `is_project_member`.
create function public.is_meeting_attendee(p_meeting_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.meeting_attendees where meeting_id = p_meeting_id and user_id = p_user_id
  );
$$;

alter table public.meetings enable row level security;
alter table public.meeting_attendees enable row level security;

-- Sin política de INSERT: las juntas se crean solo por RPC.
create policy "attendees read their meetings"
  on public.meetings for select to authenticated
  using (created_by = auth.uid() or public.is_meeting_attendee(id, auth.uid()));

create policy "organizer updates the meeting"
  on public.meetings for update to authenticated
  using (created_by = auth.uid());

create policy "organizer cancels the meeting"
  on public.meetings for delete to authenticated
  using (created_by = auth.uid());

-- Quien organiza queda siempre como invitado, así que esta condición también
-- lo cubre a él.
create policy "attendees read the guest list"
  on public.meeting_attendees for select to authenticated
  using (public.is_meeting_attendee(meeting_id, auth.uid()));

-- Notificaciones: hasta ahora solo existían las menciones.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (type in ('mention', 'meeting_invite'));
alter table public.notifications
  add column meeting_id uuid references public.meetings (id) on delete cascade;

create function public.create_meeting(
  p_team_id uuid,
  p_title text,
  p_starts_at timestamptz,
  p_duration_minutes integer,
  p_attendee_ids uuid[]
)
returns public.meetings
language plpgsql
security definer
set search_path = public
as $fn$
declare
  new_meeting public.meetings;
  attendee uuid;
begin
  if not public.is_team_member(p_team_id, auth.uid()) then
    raise exception 'Solo los miembros del equipo pueden agendar juntas.';
  end if;
  if coalesce(trim(p_title), '') = '' then
    raise exception 'La junta necesita un título.';
  end if;
  if p_starts_at is null then
    raise exception 'La junta necesita fecha y hora.';
  end if;

  insert into public.meetings (team_id, created_by, title, starts_at, duration_minutes)
  values (p_team_id, auth.uid(), trim(p_title), p_starts_at, p_duration_minutes)
  returning * into new_meeting;

  -- Quien organiza entra siempre: si no, no vería su propia junta.
  insert into public.meeting_attendees (meeting_id, user_id)
  values (new_meeting.id, auth.uid())
  on conflict do nothing;

  foreach attendee in array coalesce(p_attendee_ids, array[]::uuid[]) loop
    -- El control de acceso va aquí, no en el cliente: invitar a alguien de
    -- fuera del equipo le daría visibilidad sobre una junta que no le toca.
    if not public.is_team_member(p_team_id, attendee) then
      raise exception 'Solo puedes invitar a miembros del equipo.';
    end if;

    insert into public.meeting_attendees (meeting_id, user_id)
    values (new_meeting.id, attendee)
    on conflict do nothing;

    if attendee <> auth.uid() then
      insert into public.notifications (user_id, type, actor_id, meeting_id, body)
      values (attendee, 'meeting_invite', auth.uid(), new_meeting.id, new_meeting.title);
    end if;
  end loop;

  return new_meeting;
end;
$fn$;
