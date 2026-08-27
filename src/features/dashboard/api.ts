import { supabase } from "../../lib/supabase";
import type { Project } from "../projects/api";
import type { Column, Task } from "../board/api";
import type { TimeSession } from "../timer/api";

/** Every project the caller is an actual member of — personal or team-assigned, not just visible. */
export async function listAccessibleProjects(userId: string): Promise<Project[]> {
  const { data, error } = await supabase
    .from("project_members")
    .select("project:projects(id, name, description, owner_id, team_id, created_at, done_display_limit)")
    .eq("user_id", userId);
  if (error) throw error;
  return (data as unknown as { project: Project }[]).map((row) => row.project);
}

export async function listTasksForProjects(projectIds: string[]): Promise<Task[]> {
  if (projectIds.length === 0) return [];
  const { data, error } = await supabase
    .from("tasks")
    .select("id, project_id, column_id, title, description, priority, due_date, position, created_at, completed_at")
    .in("project_id", projectIds);
  if (error) throw error;
  return data as Task[];
}

export async function listColumnsForProjects(projectIds: string[]): Promise<Column[]> {
  if (projectIds.length === 0) return [];
  const { data, error } = await supabase
    .from("columns")
    .select("id, board_id, project_id, name, position")
    .in("project_id", projectIds)
    .order("position", { ascending: true });
  if (error) throw error;
  return data;
}

export async function listSessionsForProjects(projectIds: string[], since: string): Promise<TimeSession[]> {
  if (projectIds.length === 0) return [];
  const { data, error } = await supabase
    .from("time_sessions")
    .select("*")
    .in("project_id", projectIds)
    .gte("started_at", since);
  if (error) throw error;
  return data;
}
