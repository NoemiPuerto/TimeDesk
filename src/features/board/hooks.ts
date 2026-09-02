import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";
import { timerWindow } from "./urgency";
import * as tagsApi from "./tags";
import * as assigneesApi from "./assignees";
import * as commentsApi from "./comments";
import * as subtasksApi from "./subtasks";
import * as attachmentsApi from "./attachments";

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

/**
 * Tareas del tablero del Timer: solo la ventana hoy..hoy+6 (más vencidas y sin
 * fecha), filtradas en la consulta.
 *
 * La clave empieza por ["tasks", projectId] a propósito: react-query invalida
 * por prefijo, así que cualquier `invalidateQueries(["tasks", projectId])` que
 * ya existía refresca también esta lista sin tocar nada más.
 *
 * La ventana se calcula al montar. Si la app se deja abierta cruzando la
 * medianoche, sigue mostrando la de ayer hasta que se vuelva a montar la vista:
 * asumido, no vale la pena un temporizador solo para eso.
 */
export function useTimerTasks(projectId: string | null) {
  const { endKey, todayStart } = useMemo(() => timerWindow(), []);
  const todayStartIso = todayStart.toISOString();

  return useQuery({
    queryKey: ["tasks", projectId, "timer-window", endKey],
    queryFn: () => api.listTimerTasks(projectId as string, endKey, todayStartIso),
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

export function useReorderColumns(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: { id: string; position: number }[]) => api.reorderColumns(updates),
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ["columns", projectId] });
      const previous = queryClient.getQueryData<api.Column[]>(["columns", projectId]);
      queryClient.setQueryData<api.Column[]>(["columns", projectId], (old) => {
        if (!old) return old;
        const next = old.map((c) => {
          const update = updates.find((u) => u.id === c.id);
          return update ? { ...c, position: update.position } : c;
        });
        return next.sort((a, b) => a.position - b.position);
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["columns", projectId], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["columns", projectId] }),
  });
}

export function useCreateTask(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ columnId, title, startDate }: { columnId: string; title: string; startDate: string }) =>
      api.createTask(projectId as string, columnId, title, startDate),
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

export function useMoveTaskToColumn(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, columnId }: { taskId: string; columnId: string }) =>
      api.moveTaskToColumn(taskId, columnId),
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

// ── Comments ─────────────────────────────────────────────────────────────

export function useTaskComments(taskId: string | null) {
  return useQuery({
    queryKey: ["comments", taskId],
    queryFn: () => commentsApi.listTaskComments(taskId as string),
    enabled: !!taskId,
  });
}

export function useCommentCounts(projectId: string | null) {
  return useQuery({
    queryKey: ["comment-counts", projectId],
    queryFn: () => commentsApi.listCommentCounts(projectId as string),
    enabled: !!projectId,
  });
}

export function useCreateComment(taskId: string | null, projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => commentsApi.createComment(taskId as string, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", taskId] });
      queryClient.invalidateQueries({ queryKey: ["comment-counts", projectId] });
    },
  });
}

export function useDeleteComment(taskId: string | null, projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => commentsApi.deleteComment(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", taskId] });
      queryClient.invalidateQueries({ queryKey: ["comment-counts", projectId] });
    },
  });
}

// ── Subtasks ─────────────────────────────────────────────────────────────

export function useTaskSubtasks(taskId: string | null) {
  return useQuery({
    queryKey: ["subtasks", taskId],
    queryFn: () => subtasksApi.listTaskSubtasks(taskId as string),
    enabled: !!taskId,
  });
}

export function useSubtaskCounts(projectId: string | null) {
  return useQuery({
    queryKey: ["subtask-counts", projectId],
    queryFn: () => subtasksApi.listSubtaskCounts(projectId as string),
    enabled: !!projectId,
  });
}

function invalidateSubtaskQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  taskId: string | null,
  projectId: string | null,
) {
  queryClient.invalidateQueries({ queryKey: ["subtasks", taskId] });
  queryClient.invalidateQueries({ queryKey: ["subtask-counts", projectId] });
}

export function useCreateSubtask(taskId: string | null, projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (title: string) => subtasksApi.createSubtask(taskId as string, title),
    onSuccess: () => invalidateSubtaskQueries(queryClient, taskId, projectId),
  });
}

export function useToggleSubtask(taskId: string | null, projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ subtaskId, isDone }: { subtaskId: string; isDone: boolean }) =>
      subtasksApi.toggleSubtask(subtaskId, isDone),
    onSuccess: () => invalidateSubtaskQueries(queryClient, taskId, projectId),
  });
}

export function useDeleteSubtask(taskId: string | null, projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (subtaskId: string) => subtasksApi.deleteSubtask(subtaskId),
    onSuccess: () => invalidateSubtaskQueries(queryClient, taskId, projectId),
  });
}

// ── Attachments ──────────────────────────────────────────────────────────

export function useTaskAttachments(taskId: string | null) {
  return useQuery({
    queryKey: ["attachments", taskId],
    queryFn: () => attachmentsApi.listTaskAttachments(taskId as string),
    enabled: !!taskId,
  });
}

export function useProjectAttachments(projectId: string | null) {
  return useQuery({
    queryKey: ["project-attachments", projectId],
    queryFn: () => attachmentsApi.listProjectAttachments(projectId as string),
    enabled: !!projectId,
  });
}

export function useAttachmentCounts(projectId: string | null) {
  return useQuery({
    queryKey: ["attachment-counts", projectId],
    queryFn: () => attachmentsApi.listAttachmentCounts(projectId as string),
    enabled: !!projectId,
  });
}

function invalidateAttachmentQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  taskId: string | null,
  projectId: string | null,
) {
  queryClient.invalidateQueries({ queryKey: ["attachments", taskId] });
  queryClient.invalidateQueries({ queryKey: ["project-attachments", projectId] });
  queryClient.invalidateQueries({ queryKey: ["attachment-counts", projectId] });
}

export function useUploadAttachment(taskId: string | null, projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => attachmentsApi.uploadAttachment(projectId as string, taskId as string, file),
    onSuccess: () => invalidateAttachmentQueries(queryClient, taskId, projectId),
  });
}

export function useDeleteAttachment(taskId: string | null, projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ attachmentId, storagePath }: { attachmentId: string; storagePath: string }) =>
      attachmentsApi.deleteAttachment(attachmentId, storagePath),
    onSuccess: () => invalidateAttachmentQueries(queryClient, taskId, projectId),
  });
}
