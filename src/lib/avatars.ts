import { supabase } from "./supabase";

const BUCKET = "avatars";
export const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB

async function uploadAvatarObject(path: string, file: File): Promise<string> {
  if (file.size > MAX_AVATAR_SIZE) {
    throw new Error(`La imagen supera el límite de ${MAX_AVATAR_SIZE / 1024 / 1024}MB.`);
  }
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
  if (uploadError) throw new Error(uploadError.message);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  // Cache-bust: the path is stable (upsert overwrites in place), so without
  // this a browser that already fetched the old image would keep showing it.
  return `${data.publicUrl}?t=${Date.now()}`;
}

async function removeAvatarObject(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

export async function uploadUserAvatar(userId: string, file: File): Promise<string> {
  const url = await uploadAvatarObject(`users/${userId}`, file);
  const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
  if (error) throw error;
  return url;
}

export async function removeUserAvatar(userId: string): Promise<void> {
  await removeAvatarObject(`users/${userId}`);
  const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId);
  if (error) throw error;
}

export async function uploadProjectCover(projectId: string, file: File): Promise<string> {
  const url = await uploadAvatarObject(`projects/${projectId}`, file);
  const { error } = await supabase.from("projects").update({ cover_url: url }).eq("id", projectId);
  if (error) throw error;
  return url;
}

export async function removeProjectCover(projectId: string): Promise<void> {
  await removeAvatarObject(`projects/${projectId}`);
  const { error } = await supabase.from("projects").update({ cover_url: null }).eq("id", projectId);
  if (error) throw error;
}

export async function uploadTeamAvatar(teamId: string, file: File): Promise<string> {
  const url = await uploadAvatarObject(`teams/${teamId}`, file);
  const { error } = await supabase.from("teams").update({ avatar_url: url }).eq("id", teamId);
  if (error) throw error;
  return url;
}

export async function removeTeamAvatar(teamId: string): Promise<void> {
  await removeAvatarObject(`teams/${teamId}`);
  const { error } = await supabase.from("teams").update({ avatar_url: null }).eq("id", teamId);
  if (error) throw error;
}
