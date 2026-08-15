import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import type { Task } from "./api";
import { useDeleteTask, useRenameTask } from "./hooks";

export function TaskCard({ task, projectId }: { task: Task; projectId: string }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const renameTask = useRenameTask(projectId);
  const deleteTask = useDeleteTask(projectId);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  function commitRename() {
    setEditing(false);
    const trimmed = title.trim();
    if (trimmed && trimmed !== task.title) {
      renameTask.mutate({ taskId: task.id, title: trimmed });
    } else {
      setTitle(task.title);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-surface-container-lowest border border-outline-variant/30 p-4 rounded-md hover:shadow-md transition-shadow group cursor-grab active:cursor-grabbing"
    >
      {editing ? (
        <input
          autoFocus
          className="w-full bg-transparent border-b border-primary text-sm font-medium text-on-surface focus:outline-none"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") {
              setTitle(task.title);
              setEditing(false);
            }
          }}
          onPointerDown={(e) => e.stopPropagation()}
        />
      ) : (
        <div className="flex items-start justify-between gap-2">
          <h4
            className="font-medium text-on-surface leading-snug text-sm"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
          >
            {task.title}
          </h4>
          <button
            type="button"
            className="text-outline opacity-0 group-hover:opacity-100 transition-opacity text-xs shrink-0"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              deleteTask.mutate(task.id);
            }}
            aria-label="Eliminar tarea"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
