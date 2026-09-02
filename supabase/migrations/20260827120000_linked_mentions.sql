-- Menciones ligadas a una persona, no a su nombre escrito.
--
-- El trigger anterior buscaba el texto "@" || display_name dentro del cuerpo.
-- Eso fallaba en los dos sentidos: si alguien se renombraba, las menciones
-- nuevas escritas con el nombre viejo dejaban de avisar; y dos personas con
-- nombres parecidos ("Ana" dentro de "Ana María") podían recibir avisos que no
-- eran suyos, porque era una coincidencia de subcadena.
--
-- Ahora el cliente inserta la mención como `@[Nombre](uuid)` y este trigger
-- extrae el uuid. El nombre que quede en el texto es solo decorativo.
--
-- No toca datos existentes: los comentarios ya guardados siguen tal cual y sus
-- notificaciones ya se crearon en su momento. Lo que cambia es que, de aquí en
-- adelante, escribir "@Noemi" a mano SIN elegir de la lista ya no notifica —
-- deja de ser una mención y pasa a ser texto. Es el comportamiento pedido.

create or replace function public.notify_comment_mentions()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.notifications (user_id, type, project_id, task_id, comment_id, actor_id, body, task_title)
  select distinct
    pm.user_id,
    'mention',
    new.project_id,
    new.task_id,
    new.id,
    new.user_id,
    new.body,
    (select t.title from public.tasks t where t.id = new.task_id)
  from regexp_matches(
         new.body,
         '@\[[^\]]{1,80}\]\(([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)',
         'g'
       ) as m(groups)
  -- El join contra project_members es también el control de acceso: mencionar a
  -- alguien que no está en el proyecto no crea nada, aunque el uuid sea válido.
  join public.project_members pm
    on pm.project_id = new.project_id
   and pm.user_id = (m.groups[1])::uuid
  where pm.user_id <> new.user_id;

  return new;
end;
$fn$;
