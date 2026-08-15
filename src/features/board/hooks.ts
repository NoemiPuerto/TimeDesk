import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";
import * as tagsApi from "./tags";
import * as assigneesApi from "./assignees";

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

export function useUpdateTaskDetails(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, details }: { taskId: string; details: Partial<api.TaskDetails> }) =>
      api.updateTaskDetails(taskId, details),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks", projectId] }),
  });
}

// ── Tags ─────────────────────────────────────────────────────────────────

export function useProjectTags(projectId: string | null) {
  return useQuery({
    queryKey: ["tags", projectId],
    queryFn: () => tagsApi.listProjectTags(projectId as string),
    enabled: !!projectId,
  });
}

export function useTaskTagsMap(projectId: string | null) {
  return useQuery({
    queryKey: ["task-tags", projectId],
    queryFn: () => tagsApi.listAllTaskTags(projectId as string),
    enabled: !!projectId,
  });
}

export function useCreateTag(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => tagsApi.createTag(projectId as string, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tags", projectId] }),
  });
}

export function useDeleteTag(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tagId: string) => tagsApi.deleteTag(tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags", projectId] });
      queryClient.invalidateQueries({ queryKey: ["task-tags", projectId] });
    },
  });
}

export function useAddTaskTag(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, tagId }: { taskId: string; tagId: string }) => tagsApi.addTaskTag(taskId, tagId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["task-tags", projectId] }),
  });
}

export function useRemoveTaskTag(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, tagId }: { taskId: string; tagId: string }) => tagsApi.removeTaskTag(taskId, tagId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["task-tags", projectId] }),
  });
}

// ── Assignees ────────────────────────────────────────────────────────────

export function useTaskAssigneesMap(projectId: string | null) {
  return useQuery({
    queryKey: ["task-assignees", projectId],
    queryFn: () => assigneesApi.listAllTaskAssignees(projectId as string),
    enabled: !!projectId,
  });
}

export function useAddTaskAssignee(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, userId }: { taskId: string; userId: string }) =>
      assigneesApi.addTaskAssignee(taskId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["task-assignees", projectId] }),
  });
}

export function useRemoveTaskAssignee(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, userId }: { taskId: string; userId: string }) =>
      assigneesApi.removeTaskAssignee(taskId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["task-assignees", projectId] }),
  });
}
