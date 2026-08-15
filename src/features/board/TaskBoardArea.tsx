import { useState } from "react";
import { DEFAULT_TASK_FILTERS, type TaskFilters } from "./filters";
import { useColumns, useTasks } from "./hooks";
import { KanbanBoard } from "./KanbanBoard";
import { TaskListView } from "./TaskListView";
import { TaskTimelineView } from "./TaskTimelineView";
import { TaskDetailModal } from "./TaskDetailModal";
import { TaskToolbar } from "./TaskToolbar";

const VIEWS = [
  { key: "board", label: "Board" },
  { key: "list", label: "List" },
  { key: "timeline", label: "Timeline" },
] as const;

export function TaskBoardArea({
  projectId,
  boardOnly = false,
}: {
  projectId: string;
  boardOnly?: boolean;
}) {
  const [view, setView] = useState<(typeof VIEWS)[number]["key"]>("board");
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [filters, setFilters] = useState<TaskFilters>(DEFAULT_TASK_FILTERS);
  const { data: tasks } = useTasks(projectId);
  const { data: columns } = useColumns(projectId);

  const detailTask = tasks?.find((t) => t.id === detailTaskId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      {!boardOnly && (
        <>
          <div className="flex items-center gap-1 border-b border-outline-variant/20">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => setView(v.key)}
                className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  view === v.key
                    ? "border-primary text-on-surface"
                    : "border-transparent text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          <TaskToolbar columns={columns ?? []} filters={filters} onChange={setFilters} />
        </>
      )}

      {(boardOnly || view === "board") && (
        <KanbanBoard projectId={projectId} onOpenTask={setDetailTaskId} filters={boardOnly ? undefined : filters} />
      )}
      {!boardOnly && view === "list" && <TaskListView projectId={projectId} onOpenTask={setDetailTaskId} filters={filters} />}
      {!boardOnly && view === "timeline" && (
        <TaskTimelineView projectId={projectId} onOpenTask={setDetailTaskId} filters={filters} />
      )}

      {detailTask && (
        <TaskDetailModal task={detailTask} projectId={projectId} onClose={() => setDetailTaskId(null)} />
      )}
    </div>
  );
}
