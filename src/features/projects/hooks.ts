import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";

export function useMyProjects() {
  return useQuery({ queryKey: ["projects"], queryFn: api.listMyProjects });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, description, teamId }: { name: string; description: string; teamId?: string | null }) =>
      api.createProject(name, description, teamId),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      if (vars.teamId) queryClient.invalidateQueries({ queryKey: ["team-projects", vars.teamId] });
    },
  });
}

export function useProjectMembers(projectId: string | null) {
  return useQuery({
    queryKey: ["project-members", projectId],
    queryFn: () => api.listProjectMembers(projectId as string),
    enabled: !!projectId,
  });
}

export function useInviteMember(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => api.inviteMemberByEmail(projectId as string, email),
    // MembersPanel already shows this error inline next to the invite field.
    meta: { suppressToast: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-members", projectId] }),
  });
}

export function useUpdateProject(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (details: { name?: string; description?: string | null }) =>
      api.updateProject(projectId as string, details),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["team-projects"] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => api.deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["team-projects"] });
    },
  });
}

export function useRemoveMember(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.removeMember(projectId as string, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-members", projectId] });
      // Also covers self-leave: listMyProjects/listTeamProjects only return
      // projects the caller is still a member of.
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["team-projects"] });
    },
  });
}
