import { supabase } from "../../lib/supabase";

export type Tag = {
  id: string;
  project_id: string;
  name: string;
  color: string;
};

export async function listProjectTags(projectId: string): Promise<Tag[]> {
  const { data, error } = await supabase
    .from("tags")
    .select("id, project_id, name, color")
    .eq("project_id", projectId)
    .order("name", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createTag(projectId: string, name: string): Promise<Tag> {
  // INSERT goes through an RPC — see task_detail_fields migration / CLAUDE.md
  // note about FK-bearing table inserts.
  const { data, error } = await supabase.rpc("create_tag", { p_project_id: projectId, p_name: name });
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteTag(tagId: string): Promise<void> {
  const { error } = await supabase.from("tags").delete().eq("id", tagId);
  if (error) throw error;
}

/** Map of task_id -> tags, for every task in the project, in one query. */
export async function listAllTaskTags(projectId: string): Promise<Map<string, Tag[]>> {
  const { data, error } = await supabase
    .from("task_tags")
    .select("task_id, tag:tags(id, project_id, name, color), task:tasks!inner(project_id)")
    .eq("task.project_id", projectId);
  if (error) throw error;

  const map = new Map<string, Tag[]>();
  for (const row of data as unknown as { task_id: string; tag: Tag }[]) {
    const list = map.get(row.task_id) ?? [];
    list.push(row.tag);
    map.set(row.task_id, list);
  }
  return map;
}

export async function addTaskTag(taskId: string, tagId: string): Promise<void> {
  const { error } = await supabase.rpc("add_task_tag", { p_task_id: taskId, p_tag_id: tagId });
  if (error) throw error;
}

export async function removeTaskTag(taskId: string, tagId: string): Promise<void> {
  const { error } = await supabase.from("task_tags").delete().eq("task_id", taskId).eq("tag_id", tagId);
  if (error) throw error;
}
