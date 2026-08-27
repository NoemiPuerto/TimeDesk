import { supabase } from "../../lib/supabase";

export type InvitationKind = "team" | "project";

export type Invitation = {
  id: string;
  kind: InvitationKind;
  team_id: string | null;
  project_id: string | null;
  team_name: string | null;
  project_name: string | null;
  inviter_id: string;
  invitee_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  inviter: { display_name: string; email: string; avatar_url: string | null } | null;
  invitee: { display_name: string; email: string; avatar_url: string | null } | null;
};

export type AppNotification = {
  id: string;
  type: "mention";
  project_id: string | null;
  task_id: string | null;
  comment_id: string | null;
  actor_id: string | null;
  body: string | null;
  task_title: string | null;
  read_at: string | null;
  created_at: string;
  actor: { display_name: string; avatar_url: string | null } | null;
};

// `invitations` tiene dos foreign keys a `profiles` (quien invita y quien es
// invitado), así que PostgREST no puede adivinar cuál usar: hay que nombrar la
// constraint en el embed.
const INVITATION_SELECT =
  "id, kind, team_id, project_id, team_name, project_name, inviter_id, invitee_id, status, created_at," +
  " inviter:profiles!invitations_inviter_id_fkey(display_name, email, avatar_url)," +
  " invitee:profiles!invitations_invitee_id_fkey(display_name, email, avatar_url)";

/** Invitaciones que ME hicieron y todavía no respondí. */
export async function listMyPendingInvitations(userId: string): Promise<Invitation[]> {
  const { data, error } = await supabase
    .from("invitations")
    .select(INVITATION_SELECT)
    .eq("invitee_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as Invitation[];
}

/** Invitaciones pendientes que YO envié a un equipo, para verlas en su panel. */
export async function listPendingTeamInvitations(teamId: string): Promise<Invitation[]> {
  const { data, error } = await supabase
    .from("invitations")
    .select(INVITATION_SELECT)
    .eq("team_id", teamId)
    .eq("status", "pending");
  if (error) throw error;
  return data as unknown as Invitation[];
}

export async function listPendingProjectInvitations(projectId: string): Promise<Invitation[]> {
  const { data, error } = await supabase
    .from("invitations")
    .select(INVITATION_SELECT)
    .eq("project_id", projectId)
    .eq("status", "pending");
  if (error) throw error;
  return data as unknown as Invitation[];
}

export async function respondInvitation(invitationId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc("respond_invitation", {
    p_invitation_id: invitationId,
    p_accept: accept,
  });
  if (error) throw new Error(error.message);
}

export async function cancelInvitation(invitationId: string): Promise<void> {
  const { error } = await supabase.from("invitations").delete().eq("id", invitationId);
  if (error) throw error;
}

export async function listNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select(
      "id, type, project_id, task_id, comment_id, actor_id, body, task_title, read_at, created_at," +
        " actor:profiles!notifications_actor_id_fkey(display_name, avatar_url)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data as unknown as AppNotification[];
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw error;
}
