-- Las juntas pasan a ser EVENTOS: además de reuniones, ahora caben entregas,
-- cumpleaños, festivos y cualquier fecha que el equipo quiera tener a la vista.
-- Con eso llegan dos cosas nuevas: categoría y repetición.
--
-- El renombrado conserva los datos (`alter table ... rename`, no drop+create).
-- Índices, constraints y políticas siguen a la tabla; lo que NO sigue es el
-- cuerpo de las funciones, que referencia los nombres viejos en texto, así que
-- hay que recrearlas.

alter table public.meetings rename to events;
alter table public.meeting_attendees rename to event_attendees;
alter table public.event_attendees rename column meeting_id to event_id;

-- Categoría: texto libre con sugerencias en el cliente, igual que la de
-- proyectos. Sin catálogo ni tabla — ver la nota de CLAUDE.md.
alter table public.events add column category text;

-- Repetición: UNA fila con su regla, no una fila por ocurrencia. Un cumpleaños
-- son 1 fila y no 20, y mover la fecha no obliga a rehacer la serie. Las
-- ocurrencias se expanden al leer, para la ventana que se esté mirando.
alter table public.events
  add column recurrence text not null default 'none'
  check (recurrence in ('none', 'weekly', 'monthly', 'yearly'));

-- ── Función de pertenencia ──────────────────────────────────────────────
-- SECURITY DEFINER para cortar la recursión entre las políticas de las dos
-- tablas, igual que antes.
create function public.is_event_attendee(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.event_attendees where event_id = p_event_id and user_id = p_user_id
  );
$$;

-- Las políticas llaman a la función por nombre, así que hay que rehacerlas
-- ANTES de poder borrar la vieja.
drop policy if exists "attendees read their meetings" on public.events;
drop policy if exists "organizer updates the meeting" on public.events;
drop policy if exists "organizer cancels the meeting" on public.events;
drop policy if exists "attendees read the guest list" on public.event_attendees;

create policy "attendees read their events"
  on public.events for select to authenticated
  using (created_by = auth.uid() or public.is_event_attendee(id, auth.uid()));

create policy "organizer updates the event"
  on public.events for update to authenticated
  using (created_by = auth.uid());

create policy "organizer cancels the event"
  on public.events for delete to authenticated
  using (created_by = auth.uid());

create policy "attendees read the guest list"
  on public.event_attendees for select to authenticated
  using (public.is_event_attendee(event_id, auth.uid()));

drop function if exists public.is_meeting_attendee(uuid, uuid);

-- ── Notificaciones ──────────────────────────────────────────────────────
alter table public.notifications rename column meeting_id to event_id;
alter table public.notifications drop constraint if exists notifications_type_check;
update public.notifications set type = 'event_invite' where type = 'meeting_invite';
alter table public.notifications
  add constraint notifications_type_check check (type in ('mention', 'event_invite'));

-- ── Alta de eventos ─────────────────────────────────────────────────────
-- Cambia el nombre y la lista de parámetros, así que la vieja se borra: dos
-- funciones con el mismo nombre y distinta firma dejarían a PostgREST sin poder
-- elegir (PGRST203). Ver la nota de CLAUDE.md.
drop function if exists public.create_meeting(uuid, text, timestamptz, integer, uuid[]);

create function public.create_event(
  p_team_id uuid,
  p_title text,
  p_starts_at timestamptz,
  p_duration_minutes integer,
  p_attendee_ids uuid[],
  p_category text default null,
  p_recurrence text default 'none'
)
returns public.events
language plpgsql
security definer
set search_path = public
as $fn$
declare
  new_event public.events;
  attendee uuid;
begin
  if not public.is_team_member(p_team_id, auth.uid()) then
    raise exception 'Solo los miembros del equipo pueden crear eventos.';
  end if;
  if coalesce(trim(p_title), '') = '' then
    raise exception 'El evento necesita un título.';
  end if;
  if p_starts_at is null then
    raise exception 'El evento necesita fecha y hora.';
  end if;

  insert into public.events (team_id, created_by, title, starts_at, duration_minutes, category, recurrence)
  values (
    p_team_id,
    auth.uid(),
    trim(p_title),
    p_starts_at,
    p_duration_minutes,
    nullif(trim(coalesce(p_category, '')), ''),
    coalesce(p_recurrence, 'none')
  )
  returning * into new_event;

  -- Quien organiza entra siempre: si no, no vería su propio evento.
  insert into public.event_attendees (event_id, user_id)
  values (new_event.id, auth.uid())
  on conflict do nothing;

  foreach attendee in array coalesce(p_attendee_ids, array[]::uuid[]) loop
    -- El control de acceso va aquí, no en el cliente: invitar a alguien de
    -- fuera del equipo le daría visibilidad sobre un evento que no le toca.
    if not public.is_team_member(p_team_id, attendee) then
      raise exception 'Solo puedes invitar a miembros del equipo.';
    end if;

    insert into public.event_attendees (event_id, user_id)
    values (new_event.id, attendee)
    on conflict do nothing;

    if attendee <> auth.uid() then
      insert into public.notifications (user_id, type, actor_id, event_id, body)
      values (attendee, 'event_invite', auth.uid(), new_event.id, new_event.title);
    end if;
  end loop;

  return new_event;
end;
$fn$;
