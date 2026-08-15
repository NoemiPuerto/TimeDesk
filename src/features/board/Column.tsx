import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useState, type FormEvent } from "react";
import type { Column as ColumnType, Task } from "./api";
import { useCreateTask, useDeleteColumn, useRenameColumn } from "./hooks";
import { TaskCard } from "./TaskCard";

export function Column({
  column,
  tasks,
  projectId,
}: {
  column: ColumnType;
  tasks: Task[];
  projectId: string;
}) {
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(column.name);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const renameColumn = useRenameColumn(projectId);
  const deleteColumn = useDeleteColumn(projectId);
  const createTask = useCreateTask(projectId);

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

  function handleAddTask(e: FormEvent) {
    e.preventDefault();
    const title = newTaskTitle.trim();
    if (!title) return;
    createTask.mutate({ columnId: column.id, title });
    setNewTaskTitle("");
  }

  return (
    <div className="flex flex-col gap-3 w-80 shrink-0">
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
            <TaskCard key={task.id} task={task} projectId={projectId} />
          ))}
        </SortableContext>
      </div>

      <form onSubmit={handleAddTask} className="flex items-center gap-2 px-1">
        <input
          className="flex-1 bg-surface-container-lowest border border-outline-variant/30 rounded-sm px-3 py-1.5 text-xs placeholder-outline/60 focus:outline-none focus:ring-2 focus:ring-primary-container"
          placeholder="Añadir tarea..."
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
        />
        {newTaskTitle.trim() && (
          <button
            type="submit"
            className="text-xs text-primary font-medium px-2 shrink-0"
            aria-label="Añadir tarea"
          >
            Añadir
          </button>
        )}
      </form>
    </div>
  );
}
