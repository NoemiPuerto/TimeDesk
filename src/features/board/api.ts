import { supabase } from "../../lib/supabase";

export type Column = {
  id: string;
  board_id: string;
  project_id: string;
  name: string;
  position: number;
};

export type Task = {
  id: string;
  project_id: string;
  column_id: string;
  title: string;
  position: number;
  created_at: string;
};

export async function listColumns(projectId: string): Promise<Column[]> {
  const { data, error } = await supabase
    .from("columns")
    .select("id, board_id, project_id, name, position")
    .eq("project_id", projectId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createColumn(projectId: string, name: string): Promise<Column> {
  // See rpc_writes migration: INSERT on FK-bearing tables must go through an
  // RPC on this Postgres instance.
  const { data, error } = await supabase.rpc("create_column", { p_project_id: projectId, p_name: name });
  if (error) throw error;
  return data;
}

export async function renameColumn(columnId: string, name: string): Promise<void> {
  const { error } = await supabase.from("columns").update({ name }).eq("id", columnId);
  if (error) throw error;
}

export async function deleteColumn(columnId: string): Promise<void> {
  const { error } = await supabase.from("columns").delete().eq("id", columnId);
  if (error) throw error;
}

export async function listTasks(projectId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, project_id, column_id, title, position, created_at")
    .eq("project_id", projectId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createTask(projectId: string, columnId: string, title: string): Promise<Task> {
  // See rpc_writes migration: INSERT on FK-bearing tables must go through an
  // RPC on this Postgres instance.
  const { data, error } = await supabase.rpc("create_task", {
    p_project_id: projectId,
    p_column_id: columnId,
    p_title: title,
  });
  if (error) throw error;
  return data;
}

export async function renameTask(taskId: string, title: string): Promise<void> {
  const { error } = await supabase.from("tasks").update({ title }).eq("id", taskId);
  if (error) throw error;
}

export async function deleteTask(taskId: string): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw error;
}

export async function reorderTasks(updates: { id: string; column_id: string; position: number }[]): Promise<void> {
  const results = await Promise.all(
    updates.map((u) => supabase.from("tasks").update({ column_id: u.column_id, position: u.position }).eq("id", u.id)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}
