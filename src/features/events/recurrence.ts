import { fromDateKey, toDateKey } from "../analytics/utils";
import type { CalendarEvent, Recurrence } from "./api";

/**
 * Expansión de eventos repetidos.
 *
 * Un evento que se repite es UNA fila con su regla, no una fila por ocurrencia:
 * un cumpleaños son 1 fila y no 20, y mover la fecha no obliga a rehacer la
 * serie. Lo que se pinta son las ocurrencias que caen en la ventana visible, y
 * eso se calcula aquí — sin JSX, porque es lo único de esta pantalla que puede
 * dar fechas mal y así se puede comprobar aparte.
 *
 * Todo va en hora LOCAL (`new Date(y, m, d, ...)`), nunca por UTC: `starts_at`
 * es un instante, pero "el 12 de marzo a las 10:00" tiene que seguir cayendo el
 * 12 de marzo a las 10:00 aunque cambie el horario de verano.
 */

export type EventOccurrence = {
  event: CalendarEvent;
  /** Instante concreto de ESTA ocurrencia (la base para las no repetidas). */
  startsAt: Date;
  dateKey: string;
  /** Única por ocurrencia: la fila sola no basta como key de React. */
  key: string;
  /** Falso en la primera aparición de la serie; cierto en las repeticiones. */
  isRepeat: boolean;
};

/** Tope de seguridad: una ventana enorme no puede colgar el render. */
const MAX_OCCURRENCES = 400;

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  none: "No se repite",
  weekly: "Cada semana",
  monthly: "Cada mes",
  yearly: "Cada año",
};

/** Etiqueta corta para la tarjeta del evento; `null` cuando no se repite. */
export function recurrenceBadge(recurrence: Recurrence): string | null {
  return recurrence === "none" ? null : RECURRENCE_LABEL[recurrence];
}

/**
 * Ocurrencias de un evento dentro de [fromKey, toKey], ambos incluidos.
 *
 * Las repeticiones nunca se generan ANTES de la fecha base: un evento que
 * empieza en marzo no aparece en enero aunque la ventana llegue hasta ahí.
 *
 * Casos que se saltan a propósito, en vez de moverlos a otro día:
 *  - mensual día 31 en un mes de 30 → ese mes no tiene ocurrencia;
 *  - anual 29 de febrero en año no bisiesto → ese año no tiene ocurrencia.
 * Recolocarlos al día 28 o al 1 sería inventarse una fecha que nadie eligió.
 */
export function expandEvent(event: CalendarEvent, fromKey: string, toKey: string): EventOccurrence[] {
  const base = new Date(event.starts_at);
  const baseKey = toDateKey(base);
  const occurrences: EventOccurrence[] = [];

  const push = (date: Date, isRepeat: boolean) => {
    const key = toDateKey(date);
    if (key < fromKey || key > toKey) return;
    occurrences.push({ event, startsAt: date, dateKey: key, key: `${event.id}:${key}`, isRepeat });
  };

  if (event.recurrence === "none") {
    push(base, false);
    return occurrences;
  }

  const from = fromDateKey(fromKey);
  const to = fromDateKey(toKey);
  const hours = base.getHours();
  const minutes = base.getMinutes();

  if (event.recurrence === "weekly") {
    // Se salta de golpe hasta la ventana en vez de iterar semana a semana desde
    // la fecha base, que con un evento de hace años serían miles de vueltas.
    const dayMs = 86_400_000;
    const weeksBehind = Math.max(0, Math.floor((from.getTime() - base.getTime()) / (7 * dayMs)));
    const cursor = new Date(base);
    cursor.setDate(cursor.getDate() + weeksBehind * 7);

    for (let i = 0; i < MAX_OCCURRENCES && cursor.getTime() <= to.getTime() + dayMs; i++) {
      if (cursor.getTime() >= base.getTime()) push(new Date(cursor), toDateKey(cursor) !== baseKey);
      cursor.setDate(cursor.getDate() + 7);
    }
    return occurrences;
  }

  const dayOfMonth = base.getDate();

  if (event.recurrence === "monthly") {
    const startMonth = Math.max(
      0,
      (from.getFullYear() - base.getFullYear()) * 12 + (from.getMonth() - base.getMonth()),
    );
    for (let i = 0; i < MAX_OCCURRENCES; i++) {
      const monthIndex = base.getMonth() + startMonth + i;
      const year = base.getFullYear() + Math.floor(monthIndex / 12);
      const month = ((monthIndex % 12) + 12) % 12;
      if (new Date(year, month, 1).getTime() > to.getTime()) break;

      // `new Date(2026, 1, 31)` se desbordaría a marzo: se comprueba antes.
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      if (dayOfMonth > daysInMonth) continue;

      const date = new Date(year, month, dayOfMonth, hours, minutes);
      if (date.getTime() >= base.getTime()) push(date, toDateKey(date) !== baseKey);
    }
    return occurrences;
  }

  // Anual.
  for (let year = Math.max(base.getFullYear(), from.getFullYear()); year <= to.getFullYear(); year++) {
    const month = base.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    if (dayOfMonth > daysInMonth) continue; // 29 de febrero en año no bisiesto

    const date = new Date(year, month, dayOfMonth, hours, minutes);
    if (date.getTime() >= base.getTime()) push(date, toDateKey(date) !== baseKey);
  }
  return occurrences;
}

/** Todas las ocurrencias de la ventana, en orden cronológico. */
export function expandEvents(events: CalendarEvent[], fromKey: string, toKey: string): EventOccurrence[] {
  return events
    .flatMap((event) => expandEvent(event, fromKey, toKey))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/**
 * Deja una sola ocurrencia por serie: la primera de la ventana.
 *
 * Sin esto, un evento semanal llena la lista de "próximos" con trece tarjetas
 * idénticas y entierra todo lo demás. La lista responde a "qué es lo siguiente"
 * y el calendario a "qué hay este mes": cada uno enseña lo suyo.
 *
 * Asume la entrada ya ordenada, que es lo que devuelve `expandEvents`.
 */
export function nextPerSeries(occurrences: EventOccurrence[]): EventOccurrence[] {
  const seen = new Set<string>();
  return occurrences.filter((occurrence) => {
    if (seen.has(occurrence.event.id)) return false;
    seen.add(occurrence.event.id);
    return true;
  });
}

/** Ocurrencias agrupadas por día, para pintar una lista con encabezados. */
export function groupByDay(occurrences: EventOccurrence[]): [string, EventOccurrence[]][] {
  const groups = new Map<string, EventOccurrence[]>();
  for (const occurrence of occurrences) {
    const list = groups.get(occurrence.dateKey) ?? [];
    list.push(occurrence);
    groups.set(occurrence.dateKey, list);
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}
