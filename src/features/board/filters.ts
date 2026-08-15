import type { Task } from "./api";

export type SortBy = "manual" | "due_date" | "priority" | "title";

export type TaskFilters = {
  search: string;
  statusColumnId: string | "all";
  priority: "all" | "high" | "medium" | "low";
  sortBy: SortBy;
};

export const DEFAULT_TASK_FILTERS: TaskFilters = {
  search: "",
  statusColumnId: "all",
  priority: "all",
  sortBy: "manual",
};

export function hasActiveFilters(filters: TaskFilters): boolean {
  return filters.search.trim() !== "" || filters.statusColumnId !== "all" || filters.priority !== "all";
}

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

export function applyTaskFilters(tasks: Task[], filters: TaskFilters): Task[] {
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
