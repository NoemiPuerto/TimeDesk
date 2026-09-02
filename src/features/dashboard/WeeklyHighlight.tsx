export type HighlightTask = { id: string; title: string; projectName: string };

/**
 * Bloque destacado del Dashboard: lo que cerraste esta semana, en tarjetas.
 *
 * Cada tarjeta lleva la etiqueta del proyecto al que pertenece, porque el
 * bloque cruza todos los proyectos a la vez y el título de una tarea suelto no
 * dice de dónde sale.
 */
export function WeeklyHighlight({
  userName,
  tasks,
  onOpenTask,
  onOpenStats,
}: {
  userName?: string;
  tasks: HighlightTask[];
  onOpenTask: (taskId: string) => void;
  onOpenStats: () => void;
}) {
  return (
    <section className="rounded-lg bg-primary-container/10 border border-primary/20 p-5 sm:p-6 flex flex-col xl:flex-row gap-6">
      <div className="xl:w-[38%] shrink-0 flex flex-col justify-center gap-4">
        <div>
          {userName && <p className="text-sm text-on-surface-variant">Hola, {userName}</p>}
          <h2 className="text-2xl sm:text-3xl font-black text-on-surface leading-tight mt-1">
            {tasks.length === 0
              ? "Aún no has terminado tareas esta semana"
              : `Completaste ${tasks.length} tarea${tasks.length === 1 ? "" : "s"} esta semana`}
          </h2>
        </div>
        <button
          type="button"
          onClick={onOpenStats}
          className="self-start flex items-center gap-2 rounded-full bg-primary-container text-on-primary text-sm font-medium px-5 py-2.5 hover:bg-primary transition-colors"
        >
          Ver estadísticas
          <span aria-hidden>↗</span>
        </button>
      </div>

      {tasks.length > 0 && (
        <div className="flex-1 min-w-0 flex gap-3 overflow-x-auto pb-1">
          {tasks.slice(0, 8).map((task, index) => {
            // Se alternan rellenas y planas, como en la referencia, sin salirse
            // de la paleta: primario y superficie.
            const filled = index % 2 === 1;
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => onOpenTask(task.id)}
                className={`w-40 shrink-0 rounded-lg p-4 flex flex-col justify-between gap-6 text-left transition-transform hover:-translate-y-0.5 ${
                  filled
                    ? "bg-primary-container text-on-primary"
                    : "bg-surface-container-lowest text-on-surface border border-outline-variant/25"
                }`}
              >
                <span className={`text-xs font-bold ${filled ? "opacity-70" : "text-on-surface-variant"}`}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="flex flex-col gap-2 min-w-0">
                  <span className="text-sm font-bold leading-snug line-clamp-3">{task.title}</span>
                  <span
                    className={`self-start px-2 py-0.5 rounded-full text-[10px] font-medium truncate max-w-full ${
                      filled ? "bg-on-primary/20 text-on-primary" : "bg-surface-container-high text-on-surface-variant"
                    }`}
                  >
                    {task.projectName}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
