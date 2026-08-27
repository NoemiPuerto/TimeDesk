import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { GripVerticalIcon } from "../../components/icons";
import type { Column as ColumnType, Task } from "./api";
import { useDeleteColumn, useRenameColumn } from "./hooks";
import { TaskCard } from "./TaskCard";

export function Column({
  column,
  tasks,
  projectId,
  isDoneColumn,
  tasksDragDisabled = false,
  hiddenCount = 0,
  onShowHistory,
  onOpenTask,
}: {
  column: ColumnType;
  tasks: Task[];
  projectId: string;
  isDoneColumn: boolean;
  tasksDragDisabled?: boolean;
  /** Terminadas que existen pero no se pintan, por el límite del proyecto. */
  hiddenCount?: number;
  onShowHistory?: () => void;
  onOpenTask: (taskId: string) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(column.name);
  const renameColumn = useRenameColumn(projectId);
  const deleteColumn = useDeleteColumn(projectId);

  const { setNodeRef, isOver } = useDroppable({ id: column.id, data: { type: "column", columnId: column.id } });

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `col-${column.id}`, data: { type: "column-sort", columnId: column.id } });

  const columnStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

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
    <div ref={setSortableRef} style={columnStyle} className="flex flex-col gap-3 w-64 shrink-0">
      <div className="flex items-center justify-between px-1 group/header">
        <div className="flex items-center gap-1 min-w-0">
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label="Reordenar columna"
            className="text-outline opacity-0 group-hover/header:opacity-100 hover:text-primary transition-opacity cursor-grab active:cursor-grabbing shrink-0"
          >
            <GripVerticalIcon className="w-3.5 h-3.5" />
          </button>
          {editingName ? (
            <input
              autoFocus
              className="bg-transparent border-b border-primary text-sm font-bold uppercase tracking-widest text-on-surface-variant focus:outline-none flex-1 min-w-0"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => e.key === "Enter" && commitRename()}
            />
          ) : (
            <h3
              className="flex items-center gap-2 font-bold text-on-surface-variant text-sm uppercase tracking-widest cursor-text truncate"
              onDoubleClick={() => setEditingName(true)}
            >
              {column.name}
              <span className="bg-surface-container-highest px-2 py-0.5 rounded-full text-[10px] text-on-surface shrink-0">
                {tasks.length + hiddenCount}
              </span>
            </h3>
          )}
        </div>
        <button
          type="button"
          className="text-outline hover:text-error text-xs opacity-0 group-hover/header:opacity-100 transition-opacity shrink-0"
          onClick={() => {
            const affected = tasks.length + hiddenCount;
            if (affected > 0 && !confirm(`Eliminar "${column.name}" y sus ${affected} tareas?`)) return;
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
              dragDisabled={tasksDragDisabled}
              onOpenTask={onOpenTask}
            />
          ))}
        </SortableContext>

        {hiddenCount > 0 &&
          (onShowHistory ? (
            <button
              type="button"
              onClick={onShowHistory}
              className="text-xs text-on-surface-variant hover:text-primary text-left px-2 py-2 rounded-md border border-dashed border-outline-variant/40 hover:border-primary/50 transition-colors"
            >
              +{hiddenCount} terminada(s) más · ver History
            </button>
          ) : (
            <p className="text-xs text-on-surface-variant/70 px-2 py-2 rounded-md border border-dashed border-outline-variant/40">
              +{hiddenCount} terminada(s) de otras semanas
            </p>
          ))}
      </div>
    </div>
  );
}
