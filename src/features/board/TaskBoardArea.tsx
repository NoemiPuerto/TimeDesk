import { useEffect, useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import { DEFAULT_TASK_FILTERS, type TaskFilters } from "./filters";
import { FilesView } from "./FilesView";
import { HistoryView } from "./HistoryView";
import { useColumns, useTasks } from "./hooks";
import { KanbanBoard } from "./KanbanBoard";
import { OverviewView } from "./OverviewView";
import { TaskListView } from "./TaskListView";
import { TaskTimelineView } from "./TaskTimelineView";
import { TaskDetailModal } from "./TaskDetailModal";
import { TaskToolbar } from "./TaskToolbar";

const VIEWS = [
  { key: "overview", label: "Overview" },
  { key: "board", label: "Board" },
  { key: "list", label: "List" },
  { key: "timeline", label: "Timeline" },
  { key: "history", label: "History" },
  { key: "files", label: "Files" },
] as const;

export function TaskBoardArea({
  projectId,
  boardOnly = false,
  doneDisplayLimit = null,
}: {
  projectId: string;
  boardOnly?: boolean;
  /** Tarjetas visibles en la columna de terminadas; null = sin límite. */
  doneDisplayLimit?: number | null;
}) {
  const [view, setView] = useState<(typeof VIEWS)[number]["key"]>("board");
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [filters, setFilters] = useState<TaskFilters>(DEFAULT_TASK_FILTERS);
  const { data: tasks } = useTasks(projectId);
  const { data: columns } = useColumns(projectId);
  const { openTaskId, requestOpenTask } = useAppStore();

  // Una mención (buzón o dashboard) pide abrir una tarea concreta; el tablero
  // solo puede hacerlo cuando ya cargó las tareas de ESTE proyecto.
  useEffect(() => {
    if (!openTaskId || !tasks) return;
    if (tasks.some((t) => t.id === openTaskId)) {
      setDetailTaskId(openTaskId);
      requestOpenTask(null);
    }
  }, [openTaskId, tasks, requestOpenTask]);

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

          {view !== "overview" && view !== "files" && view !== "history" && (
            <TaskToolbar columns={columns ?? []} filters={filters} onChange={setFilters} />
          )}
        </>
      )}

      {!boardOnly && view === "overview" && (
        <OverviewView projectId={projectId} onOpenTask={setDetailTaskId} onShowHistory={() => setView("history")} />
      )}
      {(boardOnly || view === "board") && (
        <KanbanBoard
          projectId={projectId}
          onOpenTask={setDetailTaskId}
          filters={boardOnly ? undefined : filters}
          // En el Timer el tablero es solo lo de esta semana; el límite de Done
          // es cosa de la pestaña Board.
          recentOnly={boardOnly}
          doneDisplayLimit={boardOnly ? null : doneDisplayLimit}
          onShowHistory={boardOnly ? undefined : () => setView("history")}
        />
      )}
      {!boardOnly && view === "history" && <HistoryView projectId={projectId} onOpenTask={setDetailTaskId} />}
      {!boardOnly && view === "list" && <TaskListView projectId={projectId} onOpenTask={setDetailTaskId} filters={filters} />}
      {!boardOnly && view === "timeline" && (
        <TaskTimelineView projectId={projectId} onOpenTask={setDetailTaskId} filters={filters} />
      )}
      {!boardOnly && view === "files" && <FilesView projectId={projectId} onOpenTask={setDetailTaskId} />}

      {detailTask && (
        <TaskDetailModal task={detailTask} projectId={projectId} onClose={() => setDetailTaskId(null)} />
      )}
    </div>
  );
}
