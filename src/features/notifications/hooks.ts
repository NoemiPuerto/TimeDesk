import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import * as api from "./api";

export function useMyPendingInvitations(userId: string | null) {
  return useQuery({
    queryKey: ["invitations", "mine", userId],
    queryFn: () => api.listMyPendingInvitations(userId as string),
    enabled: !!userId,
  });
}

export function usePendingTeamInvitations(teamId: string | null) {
  return useQuery({
    queryKey: ["invitations", "team", teamId],
    queryFn: () => api.listPendingTeamInvitations(teamId as string),
    enabled: !!teamId,
  });
}

export function usePendingProjectInvitations(projectId: string | null) {
  return useQuery({
    queryKey: ["invitations", "project", projectId],
    queryFn: () => api.listPendingProjectInvitations(projectId as string),
    enabled: !!projectId,
  });
}

export function useRespondInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ invitationId, accept }: { invitationId: string; accept: boolean }) =>
      api.respondInvitation(invitationId, accept),
    // InvitationRow ya muestra el error dentro de la propia invitación.
    meta: { suppressToast: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
      // Aceptar crea la membresía: las listas de equipos y proyectos cambian.
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["team-projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["accessible-projects"] });
    },
  });
}

export function useCancelInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) => api.cancelInvitation(invitationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invitations"] }),
  });
}

export function useNotifications(userId: string | null) {
  return useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => api.listNotifications(userId as string),
    enabled: !!userId,
  });
}

export function useMarkNotificationRead(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => api.markNotificationRead(notificationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", userId] }),
  });
}

export function useMarkAllNotificationsRead(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.markAllNotificationsRead(userId as string),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", userId] }),
  });
}

/**
 * Canal de realtime propio de la persona (no de un proyecto): invitaciones,
 * menciones y cambios de membresía. Sin esto, alguien recién invitado tenía que
 * cerrar y volver a abrir la app para ver el equipo o el proyecto nuevo.
 */
export function useUserRealtime(userId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`user:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invitations", filter: `invitee_id=eq.${userId}` },
        () => queryClient.invalidateQueries({ queryKey: ["invitations"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => queryClient.invalidateQueries({ queryKey: ["notifications", userId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "team_members", filter: `user_id=eq.${userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["teams"] });
          queryClient.invalidateQueries({ queryKey: ["team-members"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_members", filter: `user_id=eq.${userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["projects"] });
          queryClient.invalidateQueries({ queryKey: ["team-projects"] });
          queryClient.invalidateQueries({ queryKey: ["accessible-projects"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}
