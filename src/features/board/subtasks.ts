import { supabase } from "../../lib/supabase";

export type Subtask = {
  id: string;
  task_id: string;
  title: string;
  is_done: boolean;
  position: number;
  created_at: string;
};

export async function listTaskSubtasks(taskId: string): Promise<Subtask[]> {
  const { data, error } = await supabase
    .from("subtasks")
    .select("id, task_id, title, is_done, position, created_at")
    .eq("task_id", taskId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createSubtask(taskId: string, title: string): Promise<Subtask> {
  // INSERT goes through an RPC — see CLAUDE.md note on FK-bearing table inserts.
  const { data, error } = await supabase.rpc("create_subtask", { p_task_id: taskId, p_title: title });
  if (error) throw new Error(error.message);
  return data;
}

export async function toggleSubtask(subtaskId: string, isDone: boolean): Promise<void> {
  const { error } = await supabase.from("subtasks").update({ is_done: isDone }).eq("id", subtaskId);
  if (error) throw error;
}

export async function deleteSubtask(subtaskId: string): Promise<void> {
  const { error } = await supabase.from("subtasks").delete().eq("id", subtaskId);
  if (error) throw error;
}

/** Map of task_id -> { done, total }, for every task in the project, in one query. */
export async function listSubtaskCounts(projectId: string): Promise<Map<string, { done: number; total: number }>> {
  const { data, error } = await supabase.from("subtasks").select("task_id, is_done").eq("project_id", projectId);
  if (error) throw error;

  const map = new Map<string, { done: number; total: number }>();
  for (const row of data) {
    const entry = map.get(row.task_id) ?? { done: 0, total: 0 };
    entry.total += 1;
    if (row.is_done) entry.done += 1;
    map.set(row.task_id, entry);
  }
  return map;
}
