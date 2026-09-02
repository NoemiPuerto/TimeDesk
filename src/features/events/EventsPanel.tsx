import { useState } from "react";
import { Avatar } from "../../components/Avatar";
import { CalendarIcon, PlusIcon } from "../../components/icons";
import { toDateKey } from "../analytics/utils";
import { useAuth } from "../auth/AuthProvider";
import { useMyTeams } from "../teams/hooks";
import { EventForm } from "./EventForm";
import { useDeleteEvent, useEventOccurrences } from "./hooks";
import { groupByDay, nextPerSeries, recurrenceBadge, type EventOccurrence } from "./recurrence";

/** Ventana de la lista de próximos: lo bastante larga para ver lo que viene. */
const UPCOMING_DAYS = 90;

/** "Hoy", "Mañana" o la fecha, según lo cerca que esté. */
export function dayLabel(dateKey: string): string {
  const todayKey = toDateKey(new Date());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (dateKey === todayKey) return "Hoy";
  if (dateKey === toDateKey(tomorrow)) return "Mañana";
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function timeRange(occurrence: EventOccurrence): string {
  const start = occurrence.startsAt;
  const end = new Date(start.getTime() + occurrence.event.duration_minutes * 60000);
  const fmt = (d: Date) => d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function EventCard({ occurrence }: { occurrence: EventOccurrence }) {
  const { user } = useAuth();
  const deleteEvent = useDeleteEvent();
  const { event } = occurrence;
  const badge = recurrenceBadge(event.recurrence);

  return (
    <div className="bg-surface-container rounded-lg p-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-on-surface truncate">{event.title}</p>
          <p className="text-xs text-on-surface-variant">{timeRange(occurrence)}</p>
        </div>
        {event.created_by === user?.id && (
          <button
            type="button"
            onClick={() => {
              // Se borra la serie entera: no hay excepciones por ocurrencia, y
              // callárselo dejaría a alguien creyendo que quitó solo esta.
              const warning = badge
                ? `¿Eliminar "${event.title}"? Se quita la serie completa, no solo esta fecha.`
                : `¿Eliminar "${event.title}"? Desaparecerá de la agenda de los invitados.`;
              if (confirm(warning)) deleteEvent.mutate(event.id);
            }}
            className="text-[10px] text-on-surface-variant hover:text-error shrink-0"
          >
            Eliminar
          </button>
        )}
      </div>

      {(event.category || badge) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {event.category && (
            <span className="px-2 py-0.5 rounded-full border border-outline-variant/40 text-on-surface-variant text-[10px] font-medium">
              {event.category}
            </span>
          )}
          {badge && (
            <span className="px-2 py-0.5 rounded-full bg-primary-container/20 text-primary text-[10px] font-medium">
              {badge}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center -space-x-1.5">
        {event.attendees.map((a) => (
          <div key={a.user_id} title={a.profile.display_name} className="border-2 border-surface-container rounded-full">
            <Avatar url={a.profile.avatar_url} name={a.profile.display_name} size="w-6 h-6" textSize="text-[9px]" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Agenda de eventos del usuario.
 *
 * Cualquier miembro del equipo puede crearlos, no solo los admin. La lista sale
 * de lo que la RLS deja ver, que es exactamente donde eres organizador o
 * invitado. Las series repetidas ya vienen expandidas en ocurrencias.
 */
export function EventsPanel() {
  const { data: teams } = useMyTeams();
  const [creating, setCreating] = useState(false);

  const todayKey = toDateKey(new Date());
  const end = new Date();
  end.setDate(end.getDate() + UPCOMING_DAYS);
  const { occurrences } = useEventOccurrences(todayKey, toDateKey(end));

  // Solo la próxima aparición de cada serie: ver `nextPerSeries`.
  const byDay = groupByDay(nextPerSeries(occurrences));
  const hasTeams = (teams ?? []).length > 0;

  return (
    <div className="flex flex-col gap-3">
      {creating && <EventForm onDone={() => setCreating(false)} />}

      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-widest text-on-surface-variant">
          <CalendarIcon className="w-3.5 h-3.5" />
          Eventos
        </h3>
        {hasTeams && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            Crear
          </button>
        )}
      </div>

      {!hasTeams ? (
        <p className="text-xs text-on-surface-variant bg-surface-container rounded-lg p-3">
          Los eventos se crean con miembros de un equipo. Cuando pertenezcas a uno, podrás crearlos aquí.
        </p>
      ) : byDay.length === 0 ? (
        <p className="text-xs text-on-surface-variant bg-surface-container rounded-lg p-3">
          No tienes eventos próximos.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {byDay.map(([key, list]) => (
            <div key={key} className="flex flex-col gap-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/70 first-letter:uppercase">
                {dayLabel(key)}
              </p>
              {list.map((occurrence) => (
                <EventCard key={occurrence.key} occurrence={occurrence} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
