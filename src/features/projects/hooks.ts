import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";

export function useMyProjects() {
  return useQuery({ queryKey: ["projects"], queryFn: api.listMyProjects });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, description }: { name: string; description: string }) => api.createProject(name, description),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-members", projectId] }),
  });
}

export function useRemoveMember(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.removeMember(projectId as string, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-members", projectId] }),
  });
}
