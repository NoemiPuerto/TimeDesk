import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";

export function useColumns(projectId: string | null) {
  return useQuery({
    queryKey: ["columns", projectId],
    queryFn: () => api.listColumns(projectId as string),
    enabled: !!projectId,
  });
}

export function useTasks(projectId: string | null) {
  return useQuery({
    queryKey: ["tasks", projectId],
    queryFn: () => api.listTasks(projectId as string),
    enabled: !!projectId,
  });
}

export function useCreateColumn(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.createColumn(projectId as string, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["columns", projectId] }),
  });
}

export function useRenameColumn(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ columnId, name }: { columnId: string; name: string }) => api.renameColumn(columnId, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["columns", projectId] }),
  });
}

export function useDeleteColumn(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (columnId: string) => api.deleteColumn(columnId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["columns", projectId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
  });
}

export function useCreateTask(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ columnId, title }: { columnId: string; title: string }) =>
      api.createTask(projectId as string, columnId, title),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks", projectId] }),
  });
}

export function useRenameTask(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, title }: { taskId: string; title: string }) => api.renameTask(taskId, title),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks", projectId] }),
  });
}

export function useReorderTasks(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: { id: string; column_id: string; position: number }[]) => api.reorderTasks(updates),
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ["tasks", projectId] });
      const previous = queryClient.getQueryData<api.Task[]>(["tasks", projectId]);
      queryClient.setQueryData<api.Task[]>(["tasks", projectId], (old) =>
        old?.map((t) => {
          const update = updates.find((u) => u.id === t.id);
          return update ? { ...t, column_id: update.column_id, position: update.position } : t;
        }),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["tasks", projectId], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["tasks", projectId] }),
  });
}

export function useDeleteTask(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => api.deleteTask(taskId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks", projectId] }),
  });
}
