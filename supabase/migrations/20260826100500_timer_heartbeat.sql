-- El timer vivía solo como (started_at, ended_at is null): el tiempo se
-- calculaba como `now() - started_at`, así que si se cerraba la app, se
-- suspendía el equipo o se cortaba la luz, la sesión seguía "corriendo" y al
-- volver mostraba horas que nadie trabajó.
--
-- `last_heartbeat_at` es la prueba de vida: mientras el timer corre, el cliente
-- la refresca cada 30s. Si la app deja de latir, la sesión se cierra en el
-- último latido conocido (no en `now()`), que es el último instante en que
-- sabemos con certeza que la persona estaba trabajando.

alter table public.time_sessions
  add column last_heartbeat_at timestamptz not null default now();

-- Cierra la sesión abierta del usuario si su último latido es viejo. Corre en
-- el servidor a propósito: comparar `last_heartbeat_at` contra el reloj del
-- cliente daría resultados distintos en cada máquina.
-- Devuelve la sesión cerrada, o NULL si no había nada que cerrar.
create function public.close_stale_timer(p_stale_seconds integer default 120)
returns public.time_sessions
language plpgsql
security definer
set search_path = public
as $fn$
declare
  closed public.time_sessions;
begin
  update public.time_sessions
  set ended_at = greatest(last_heartbeat_at, started_at)
  where user_id = auth.uid()
    and ended_at is null
    and last_heartbeat_at < now() - make_interval(secs => greatest(p_stale_seconds, 30))
  returning * into closed;

  return closed;
end;
$fn$;

-- Un latido no debe poder alargar una sesión ajena ni resucitar una cerrada.
create function public.heartbeat_timer()
returns timestamptz
language plpgsql
security invoker
set search_path = public
as $fn$
declare
  beat timestamptz;
begin
  update public.time_sessions
  set last_heartbeat_at = now()
  where user_id = auth.uid() and ended_at is null
  returning last_heartbeat_at into beat;

  return beat;
end;
$fn$;
