import type { TimeSession } from "../timer/api";

export type DailyHours = { dateKey: string; label: string; hours: number };
export type TaskHours = { taskId: string; title: string; hours: number };

function sessionHours(session: TimeSession, now: number): number {
  const start = new Date(session.started_at).getTime();
  const end = session.ended_at ? new Date(session.ended_at).getTime() : now;
  return Math.max(0, (end - start) / 1000 / 3600);
}

export function totalHours(sessions: TimeSession[], now: number): number {
  return sessions.reduce((sum, s) => sum + sessionHours(s, now), 0);
}

export function hoursByDay(sessions: TimeSession[], days: number, now: number): DailyHours[] {
  const buckets = new Map<string, number>();
  const order: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, 0);
    order.push(key);
  }

  for (const session of sessions) {
    const key = new Date(session.started_at).toISOString().slice(0, 10);
    if (!buckets.has(key)) continue;
    buckets.set(key, (buckets.get(key) ?? 0) + sessionHours(session, now));
  }

  return order.map((key) => ({
    dateKey: key,
    label: new Date(key).toLocaleDateString("es", { weekday: "short" }),
    hours: Math.round(buckets.get(key)! * 100) / 100,
  }));
}

export function hoursByTask(
  sessions: TimeSession[],
  taskTitles: Map<string, string>,
  now: number,
): TaskHours[] {
  const buckets = new Map<string, number>();
  for (const session of sessions) {
    buckets.set(session.task_id, (buckets.get(session.task_id) ?? 0) + sessionHours(session, now));
  }
  return Array.from(buckets.entries())
    .map(([taskId, hours]) => ({
      taskId,
      title: taskTitles.get(taskId) ?? "Tarea eliminada",
      hours: Math.round(hours * 100) / 100,
    }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 6);
}
