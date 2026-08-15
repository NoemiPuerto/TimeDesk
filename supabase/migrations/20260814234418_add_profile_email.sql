-- Denormalized so members can be invited by email without exposing auth.users
-- (profiles is already readable by any authenticated user via RLS).
alter table public.profiles add column email text not null default '';

update public.profiles p set email = u.email from auth.users u where u.id = p.id;

alter table public.profiles alter column email drop default;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.email), new.email);
  return new;
end;
$$;

create function public.sync_user_email()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.sync_user_email();
