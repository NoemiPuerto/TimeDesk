import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import { useActiveSession, useStartTimer, useStopTimer } from "../timer/hooks";
import type { Task } from "./api";
import { useDeleteTask, useRenameTask } from "./hooks";

export function TaskCard({ task, projectId }: { task: Task; projectId: string }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const renameTask = useRenameTask(projectId);
  const deleteTask = useDeleteTask(projectId);
  const { setFocusedTaskId } = useAppStore();
  const { data: activeSession } = useActiveSession();
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();

  const isActive = activeSession?.task_id === task.id;

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

  function toggleTimer(e: React.MouseEvent) {
    e.stopPropagation();
    if (isActive && activeSession) {
      stopTimer.mutate(activeSession.id);
    } else {
      setFocusedTaskId(task.id);
      startTimer.mutate(task.id);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-surface-container-lowest p-4 rounded-md hover:shadow-md transition-shadow group cursor-grab active:cursor-grabbing ${
        isActive ? "border-2 border-primary-container" : "border border-outline-variant/30"
      }`}
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
          <div className="flex items-start gap-2 min-w-0">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={toggleTimer}
              className={`shrink-0 mt-0.5 text-xs rounded-full w-5 h-5 flex items-center justify-center ${
                isActive ? "bg-primary text-on-primary" : "text-outline hover:text-primary"
              }`}
              aria-label={isActive ? "Pausar timer" : "Iniciar timer"}
            >
              {isActive ? "❙❙" : "▶"}
            </button>
            <h4
              className="font-medium text-on-surface leading-snug text-sm"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditing(true);
              }}
            >
              {task.title}
            </h4>
          </div>
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
