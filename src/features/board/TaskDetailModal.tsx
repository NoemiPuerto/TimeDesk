import { useRef, useState, type FormEvent } from "react";
import { Avatar } from "../../components/Avatar";
import { CheckCircleIcon, DownloadIcon, PaperclipIcon, TrashIcon } from "../../components/icons";
import { useDismissable } from "../../lib/useDismissable";
import { useAuth } from "../auth/AuthProvider";
import { useProjectMembers } from "../projects/hooks";
import { getAttachmentDownloadUrl, MAX_ATTACHMENT_SIZE } from "./attachments";
import { formatBytes } from "./attachmentUtils";
import type { Priority, Task } from "./api";
import { DueDatePicker } from "./DueDatePicker";
import {
  useAddTaskAssignee,
  useAddTaskTag,
  useCreateComment,
  useCreateSubtask,
  useCreateTag,
  useDeleteAttachment,
  useDeleteComment,
  useDeleteSubtask,
  useDeleteTask,
  useProjectTags,
  useRemoveTaskAssignee,
  useRemoveTaskTag,
  useRenameTask,
  useTaskAssigneesMap,
  useTaskAttachments,
  useTaskComments,
  useTaskSubtasks,
  useTaskTagsMap,
  useToggleSubtask,
  useUpdateTaskDetails,
  useUploadAttachment,
} from "./hooks";

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: "high", label: "Alta", color: "#eb3619" },
  { value: "medium", label: "Media", color: "#f59e0b" },
  { value: "low", label: "Baja", color: "#a3a3a3" },
];

