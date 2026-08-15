-- Tables created via SQL migrations aren't added to the realtime publication
-- automatically (unlike tables created through the dashboard's table editor).
alter publication supabase_realtime add table public.columns;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.time_sessions;
alter publication supabase_realtime add table public.project_members;
