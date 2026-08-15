import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

export type PresenceMember = { userId: string; displayName: string };

export function useProjectRealtime(projectId: string | null) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [onlineMembers, setOnlineMembers] = useState<PresenceMember[]>([]);

  useEffect(() => {
    if (!projectId || !user) {
      setOnlineMembers([]);
      return;
    }

    const channel = supabase.channel(`project:${projectId}`, {
      config: { presence: { key: user.id } },
    });

    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "columns", filter: `project_id=eq.${projectId}` },
        () => queryClient.invalidateQueries({ queryKey: ["columns", projectId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `project_id=eq.${projectId}` },
        () => queryClient.invalidateQueries({ queryKey: ["tasks", projectId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "time_sessions", filter: `project_id=eq.${projectId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["active-session"] });
          queryClient.invalidateQueries({ queryKey: ["task-sessions"] });
          queryClient.invalidateQueries({ queryKey: ["project-sessions", projectId] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_members", filter: `project_id=eq.${projectId}` },
        () => queryClient.invalidateQueries({ queryKey: ["project-members", projectId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments", filter: `project_id=eq.${projectId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["comments"] });
          queryClient.invalidateQueries({ queryKey: ["comment-counts", projectId] });
        },
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ displayName: string }>();
        const members = Object.entries(state).map(([userId, presences]) => ({
          userId,
          displayName: presences[0]?.displayName ?? "…",
        }));
        setOnlineMembers(members);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            displayName: (user.user_metadata?.display_name as string | undefined) ?? user.email ?? "",
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, user, queryClient]);

  return { onlineMembers };
}
