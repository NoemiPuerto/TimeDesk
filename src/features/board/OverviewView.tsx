import { useMemo } from "react";
import { startOfWeek, toDateKey, totalHours } from "../analytics/utils";
import { useProjectSessions } from "../timer/hooks";
import { useColumns, useSubtaskCounts, useTasks } from "./hooks";

const PRIORITY_META: { key: "high" | "medium" | "low"; label: string; color: string }[] = [
  { key: "high", label: "Alta", color: "#eb3619" },
  { key: "medium", label: "Media", color: "#f59e0b" },
  { key: "low", label: "Baja", color: "#a3a3a3" },
];

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-container rounded-lg p-5 flex flex-col gap-1">
      <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{label}</span>
      <span className="text-3xl font-bold text-on-surface">{value}</span>
    </div>
  );
}

export function OverviewView({
  projectId,
  onOpenTask,
  onShowHistory,
}: {
  projectId: string;
  onOpenTask: (taskId: string) => void;
  onShowHistory?: () => void;
}) {
  const { data: columns } = useColumns(projectId);
  const { data: tasks } = useTasks(projectId);
  const { data: subtaskCounts } = useSubtaskCounts(projectId);
  const { data: sessions } = useProjectSessions(projectId);
  const now = Date.now();

  const totalTasks = tasks?.length ?? 0;
  const projectHours = sessions ? totalHours(sessions, now) : 0;

  const byColumn = useMemo(() => {
    if (!columns || !tasks) return [];
    return columns.map((c) => ({ column: c, count: tasks.filter((t) => t.column_id === c.id).length }));
  }, [columns, tasks]);

  const byPriority = useMemo(() => {
    const counts: Record<string, number> = { high: 0, medium: 0, low: 0, none: 0 };
    for (const t of tasks ?? []) {
      counts[t.priority ?? "none"] += 1;
    }
    return counts;
  }, [tasks]);

  const upcoming = useMemo(() => {
    return (tasks ?? [])
      .filter((t): t is typeof t & { due_date: string } => !!t.due_date)
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .slice(0, 6);
  }, [tasks]);

  const subtaskTotals = useMemo(() => {
    let done = 0;
    let total = 0;
    for (const v of subtaskCounts?.values() ?? []) {
      done += v.done;
      total += v.total;
    }
    return { done, total };
  }, [subtaskCounts]);

  const todayKey = toDateKey(new Date());

  const completed = useMemo(() => {
    const weekStart = startOfWeek(new Date()).getTime();
    const done = (tasks ?? []).filter((t) => !!t.completed_at);
    return {
      total: done.length,
      thisWeek: done.filter((t) => new Date(t.completed_at!).getTime() >= weekStart).length,
      recent: [...done].sort((a, b) => b.completed_at!.localeCompare(a.completed_at!)).slice(0, 5),
    };
  }, [tasks]);

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Tareas totales" value={String(totalTasks)} />
        <StatTile label="Horas registradas" value={`${projectHours.toFixed(1)}h`} />
        <StatTile label="Subtareas" value={subtaskTotals.total > 0 ? `${subtaskTotals.done}/${subtaskTotals.total}` : "—"} />
        <StatTile label="Terminadas esta semana" value={String(completed.thisWeek)} />
      </div>

      {byColumn.length > 0 && (
        <div className="bg-surface-container rounded-lg p-6 flex flex-col gap-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">
            Progreso por columna
          </h3>
          {byColumn.map(({ column, count }) => (
            <div key={column.id} className="flex items-center gap-3">
              <span className="text-sm text-on-surface w-32 truncate shrink-0">{column.name}</span>
              <div className="flex-1 h-2 rounded-full bg-surface-container-highest overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: totalTasks > 0 ? `${(count / totalTasks) * 100}%` : "0%" }}
                />
              </div>
              <span className="text-xs text-on-surface-variant w-6 text-right shrink-0">{count}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
        <div className="bg-surface-container rounded-lg p-6 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">
              Terminadas recientemente
            </h3>
            {onShowHistory && completed.total > 0 && (
              <button type="button" onClick={onShowHistory} className="text-xs text-primary hover:underline shrink-0">
                Ver History
              </button>
            )}
          </div>
          {completed.recent.length === 0 ? (
            <p className="text-xs text-on-surface-variant">Todavía no terminaste ninguna tarea.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {completed.recent.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => onOpenTask(t.id)}
                    className="w-full flex items-center justify-between gap-2 text-left hover:bg-surface-container-high rounded-sm px-2 py-1.5 -mx-2 transition-colors"
                  >
                    <span className="text-sm text-on-surface-variant line-through truncate">{t.title}</span>
                    <span className="text-xs text-on-surface-variant shrink-0">
                      {new Date(t.completed_at!).toLocaleDateString("es", { day: "numeric", month: "short" })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {completed.total > completed.recent.length && (
            <p className="text-xs text-on-surface-variant/70">
              {completed.total} terminadas en total.
            </p>
          )}
        </div>

        <div className="bg-surface-container rounded-lg p-6 flex flex-col gap-3">
          <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">Prioridad</h3>
          {PRIORITY_META.map((p) => (
            <div key={p.key} className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
              <span className="text-on-surface flex-1">{p.label}</span>
              <span className="text-on-surface-variant">{byPriority[p.key]}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full shrink-0 bg-outline" />
            <span className="text-on-surface flex-1">Sin prioridad</span>
            <span className="text-on-surface-variant">{byPriority.none}</span>
          </div>
        </div>

        <div className="bg-surface-container rounded-lg p-6 flex flex-col gap-3">
          <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">
            Próximas fechas límite
          </h3>
          {upcoming.length === 0 ? (
            <p className="text-xs text-on-surface-variant">No hay tareas con fecha límite.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {upcoming.map((t) => {
                const isOverdue = t.due_date < todayKey;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => onOpenTask(t.id)}
                      className="w-full flex items-center justify-between gap-2 text-left hover:bg-surface-container-high rounded-sm px-2 py-1.5 -mx-2 transition-colors"
                    >
                      <span className="text-sm text-on-surface truncate">{t.title}</span>
                      <span className={`text-xs shrink-0 ${isOverdue ? "text-error" : "text-on-surface-variant"}`}>
                        {new Date(t.due_date + "T00:00:00").toLocaleDateString("es", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
