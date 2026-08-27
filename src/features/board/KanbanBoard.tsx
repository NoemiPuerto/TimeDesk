import { DndContext, closestCorners, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, horizontalListSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import { useMemo, useState, type FormEvent } from "react";
import { startOfWeek } from "../analytics/utils";
import type { Task } from "./api";
import { applyTaskFilters, DEFAULT_TASK_FILTERS, hasActiveFilters, type TaskFilters } from "./filters";
import { useColumns, useCreateColumn, useReorderColumns, useReorderTasks, useTasks } from "./hooks";
import { Column } from "./Column";
import { QuickAddTask } from "./QuickAddTask";

export function KanbanBoard({
  projectId,
  onOpenTask,
  filters = DEFAULT_TASK_FILTERS,
  doneDisplayLimit = null,
  recentOnly = false,
  onShowHistory,
}: {
  projectId: string;
  onOpenTask: (taskId: string) => void;
  filters?: TaskFilters;
  /** Tarjetas visibles en la columna de terminadas. null = todas. */
  doneDisplayLimit?: number | null;
  /** Vista del Timer: esconde lo terminado antes de esta semana. */
  recentOnly?: boolean;
  onShowHistory?: () => void;
}) {
  const { data: columns, isLoading: columnsLoading } = useColumns(projectId);
  const { data: tasks, isLoading: tasksLoading } = useTasks(projectId);
  const createColumn = useCreateColumn(projectId);
  const reorderTasks = useReorderTasks(projectId);
  const reorderColumns = useReorderColumns(projectId);
  const [newColumnName, setNewColumnName] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const filteredTasks = useMemo(() => applyTaskFilters(tasks ?? [], filters), [tasks, filters]);

  // En el Timer el tablero es "lo que estoy haciendo ahora": las terminadas de
  // semanas anteriores solo estorban. Las abiertas se muestran siempre, sin
  // importar cuándo se crearon.
  const visibleTasks = useMemo(() => {
    if (!recentOnly) return filteredTasks;
    const weekStart = startOfWeek(new Date()).getTime();
    return filteredTasks.filter((t) => !t.completed_at || new Date(t.completed_at).getTime() >= weekStart);
  }, [filteredTasks, recentOnly]);

  const tasksByColumn = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of visibleTasks) {
      const list = map.get(task.column_id) ?? [];
      list.push(task);
      map.set(task.column_id, list);
    }
    if (filters.sortBy === "manual") {
      for (const list of map.values()) list.sort((a, b) => a.position - b.position);
    }
    return map;
  }, [visibleTasks, filters.sortBy]);

  function handleColumnDragEnd(activeColId: string, overColId: string) {
    if (!columns || activeColId === overColId) return;

    const ids = columns.map((c) => c.id);
    const oldIndex = ids.indexOf(activeColId);
    const newIndex = ids.indexOf(overColId);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(ids, oldIndex, newIndex);
    reorderColumns.mutate(reordered.map((id, index) => ({ id, position: index })));
  }

  // Resolves the column a drop landed on, whichever element `over` actually
  // is — the column's own drag handle, its (mostly empty) task-drop-zone, or
  // one of its task cards. Nested sortable contexts make dnd-kit's collision
  // detection land on the closest of any of those, not necessarily the
  // column wrapper itself.
  function resolveOverColumnId(over: NonNullable<DragEndEvent["over"]>): string | null {
    const data = over.data.current as { type?: string; columnId?: string; task?: Task } | undefined;
    if (data?.type === "column-sort" && data.columnId) return data.columnId;
    if (data?.type === "column" && data.columnId) return data.columnId;
    if (data?.type === "task" && data.task) return data.task.column_id;
    const rawId = String(over.id);
    return rawId.startsWith("col-") ? rawId.slice(4) : rawId;
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current as { type?: string; columnId?: string } | undefined;
    if (activeData?.type === "column-sort") {
      const activeColId = activeData.columnId ?? String(active.id).replace(/^col-/, "");
      const overColId = resolveOverColumnId(over);
      if (overColId) handleColumnDragEnd(activeColId, overColId);
      return;
    }

    if (!tasks || hasActiveFilters(filters)) return;

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

  const [addingColumn, setAddingColumn] = useState(false);

  function handleAddColumn(e: FormEvent) {
    e.preventDefault();
    const name = newColumnName.trim();
    if (!name) {
      setAddingColumn(false);
      return;
    }
    createColumn.mutate(name);
    setNewColumnName("");
    setAddingColumn(false);
  }

  if (columnsLoading || tasksLoading) {
    return <p className="text-on-surface-variant text-sm p-8">Cargando tablero...</p>;
  }

  const lastColumnId = columns && columns.length > 0 ? columns[columns.length - 1].id : null;
  const tasksDragDisabled = hasActiveFilters(filters);

  // El recorte es solo de pintura: `tasksByColumn` sigue completo porque es lo
  // que usa handleDragEnd para calcular posiciones al soltar.
  const doneTasksAll = lastColumnId ? (tasksByColumn.get(lastColumnId) ?? []) : [];
  // Las que escondió el filtro "solo esta semana" también cuentan para el pie
  // de la columna: si no, diría que hay menos terminadas de las que hay.
  const doneHiddenByWeek = lastColumnId
    ? filteredTasks.filter((t) => t.column_id === lastColumnId).length - doneTasksAll.length
    : 0;
  const doneTasksVisible =
    doneDisplayLimit && doneTasksAll.length > doneDisplayLimit
      ? [...doneTasksAll]
          .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))
          .slice(0, doneDisplayLimit)
      : doneTasksAll;
  const doneHiddenCount = doneTasksAll.length - doneTasksVisible.length + doneHiddenByWeek;

  return (
    <div className="flex flex-col gap-4">
      <QuickAddTask projectId={projectId} columns={columns ?? []} />

      {tasksDragDisabled && (
        <p className="text-xs text-on-surface-variant">
          Quita los filtros para poder reordenar tareas arrastrándolas.
        </p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div className="flex items-start gap-6 overflow-x-auto pb-4">
          <SortableContext items={(columns ?? []).map((c) => `col-${c.id}`)} strategy={horizontalListSortingStrategy}>
            {(columns ?? []).map((column) => {
              const isDone = column.id === lastColumnId;
              return (
                <Column
                  key={column.id}
                  column={column}
                  tasks={isDone ? doneTasksVisible : (tasksByColumn.get(column.id) ?? [])}
                  projectId={projectId}
                  isDoneColumn={isDone}
                  tasksDragDisabled={tasksDragDisabled}
                  hiddenCount={isDone ? doneHiddenCount : 0}
                  onShowHistory={onShowHistory}
                  onOpenTask={onOpenTask}
                />
              );
            })}
          </SortableContext>

          {addingColumn ? (
            <form onSubmit={handleAddColumn} className="w-64 shrink-0 flex gap-2">
              <input
                autoFocus
                className="flex-1 bg-surface-container-low border border-outline-variant/30 rounded-md px-3 py-2 text-sm placeholder-outline/60 focus:outline-none focus:ring-2 focus:ring-primary-container"
                placeholder="Nombre de la columna"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                onBlur={() => !newColumnName.trim() && setAddingColumn(false)}
                onKeyDown={(e) => e.key === "Escape" && setAddingColumn(false)}
              />
              {newColumnName.trim() && (
                <button type="submit" className="text-sm text-primary font-medium px-2 shrink-0">
                  Añadir
                </button>
              )}
            </form>
          ) : (
            <button
              type="button"
              title="Añadir columna"
              aria-label="Añadir columna"
              onClick={() => setAddingColumn(true)}
              className="shrink-0 w-9 h-9 flex items-center justify-center rounded-md border border-outline-variant/30 text-on-surface-variant hover:text-primary hover:border-primary transition-colors"
            >
              +
            </button>
          )}
        </div>
      </DndContext>
    </div>
  );
}
