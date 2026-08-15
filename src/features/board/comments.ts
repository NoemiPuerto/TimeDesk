import { supabase } from "../../lib/supabase";

export type Comment = {
  id: string;
  task_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author: { display_name: string; avatar_url: string | null };
};

export async function listTaskComments(taskId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from("comments")
    .select("id, task_id, user_id, body, created_at, author:profiles(display_name, avatar_url)")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as unknown as Comment[];
}

export async function createComment(taskId: string, body: string): Promise<Comment> {
  // INSERT goes through an RPC — see CLAUDE.md note on FK-bearing table inserts.
  const { data, error } = await supabase.rpc("create_comment", { p_task_id: taskId, p_body: body });
  if (error) throw new Error(error.message);
  return data as unknown as Comment;
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase.from("comments").delete().eq("id", commentId);
  if (error) throw error;
}

/** Map of task_id -> comment count, for every task in the project, in one query. */
export async function listCommentCounts(projectId: string): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("comments")
    .select("task_id")
    .eq("project_id", projectId);
  if (error) throw error;

  const map = new Map<string, number>();
  for (const row of data) {
    map.set(row.task_id, (map.get(row.task_id) ?? 0) + 1);
  }
  return map;
}
