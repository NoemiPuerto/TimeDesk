import { supabase } from "../../lib/supabase";

export type Assignee = {
  id: string;
  display_name: string;
};

/** Map of task_id -> assignees, for every task in the project, in one query. */
export async function listAllTaskAssignees(projectId: string): Promise<Map<string, Assignee[]>> {
  const { data, error } = await supabase
    .from("task_assignees")
    .select("task_id, user:profiles(id, display_name), task:tasks!inner(project_id)")
    .eq("task.project_id", projectId);
  if (error) throw error;

  const map = new Map<string, Assignee[]>();
  for (const row of data as unknown as { task_id: string; user: Assignee }[]) {
    const list = map.get(row.task_id) ?? [];
    list.push(row.user);
    map.set(row.task_id, list);
  }
  return map;
}

export async function addTaskAssignee(taskId: string, userId: string): Promise<void> {
  // INSERT goes through an RPC — see task_detail_fields migration / CLAUDE.md
  // note about FK-bearing table inserts.
  const { error } = await supabase.rpc("add_task_assignee", { p_task_id: taskId, p_user_id: userId });
  if (error) throw new Error(error.message);
}

export async function removeTaskAssignee(taskId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("task_assignees").delete().eq("task_id", taskId).eq("user_id", userId);
  if (error) throw error;
}
