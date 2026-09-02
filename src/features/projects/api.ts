import { supabase } from "../../lib/supabase";

export type Project = {
  id: string;
  name: string;
  description: string | null;
  /** Imagen de portada en el bucket `avatars` (`projects/{id}`). Sin ella se pinta un patrón. */
  cover_url: string | null;
  category: string | null;
  owner_id: string;
  team_id: string | null;
  created_at: string;
  /** Tarjetas visibles en la columna Done del tablero. null = sin límite. */
  done_display_limit: number | null;
};

export type ProjectMember = {
  project_id: string;
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
  profile: { display_name: string; email: string; avatar_url: string | null };
};

/** Columnas que componen un `Project`. Compartida para que ninguna consulta se quede corta. */
export const PROJECT_COLUMNS =
  "id, name, description, cover_url, category, owner_id, team_id, created_at, done_display_limit";

export async function listMyProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_COLUMNS)
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

/** Miembros de varios proyectos de una vez, para no lanzar una consulta por tarjeta. */
export async function listMembersForProjects(projectIds: string[]): Promise<Map<string, ProjectMember[]>> {
  const map = new Map<string, ProjectMember[]>();
  if (projectIds.length === 0) return map;

  const { data, error } = await supabase
    .from("project_members")
    .select("project_id, user_id, role, joined_at, profile:profiles(display_name, email, avatar_url)")
    .in("project_id", projectIds);
  if (error) throw error;

  for (const row of data as unknown as ProjectMember[]) {
    const list = map.get(row.project_id) ?? [];
    list.push(row);
    map.set(row.project_id, list);
  }
  return map;
}

/**
 * Última vez que se registró tiempo en cada proyecto.
 *
 * Sale de `time_sessions`, así que refleja trabajo real y no ediciones del
 * proyecto. Ojo con lo que devuelve en proyectos de equipo: la política RLS
 * solo entrega sesiones ajenas al admin, de modo que para el resto es "la
 * última vez que YO trabajé aquí".
 */
export async function listLastActivityForProjects(projectIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (projectIds.length === 0) return map;

  const { data, error } = await supabase
    .from("time_sessions")
    .select("project_id, started_at")
    .in("project_id", projectIds)
    .order("started_at", { ascending: false })
    .limit(1000);
  if (error) throw error;

  // Vienen ordenadas de más reciente a más antigua: la primera de cada
  // proyecto es la que vale.
  for (const row of data) {
    if (!map.has(row.project_id)) map.set(row.project_id, row.started_at);
  }
  return map;
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
  details: {
    name?: string;
    description?: string | null;
    cover_url?: string | null;
    category?: string | null;
    done_display_limit?: number | null;
  },
): Promise<void> {
  const { error } = await supabase.from("projects").update(details).eq("id", projectId);
  if (error) throw error;
}

export async function deleteProject(projectId: string): Promise<void> {
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) throw error;
}
