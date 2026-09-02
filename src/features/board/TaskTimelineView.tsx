import { useMemo, useState, type ReactNode } from "react";
import { Avatar } from "../../components/Avatar";
import { CheckCircleIcon, ChevronLeftIcon, ChevronRightIcon } from "../../components/icons";
import { fromDateKey, toDateKey } from "../analytics/utils";
import { applyTaskFilters, DEFAULT_TASK_FILTERS, type TaskFilters } from "./filters";
import {
  ganttBar,
  ganttTicks,
  ganttWindow,
  GANTT_SCALES,
  barStyle,
  nowOffset,
  sortSpans,
  taskSpan,
  type GanttBar,
  type GanttScaleKey,
} from "./gantt";
import { useTaskAssigneesMap, useTasks, useTaskTagsMap } from "./hooks";
import type { Assignee } from "./assignees";
import type { Tag } from "./tags";

const ROW_HEIGHT = 36;
const ROW_GAP = 8;
/** Por debajo de esto no cabe el título dentro de la barra y se escribe al lado. */
const MIN_WIDTH_FOR_LABEL = 104;
const MIN_WIDTH_FOR_META = 176;

function dayLabel(key: string): string {
  return fromDateKey(key).toLocaleDateString("es", { day: "numeric", month: "short" });
}