export function TaskDetailModal({
  task,
  projectId,
  onClose,
}: {
  task: Task;
  projectId: string;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [newTagName, setNewTagName] = useState("");
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false);
  const tagPickerRef = useDismissable(tagPickerOpen, () => setTagPickerOpen(false));
  const assigneePickerRef = useDismissable(assigneePickerOpen, () => setAssigneePickerOpen(false));
  const [newComment, setNewComment] = useState("");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { user } = useAuth();
  const renameTask = useRenameTask(projectId);
  const updateDetails = useUpdateTaskDetails(projectId);
  const deleteTask = useDeleteTask(projectId);
  const { data: comments } = useTaskComments(task.id);
  const createComment = useCreateComment(task.id, projectId);
  const deleteComment = useDeleteComment(task.id, projectId);
  const { data: subtasks } = useTaskSubtasks(task.id);
  const createSubtask = useCreateSubtask(task.id, projectId);
  const toggleSubtask = useToggleSubtask(task.id, projectId);
  const deleteSubtask = useDeleteSubtask(task.id, projectId);
  const { data: attachments } = useTaskAttachments(task.id);
  const uploadAttachment = useUploadAttachment(task.id, projectId);
  const deleteAttachment = useDeleteAttachment(task.id, projectId);

  const { data: members } = useProjectMembers(projectId);
  const { data: allTags } = useProjectTags(projectId);
  const { data: taskTagsMap } = useTaskTagsMap(projectId);
  const { data: taskAssigneesMap } = useTaskAssigneesMap(projectId);
  const createTag = useCreateTag(projectId);
  const addTaskTag = useAddTaskTag(projectId);
  const removeTaskTag = useRemoveTaskTag(projectId);
  const addAssignee = useAddTaskAssignee(projectId);
  const removeAssignee = useRemoveTaskAssignee(projectId);

  const taskTags = taskTagsMap?.get(task.id) ?? [];
  const taskAssignees = taskAssigneesMap?.get(task.id) ?? [];
  const availableTags = (allTags ?? []).filter((t) => !taskTags.some((tt) => tt.id === t.id));
  const availableMembers = (members ?? []).filter(
    (m) => !taskAssignees.some((a) => a.id === m.user_id),
  );

  function commitTitle() {
    const trimmed = title.trim();
    if (trimmed && trimmed !== task.title) renameTask.mutate({ taskId: task.id, title: trimmed });
    else setTitle(task.title);
  }

  function commitDescription() {
    if (description !== (task.description ?? "")) {
      updateDetails.mutate({ taskId: task.id, details: { description: description || null } });
    }
  }

  function setPriority(priority: Priority) {
    updateDetails.mutate({ taskId: task.id, details: { priority: task.priority === priority ? null : priority } });
  }

  function setDueDate(value: string | null) {
    updateDetails.mutate({ taskId: task.id, details: { due_date: value } });
  }

  async function handleCreateTag(e: FormEvent) {
    e.preventDefault();
    const name = newTagName.trim();
    if (!name) return;
    const tag = await createTag.mutateAsync(name);
    addTaskTag.mutate({ taskId: task.id, tagId: tag.id });
    setNewTagName("");
    setTagPickerOpen(false);
  }

  function handleDelete() {
    if (!confirm(`¿Eliminar la tarea "${task.title}"?`)) return;
    deleteTask.mutate(task.id);
    onClose();
  }

  function handleAddComment(e: FormEvent) {
    e.preventDefault();
    const body = newComment.trim();
    if (!body) return;
    createComment.mutate(body);
    setNewComment("");
  }

  function handleAddSubtask(e: FormEvent) {
    e.preventDefault();
    const title = newSubtaskTitle.trim();
    if (!title) return;
    createSubtask.mutate(title);
    setNewSubtaskTitle("");
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAttachmentError(null);
    try {
      await uploadAttachment.mutateAsync(file);
    } catch (err) {
      setAttachmentError(err instanceof Error ? err.message : "No se pudo subir el archivo.");
    }
  }

  async function handleDownload(storagePath: string) {
    // Open the tab synchronously (inside the click handler) so browsers don't
    // block it as a popup — window.open() after an await loses the
    // user-gesture context and gets blocked silently.
    const tab = window.open("", "_blank");
    try {
      const url = await getAttachmentDownloadUrl(storagePath);
      if (tab) tab.location.href = url;
      else window.open(url, "_blank");
    } catch (err) {
      tab?.close();
      setAttachmentError(err instanceof Error ? err.message : "No se pudo abrir el archivo.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/70 flex items-start justify-center p-8 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-surface-container rounded-lg w-full max-w-xl p-6 flex flex-col gap-6 mt-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <input
            className="flex-1 bg-transparent text-lg font-bold text-on-surface focus:outline-none border-b border-transparent focus:border-outline-variant"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          />
          <button type="button" onClick={onClose} className="text-on-surface-variant hover:text-on-surface shrink-0" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {/* Description */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Descripción</label>
          <textarea
            className="bg-surface-container-lowest border border-outline-variant/30 rounded-md px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container min-h-[80px] resize-y"
            placeholder="Añade una descripción..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={commitDescription}
          />
        </div>

        {/* Priority + due date */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Prioridad</span>
            <div className="flex gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
                  style={
                    task.priority === p.value
                      ? { backgroundColor: p.color, borderColor: p.color, color: "#fff" }
                      : { borderColor: "var(--outline-variant)", color: "var(--on-surface-variant)" }
                  }
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Fecha límite
            </label>
            <DueDatePicker value={task.due_date} onChange={setDueDate} />
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Categorías</span>
          <div className="flex flex-wrap items-center gap-2">
            {taskTags.map((tag) => (
              <span
                key={tag.id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: tag.color }}
              >
                {tag.name}
                <button
                  type="button"
                  onClick={() => removeTaskTag.mutate({ taskId: task.id, tagId: tag.id })}
                  aria-label={`Quitar categoría ${tag.name}`}
                  className="opacity-80 hover:opacity-100"
                >
                  ✕
                </button>
              </span>
            ))}
            <div className="relative" ref={tagPickerRef}>
              <button
                type="button"
                onClick={() => setTagPickerOpen((o) => !o)}
                className="w-6 h-6 rounded-full border border-outline-variant/40 text-on-surface-variant hover:border-primary hover:text-primary flex items-center justify-center text-xs"
                aria-label="Añadir categoría"
                title="Añadir categoría"
              >
                +
              </button>
              {tagPickerOpen && (
                <div className="absolute left-0 mt-2 w-72 bg-surface-container-lowest border border-outline-variant/30 rounded-md shadow-lg z-10 p-2 flex flex-col gap-2">
                  {availableTags.length > 0 && (
                    <ul className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                      {availableTags.map((tag) => (
                        <li key={tag.id}>
                          <button
                            type="button"
                            className="w-full flex items-center gap-2 px-2 py-1 rounded-sm text-sm hover:bg-surface-container-high text-left"
                            onClick={() => {
                              addTaskTag.mutate({ taskId: task.id, tagId: tag.id });
                              setTagPickerOpen(false);
                            }}
                          >
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                            {tag.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <form onSubmit={handleCreateTag} className="flex items-center gap-2 border-t border-outline-variant/20 pt-2">
                    <input
                      autoFocus
                      className="flex-1 min-w-0 bg-surface-container-low border border-outline-variant/30 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary-container"
                      placeholder="Nueva categoría"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                    />
                    <button type="submit" className="text-xs text-primary font-medium px-1.5 shrink-0">
                      Crear
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Assignees */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            Compartido con
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {taskAssignees.map((a) => (
              <span
                key={a.id}
                className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full text-xs font-medium bg-surface-container-high text-on-surface"
              >
                <Avatar url={a.avatar_url} name={a.display_name} size="w-5 h-5" textSize="text-[10px]" />
                {a.display_name}
                <button
                  type="button"
                  onClick={() => removeAssignee.mutate({ taskId: task.id, userId: a.id })}
                  aria-label={`Quitar a ${a.display_name}`}
                  className="text-on-surface-variant hover:text-on-surface"
                >
                  ✕
                </button>
              </span>
            ))}
            <div className="relative" ref={assigneePickerRef}>
              <button
                type="button"
                onClick={() => setAssigneePickerOpen((o) => !o)}
                className="w-6 h-6 rounded-full border border-outline-variant/40 text-on-surface-variant hover:border-primary hover:text-primary flex items-center justify-center text-xs"
                aria-label="Añadir persona"
                title="Añadir persona"
              >
                +
              </button>
              {assigneePickerOpen && (
                <div className="absolute left-0 mt-2 w-56 bg-surface-container-lowest border border-outline-variant/30 rounded-md shadow-lg z-10 p-2">
                  {availableMembers.length === 0 ? (
                    <p className="text-xs text-on-surface-variant px-2 py-1">Nadie más para asignar.</p>
                  ) : (
                    <ul className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                      {availableMembers.map((m) => (
                        <li key={m.user_id}>
                          <button
                            type="button"
                            className="w-full px-2 py-1 rounded-sm text-sm hover:bg-surface-container-high text-left"
                            onClick={() => {
                              addAssignee.mutate({ taskId: task.id, userId: m.user_id });
                              setAssigneePickerOpen(false);
                            }}
                          >
                            {m.profile.display_name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Subtasks */}
        <div className="flex flex-col gap-3 border-t border-outline-variant/20 pt-4">
          <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            Subtareas {subtasks && subtasks.length > 0 ? `(${subtasks.filter((s) => s.is_done).length}/${subtasks.length})` : ""}
          </span>

          {subtasks && subtasks.length > 0 && (
            <ul className="flex flex-col gap-1">
              {subtasks.map((s) => (
                <li key={s.id} className="flex items-center gap-2 group/subtask">
                  <button
                    type="button"
                    onClick={() => toggleSubtask.mutate({ subtaskId: s.id, isDone: !s.is_done })}
                    aria-label={s.is_done ? "Marcar como pendiente" : "Marcar como completada"}
                    className={`shrink-0 w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                      s.is_done
                        ? "bg-primary-container border-primary-container text-on-primary"
                        : "border-outline-variant/50 text-transparent hover:border-primary"
                    }`}
                  >
                    <CheckCircleIcon className="w-3 h-3" />
                  </button>
                  <span
                    className={`flex-1 min-w-0 text-sm truncate ${
                      s.is_done ? "text-on-surface-variant line-through decoration-outline" : "text-on-surface"
                    }`}
                  >
                    {s.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteSubtask.mutate(s.id)}
                    aria-label={`Eliminar subtarea ${s.title}`}
                    className="text-outline opacity-0 group-hover/subtask:opacity-100 hover:text-error transition-opacity shrink-0"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={handleAddSubtask} className="flex items-center gap-2">
            <input
              className="flex-1 min-w-0 bg-surface-container-lowest border border-outline-variant/30 rounded-sm px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-container"
              placeholder="Añadir subtarea..."
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
            />
            <button type="submit" disabled={!newSubtaskTitle.trim()} className="text-xs text-primary font-medium px-1.5 shrink-0 disabled:opacity-40">
              Añadir
            </button>
          </form>
        </div>

        {/* Attachments */}
        <div className="flex flex-col gap-3 border-t border-outline-variant/20 pt-4">
          <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            Archivos {attachments && attachments.length > 0 ? `(${attachments.length})` : ""}
          </span>

          {attachments && attachments.length > 0 && (
            <ul className="flex flex-col gap-1">
              {attachments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-2 group/file bg-surface-container-lowest rounded-sm px-2 py-1.5"
                >
                  <PaperclipIcon className="w-3.5 h-3.5 text-on-surface-variant shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-on-surface truncate">{a.filename}</p>
                    <p className="text-[10px] text-on-surface-variant">
                      {formatBytes(a.size_bytes)} · {a.uploader.display_name}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownload(a.storage_path)}
                    aria-label={`Descargar ${a.filename}`}
                    className="text-on-surface-variant hover:text-primary transition-colors shrink-0"
                  >
                    <DownloadIcon className="w-3.5 h-3.5" />
                  </button>
                  {a.uploaded_by === user?.id && (
                    <button
                      type="button"
                      onClick={() => deleteAttachment.mutate({ attachmentId: a.id, storagePath: a.storage_path })}
                      aria-label={`Eliminar ${a.filename}`}
                      className="text-outline opacity-0 group-hover/file:opacity-100 hover:text-error transition-opacity shrink-0"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {attachmentError && <p className="text-error text-xs">{attachmentError}</p>}

          <input ref={fileInputRef} type="file" onChange={handleFileSelected} className="hidden" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadAttachment.isPending}
            className="self-start flex items-center gap-1.5 text-xs text-primary font-medium disabled:opacity-40"
          >
            <PaperclipIcon className="w-3.5 h-3.5" />
            {uploadAttachment.isPending ? "Subiendo..." : `Adjuntar archivo (máx. ${MAX_ATTACHMENT_SIZE / 1024 / 1024}MB)`}
          </button>
        </div>

        {/* Comments */}
        <div className="flex flex-col gap-3 border-t border-outline-variant/20 pt-4">
          <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            Comentarios {comments && comments.length > 0 ? `(${comments.length})` : ""}
          </span>

          <div className="flex flex-col gap-3 max-h-56 overflow-y-auto">
            {comments?.length === 0 && (
              <p className="text-xs text-on-surface-variant">Todavía no hay comentarios.</p>
            )}
            {comments?.map((c) => (
              <div key={c.id} className="flex gap-2 group/comment">
                <Avatar url={c.author.avatar_url} name={c.author.display_name} size="w-6 h-6" textSize="text-[10px]" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-bold text-on-surface">{c.author.display_name}</span>
                    <span className="text-[10px] text-on-surface-variant">
                      {new Date(c.created_at).toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {c.user_id === user?.id && (
                      <button
                        type="button"
                        onClick={() => deleteComment.mutate(c.id)}
                        className="text-[10px] text-on-surface-variant hover:text-error opacity-0 group-hover/comment:opacity-100 transition-opacity"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-on-surface whitespace-pre-wrap break-words">{c.body}</p>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddComment} className="flex items-end gap-2">
            <textarea
              className="flex-1 bg-surface-container-lowest border border-outline-variant/30 rounded-md px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container min-h-[40px] resize-none"
              placeholder="Escribe un comentario..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAddComment(e as unknown as FormEvent);
                }
              }}
            />
            <button
              type="submit"
              disabled={!newComment.trim()}
              className="text-sm text-primary font-medium px-2 py-2 shrink-0 disabled:opacity-40"
            >
              Enviar
            </button>
          </form>
        </div>

        <div className="flex justify-end pt-2 border-t border-outline-variant/20">
          <button
            type="button"
            onClick={handleDelete}
            className="text-xs text-error hover:underline"
          >
            Eliminar tarea
          </button>
        </div>
      </div>
    </div>
  );
}
