import { supabase } from "../../lib/supabase";

export type Team = {
  id: string;
  name: string;
  owner_id: string;
  avatar_url: string | null;
  created_at: string;
};

export type TeamMember = {
  team_id: string;
  user_id: string;
  role: "admin" | "member";
  joined_at: string;
  profile: { display_name: string; email: string; avatar_url: string | null };
};

export type TeamProject = {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  category: string | null;
  team_id: string;
  owner_id: string;
  created_at: string;
  done_display_limit: number | null;
  has_access: boolean;
};

export async function listMyTeams(): Promise<Team[]> {
  const { data, error } = await supabase
    .from("teams")
    .select("id, name, owner_id, avatar_url, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createTeam(name: string): Promise<Team> {
  // INSERT goes through an RPC — see CLAUDE.md note on FK-bearing table inserts.
  const { data, error } = await supabase.rpc("create_team", { p_name: name });
  if (error) throw new Error(error.message);
  return data;
}

export async function listTeamMembers(teamId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from("team_members")
    .select("team_id, user_id, role, joined_at, profile:profiles(display_name, email, avatar_url)")
    .eq("team_id", teamId);
  if (error) throw error;
  return data as unknown as TeamMember[];
}

export async function inviteTeamMember(teamId: string, email: string): Promise<void> {
  const { error } = await supabase.rpc("invite_team_member", { p_team_id: teamId, p_email: email });
  if (error) throw new Error(error.message);
}

export async function removeTeamMember(teamId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("team_members").delete().eq("team_id", teamId).eq("user_id", userId);
  if (error) throw error;
}

export async function updateTeam(teamId: string, details: { name: string }): Promise<void> {
  const { error } = await supabase.from("teams").update(details).eq("id", teamId);
  if (error) throw error;
}

/**
 * Borrar el equipo NO borra sus proyectos: `projects.team_id` es
 * `on delete set null`, así que cada proyecto vuelve a ser personal de su
 * dueño. Los miembros que no eran dueños pierden acceso solo si además se los
 * quita de `project_members` — el borrado del equipo por sí solo no los toca.
 */
export async function deleteTeam(teamId: string): Promise<void> {
  const { error } = await supabase.from("teams").delete().eq("id", teamId);
  if (error) throw error;
}

export async function listTeamProjects(teamId: string): Promise<TeamProject[]> {
  const { data, error } = await supabase.rpc("list_team_projects", { p_team_id: teamId });
  if (error) throw error;
  return data;
}
