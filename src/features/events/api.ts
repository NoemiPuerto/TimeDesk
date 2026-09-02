import { supabase } from "../../lib/supabase";

export type Recurrence = "none" | "weekly" | "monthly" | "yearly";

export type EventAttendee = {
  user_id: string;
  profile: { display_name: string; avatar_url: string | null };
};

export type CalendarEvent = {
  id: string;
  team_id: string;
  created_by: string;
  title: string;
  starts_at: string;
  duration_minutes: number;
  category: string | null;
  recurrence: Recurrence;
  attendees: EventAttendee[];
};

const EVENT_SELECT =
  "id, team_id, created_by, title, starts_at, duration_minutes, category, recurrence," +
  " attendees:event_attendees(user_id, profile:profiles(display_name, avatar_url))";

/**
 * Eventos NO repetidos que caen en una ventana concreta.
 *
 * No filtra por usuario a mano: la política SELECT de `events` ya solo entrega
 * aquellos donde soy invitado u organizador.
 */
export async function listEventsInRange(fromIso: string, toIso: string): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .eq("recurrence", "none")
    .gte("starts_at", fromIso)
    .lte("starts_at", toIso)
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return data as unknown as CalendarEvent[];
}

/**
 * TODOS los eventos repetidos, sin filtrar por fecha.
 *
 * Tiene que ser sin filtro: un cumpleaños con fecha base de hace tres años
 * sigue teniendo ocurrencia este mes, y un `gte(starts_at)` lo dejaría fuera.
 * Son pocas filas —una por serie, no una por ocurrencia—, así que traerlas
 * todas sale más barato que intentar acotarlas en SQL.
 */
export async function listRecurringEvents(): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .neq("recurrence", "none")
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return data as unknown as CalendarEvent[];
}

export async function createEvent(input: {
  teamId: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
  attendeeIds: string[];
  category: string | null;
  recurrence: Recurrence;
}): Promise<CalendarEvent> {
  // INSERT por RPC — ver la nota de CLAUDE.md sobre tablas con foreign keys.
  const { data, error } = await supabase.rpc("create_event", {
    p_team_id: input.teamId,
    p_title: input.title,
    p_starts_at: input.startsAt,
    p_duration_minutes: input.durationMinutes,
    p_attendee_ids: input.attendeeIds,
    p_category: input.category ?? undefined,
    p_recurrence: input.recurrence,
  });
  if (error) throw new Error(error.message);
  return data as unknown as CalendarEvent;
}

/**
 * Solo quien lo creó puede borrarlo; lo impone la política de DELETE.
 *
 * Borra la SERIE entera, no una ocurrencia suelta: no hay tabla de excepciones,
 * así que cancelar "el cumpleaños de este año" no es algo que se pueda
 * representar todavía.
 */
export async function deleteEvent(eventId: string): Promise<void> {
  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) throw error;
}
