-- Fecha de inicio de la tarea.
--
-- Hasta ahora `tasks` solo tenía `due_date`, así que el Gantt del Timeline
-- tenía que deducir el arranque de cada barra a partir de `created_at`: en un
-- proyecto donde todo se creó el mismo día, todas las barras salían alineadas
-- y solo las diferenciaba el final. `start_date` es esa fecha de verdad, y se
-- puede mover sin tocar cuándo se dio de alta la fila.
--
-- Es NOT NULL a propósito: una tarea siempre empieza en algún momento, aunque
-- sea hoy. Así el Gantt no tiene que arrastrar un caso "sin inicio" y la fecha
-- límite sigue siendo lo único opcional.
alter table public.tasks add column start_date date;

-- Relleno de lo que ya existe: el día en que se creó la tarea, que es
-- exactamente lo que el Gantt venía usando.
update public.tasks
set start_date = (created_at at time zone 'UTC')::date
where start_date is null;

alter table public.tasks alter column start_date set default current_date;
alter table public.tasks alter column start_date set not null;

-- `create_task` gana un parámetro, así que hay que BORRAR la versión vieja
-- antes: para Postgres el nombre + la lista de parámetros es la identidad de
-- la función, y un `create or replace` a secas dejaría las dos conviviendo y
-- PostgREST respondería PGRST203 ("could not choose the best candidate
-- function"). Ver la nota de CLAUDE.md sobre esto.
drop function if exists public.create_task(uuid, uuid, text);

create function public.create_task(
  p_project_id uuid,
  p_column_id uuid,
  p_title text,
  p_start_date date default null
)
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

  -- El cliente manda su fecha LOCAL; `current_date` (que en Supabase es UTC)
  -- es solo la red de seguridad para una llamada que no la mande.
  insert into public.tasks (project_id, column_id, title, position, created_by, start_date)
  values (p_project_id, p_column_id, p_title, next_position, auth.uid(), coalesce(p_start_date, current_date))
  returning * into new_task;

  return new_task;
end;
$$;
