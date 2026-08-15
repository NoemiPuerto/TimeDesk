import { useMemo } from "react";
import type { Task } from "./api";
import { applyTaskFilters, DEFAULT_TASK_FILTERS, type TaskFilters } from "./filters";
import { useTasks } from "./hooks";

const PRIORITY_COLOR: Record<string, string> = { high: "#eb3619", medium: "#f59e0b", low: "#a3a3a3" };
const TIMELINE_DAYS = 14;

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function TaskTimelineView({
  projectId,
  onOpenTask,
  filters = DEFAULT_TASK_FILTERS,
}: {
  projectId: string;
  onOpenTask: (taskId: string) => void;
  filters?: TaskFilters;
}) {
  const { data: rawTasks, isLoading } = useTasks(projectId);
  const tasks = useMemo(() => applyTaskFilters(rawTasks ?? [], filters), [rawTasks, filters]);

  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: TIMELINE_DAYS }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks ?? []) {
      if (!task.due_date) continue;
      const list = map.get(task.due_date) ?? [];
      list.push(task);
      map.set(task.due_date, list);
    }
    return map;
  }, [tasks]);

  if (isLoading) {
    return <p className="text-on-surface-variant text-sm p-8">Cargando timeline...</p>;
  }

  const noDateTasks = (tasks ?? []).filter((t) => !t.due_date);
  const todayKey = dateKey(new Date());

  return (
    <div className="flex items-start gap-4 overflow-x-auto pb-4">
      <TimelineColumn title="Sin fecha" tasks={noDateTasks} onOpenTask={onOpenTask} />
      {days.map((d) => {
        const key = dateKey(d);
        return (
          <TimelineColumn
            key={key}
            title={d.toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short" })}
            tasks={tasksByDay.get(key) ?? []}
            onOpenTask={onOpenTask}
            isToday={key === todayKey}
          />
        );
      })}
    </div>
  );
}

function TimelineColumn({
  title,
  tasks,
  onOpenTask,
  isToday,
}: {
  title: string;
  tasks: Task[];
  onOpenTask: (taskId: string) => void;
  isToday?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-2 w-48 shrink-0 rounded-md p-2 ${isToday ? "bg-primary-container/10" : ""}`}>
      <h4 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1 truncate">{title}</h4>
      <div className="flex flex-col gap-2 min-h-[40px]">
        {tasks.map((task) => (
          <button
            key={task.id}
            type="button"
            onClick={() => onOpenTask(task.id)}
            className="text-left bg-surface-container-lowest border border-outline-variant/30 rounded-md p-2 hover:shadow-md transition-shadow"
          >
            {task.priority && (
              <span
                className="w-1.5 h-1.5 rounded-full inline-block mr-1.5"
                style={{ backgroundColor: PRIORITY_COLOR[task.priority] }}
              />
            )}
            <span className="text-xs text-on-surface">{task.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
