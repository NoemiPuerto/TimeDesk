-- Portada y categoría de proyecto.
--
-- Las tarjetas de la pestaña Projects eran nombre + avatares sobre una caja
-- gris. Con la portada y la categoría pasan a distinguirse de un vistazo, y la
-- descripción —que ya existía y no se enseñaba en ningún sitio— por fin se ve.
alter table public.projects add column cover_url text;
alter table public.projects add column category text;

-- ¿Quién puede administrar este proyecto? El dueño siempre; en un proyecto de
-- equipo, también el admin del equipo — el mismo criterio que ya usa
-- `MembersPanel` para decidir `canManage`, pero aquí en la base porque hace
-- falta dentro de una política de Storage.
create function public.can_manage_project(p_project_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and (
        p.owner_id = p_user_id
        or (p.team_id is not null and public.is_team_admin(p.team_id, p_user_id))
      )
  );
$$;

-- Portadas en el bucket público `avatars` que ya existe, con el prefijo
-- `projects/`. Es el mismo caso de uso que las fotos de perfil y de equipo: no
-- son sensibles y tienen que verse desde varias pantallas, así que las signed
-- URLs por-proyecto de `attachments` serían la herramienta equivocada. Path
-- fijo `projects/{project_id}` subido con upsert, así que no quedan objetos
-- huérfanos y solo hay que romper la caché con `?t=`.
create policy "project managers upload covers"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = 'projects'
    and public.can_manage_project(split_part(name, '/', 2)::uuid, auth.uid())
  );

create policy "project managers update covers"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = 'projects'
    and public.can_manage_project(split_part(name, '/', 2)::uuid, auth.uid())
  );

create policy "project managers delete covers"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = 'projects'
    and public.can_manage_project(split_part(name, '/', 2)::uuid, auth.uid())
  );

-- `list_team_projects` tiene que devolver también portada y categoría, o las
-- tarjetas de un proyecto de equipo bloqueado saldrían sin nada que las
-- distinga. Cambia el tipo de retorno, así que hay que borrarla antes: un
-- `create or replace` falla con "cannot change return type of existing
-- function". Los parámetros no cambian, así que no hay riesgo de overload.
drop function if exists public.list_team_projects(uuid);

create function public.list_team_projects(p_team_id uuid)
returns table (
  id uuid,
  name text,
  description text,
  cover_url text,
  category text,
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
    p.id, p.name, p.description, p.cover_url, p.category,
    p.team_id, p.owner_id, p.created_at, p.done_display_limit,
    exists (
      select 1 from public.project_members pm where pm.project_id = p.id and pm.user_id = auth.uid()
    ) as has_access
  from public.projects p
  where p.team_id = p_team_id;
$fn$;
