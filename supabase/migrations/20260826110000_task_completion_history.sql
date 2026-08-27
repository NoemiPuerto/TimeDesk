-- Historial de tareas terminadas + límite configurable de la columna Done.
--
-- Hasta ahora "terminada" era puramente posicional: la tarea está en la última
-- columna del tablero. Eso alcanza para pintar la tarjeta en gris, pero no para
-- responder "¿cuándo la terminé?", que es lo que necesita el historial y el
-- tablero del Timer (que solo muestra lo de esta semana).

alter table public.tasks add column completed_at timestamptz;

-- Límite de tarjetas visibles en la columna Done del tablero. NULL = sin
-- límite; el resto de las terminadas se consultan en la pestaña History.
alter table public.projects add column done_display_limit integer default 10;
alter table public.projects
  add constraint done_display_limit_positive
  check (done_display_limit is null or done_display_limit > 0);

-- La "columna de terminadas" es la de mayor `position` del proyecto, la misma
-- regla que ya usa el cliente para atenuar las tarjetas. Se resuelve a partir
-- de `new.column_id` y NO de `new.project_id` a propósito: en un INSERT este
-- trigger puede correr antes que `tasks_set_project_id` (Postgres los ejecuta
-- en orden alfabético por nombre de trigger y 'c' < 'p'), así que
-- `new.project_id` todavía puede traer el valor crudo del cliente.
create function public.set_task_completed_at()
returns trigger
language plpgsql
set search_path = public
as $fn$
declare
  done_column_id uuid;
begin
  if tg_op = 'UPDATE' and new.column_id is not distinct from old.column_id then
    return new;
  end if;

  select c.id into done_column_id
  from public.columns c
  where c.project_id = (select c2.project_id from public.columns c2 where c2.id = new.column_id)
  order by c.position desc, c.created_at desc
  limit 1;

  if done_column_id is not null and new.column_id = done_column_id then
    new.completed_at = coalesce(new.completed_at, now());
  else
    -- Sacarla de Done la vuelve a abrir: el historial refleja el estado real,
    -- no acumula fechas de terminaciones que se deshicieron.
    new.completed_at = null;
  end if;

  return new;
end;
$fn$;

create trigger tasks_set_completed_at
  before insert or update on public.tasks
  for each row execute function public.set_task_completed_at();

-- Las tareas que ya estaban en Done no tienen fecha real de terminación; lo
-- más cercano que existe es su última modificación. El SET lee el valor viejo
-- de updated_at (el trigger touch_updated_at lo pisa después), que es
-- justamente el momento en que se la movió a Done.
update public.tasks t
set completed_at = t.updated_at
where t.completed_at is null
  and t.column_id = (
    select c.id
    from public.columns c
    where c.project_id = t.project_id
    order by c.position desc, c.created_at desc
    limit 1
  );

-- `list_team_projects` devuelve las columnas del proyecto una por una, así que
-- hay que recrearla para que incluya el límite nuevo. Cambia el tipo de
-- retorno: `create or replace` no alcanza, hace falta el drop explícito
-- (ver la nota de CLAUDE.md sobre firmas de funciones).
drop function if exists public.list_team_projects(uuid);

create function public.list_team_projects(p_team_id uuid)
returns table (
  id uuid,
  name text,
  description text,
  team_id uuid,
  owner_id uuid,
  created_at timestamptz,
  done_display_limit integer,
  has_access boolean
)
language sql
security invoker
stable
set search_path = public
as $fn$
  select
    p.id, p.name, p.description, p.team_id, p.owner_id, p.created_at, p.done_display_limit,
    exists (
      select 1 from public.project_members pm where pm.project_id = p.id and pm.user_id = auth.uid()
    ) as has_access
  from public.projects p
  where p.team_id = p_team_id;
$fn$;
