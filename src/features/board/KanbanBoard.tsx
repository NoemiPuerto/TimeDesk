import { DndContext, closestCorners, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useMemo, useState, type FormEvent } from "react";
import type { Task } from "./api";
import { useColumns, useCreateColumn, useReorderTasks, useTasks } from "./hooks";
import { Column } from "./Column";

export function KanbanBoard({ projectId }: { projectId: string }) {
  const { data: columns, isLoading: columnsLoading } = useColumns(projectId);
  const { data: tasks, isLoading: tasksLoading } = useTasks(projectId);
  const createColumn = useCreateColumn(projectId);
  const reorderTasks = useReorderTasks(projectId);
  const [newColumnName, setNewColumnName] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const tasksByColumn = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks ?? []) {
      const list = map.get(task.column_id) ?? [];
      list.push(task);
      map.set(task.column_id, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.position - b.position);
    return map;
  }, [tasks]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !tasks) return;

    const activeTask = tasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    const overData = over.data.current as { type?: string; columnId?: string; task?: Task } | undefined;
    const destColumnId = overData?.type === "column" ? overData.columnId : overData?.task?.column_id;
    if (!destColumnId) return;

    const sourceColumnId = activeTask.column_id;
    const sourceList = (tasksByColumn.get(sourceColumnId) ?? []).map((t) => t.id);
    const destList =
      sourceColumnId === destColumnId ? sourceList : (tasksByColumn.get(destColumnId) ?? []).map((t) => t.id);

    const activeIndex = sourceList.indexOf(active.id as string);
    let overIndex = overData?.type === "task" ? destList.indexOf(over.id as string) : destList.length;
    if (overIndex === -1) overIndex = destList.length;

    let updates: { id: string; column_id: string; position: number }[];

    if (sourceColumnId === destColumnId) {
      if (activeIndex === overIndex) return;
      const reordered = arrayMove(sourceList, activeIndex, overIndex);
      updates = reordered.map((id, index) => ({ id, column_id: destColumnId, position: index }));
    } else {
      const newSource = sourceList.filter((id) => id !== active.id);
      const newDest = [...destList];
      newDest.splice(overIndex, 0, active.id as string);
      updates = [
        ...newSource.map((id, index) => ({ id, column_id: sourceColumnId, position: index })),
        ...newDest.map((id, index) => ({ id, column_id: destColumnId, position: index })),
      ];
    }

    reorderTasks.mutate(updates);
  }

  function handleAddColumn(e: FormEvent) {
    e.preventDefault();
    const name = newColumnName.trim();
    if (!name) return;
    createColumn.mutate(name);
    setNewColumnName("");
  }

  if (columnsLoading || tasksLoading) {
    return <p className="text-on-surface-variant text-sm p-8">Cargando tablero...</p>;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="flex items-start gap-6 overflow-x-auto pb-4">
        {(columns ?? []).map((column) => (
          <Column key={column.id} column={column} tasks={tasksByColumn.get(column.id) ?? []} projectId={projectId} />
        ))}

        <form onSubmit={handleAddColumn} className="w-64 shrink-0 flex gap-2">
          <input
            className="flex-1 bg-surface-container-low border border-outline-variant/30 rounded-md px-3 py-2 text-sm placeholder-outline/60 focus:outline-none focus:ring-2 focus:ring-primary-container"
            placeholder="+ Añadir columna"
            value={newColumnName}
            onChange={(e) => setNewColumnName(e.target.value)}
          />
          {newColumnName.trim() && (
            <button type="submit" className="text-sm text-primary font-medium px-2 shrink-0">
              Añadir
            </button>
          )}
        </form>
      </div>
    </DndContext>
  );
}
