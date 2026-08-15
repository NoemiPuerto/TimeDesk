import { useMemo } from "react";
import { Avatar } from "../../components/Avatar";
import { MessageCircleIcon } from "../../components/icons";
import type { Task } from "./api";
import { applyTaskFilters, DEFAULT_TASK_FILTERS, type TaskFilters } from "./filters";
import { useColumns, useCommentCounts, useTaskAssigneesMap, useTaskTagsMap, useTasks } from "./hooks";

const PRIORITY_STYLE: Record<string, { label: string; color: string }> = {
  high: { label: "Alta", color: "#eb3619" },
  medium: { label: "Media", color: "#f59e0b" },
  low: { label: "Baja", color: "#a3a3a3" },
};

export function TaskListView({
  projectId,
  onOpenTask,
  filters = DEFAULT_TASK_FILTERS,
}: {
  projectId: string;
  onOpenTask: (taskId: string) => void;
  filters?: TaskFilters;
}) {
  const { data: columns, isLoading: columnsLoading } = useColumns(projectId);
  const { data: tasks, isLoading: tasksLoading } = useTasks(projectId);
  const { data: tagsMap } = useTaskTagsMap(projectId);
  const { data: assigneesMap } = useTaskAssigneesMap(projectId);
  const { data: commentCounts } = useCommentCounts(projectId);

  const filteredTasks = useMemo(() => applyTaskFilters(tasks ?? [], filters), [tasks, filters]);

  const tasksByColumn = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of filteredTasks) {
      const list = map.get(task.column_id) ?? [];
      list.push(task);
      map.set(task.column_id, list);
    }
    if (filters.sortBy === "manual") {
      for (const list of map.values()) list.sort((a, b) => a.position - b.position);
    }
    return map;
  }, [filteredTasks, filters.sortBy]);

  if (columnsLoading || tasksLoading) {
    return <p className="text-on-surface-variant text-sm p-8">Cargando lista...</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {(columns ?? []).map((column) => {
        const columnTasks = tasksByColumn.get(column.id) ?? [];
        return (
          <div key={column.id} className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 font-bold text-on-surface-variant text-sm uppercase tracking-widest px-1">
              {column.name}
              <span className="bg-surface-container-highest px-2 py-0.5 rounded-full text-[10px] text-on-surface">
                {columnTasks.length}
              </span>
            </h3>
            {columnTasks.length === 0 ? (
              <p className="text-xs text-on-surface-variant px-1">Sin tareas.</p>
            ) : (
              <div className="flex flex-col rounded-md overflow-hidden border border-outline-variant/20">
                {columnTasks.map((task) => {
                  const priority = task.priority ? PRIORITY_STYLE[task.priority] : null;
                  const tags = tagsMap?.get(task.id) ?? [];
                  const assignees = assigneesMap?.get(task.id) ?? [];
                  const commentCount = commentCounts?.get(task.id) ?? 0;
                  const dueDateLabel = task.due_date
                    ? new Date(task.due_date + "T00:00:00").toLocaleDateString("es", { day: "numeric", month: "short" })
                    : null;
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => onOpenTask(task.id)}
                      className="flex items-center gap-3 px-3 py-2.5 bg-surface-container-lowest hover:bg-surface-container-high transition-colors border-b border-outline-variant/10 last:border-b-0 text-left"
                    >
                      {priority && (
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: priority.color }}
                          title={priority.label}
                        />
                      )}
                      <span className="flex-1 min-w-0 text-sm text-on-surface truncate">{task.title}</span>
                      {tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag.id}
                          className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-medium text-white shrink-0"
                          style={{ backgroundColor: tag.color }}
                        >
                          {tag.name}
                        </span>
                      ))}
                      {dueDateLabel && (
                        <span className="text-[11px] text-on-surface-variant shrink-0">{dueDateLabel}</span>
                      )}
                      {commentCount > 0 && (
                        <span className="flex items-center gap-1 text-[11px] text-on-surface-variant shrink-0">
                          <MessageCircleIcon className="w-3 h-3" />
                          {commentCount}
                        </span>
                      )}
                      {assignees.length > 0 && (
                        <div className="flex -space-x-1.5 shrink-0">
                          {assignees.slice(0, 3).map((a) => (
                            <span key={a.id} title={a.display_name} className="border-2 border-surface-container-lowest rounded-full">
                              <Avatar url={a.avatar_url} name={a.display_name} size="w-5 h-5" textSize="text-[9px]" />
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
