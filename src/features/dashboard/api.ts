import { supabase } from "../../lib/supabase";
import { PROJECT_COLUMNS, type Project } from "../projects/api";
import { TASK_COLUMNS, type Column, type Task } from "../board/api";
import type { TimeSession } from "../timer/api";

/** Every project the caller is an actual member of — personal or team-assigned, not just visible. */
export async function listAccessibleProjects(userId: string): Promise<Project[]> {
  const { data, error } = await supabase
    .from("project_members")
    .select(`project:projects(${PROJECT_COLUMNS})`)
    .eq("user_id", userId);
  if (error) throw error;
  return (data as unknown as { project: Project }[]).map((row) => row.project);
}

export async function listTasksForProjects(projectIds: string[]): Promise<Task[]> {
  if (projectIds.length === 0) return [];
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_COLUMNS)
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

/** Ids de las tareas asignadas a esta persona dentro de los proyectos dados. */
export async function listMyAssignedTaskIds(userId: string, projectIds: string[]): Promise<Set<string>> {
  if (projectIds.length === 0) return new Set();
  // task_assignees no guarda project_id: se acota con un join interno a tasks,
  // igual que hace listAllTaskAssignees.
  const { data, error } = await supabase
    .from("task_assignees")
    .select("task_id, task:tasks!inner(project_id)")
    .eq("user_id", userId)
    .in("task.project_id", projectIds);
  if (error) throw error;
  return new Set((data as unknown as { task_id: string }[]).map((row) => row.task_id));
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
