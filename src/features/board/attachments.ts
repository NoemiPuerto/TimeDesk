import { supabase } from "../../lib/supabase";

const BUCKET = "attachments";
export const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024; // 20MB — keeps the project well inside Supabase's free storage tier.

export type Attachment = {
  id: string;
  task_id: string;
  storage_path: string;
  filename: string;
  size_bytes: number;
  content_type: string | null;
  uploaded_by: string;
  created_at: string;
  uploader: { display_name: string };
};

export type ProjectAttachment = Attachment & { task_title: string };

export async function listTaskAttachments(taskId: string): Promise<Attachment[]> {
  const { data, error } = await supabase
    .from("attachments")
    .select(
      "id, task_id, storage_path, filename, size_bytes, content_type, uploaded_by, created_at, uploader:profiles(display_name)",
    )
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as unknown as Attachment[];
}

export async function listProjectAttachments(projectId: string): Promise<ProjectAttachment[]> {
  const { data, error } = await supabase
    .from("attachments")
    .select(
      "id, task_id, storage_path, filename, size_bytes, content_type, uploaded_by, created_at, uploader:profiles(display_name), task:tasks(title)",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as (Attachment & { task: { title: string } | null })[]).map((row) => ({
    ...row,
    task_title: row.task?.title ?? "Tarea eliminada",
  }));
}

/** Map of task_id -> attachment count, for every task in the project, in one query. */
export async function listAttachmentCounts(projectId: string): Promise<Map<string, number>> {
  const { data, error } = await supabase.from("attachments").select("task_id").eq("project_id", projectId);
  if (error) throw error;
  const map = new Map<string, number>();
  for (const row of data) map.set(row.task_id, (map.get(row.task_id) ?? 0) + 1);
  return map;
}

export async function uploadAttachment(projectId: string, taskId: string, file: File): Promise<Attachment> {
  if (file.size > MAX_ATTACHMENT_SIZE) {
    throw new Error(`El archivo supera el límite de ${MAX_ATTACHMENT_SIZE / 1024 / 1024}MB.`);
  }

  const path = `${projectId}/${taskId}/${crypto.randomUUID()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file);
  if (uploadError) throw new Error(uploadError.message);

  // INSERT goes through an RPC — see CLAUDE.md note on FK-bearing table inserts.
  const { data, error } = await supabase.rpc("create_attachment", {
    p_task_id: taskId,
    p_storage_path: path,
    p_filename: file.name,
    p_size_bytes: file.size,
    p_content_type: file.type || undefined,
  });
  if (error) {
    // Don't leave an orphaned object behind if we can't record it.
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error(error.message);
  }
  return data as unknown as Attachment;
}

export async function getAttachmentDownloadUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 5);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteAttachment(attachmentId: string, storagePath: string): Promise<void> {
  const { error: removeError } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (removeError) throw removeError;
  const { error } = await supabase.from("attachments").delete().eq("id", attachmentId);
  if (error) throw error;
}