function rangeLabel(startKey: string, endKey: string): string {
  const start = fromDateKey(startKey);
  const end = fromDateKey(endKey);
  const sameYear = start.getFullYear() === end.getFullYear();
  const startText = start.toLocaleDateString("es", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
  const endText = end.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
  return `${startText} – ${endText}`;
}

/**
 * Gantt de solo lectura: cada tarea es una barra de `start_date` a su fecha
 * límite —o a la de cierre, si ya está terminada— sobre un eje de días, con la
 * línea de "ahora" marcando por dónde va el proyecto. Sigue sin ser un Gantt
 * editable: no se arrastra para reprogramar, las fechas se cambian en el
 * detalle de la tarea igual que en Board y List.
 */
export function TaskTimelineView({
  projectId,
  onOpenTask,
  filters = DEFAULT_TASK_FILTERS,
}: {
  projectId: string;
  onOpenTask: (taskId: string) => void;
  filters?: TaskFilters;
}) {
  const [scaleKey, setScaleKey] = useState<GanttScaleKey>("month");
  const [offsetDays, setOffsetDays] = useState(0);

  const { data: rawTasks, isLoading } = useTasks(projectId);
  const { data: assigneesByTask } = useTaskAssigneesMap(projectId);
  const { data: tagsByTask } = useTaskTagsMap(projectId);

  const tasks = useMemo(
    () => applyTaskFilters(rawTasks ?? [], filters, { assigneesByTask, tagsByTask }),
    [rawTasks, filters, assigneesByTask, tagsByTask],
  );

  const scale = GANTT_SCALES.find((s) => s.key === scaleKey) ?? GANTT_SCALES[1];
  const now = new Date();
  const todayKey = toDateKey(now);
  const chart = useMemo(() => ganttWindow(scale, offsetDays, todayKey), [scale, offsetDays, todayKey]);
  const ticks = useMemo(() => ganttTicks(chart, scale, todayKey), [chart, scale, todayKey]);
  const nowX = nowOffset(chart, scale, now);

  // Desde que `tasks.start_date` existe toda tarea tiene tramo, así que ya no
  // hay lista aparte de "sin fecha": lo que falta es el FINAL, y eso lo dice la
  // propia barra con el borde derecho difuminado.
  const { bars, outOfRange } = useMemo(() => {
    const spans = tasks.map((task) => taskSpan(task, todayKey));

    const bars: GanttBar[] = [];
    let outOfRange = 0;
    for (const span of sortSpans(spans)) {
      const bar = ganttBar(span, chart, scale);
      if (bar) bars.push(bar);
      else outOfRange++;
    }
    return { bars, outOfRange };
  }, [tasks, chart, scale, todayKey]);

  if (isLoading) {
    return <p className="text-on-surface-variant text-sm p-8">Cargando timeline...</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg bg-surface-container-lowest border border-outline-variant/20 p-4">
        <header className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-semibold text-on-surface">Plan de trabajo</h3>
            <p className="text-xs text-on-surface-variant">
              {rangeLabel(chart.startKey, chart.endKey)} · {bars.length}{" "}
              {bars.length === 1 ? "tarea" : "tareas"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={scaleKey}
              onChange={(e) => {
                setScaleKey(e.target.value as GanttScaleKey);
                setOffsetDays(0);
              }}
              aria-label="Rango del timeline"
              className="bg-surface-container-low border border-outline-variant/30 rounded-sm px-2 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
            >
              {GANTT_SCALES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>

            <div className="flex items-center rounded-sm border border-outline-variant/30 overflow-hidden">
              <NavButton label="Rango anterior" onClick={() => setOffsetDays((v) => v - Math.floor(scale.days / 2))}>
                <ChevronLeftIcon className="w-4 h-4" />
              </NavButton>
              <button
                type="button"
                onClick={() => setOffsetDays(0)}
                className={`px-3 py-1.5 text-sm border-x border-outline-variant/30 transition-colors ${
                  offsetDays === 0
                    ? "text-on-surface-variant"
                    : "text-primary hover:bg-surface-container-high font-medium"
                }`}
              >
                Hoy
              </button>
              <NavButton label="Rango siguiente" onClick={() => setOffsetDays((v) => v + Math.floor(scale.days / 2))}>
                <ChevronRightIcon className="w-4 h-4" />
              </NavButton>
            </div>
          </div>
        </header>

        {bars.length === 0 ? (
          <p className="text-sm text-on-surface-variant py-8 text-center">
            No hay tareas en este rango.
            {outOfRange > 0 && " Prueba a ampliar el rango o a moverte con las flechas."}
          </p>
        ) : (
          <div className="overflow-x-auto pb-2">
            <div className="relative" style={{ width: chart.width, minWidth: "100%" }}>
              {/* Eje de días */}
              <div className="relative h-7 border-b border-outline-variant/20">
                {ticks.map((tick) => {
                  // La marca de hoy se calla: la píldora "Ahora" ocupa ese
                  // mismo punto del eje y las dos se pisarían. En rangos
                  // largos ninguna marca cae justo en hoy, y la píldora sigue
                  // siendo la única referencia — por eso no depende de ella.
                  if (tick.isToday && nowX !== null) return null;
                  return (
                    <span
                      key={tick.key}
                      className={`absolute top-0 text-[11px] whitespace-nowrap -translate-x-1/2 ${
                        tick.isWeekend ? "text-outline" : "text-on-surface-variant"
                      }`}
                      style={{ left: tick.x }}
                    >
                      {tick.label}
                    </span>
                  );
                })}
              </div>

              {/* Rejilla + barras */}
              <div className="relative pt-4">
                <div className="absolute inset-0 pointer-events-none">
                  {ticks.map((tick) => (
                    <span
                      key={tick.key}
                      className={`absolute top-0 bottom-0 w-px ${
                        tick.isWeekend ? "bg-outline-variant/25" : "bg-outline-variant/10"
                      }`}
                      style={{ left: tick.x }}
                    />
                  ))}
                </div>

                <div className="relative" style={{ height: bars.length * (ROW_HEIGHT + ROW_GAP) }}>
                  {bars.map((bar, index) => (
                    <GanttRow
                      key={bar.span.task.id}
                      bar={bar}
                      top={index * (ROW_HEIGHT + ROW_GAP)}
                      windowWidth={chart.width}
                      todayKey={todayKey}
                      tags={tagsByTask?.get(bar.span.task.id) ?? []}
                      assignees={assigneesByTask?.get(bar.span.task.id) ?? []}
                      onOpenTask={onOpenTask}
                    />
                  ))}
                </div>
              </div>

              {/* Línea de "ahora": va por encima de todo y cruza eje y barras. */}
              {nowX !== null && (
                <>
                  <div
                    className="absolute top-6 bottom-0 w-px bg-primary pointer-events-none"
                    style={{ left: nowX }}
                  />
                  <span
                    className="absolute top-0 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-primary text-on-primary text-[10px] font-bold leading-none pointer-events-none"
                    style={{ left: nowX }}
                  >
                    Ahora
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {bars.length > 0 && (
          <p className="text-xs text-on-surface-variant mt-3">
            El borde derecho difuminado marca las tareas sin fecha límite: la barra llega hasta hoy.
            {outOfRange > 0 &&
              ` ${outOfRange} ${outOfRange === 1 ? "tarea queda" : "tareas quedan"} fuera del rango visible.`}
          </p>
        )}
      </div>

    </div>
  );
}

function NavButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="px-2 py-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
    >
      {children}
    </button>
  );
}

function GanttRow({
  bar,
  top,
  windowWidth,
  todayKey,
  tags,
  assignees,
  onOpenTask,
}: {
  bar: GanttBar;
  top: number;
  windowWidth: number;
  todayKey: string;
  tags: Tag[];
  assignees: Assignee[];
  onOpenTask: (taskId: string) => void;
}) {
  const { task, days, startKey, endKey, openEnded } = bar.span;
  const style = barStyle(task, tags, todayKey);
  // Sin fecha límite el final no es una fecha, es "hasta hoy": se difumina en
  // vez de cortar en seco, que se leería como un plazo que nadie ha puesto.
  const background =
    openEnded && !bar.clippedEnd
      ? `linear-gradient(to right, ${style.background} 65%, transparent)`
      : style.background;

  const fitsLabel = bar.width >= MIN_WIDTH_FOR_LABEL;
  const fitsMeta = bar.width >= MIN_WIDTH_FOR_META;
  // Con la barra pegada al borde derecho no queda sitio para la etiqueta de
  // fuera, así que se escribe a la izquierda.
  const labelOnLeft = !fitsLabel && bar.x + bar.width + 150 > windowWidth;

  // Sin fecha límite, anunciar "8 días" sería inventarse un plazo: el tramo
  // solo llega hasta hoy porque hoy es lo último que se sabe.
  const tooltip = openEnded
    ? `${task.title}\nEmpezó el ${dayLabel(startKey)} · sin fecha límite`
    : `${task.title}\n${rangeLabel(startKey, endKey)} · ${days} ${days === 1 ? "día" : "días"}`;

  return (
    <div className="absolute left-0 right-0" style={{ top, height: ROW_HEIGHT }}>
      <button
        type="button"
        onClick={() => onOpenTask(task.id)}
        title={tooltip}
        className={`absolute top-0 flex items-center gap-2 px-3 h-full text-left transition-transform hover:-translate-y-px ${
          bar.clippedStart ? "rounded-l-none" : "rounded-l-md"
        } ${bar.clippedEnd ? "rounded-r-none" : "rounded-r-md"} ${style.muted ? "opacity-70" : ""}`}
        style={{ left: bar.x, width: bar.width, background, color: style.color }}
      >
        {task.completed_at && fitsLabel && <CheckCircleIcon className="w-3.5 h-3.5 shrink-0 opacity-80" />}
        {fitsLabel && <span className="text-xs font-medium truncate">{task.title}</span>}
        {fitsMeta && (
          <span className="ml-auto flex items-center gap-1.5 shrink-0">
            {assignees.slice(0, 2).map((a) => (
              <Avatar key={a.id} url={a.avatar_url} name={a.display_name} size="w-5 h-5" textSize="text-[9px]" />
            ))}
            {!openEnded && (
              <span className="px-1.5 py-0.5 rounded-sm bg-black/30 text-[10px] font-semibold whitespace-nowrap">
                {days} d
              </span>
            )}
          </span>
        )}
      </button>

      {!fitsLabel && (
        <span
          className="absolute top-0 h-full flex items-center text-xs text-on-surface-variant whitespace-nowrap pointer-events-none"
          style={
            labelOnLeft
              ? { right: windowWidth - bar.x + 8, maxWidth: bar.x - 8 }
              : { left: bar.x + bar.width + 8 }
          }
        >
          <span className="truncate">{task.title}</span>
        </span>
      )}
    </div>
  );
}
