import type { TimeSession } from "./api";

export function sessionSeconds(session: TimeSession, now: number): number {
  const start = new Date(session.started_at).getTime();
  const end = session.ended_at ? new Date(session.ended_at).getTime() : now;
  return Math.max(0, Math.floor((end - start) / 1000));
}

export function totalSeconds(sessions: TimeSession[], now: number): number {
  return sessions.reduce((sum, s) => sum + sessionSeconds(s, now), 0);
}

export function formatDuration(totalSecondsValue: number): string {
  const hours = Math.floor(totalSecondsValue / 3600);
  const minutes = Math.floor((totalSecondsValue % 3600) / 60);
  const seconds = Math.floor(totalSecondsValue % 60);
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, "0")).join(":");
}
