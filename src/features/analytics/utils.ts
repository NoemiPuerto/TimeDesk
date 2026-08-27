import type { TimeSession } from "../timer/api";

export type BucketHours = { key: string; label: string; sublabel?: string; hours: number };
/** @deprecated nombre viejo; se mantiene para no romper importaciones existentes. */
export type DailyHours = BucketHours;
export type TaskHours = { taskId: string; title: string; hours: number };

/**
 * Clave de día en hora LOCAL (YYYY-MM-DD).
 *
 * Ojo: `toISOString().slice(0, 10)` es la trampa que había antes. Convierte a
 * UTC, así que en UTC-6 una sesión de las 20:00 del lunes caía en el martes, y
 * las etiquetas de los días quedaban corridas un día respecto de las barras.
 * Todo el agrupamiento de este archivo es local a propósito.
 */
export function toDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Medianoche local del día de `key` (nunca UTC — ver toDateKey). */
export function fromDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Semana que empieza el lunes, en hora local. */
export function startOfWeek(d: Date): Date {
  const copy = startOfDay(d);
  copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7));
  return copy;
}

export function startOfMonth(d: Date): Date {
  const copy = startOfDay(d);
  copy.setDate(1);
  return copy;
}

function sessionRange(session: TimeSession, now: number): { start: number; end: number } {
  const start = new Date(session.started_at).getTime();
  const end = session.ended_at ? new Date(session.ended_at).getTime() : now;
  return { start, end: Math.max(start, end) };
}

function sessionHours(session: TimeSession, now: number): number {
  const { start, end } = sessionRange(session, now);
  return (end - start) / 1000 / 3600;
}

/**
 * Horas de la sesión que caen DENTRO de [from, to).
 *
 * Antes cada sesión se contaba entera en el período donde empezó. Una que
 * cruzaba la medianoche (o el fin de semana, o el fin de mes) le sumaba a un
 * día horas que se trabajaron en otro, y la suma de las barras no coincidía con
 * lo que la persona recordaba haber hecho ese día. Ahora se reparte por
 * solapamiento real: la suma de todos los períodos da exactamente el total.
 */
function overlapHours(session: TimeSession, from: number, to: number, now: number): number {
  const { start, end } = sessionRange(session, now);
  const overlap = Math.min(end, to) - Math.max(start, from);
  return overlap > 0 ? overlap / 1000 / 3600 : 0;
}

function round2(hours: number): number {
  return Math.round(hours * 100) / 100;
}

export function totalHours(sessions: TimeSession[], now: number): number {
  return sessions.reduce((sum, s) => sum + sessionHours(s, now), 0);
}

/** Horas trabajadas dentro de [from, to), repartiendo las sesiones que lo cruzan. */
export function hoursBetween(sessions: TimeSession[], from: Date, to: Date, now: number): number {
  const fromMs = from.getTime();
  const toMs = to.getTime();
  return sessions.reduce((sum, s) => sum + overlapHours(s, fromMs, toMs, now), 0);
}

/**
 * Reparte las sesiones en cubetas consecutivas por solapamiento real, así una
 * sesión que cruza la medianoche le suma a cada día lo que le corresponde.
 */
function bucketize(
  sessions: TimeSession[],
  now: number,
  buckets: { key: string; start: Date; end: Date; label: string; sublabel?: string }[],
): BucketHours[] {
  return buckets.map((b) => {
    const from = b.start.getTime();
    const to = b.end.getTime();
    const hours = sessions.reduce((sum, s) => sum + overlapHours(s, from, to, now), 0);
    return { key: b.key, label: b.label, sublabel: b.sublabel, hours: round2(hours) };
  });
}

export function hoursByDay(sessions: TimeSession[], days: number, now: number): BucketHours[] {
  const buckets = [];
  for (let i = days - 1; i >= 0; i--) {
    const start = startOfDay(new Date(now));
    start.setDate(start.getDate() - i);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    buckets.push({
      key: toDateKey(start),
      start,
      end,
      // El día del mes es único dentro de la ventana; el nombre del día se
      // repetiría cada 7 barras y no sirve para identificar una en concreto.
      label: String(start.getDate()),
      sublabel: start.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" }),
    });
  }
  return bucketize(sessions, now, buckets);
}

export function hoursByWeek(sessions: TimeSession[], weeks: number, now: number): BucketHours[] {
  const buckets = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = startOfWeek(new Date(now));
    start.setDate(start.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    buckets.push({
      key: toDateKey(start),
      start,
      end,
      label: start.toLocaleDateString("es", { day: "numeric", month: "short" }),
      sublabel: `Semana del ${start.toLocaleDateString("es", { day: "numeric", month: "long" })}`,
    });
  }
  return bucketize(sessions, now, buckets);
}

