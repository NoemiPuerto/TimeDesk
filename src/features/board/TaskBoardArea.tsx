import { useState } from "react";
import { useTasks } from "./hooks";
import { KanbanBoard } from "./KanbanBoard";
import { TaskListView } from "./TaskListView";
import { TaskTimelineView } from "./TaskTimelineView";
import { TaskDetailModal } from "./TaskDetailModal";

const VIEWS = [
  { key: "board", label: "Board" },
  { key: "list", label: "List" },
  { key: "timeline", label: "Timeline" },
] as const;

export function TaskBoardArea({ projectId }: { projectId: string }) {
  const [view, setView] = useState<(typeof VIEWS)[number]["key"]>("board");
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const { data: tasks } = useTasks(projectId);

  const detailTask = tasks?.find((t) => t.id === detailTaskId) ?? null;

  return (
    <div className="flex flex-col gap-4">
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

      {view === "board" && <KanbanBoard projectId={projectId} onOpenTask={setDetailTaskId} />}
      {view === "list" && <TaskListView projectId={projectId} onOpenTask={setDetailTaskId} />}
      {view === "timeline" && <TaskTimelineView projectId={projectId} onOpenTask={setDetailTaskId} />}

      {detailTask && (
        <TaskDetailModal task={detailTask} projectId={projectId} onClose={() => setDetailTaskId(null)} />
      )}
    </div>
  );
}
