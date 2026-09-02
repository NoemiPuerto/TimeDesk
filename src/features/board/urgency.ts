import { toDateKey } from "../analytics/utils";
import type { Priority, Task } from "./api";

/** Días que abarca el tablero del Timer: hoy más los 6 siguientes. */
export const TIMER_WINDOW_DAYS = 7;

export type DueState = "overdue" | "today" | "upcoming" | "none";

/**
 * Ventana del Timer en claves de fecha LOCAL (YYYY-MM-DD).
 *
 * `due_date` es una columna `date`, sin hora ni zona, así que se compara contra
 * claves locales y nunca contra un instante UTC — convertir aquí es lo que
 * desplazaría un día en husos negativos. La aritmética de `setDate` normaliza
 * sola el cambio de mes y de año: domingo 30 de agosto + 6 = 5 de septiembre,
 * y 28 de diciembre + 6 = 3 de enero.
 */
export function timerWindow(now: Date = new Date()): { todayKey: string; endKey: string; todayStart: Date } {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const end = new Date(todayStart);
  end.setDate(end.getDate() + (TIMER_WINDOW_DAYS - 1));

  return { todayKey: toDateKey(todayStart), endKey: toDateKey(end), todayStart };
}

/** Las claves ISO se comparan bien como texto: mismo largo y de mayor a menor peso. */
export function dueState(dueDate: string | null, todayKey: string): DueState {
  if (!dueDate) return "none";
  if (dueDate < todayKey) return "overdue";
  if (dueDate === todayKey) return "today";
  return "upcoming";
}

const DUE_RANK: Record<DueState, number> = { overdue: 0, today: 1, upcoming: 2, none: 3 };
const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

function priorityRank(priority: Priority | null): number {
  return priority ? PRIORITY_RANK[priority] : 3;
}

/**
 * Orden del tablero del Timer: lo que aprieta, arriba.
 *
 * 1. Vencidas   2. Vencen hoy   3. Próximas (por fecha)   4. Sin fecha
 *
 * La urgencia manda sobre la prioridad declarada: una tarea "baja" que vence
 * hoy pide atención antes que una "alta" que vence dentro de cinco días. La
 * prioridad desempata dentro del mismo día, y `position` desempata al final
 * para que el orden sea estable entre renders.
 */
export function compareByUrgency(a: Task, b: Task, todayKey: string): number {
  const rankDiff = DUE_RANK[dueState(a.due_date, todayKey)] - DUE_RANK[dueState(b.due_date, todayKey)];
  if (rankDiff !== 0) return rankDiff;

  // Dentro de "próximas", la que vence antes va primero. Las vencidas se
  // ordenan igual: la más atrasada arriba.
  if (a.due_date && b.due_date && a.due_date !== b.due_date) {
    return a.due_date < b.due_date ? -1 : 1;
  }

  const priorityDiff = priorityRank(a.priority) - priorityRank(b.priority);
  if (priorityDiff !== 0) return priorityDiff;

  return a.position - b.position;
}

export function sortByUrgency(tasks: Task[], todayKey: string): Task[] {
  return [...tasks].sort((a, b) => compareByUrgency(a, b, todayKey));
}
