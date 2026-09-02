import { useQuery } from "@tanstack/react-query";
import * as api from "./api";

export function useAccessibleProjects(userId: string | null) {
  return useQuery({
    queryKey: ["accessible-projects", userId],
    queryFn: () => api.listAccessibleProjects(userId as string),
    enabled: !!userId,
  });
}

export function useDashboardTasks(projectIds: string[]) {
  return useQuery({
    queryKey: ["dashboard-tasks", projectIds],
    queryFn: () => api.listTasksForProjects(projectIds),
    enabled: projectIds.length > 0,
  });
}

export function useDashboardColumns(projectIds: string[]) {
  return useQuery({
    queryKey: ["dashboard-columns", projectIds],
    queryFn: () => api.listColumnsForProjects(projectIds),
    enabled: projectIds.length > 0,
  });
}

export function useDashboardSessions(projectIds: string[], since: string) {
  return useQuery({
    queryKey: ["dashboard-sessions", projectIds, since],
    queryFn: () => api.listSessionsForProjects(projectIds, since),
    enabled: projectIds.length > 0,
  });
}

export function useMyAssignedTaskIds(userId: string | null, projectIds: string[]) {
  return useQuery({
    queryKey: ["dashboard-assigned", userId, projectIds],
    queryFn: () => api.listMyAssignedTaskIds(userId as string, projectIds),
    enabled: !!userId && projectIds.length > 0,
  });
}
