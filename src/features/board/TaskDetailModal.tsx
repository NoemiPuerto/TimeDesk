import { useState, type FormEvent } from "react";
import { useProjectMembers } from "../projects/hooks";
import type { Priority, Task } from "./api";
import {
  useAddTaskAssignee,
  useAddTaskTag,
  useCreateTag,
  useDeleteTask,
  useProjectTags,
  useRemoveTaskAssignee,
  useRemoveTaskTag,
  useRenameTask,
  useTaskAssigneesMap,
  useTaskTagsMap,
  useUpdateTaskDetails,
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

  const renameTask = useRenameTask(projectId);
  const updateDetails = useUpdateTaskDetails(projectId);
  const deleteTask = useDeleteTask(projectId);

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

  function setDueDate(value: string) {
    updateDetails.mutate({ taskId: task.id, details: { due_date: value || null } });
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
            <input
              type="date"
              defaultValue={task.due_date ?? ""}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-surface-container-lowest border border-outline-variant/30 rounded-md px-3 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
            />
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
            <div className="relative">
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
                <div className="absolute left-0 mt-2 w-56 bg-surface-container-lowest border border-outline-variant/30 rounded-md shadow-lg z-10 p-2 flex flex-col gap-2">
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
                  <form onSubmit={handleCreateTag} className="flex gap-1 border-t border-outline-variant/20 pt-2">
                    <input
                      autoFocus
                      className="flex-1 bg-surface-container-low border border-outline-variant/30 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary-container"
                      placeholder="Nueva categoría"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                    />
                    <button type="submit" className="text-xs text-primary font-medium px-1 shrink-0">
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
                <span className="w-5 h-5 rounded-full bg-secondary-container text-on-surface flex items-center justify-center text-[10px] font-bold">
                  {a.display_name.slice(0, 1).toUpperCase()}
                </span>
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
            <div className="relative">
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
