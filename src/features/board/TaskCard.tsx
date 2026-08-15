import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAppStore } from "../../store/useAppStore";
import { useActiveSession, useStartTimer, useStopTimer } from "../timer/hooks";
import type { Task } from "./api";
import { useDeleteTask, useTaskAssigneesMap, useTaskTagsMap } from "./hooks";

const PRIORITY_STYLE: Record<string, { label: string; color: string }> = {
  high: { label: "Alta", color: "#eb3619" },
  medium: { label: "Media", color: "#f59e0b" },
  low: { label: "Baja", color: "#a3a3a3" },
};

export function TaskCard({
  task,
  projectId,
  onOpenTask,
}: {
  task: Task;
  projectId: string;
  onOpenTask: (taskId: string) => void;
}) {
  const deleteTask = useDeleteTask(projectId);
  const { setFocusedTaskId } = useAppStore();
  const { data: activeSession } = useActiveSession();
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();
  const { data: tagsMap } = useTaskTagsMap(projectId);
  const { data: assigneesMap } = useTaskAssigneesMap(projectId);

  const isActive = activeSession?.task_id === task.id;
  const tags = tagsMap?.get(task.id) ?? [];
  const assignees = assigneesMap?.get(task.id) ?? [];
  const priority = task.priority ? PRIORITY_STYLE[task.priority] : null;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  function toggleTimer(e: React.MouseEvent) {
    e.stopPropagation();
    if (isActive && activeSession) {
      stopTimer.mutate(activeSession.id);
    } else {
      setFocusedTaskId(task.id);
      startTimer.mutate(task.id);
    }
  }

  const dueDateLabel = task.due_date
    ? new Date(task.due_date + "T00:00:00").toLocaleDateString("es", { day: "numeric", month: "short" })
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpenTask(task.id)}
      className={`bg-surface-container-lowest p-4 rounded-md hover:shadow-md transition-shadow group cursor-grab active:cursor-grabbing ${
        isActive ? "border-2 border-primary-container" : "border border-outline-variant/30"
      }`}
    >
      {(priority || tags.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          {priority && (
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
              style={{ backgroundColor: `${priority.color}26`, color: priority.color }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: priority.color }} />
              {priority.label}
            </span>
          )}
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={toggleTimer}
            className={`shrink-0 mt-0.5 text-xs rounded-full w-5 h-5 flex items-center justify-center ${
              isActive ? "bg-primary text-on-primary" : "text-outline hover:text-primary"
            }`}
            aria-label={isActive ? "Pausar timer" : "Iniciar timer"}
          >
            {isActive ? "❙❙" : "▶"}
          </button>
          <h4 className="font-medium text-on-surface leading-snug text-sm">{task.title}</h4>
        </div>
        <button
          type="button"
          className="text-outline opacity-0 group-hover:opacity-100 transition-opacity text-xs shrink-0"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            deleteTask.mutate(task.id);
          }}
          aria-label="Eliminar tarea"
        >
          ✕
        </button>
      </div>

      {(dueDateLabel || assignees.length > 0) && (
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-outline-variant/10">
          <span className="text-[11px] text-on-surface-variant">{dueDateLabel ?? ""}</span>
          {assignees.length > 0 && (
            <div className="flex -space-x-1.5">
              {assignees.slice(0, 3).map((a) => (
                <span
                  key={a.id}
                  title={a.display_name}
                  className="w-5 h-5 rounded-full border-2 border-surface-container-lowest bg-secondary-container text-on-surface flex items-center justify-center text-[9px] font-bold"
                >
                  {a.display_name.slice(0, 1).toUpperCase()}
                </span>
              ))}
              {assignees.length > 3 && (
                <span className="w-5 h-5 rounded-full border-2 border-surface-container-lowest bg-surface-container-high text-on-surface-variant flex items-center justify-center text-[9px] font-bold">
                  +{assignees.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
