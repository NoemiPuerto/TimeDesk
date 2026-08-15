import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as avatars from "../../lib/avatars";
import * as api from "./api";

export function useMyTeams() {
  return useQuery({ queryKey: ["teams"], queryFn: api.listMyTeams });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.createTeam(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["teams"] }),
  });
}

export function useTeamMembers(teamId: string | null) {
  return useQuery({
    queryKey: ["team-members", teamId],
    queryFn: () => api.listTeamMembers(teamId as string),
    enabled: !!teamId,
  });
}

export function useInviteTeamMember(teamId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => api.inviteTeamMember(teamId as string, email),
    meta: { suppressToast: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team-members", teamId] }),
  });
}

export function useRemoveTeamMember(teamId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.removeTeamMember(teamId as string, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members", teamId] });
      // Also covers self-leave: listMyTeams only returns teams the caller is still a member of.
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useTeamProjects(teamId: string | null) {
  return useQuery({
    queryKey: ["team-projects", teamId],
    queryFn: () => api.listTeamProjects(teamId as string),
    enabled: !!teamId,
  });
}

export function useUploadTeamAvatar(teamId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => avatars.uploadTeamAvatar(teamId as string, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["teams"] }),
  });
}

export function useRemoveTeamAvatar(teamId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => avatars.removeTeamAvatar(teamId as string),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["teams"] }),
  });
}
