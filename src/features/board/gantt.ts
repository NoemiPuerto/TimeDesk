import { fromDateKey, toDateKey } from "../analytics/utils";
import type { Task } from "./api";
import type { Tag } from "./tags";

const MS_PER_DAY = 86_400_000;

export type GanttScaleKey = "weeks" | "month" | "quarter";

export type GanttScale = {
  key: GanttScaleKey;
  label: string;
  /** Días que abarca la ventana visible. */
  days: number;
  /** Ancho de un día en píxeles: fija el ancho total y el scroll horizontal. */
  pxPerDay: number;
  /** Cada cuántos días se dibuja una marca en el eje. */
  tickEvery: number;
};

export const GANTT_SCALES: GanttScale[] = [
  { key: "weeks", label: "2 semanas", days: 14, pxPerDay: 68, tickEvery: 1 },
  { key: "month", label: "1 mes", days: 31, pxPerDay: 34, tickEvery: 2 },
  { key: "quarter", label: "3 meses", days: 91, pxPerDay: 14, tickEvery: 7 },
];

/** Días entre dos claves locales. `Math.round` absorbe las horas que mueve el cambio de horario. */
export function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((fromDateKey(toKey).getTime() - fromDateKey(fromKey).getTime()) / MS_PER_DAY);
}

export function addDays(key: string, days: number): string {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

export type TaskSpan = {
  task: Task;
  startKey: string;
  endKey: string;
  /** Duración inclusiva: una tarea que empieza y acaba el mismo día dura 1 día. */
  days: number;
  /** Sigue abierta y sin fecha límite: el final es "hasta hoy", no una fecha real. */
  openEnded: boolean;
};

/**
 * Tramo de una tarea en el Gantt.
 *
 * Empieza en `start_date` —columna propia desde la migración
 * `task_start_date`, con la fecha de creación como valor inicial— y termina:
 *
 *  - en `completed_at` si ya está terminada: el tramo que realmente llevó;
 *  - en `due_date` si sigue abierta y tiene fecha límite;
 *  - en hoy si no tiene ninguna de las dos (`openEnded`), que se dibuja con el
 *    borde derecho difuminado para no fingir un final que nadie ha puesto.
 *
 * Si el final cae antes del inicio (fecha límite anterior al arranque) el tramo
 * se aplana a un día en lugar de dibujar una barra hacia atrás.
 */
export function taskSpan(task: Task, todayKey: string): TaskSpan {
  const startKey = task.start_date;
  const closedEnd = task.completed_at ? toDateKey(new Date(task.completed_at)) : task.due_date;
  const endSource = closedEnd ?? (todayKey > startKey ? todayKey : startKey);
  const endKey = endSource < startKey ? startKey : endSource;

  return {
    task,
    startKey,
    endKey,
    days: daysBetween(startKey, endKey) + 1,
    openEnded: closedEnd === null,
  };
}

export function sortSpans(spans: TaskSpan[]): TaskSpan[] {
  return [...spans].sort(
    (a, b) =>
      a.startKey.localeCompare(b.startKey) ||
      a.endKey.localeCompare(b.endKey) ||
      a.task.title.localeCompare(b.task.title),
  );
}

export type GanttWindow = { startKey: string; endKey: string; days: number; width: number };

/**
 * Ventana visible. Arranca un cuarto de rango ANTES de hoy para que se vea de
 * dónde viene el trabajo, no solo lo que falta — igual que la referencia, donde
 * la línea de "ahora" no está pegada al borde izquierdo. `offsetDays` es la
 * navegación con las flechas.
 */
export function ganttWindow(scale: GanttScale, offsetDays: number, today: string): GanttWindow {
  const startKey = addDays(today, -Math.floor(scale.days / 4) + offsetDays);
  return {
    startKey,
    endKey: addDays(startKey, scale.days - 1),
    days: scale.days,
    width: scale.days * scale.pxPerDay,
  };
}

export type GanttTick = { key: string; x: number; label: string; isToday: boolean; isWeekend: boolean };

export function ganttTicks(window: GanttWindow, scale: GanttScale, today: string): GanttTick[] {
  const ticks: GanttTick[] = [];
  for (let i = 0; i < window.days; i += scale.tickEvery) {
    const key = addDays(window.startKey, i);
    const date = fromDateKey(key);
    const day = date.getDay();
    ticks.push({
      key,
      x: i * scale.pxPerDay,
      // En rangos largos no cabe el día de la semana; en cortos ayuda a ubicarse.
      label:
        scale.key === "weeks"
          ? date.toLocaleDateString("es", { weekday: "short", day: "numeric" })
          : date.toLocaleDateString("es", { day: "numeric", month: "short" }),
      isToday: key === today,
      isWeekend: day === 0 || day === 6,
    });
  }
  return ticks;
}

export type GanttBar = {
  span: TaskSpan;
  x: number;
  width: number;
  /** El tramo empieza antes / acaba después de la ventana: la barra va cortada. */
  clippedStart: boolean;
  clippedEnd: boolean;
};

/** `null` cuando el tramo queda entero fuera de la ventana. */
export function ganttBar(span: TaskSpan, window: GanttWindow, scale: GanttScale): GanttBar | null {
  const startIndex = daysBetween(window.startKey, span.startKey);
  const endIndex = daysBetween(window.startKey, span.endKey) + 1; // exclusivo
  if (endIndex <= 0 || startIndex >= window.days) return null;

  const visibleStart = Math.max(startIndex, 0);
  const visibleEnd = Math.min(endIndex, window.days);
  return {
    span,
    x: visibleStart * scale.pxPerDay,
    // Una barra de un día en la escala trimestral mediría 14px: el mínimo la
    // mantiene visible y pinchable.
    width: Math.max((visibleEnd - visibleStart) * scale.pxPerDay, 12),
    clippedStart: startIndex < 0,
    clippedEnd: endIndex > window.days,
  };
}

/** Posición en píxeles del instante actual, incluida la fracción del día. */
export function nowOffset(window: GanttWindow, scale: GanttScale, now: Date): number | null {
  const dayIndex = daysBetween(window.startKey, toDateKey(now));
  if (dayIndex < 0 || dayIndex >= window.days) return null;
  const fractionOfDay = (now.getHours() * 60 + now.getMinutes()) / 1440;
  return (dayIndex + fractionOfDay) * scale.pxPerDay;
}

export type BarStyle = { background: string; color: string; muted: boolean };

const PRIORITY_COLOR: Record<string, string> = { high: "#eb3619", medium: "#f59e0b", low: "#a3a3a3" };

/**
 * Color de la barra, por orden de lo que más dice de la tarea:
 * terminada (apagada) → vencida (error) → su primera etiqueta → su prioridad →
 * superficie neutra. Las etiquetas ganan a la prioridad porque son la
 * clasificación que la propia persona creó para este proyecto.
 */
export function barStyle(task: Task, tags: Tag[], todayKey: string): BarStyle {
  if (task.completed_at) return { background: "#292929", color: "#a3a3a3", muted: true };
  if (task.due_date && task.due_date < todayKey) return { background: "#ff5233", color: "#ffffff", muted: false };
  if (tags.length > 0) return { background: tags[0].color, color: "#ffffff", muted: false };
  if (task.priority) return { background: PRIORITY_COLOR[task.priority], color: "#ffffff", muted: false };
  return { background: "#333333", color: "#f5f5f5", muted: false };
}
