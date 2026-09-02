-- Conexión de cada persona con su Google Calendar.
--
-- Una fila por usuario: quien conecta su cuenta autoriza a TimeDesk a escribir
-- eventos en SU calendario, así que el token es suyo y solo él lo ve. La
-- política es `user_id = auth.uid()` a secas: aquí no hay nada compartido con
-- el equipo, a diferencia del resto de tablas del proyecto.
--
-- Aviso honesto que conviene tener escrito: el refresh_token queda en claro en
-- esta tabla. Lo protege la RLS (nadie más lo lee) y el cifrado en reposo de
-- Supabase, pero la `service_role` key sí puede leerlo — quien administre el
-- proyecto de Supabase tiene acceso. Para el tamaño de esta app se asume;
-- endurecerlo pasaría por Vault o por mover el intercambio a una Edge Function.

create table public.google_calendar_accounts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  -- Solo para poder decir en Settings a QUÉ cuenta se está mandando.
  google_email text,
  refresh_token text not null,
  access_token text,
  access_expires_at timestamptz,
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz
);

alter table public.google_calendar_accounts enable row level security;

-- Sin política de INSERT: el alta va por RPC, como el resto de tablas con
-- foreign keys (ver la nota de CLAUDE.md sobre el bug de INSERT+FK).
create policy "own google account is readable"
  on public.google_calendar_accounts for select to authenticated
  using (user_id = auth.uid());

create policy "own google account is updatable"
  on public.google_calendar_accounts for update to authenticated
  using (user_id = auth.uid());

create policy "own google account is deletable"
  on public.google_calendar_accounts for delete to authenticated
  using (user_id = auth.uid());

-- Alta y reconexión en una: volver a conectar sobreescribe los tokens en vez
-- de fallar por clave duplicada.
create function public.save_google_account(
  p_refresh_token text,
  p_access_token text,
  p_access_expires_at timestamptz,
  p_google_email text
)
returns public.google_calendar_accounts
language plpgsql
security definer
set search_path = public
as $fn$
declare
  saved public.google_calendar_accounts;
begin
  if auth.uid() is null then
    raise exception 'Hay que iniciar sesión para conectar Google Calendar.';
  end if;
  if coalesce(trim(p_refresh_token), '') = '' then
    raise exception 'Google no devolvió un refresh token.';
  end if;

  insert into public.google_calendar_accounts
    (user_id, refresh_token, access_token, access_expires_at, google_email)
  values
    (auth.uid(), p_refresh_token, p_access_token, p_access_expires_at, p_google_email)
  on conflict (user_id) do update set
    refresh_token = excluded.refresh_token,
    access_token = excluded.access_token,
    access_expires_at = excluded.access_expires_at,
    google_email = excluded.google_email,
    connected_at = now()
  returning * into saved;

  return saved;
end;
$fn$;
