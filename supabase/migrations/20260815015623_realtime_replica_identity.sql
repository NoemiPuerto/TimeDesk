-- REPLICA IDENTITY DEFAULT only sends the primary key on DELETE, so a
-- Realtime `filter: project_id=eq.X` never matches a DELETE payload (it lacks
-- project_id entirely) and the event silently never reaches subscribers.
-- FULL includes every column on both UPDATE and DELETE payloads.
alter table public.columns replica identity full;
alter table public.tasks replica identity full;
alter table public.time_sessions replica identity full;
alter table public.project_members replica identity full;
