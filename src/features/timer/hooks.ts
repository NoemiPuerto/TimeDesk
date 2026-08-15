import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";

export function useActiveSession() {
  return useQuery({ queryKey: ["active-session"], queryFn: api.getActiveSession });
}

export function useTaskSessions(taskId: string | null) {
  return useQuery({
    queryKey: ["task-sessions", taskId],
    queryFn: () => api.listTaskSessions(taskId as string),
    enabled: !!taskId,
  });
}

export function useProjectSessions(projectId: string | null) {
  return useQuery({
    queryKey: ["project-sessions", projectId],
    queryFn: () => api.listProjectSessions(projectId as string),
    enabled: !!projectId,
  });
}

function invalidateSessionQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["active-session"] });
  queryClient.invalidateQueries({ queryKey: ["task-sessions"] });
  queryClient.invalidateQueries({ queryKey: ["project-sessions"] });
}

export function useStartTimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => api.startTimer(taskId),
    onSuccess: () => invalidateSessionQueries(queryClient),
  });
}

export function useStopTimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => api.stopTimer(sessionId),
    onMutate: () => {
      queryClient.setQueryData<api.TimeSession | null>(["active-session"], null);
    },
    onSuccess: () => invalidateSessionQueries(queryClient),
  });
}
