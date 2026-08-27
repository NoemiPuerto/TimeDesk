import { useMemo, useState } from "react";
import { CheckCircleIcon, ClockIcon, SearchIcon } from "../../components/icons";
import { startOfWeek, toDateKey } from "../analytics/utils";
import { useProjectSessions } from "../timer/hooks";
import { formatDuration } from "../timer/utils";
import type { Task } from "./api";
import { useColumns, useReorderTasks, useTasks } from "./hooks";

/** Etiqueta relativa de la semana: "Esta semana", "Semana pasada", o la fecha. */
function weekLabel(weekStart: Date, now: Date): string {
  const currentWeek = startOfWeek(now);
  const diffWeeks = Math.round((currentWeek.getTime() - weekStart.getTime()) / (7 * 24 * 3600 * 1000));
  if (diffWeeks === 0) return "Esta semana";
  if (diffWeeks === 1) return "Semana pasada";
  return `Semana del ${weekStart.toLocaleDateString("es", { day: "numeric", month: "long" })}`;
}

export function HistoryView({
  projectId,
  onOpenTask,
}: {
  projectId: string;
  onOpenTask: (taskId: string) => void;
}) {
  const { data: tasks } = useTasks(projectId);
  const { data: columns } = useColumns(projectId);
  const { data: sessions } = useProjectSessions(projectId);
  const reorderTasks = useReorderTasks(projectId);
  const [search, setSearch] = useState("");

  const now = Date.now();

  const secondsByTask = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sessions ?? []) {
      const start = new Date(s.started_at).getTime();
      const end = s.ended_at ? new Date(s.ended_at).getTime() : now;
      map.set(s.task_id, (map.get(s.task_id) ?? 0) + Math.max(0, (end - start) / 1000));
    }
    return map;
  }, [sessions, now]);

  const completed = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (tasks ?? [])
      .filter((t): t is Task & { completed_at: string } => !!t.completed_at)
      .filter((t) => (query ? t.title.toLowerCase().includes(query) : true))
      .sort((a, b) => b.completed_at.localeCompare(a.completed_at));
  }, [tasks, search]);

  /** Agrupadas por semana de terminación, de la más reciente a la más vieja. */
  const groups = useMemo(() => {
    const byWeek = new Map<string, { start: Date; tasks: (Task & { completed_at: string })[] }>();
    for (const task of completed) {
      const start = startOfWeek(new Date(task.completed_at));
      const key = toDateKey(start);
      const group = byWeek.get(key) ?? { start, tasks: [] };
      group.tasks.push(task);
      byWeek.set(key, group);
    }
    return Array.from(byWeek.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [completed]);

  const firstColumn = columns?.[0] ?? null;

  function handleReopen(task: Task) {
    if (!firstColumn || !tasks) return;
    // Vuelve al final de la primera columna; el trigger de la base limpia
    // completed_at al salir de Done, así que desaparece del historial sola.
    const targetPositions = tasks.filter((t) => t.column_id === firstColumn.id).map((t) => t.position);
    const nextPosition = targetPositions.length > 0 ? Math.max(...targetPositions) + 1 : 0;
    reorderTasks.mutate([{ id: task.id, column_id: firstColumn.id, position: nextPosition }]);
  }

  const totalCompleted = (tasks ?? []).filter((t) => t.completed_at).length;

  if (totalCompleted === 0) {
    return (
      <p className="text-on-surface-variant text-sm">
        Todavía no terminaste ninguna tarea en este proyecto. Cuando muevas una a la última columna del tablero,
        aparecerá aquí con su fecha y el tiempo que le dedicaste.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-on-surface-variant">
          <span className="text-on-surface font-bold">{totalCompleted}</span> tarea(s) terminadas
        </p>
        <label className="relative flex items-center max-w-full">
          <SearchIcon className="w-4 h-4 absolute left-3 text-on-surface-variant pointer-events-none" />
          <span className="sr-only">Buscar en el historial</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar en el historial..."
            className="bg-surface-container-lowest border border-outline-variant/30 rounded-md pl-9 pr-3 py-2 text-sm w-64 max-w-full focus:outline-none focus:ring-2 focus:ring-primary-container"
          />
        </label>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-on-surface-variant">Ninguna tarea terminada coincide con esa búsqueda.</p>
      ) : (
        groups.map(([key, group]) => (
          <section key={key} className="flex flex-col gap-2 min-w-0">
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              {weekLabel(group.start, new Date(now))}
              <span className="ml-2 text-on-surface-variant/60 normal-case tracking-normal font-normal">
                {group.tasks.length}
              </span>
            </h3>
            <ul className="flex flex-col divide-y divide-outline-variant/20 bg-surface-container rounded-lg overflow-hidden">
              {group.tasks.map((task) => {
                const seconds = secondsByTask.get(task.id) ?? 0;
                return (
                  <li key={task.id} className="flex items-center gap-3 px-3 sm:px-4 py-3 min-w-0">
                    <CheckCircleIcon className="w-4 h-4 text-primary shrink-0" />
                    <button
                      type="button"
                      onClick={() => onOpenTask(task.id)}
                      className="flex-1 min-w-0 text-left hover:underline"
                    >
                      <span className="block text-sm text-on-surface truncate">{task.title}</span>
                      <span className="block text-xs text-on-surface-variant">
                        {new Date(task.completed_at).toLocaleDateString("es", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </button>
                    {seconds > 0 && (
                      <span className="hidden sm:flex items-center gap-1.5 text-xs text-on-surface-variant tabular-nums shrink-0">
                        <ClockIcon className="w-3.5 h-3.5" />
                        {formatDuration(Math.round(seconds))}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleReopen(task)}
                      disabled={!firstColumn}
                      className="text-xs text-on-surface-variant hover:text-primary shrink-0 disabled:opacity-40"
                    >
                      Reabrir
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
