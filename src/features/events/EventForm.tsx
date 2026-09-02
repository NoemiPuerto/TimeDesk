import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Avatar } from "../../components/Avatar";
import { toDateKey } from "../analytics/utils";
import { useAuth } from "../auth/AuthProvider";
import { useMyTeams, useTeamMembers } from "../teams/hooks";
import type { Recurrence } from "./api";
import { useCreateEvent } from "./hooks";
import { RECURRENCE_LABEL } from "./recurrence";

const FIELD_CLASS =
  "w-full bg-surface-container-lowest border border-outline-variant/30 rounded-md px-3 py-2.5 text-sm text-on-surface placeholder-outline/60 focus:outline-none focus:ring-2 focus:ring-primary-container";

const CATEGORIES = ["Junta", "Entrega", "Fecha límite", "Cumpleaños", "Aniversario", "Festivo", "Recordatorio"];

const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240];

const RECURRENCES: Recurrence[] = ["none", "weekly", "monthly", "yearly"];

function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours} h` : `${Math.floor(hours)} h ${minutes % 60} min`;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-on-surface-variant/70">{hint}</span>}
    </label>
  );
}

/**
 * Alta de evento en un diálogo centrado.
 *
 * Antes vivía dentro de la columna del Dashboard, que es estrecha: la fecha, la
 * hora y la duración no cabían en una línea y los invitados se amontonaban.
 * Aquí hay sitio para agruparlo por temas y para lo que se añadió después
 * —categoría y repetición— sin que el panel crezca.
 */
export function EventForm({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const { data: teams } = useMyTeams();
  const createEvent = useCreateEvent();

  const [teamId, setTeamId] = useState(teams?.[0]?.id ?? "");
  const effectiveTeamId = teams?.some((t) => t.id === teamId) ? teamId : (teams?.[0]?.id ?? "");
  const { data: members } = useTeamMembers(effectiveTeamId || null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(toDateKey(new Date()));
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState(30);
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [attendees, setAttendees] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onDone();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onDone]);

  // Al cambiar de equipo, los invitados elegidos ya no pertenecen a él: la RPC
  // rechazaría a cualquiera de fuera, así que se limpian antes de que falle.
  useEffect(() => setAttendees([]), [effectiveTeamId]);

  // Uno mismo entra siempre, así que no se ofrece como invitado.
  const invitables = (members ?? []).filter((m) => m.user_id !== user?.id);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!effectiveTeamId) {
      setError("Necesitas pertenecer a un equipo para crear eventos.");
      return;
    }

    // La fecha y la hora se combinan en local: `new Date(y, m, d, hh, mm)`
    // interpreta en la zona de quien lo crea, no en UTC.
    const [year, month, day] = date.split("-").map(Number);
    const [hours, minutes] = time.split(":").map(Number);
    const startsAt = new Date(year, month - 1, day, hours, minutes, 0, 0);

    try {
      await createEvent.mutateAsync({
        teamId: effectiveTeamId,
        title: title.trim(),
        startsAt: startsAt.toISOString(),
        durationMinutes: duration,
        attendeeIds: attendees,
        category: category.trim() || null,
        recurrence,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el evento.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xl max-h-full overflow-y-auto bg-surface-container-low border border-outline-variant/25 rounded-lg flex flex-col"
      >
        <header className="flex items-start justify-between gap-4 px-6 py-5 border-b border-outline-variant/20">
          <div>
            <h3 className="text-lg font-bold text-on-surface">Nuevo evento</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Una junta, una entrega, un cumpleaños: cualquier fecha que el equipo deba tener a la vista.
            </p>
          </div>
          <button
            type="button"
            onClick={onDone}
            aria-label="Cerrar"
            className="w-8 h-8 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container flex items-center justify-center shrink-0 transition-colors"
          >
            ✕
          </button>
        </header>

        <div className="px-6 py-5 flex flex-col gap-5">
          <Field label="Título">
            <input
              autoFocus
              className={FIELD_CLASS}
              placeholder="Revisión de sprint"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Categoría" hint="Texto libre; las sugerencias son solo un atajo.">
              <input
                list="event-categories"
                className={FIELD_CLASS}
                placeholder="Junta, Entrega, Cumpleaños..."
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
              <datalist id="event-categories">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>

            {(teams ?? []).length > 1 && (
              <Field label="Equipo">
                <select className={FIELD_CLASS} value={effectiveTeamId} onChange={(e) => setTeamId(e.target.value)}>
                  {(teams ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-5 border-t border-outline-variant/20">
            <Field label="Fecha">
              <input
                type="date"
                className={FIELD_CLASS}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </Field>
            <Field label="Hora">
              <input
                type="time"
                className={FIELD_CLASS}
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </Field>
            <Field label="Duración">
              <select className={FIELD_CLASS} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                {DURATIONS.map((m) => (
                  <option key={m} value={m}>
                    {durationLabel(m)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field
            label="Repetición"
            hint={
              recurrence === "none"
                ? undefined
                : "Se guarda como una sola serie: cambiar la fecha mueve todas las apariciones."
            }
          >
            <div className="flex flex-wrap gap-1.5">
              {RECURRENCES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRecurrence(r)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    recurrence === r
                      ? "bg-primary-container text-on-primary border-primary-container"
                      : "border-outline-variant/40 text-on-surface-variant hover:border-primary"
                  }`}
                >
                  {RECURRENCE_LABEL[r]}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Invitados">
            {invitables.length === 0 ? (
              <p className="text-xs text-on-surface-variant/70">
                No hay más miembros en este equipo todavía. El evento se creará solo para ti.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {invitables.map((m) => {
                  const selected = attendees.includes(m.user_id);
                  return (
                    <button
                      key={m.user_id}
                      type="button"
                      onClick={() =>
                        setAttendees((prev) =>
                          selected ? prev.filter((id) => id !== m.user_id) : [...prev, m.user_id],
                        )
                      }
                      className={`flex items-center gap-1.5 pl-1 pr-3 py-1 rounded-full text-xs border transition-colors ${
                        selected
                          ? "bg-primary-container text-on-primary border-primary-container"
                          : "border-outline-variant/40 text-on-surface-variant hover:border-primary"
                      }`}
                    >
                      <Avatar
                        url={m.profile.avatar_url}
                        name={m.profile.display_name}
                        size="w-5 h-5"
                        textSize="text-[9px]"
                      />
                      {m.profile.display_name}
                    </button>
                  );
                })}
              </div>
            )}
          </Field>

          {error && <p className="text-error text-xs">{error}</p>}
        </div>

        <footer className="flex justify-end gap-2 px-6 py-4 border-t border-outline-variant/20">
          <button type="button" onClick={onDone} className="text-sm text-on-surface-variant px-4 py-2">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!title.trim() || createEvent.isPending}
            className="text-sm bg-primary-container text-on-primary px-5 py-2 rounded-full font-medium hover:bg-primary transition-colors disabled:opacity-50"
          >
            {createEvent.isPending ? "Creando..." : "Crear evento"}
          </button>
        </footer>
      </form>
    </div>
  );
}
