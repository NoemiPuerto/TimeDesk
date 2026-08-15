import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Avatar } from "../../components/Avatar";
import {
  CalendarIcon,
  CheckCircleIcon,
  MessageCircleIcon,
  PaperclipIcon,
  PauseIcon,
  PlayIcon,
  TrashIcon,
} from "../../components/icons";
import { useAppStore } from "../../store/useAppStore";
import { useActiveSession, useStartTimer, useStopTimer } from "../timer/hooks";
import type { Task } from "./api";
import {
  useAttachmentCounts,
  useCommentCounts,
  useDeleteTask,
  useSubtaskCounts,
  useTaskAssigneesMap,
  useTaskTagsMap,
} from "./hooks";

const PRIORITY_STYLE: Record<string, { label: string; color: string }> = {
  high: { label: "Alta", color: "#eb3619" },
  medium: { label: "Media", color: "#f59e0b" },
  low: { label: "Baja", color: "#a3a3a3" },
};

export function TaskCard({
  task,
  projectId,
  isDone,
  dragDisabled = false,
  onOpenTask,
}: {
  task: Task;
  projectId: string;
  isDone: boolean;
  dragDisabled?: boolean;
  onOpenTask: (taskId: string) => void;
}) {
  const deleteTask = useDeleteTask(projectId);
  const { setFocusedTaskId } = useAppStore();
  const { data: activeSession } = useActiveSession();
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();
  const { data: tagsMap } = useTaskTagsMap(projectId);
  const { data: assigneesMap } = useTaskAssigneesMap(projectId);
  const { data: commentCounts } = useCommentCounts(projectId);
  const { data: subtaskCounts } = useSubtaskCounts(projectId);
  const { data: attachmentCounts } = useAttachmentCounts(projectId);

  const isActive = activeSession?.task_id === task.id;
  const tags = tagsMap?.get(task.id) ?? [];
  const assignees = assigneesMap?.get(task.id) ?? [];
  const commentCount = commentCounts?.get(task.id) ?? 0;
  const subtasks = subtaskCounts?.get(task.id);
  const attachmentCount = attachmentCounts?.get(task.id) ?? 0;
  const priority = task.priority ? PRIORITY_STYLE[task.priority] : null;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", task },
    disabled: dragDisabled,
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
      className={`relative p-4 rounded-md transition-shadow group ${
        dragDisabled ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"
      } ${
        isDone
          ? "bg-surface-container-lowest/60 border border-outline-variant/15 opacity-70"
          : isActive
            ? "bg-surface-container-lowest border-2 border-primary-container hover:shadow-md"
            : "bg-surface-container-lowest border border-outline-variant/30 hover:shadow-md"
      }`}
    >
      <div className="absolute top-3 right-3 z-10">
        {isDone ? (
          <span
            className="w-6 h-6 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant"
            title="Completada"
          >
            <CheckCircleIcon className="w-3.5 h-3.5" />
          </span>
        ) : (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={toggleTimer}
            className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
              isActive
                ? "bg-primary text-on-primary"
                : "bg-surface-container-high text-on-surface-variant hover:text-primary"
            }`}
            aria-label={isActive ? "Pausar timer" : "Iniciar timer"}
          >
            {isActive ? <PauseIcon className="w-2.5 h-2.5" /> : <PlayIcon className="w-2.5 h-2.5 ml-0.5" />}
          </button>
        )}
      </div>

      {(priority || tags.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2 pr-8">
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

      <h4
        className={`pr-8 font-medium leading-snug text-sm ${
          isDone ? "text-on-surface-variant line-through decoration-outline" : "text-on-surface"
        }`}
      >
        {task.title}
      </h4>

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-outline-variant/10">
        <span className="flex items-center gap-2.5 text-[11px] text-on-surface-variant">
          {dueDateLabel && (
            <span className="flex items-center gap-1">
              <CalendarIcon className="w-3 h-3" />
              {dueDateLabel}
            </span>
          )}
          {commentCount > 0 && (
            <span className="flex items-center gap-1">
              <MessageCircleIcon className="w-3 h-3" />
              {commentCount}
            </span>
          )}
          {subtasks && subtasks.total > 0 && (
            <span className="flex items-center gap-1">
              <CheckCircleIcon className="w-3 h-3" />
              {subtasks.done}/{subtasks.total}
            </span>
          )}
          {attachmentCount > 0 && (
            <span className="flex items-center gap-1">
              <PaperclipIcon className="w-3 h-3" />
              {attachmentCount}
            </span>
          )}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {assignees.length > 0 && (
            <div className="flex -space-x-1.5">
              {assignees.slice(0, 3).map((a) => (
                <span key={a.id} title={a.display_name} className="border-2 border-surface-container-lowest rounded-full">
                  <Avatar url={a.avatar_url} name={a.display_name} size="w-5 h-5" textSize="text-[9px]" />
                </span>
              ))}
              {assignees.length > 3 && (
                <span className="w-5 h-5 rounded-full border-2 border-surface-container-lowest bg-surface-container-high text-on-surface-variant flex items-center justify-center text-[9px] font-bold">
                  +{assignees.length - 3}
                </span>
              )}
            </div>
          )}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              deleteTask.mutate(task.id);
            }}
            aria-label="Eliminar tarea"
            className="text-outline opacity-0 group-hover:opacity-100 hover:text-error transition-opacity"
          >
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
