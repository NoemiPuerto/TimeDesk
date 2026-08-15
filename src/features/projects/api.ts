import { supabase } from "../../lib/supabase";

export type Project = {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  team_id: string | null;
  created_at: string;
};

export type ProjectMember = {
  project_id: string;
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
  profile: { display_name: string; email: string; avatar_url: string | null };
};

export async function listMyProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, description, owner_id, team_id, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createProject(name: string, description: string, teamId?: string | null): Promise<Project> {
  // INSERT goes through an RPC (SECURITY DEFINER) instead of a direct table
  // insert: this Postgres instance rejects INSERTs from non-owner roles on any
  // RLS-enabled table that has a foreign key, so we work around it by running
  // the insert as the function owner and checking authorization manually.
  const { data, error } = await supabase.rpc("create_project", {
    p_name: name,
    p_description: description || undefined,
    p_team_id: teamId ?? undefined,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function listProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const { data, error } = await supabase
    .from("project_members")
    .select("project_id, user_id, role, joined_at, profile:profiles(display_name, email, avatar_url)")
    .eq("project_id", projectId);
  if (error) throw error;
  return data as unknown as ProjectMember[];
}

export async function inviteMemberByEmail(projectId: string, email: string): Promise<void> {
  const { error } = await supabase.rpc("invite_project_member", {
    p_project_id: projectId,
    p_email: email,
  });
  if (error) throw new Error(error.message);
}

export async function removeMember(projectId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function updateProject(
  projectId: string,
  details: { name?: string; description?: string | null },
): Promise<void> {
  const { error } = await supabase.from("projects").update(details).eq("id", projectId);
  if (error) throw error;
}

export async function deleteProject(projectId: string): Promise<void> {
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) throw error;
}
