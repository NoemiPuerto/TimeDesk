-- Postgres treats a function name + parameter list as the function's
-- identity: CREATE OR REPLACE with an added parameter does not replace an
-- existing function, it creates a second overload alongside it. PostgREST
-- then can't pick between them ("Could not choose the best candidate
-- function"). Drop the old 2-parameter signature explicitly so only the
-- 3-parameter version (with p_team_id) remains.
drop function if exists public.create_project(text, text);
