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

function sessionHours(session: TimeSession, now: number): number {
  const start = new Date(session.started_at).getTime();
  const end = session.ended_at ? new Date(session.ended_at).getTime() : now;
  return Math.max(0, (end - start) / 1000 / 3600);
}

function round2(hours: number): number {
  return Math.round(hours * 100) / 100;
}

export function totalHours(sessions: TimeSession[], now: number): number {
  return sessions.reduce((sum, s) => sum + sessionHours(s, now), 0);
}

/** Horas de las sesiones que EMPEZARON dentro de [from, to). */
export function hoursBetween(sessions: TimeSession[], from: Date, to: Date, now: number): number {
  const fromMs = from.getTime();
  const toMs = to.getTime();
  return sessions.reduce((sum, s) => {
    const started = new Date(s.started_at).getTime();
    return started >= fromMs && started < toMs ? sum + sessionHours(s, now) : sum;
  }, 0);
}

/**
 * Reparte las sesiones en cubetas consecutivas. Una sesión cuenta entera en el
 * período donde EMPEZÓ; una que cruza la medianoche no se parte (simplificación
 * a propósito: partirla complicaría todo para un caso poco frecuente en una app
 * de time tracking personal).
 */
function bucketize(
  sessions: TimeSession[],
  now: number,
  buckets: { key: string; start: Date; end: Date; label: string; sublabel?: string }[],
): BucketHours[] {
  const totals = new Map(buckets.map((b) => [b.key, 0]));

  for (const session of sessions) {
    const started = new Date(session.started_at).getTime();
    const bucket = buckets.find((b) => started >= b.start.getTime() && started < b.end.getTime());
    if (!bucket) continue;
    totals.set(bucket.key, (totals.get(bucket.key) ?? 0) + sessionHours(session, now));
  }

  return buckets.map((b) => ({
    key: b.key,
    label: b.label,
    sublabel: b.sublabel,
    hours: round2(totals.get(b.key) ?? 0),
  }));
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
      label: start.toLocaleDateString("es", { weekday: "short" }),
      sublabel: start.toLocaleDateString("es", { day: "numeric", month: "short" }),
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

  const perDay = new Map<string, number>();
  let longestSession = 0;
  for (const session of sessions) {
    const hours = sessionHours(session, now);
    longestSession = Math.max(longestSession, hours);
    const key = toDateKey(new Date(session.started_at));
    perDay.set(key, (perDay.get(key) ?? 0) + hours);
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