export function hoursByMonth(sessions: TimeSession[], months: number, now: number): BucketHours[] {
  const buckets = [];
  for (let i = months - 1; i >= 0; i--) {
    const start = startOfMonth(new Date(now));
    start.setMonth(start.getMonth() - i);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    buckets.push({
      key: toDateKey(start),
      start,
      end,
      label: start.toLocaleDateString("es", { month: "short" }),
      sublabel: start.toLocaleDateString("es", { month: "long", year: "numeric" }),
    });
  }
  return bucketize(sessions, now, buckets);
}

export function hoursByTask(
  sessions: TimeSession[],
  taskTitles: Map<string, string>,
  now: number,
  limit = 6,
): TaskHours[] {
  const buckets = new Map<string, number>();
  for (const session of sessions) {
    buckets.set(session.task_id, (buckets.get(session.task_id) ?? 0) + sessionHours(session, now));
  }
  return Array.from(buckets.entries())
    .map(([taskId, hours]) => ({
      taskId,
      title: taskTitles.get(taskId) ?? "Tarea eliminada",
      hours: round2(hours),
    }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, limit);
}

export type SessionSummary = {
  total: number;
  today: number;
  thisWeek: number;
  lastWeek: number;
  thisMonth: number;
  /** Días distintos con al menos una sesión. */
  activeDays: number;
  /** Promedio sobre los días trabajados, no sobre el calendario. */
  avgPerActiveDay: number;
  bestDay: { key: string; hours: number } | null;
  longestSession: number;
};

/**
 * Un resumen por persona.
 *
 * Solo puede devolver a alguien más que quien consulta si la base se lo
 * permitió: la política SELECT de `time_sessions` no entrega sesiones ajenas de
 * un proyecto con equipo salvo al admin de ese equipo. Acá no hay ningún filtro
 * de permisos — si la fila llegó, es porque se podía ver.
 */
export function summarizeByUser(sessions: TimeSession[], now: number): Map<string, SessionSummary> {
  const byUser = new Map<string, TimeSession[]>();
  for (const session of sessions) {
    const list = byUser.get(session.user_id) ?? [];
    list.push(session);
    byUser.set(session.user_id, list);
  }

  const result = new Map<string, SessionSummary>();
  for (const [userId, list] of byUser) {
    result.set(userId, summarize(list, now));
  }
  return result;
}

export function summarize(sessions: TimeSession[], now: number): SessionSummary {
  const today = startOfDay(new Date(now));
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const weekStart = startOfWeek(new Date(now));
  const nextWeek = new Date(weekStart);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const previousWeek = new Date(weekStart);
  previousWeek.setDate(previousWeek.getDate() - 7);

  const monthStart = startOfMonth(new Date(now));
  const nextMonth = new Date(monthStart);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  // Mismo criterio que las barras: cada sesión le suma a cada día lo que
  // realmente ocurrió en ese día, así "días trabajados" y "mejor día" no
  // contradicen al gráfico.
  const perDay = new Map<string, number>();
  let longestSession = 0;
  for (const session of sessions) {
    const { start, end } = sessionRange(session, now);
    longestSession = Math.max(longestSession, (end - start) / 1000 / 3600);

    const cursor = startOfDay(new Date(start));
    // Tope de seguridad: una sesión que quedó abierta mucho tiempo no debe
    // poder colgar el render con un bucle de miles de días.
    for (let guard = 0; cursor.getTime() < end && guard < 400; guard++) {
      const dayEnd = new Date(cursor);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const hours = overlapHours(session, cursor.getTime(), dayEnd.getTime(), now);
      if (hours > 0) {
        const key = toDateKey(cursor);
        perDay.set(key, (perDay.get(key) ?? 0) + hours);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  let bestDay: { key: string; hours: number } | null = null;
  for (const [key, hours] of perDay) {
    if (!bestDay || hours > bestDay.hours) bestDay = { key, hours };
  }

  const activeDays = perDay.size;
  const total = totalHours(sessions, now);

  return {
    total,
    today: hoursBetween(sessions, today, tomorrow, now),
    thisWeek: hoursBetween(sessions, weekStart, nextWeek, now),
    lastWeek: hoursBetween(sessions, previousWeek, weekStart, now),
    thisMonth: hoursBetween(sessions, monthStart, nextMonth, now),
    activeDays,
    avgPerActiveDay: activeDays > 0 ? total / activeDays : 0,
    bestDay,
    longestSession,
  };
}
