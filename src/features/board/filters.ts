import type { Task } from "./api";
import type { Assignee } from "./assignees";
import type { Tag } from "./tags";

export type SortBy = "manual" | "due_date" | "priority" | "title";

/** `"all"` = sin filtrar, `"none"` = solo las que no tiene nadie, o un user_id. */
export type AssigneeFilter = "all" | "none" | (string & {});

export type TaskFilters = {
  search: string;
  statusColumnId: string | "all";
  priority: "all" | "high" | "medium" | "low";
  assigneeId: AssigneeFilter;
  /** Vacío = sin filtrar. Con varias, basta con que la tarea tenga UNA (OR). */
  tagIds: string[];
  sortBy: SortBy;
};

/**
 * Las relaciones tarea↔persona y tarea↔etiqueta no viven en la fila de `tasks`,
 * sino en los mapas que ya carga la vista (`useTaskAssigneesMap`,
 * `useTaskTagsMap`). Se pasan aparte para no obligar a cada vista a
 * desnormalizarlas dentro de cada tarea.
 */
export type TaskFilterContext = {
  assigneesByTask?: Map<string, Assignee[]>;
  tagsByTask?: Map<string, Tag[]>;
};

export const DEFAULT_TASK_FILTERS: TaskFilters = {
  search: "",
  statusColumnId: "all",
  priority: "all",
  assigneeId: "all",
  tagIds: [],
  sortBy: "manual",
};

export function hasActiveFilters(filters: TaskFilters): boolean {
  return (
    filters.search.trim() !== "" ||
    filters.statusColumnId !== "all" ||
    filters.priority !== "all" ||
    filters.assigneeId !== "all" ||
    filters.tagIds.length > 0
  );
}

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

export function applyTaskFilters(tasks: Task[], filters: TaskFilters, context: TaskFilterContext = {}): Task[] {
  let result = tasks;

  const query = filters.search.trim().toLowerCase();
  if (query) {
    result = result.filter((t) => t.title.toLowerCase().includes(query));
  }
  if (filters.statusColumnId !== "all") {
    result = result.filter((t) => t.column_id === filters.statusColumnId);
  }
  if (filters.priority !== "all") {
    result = result.filter((t) => t.priority === filters.priority);
  }
  if (filters.assigneeId !== "all") {
    // Sin el mapa cargado no se puede decidir, y esconder todo el tablero
    // mientras llega la consulta se vería como "no hay tareas": se deja pasar.
    const map = context.assigneesByTask;
    if (map) {
      result = result.filter((t) => {
        const assignees = map.get(t.id) ?? [];
        return filters.assigneeId === "none"
          ? assignees.length === 0
          : assignees.some((a) => a.id === filters.assigneeId);
      });
    }
  }
  if (filters.tagIds.length > 0) {
    const map = context.tagsByTask;
    if (map) {
      const wanted = new Set(filters.tagIds);
      result = result.filter((t) => (map.get(t.id) ?? []).some((tag) => wanted.has(tag.id)));
    }
  }

  if (filters.sortBy !== "manual") {
    result = [...result].sort((a, b) => {
      switch (filters.sortBy) {
        case "due_date":
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return a.due_date.localeCompare(b.due_date);
        case "priority": {
          const rankA = a.priority ? PRIORITY_RANK[a.priority] : 3;
          const rankB = b.priority ? PRIORITY_RANK[b.priority] : 3;
          return rankA - rankB;
        }
        case "title":
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });
  }

  return result;
}
