alter table public.teams add column avatar_url text;

create function public.is_team_owner(p_team_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.teams
    where id = p_team_id and owner_id = p_user_id
  );
$$;

-- Public bucket: profile pictures (users) and team pictures aren't sensitive
-- and need to render for anyone who can see the owning user/team, which can
-- span multiple projects — a signed-URL-per-project scheme like `attachments`
-- would be the wrong fit here. Paths are `users/{user_id}` and
-- `teams/{team_id}` (no extension; content-type is stored separately),
-- uploaded with `{ upsert: true }` so a new picture replaces the old object
-- in place instead of accumulating orphaned files.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "users upload their own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = 'users'
    and split_part(name, '/', 2) = auth.uid()::text
  );

create policy "users update their own avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = 'users'
    and split_part(name, '/', 2) = auth.uid()::text
  );

create policy "users delete their own avatar"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = 'users'
    and split_part(name, '/', 2) = auth.uid()::text
  );

create policy "team owner uploads team avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = 'teams'
    and public.is_team_owner(split_part(name, '/', 2)::uuid, auth.uid())
  );

create policy "team owner updates team avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = 'teams'
    and public.is_team_owner(split_part(name, '/', 2)::uuid, auth.uid())
  );

create policy "team owner deletes team avatar"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = 'teams'
    and public.is_team_owner(split_part(name, '/', 2)::uuid, auth.uid())
  );
