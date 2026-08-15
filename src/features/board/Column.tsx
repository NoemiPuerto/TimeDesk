import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useState } from "react";
import type { Column as ColumnType, Task } from "./api";
import { useDeleteColumn, useRenameColumn } from "./hooks";
import { TaskCard } from "./TaskCard";

export function Column({
  column,
  tasks,
  projectId,
  isDoneColumn,
  onOpenTask,
}: {
  column: ColumnType;
  tasks: Task[];
  projectId: string;
  isDoneColumn: boolean;
  onOpenTask: (taskId: string) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(column.name);
  const renameColumn = useRenameColumn(projectId);
  const deleteColumn = useDeleteColumn(projectId);

  const { setNodeRef, isOver } = useDroppable({ id: column.id, data: { type: "column", columnId: column.id } });

  function commitRename() {
    setEditingName(false);
    const trimmed = name.trim();
    if (trimmed && trimmed !== column.name) {
      renameColumn.mutate({ columnId: column.id, name: trimmed });
    } else {
      setName(column.name);
    }
  }

  return (
    <div className="flex flex-col gap-3 w-64 shrink-0">
      <div className="flex items-center justify-between px-1 group/header">
        {editingName ? (
          <input
            autoFocus
            className="bg-transparent border-b border-primary text-sm font-bold uppercase tracking-widest text-on-surface-variant focus:outline-none flex-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => e.key === "Enter" && commitRename()}
          />
        ) : (
          <h3
            className="flex items-center gap-2 font-bold text-on-surface-variant text-sm uppercase tracking-widest cursor-text"
            onDoubleClick={() => setEditingName(true)}
          >
            {column.name}
            <span className="bg-surface-container-highest px-2 py-0.5 rounded-full text-[10px] text-on-surface">
              {tasks.length}
            </span>
          </h3>
        )}
        <button
          type="button"
          className="text-outline hover:text-error text-xs opacity-0 group-hover/header:opacity-100 transition-opacity"
          onClick={() => {
            if (tasks.length > 0 && !confirm(`Eliminar "${column.name}" y sus ${tasks.length} tareas?`)) return;
            deleteColumn.mutate(column.id);
          }}
          aria-label="Eliminar columna"
        >
          ✕
        </button>
      </div>

      <div
        ref={setNodeRef}
        className={`flex flex-col gap-3 min-h-[80px] rounded-md p-1 transition-colors ${
          isOver ? "bg-primary-container/10" : ""
        }`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              projectId={projectId}
              isDone={isDoneColumn}
              onOpenTask={onOpenTask}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
