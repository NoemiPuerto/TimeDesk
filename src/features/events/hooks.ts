import { useMemo } from "react";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { fromDateKey } from "../analytics/utils";
import * as api from "./api";
import { expandEvents, type EventOccurrence } from "./recurrence";

/**
 * Ocurrencias de eventos entre dos días (claves locales `YYYY-MM-DD`), ya
 * expandidas y ordenadas.
 *
 * Son dos consultas y no una: las repetidas hay que traerlas SIN filtro de
 * fecha (su fila base puede ser de hace años y aun así tener ocurrencia esta
 * semana), mientras que las sueltas sí se acotan en SQL para no arrastrar todo
 * el histórico. La de repetidas comparte clave entre quien la pida, así que
 * varias vistas a la vez no la repiten.
 */
export function useEventOccurrences(fromKey: string, toKey: string): {
  occurrences: EventOccurrence[];
  isLoading: boolean;
} {
  // El día final entra entero: hasta las 23:59:59.999 de su medianoche local.
  const fromIso = fromDateKey(fromKey).toISOString();
  const toIso = new Date(fromDateKey(toKey).getTime() + 86_400_000 - 1).toISOString();

  const results = useQueries({
    queries: [
      {
        queryKey: ["events", "range", fromKey, toKey],
        queryFn: () => api.listEventsInRange(fromIso, toIso),
      },
      {
        queryKey: ["events", "recurring"],
        queryFn: api.listRecurringEvents,
      },
    ],
  });

  const [single, recurring] = results;

  const occurrences = useMemo(
    () => expandEvents([...(single.data ?? []), ...(recurring.data ?? [])], fromKey, toKey),
    [single.data, recurring.data, fromKey, toKey],
  );

  return { occurrences, isLoading: single.isLoading || recurring.isLoading };
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createEvent,
    // El formulario muestra el error junto al campo.
    meta: { suppressToast: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["events"] }),
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => api.deleteEvent(eventId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["events"] }),
  });
}
