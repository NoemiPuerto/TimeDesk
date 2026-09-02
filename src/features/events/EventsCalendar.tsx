import { useMemo, useRef, useState, type MouseEvent } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "../../components/icons";
import { useDismissable } from "../../lib/useDismissable";
import { toDateKey } from "../analytics/utils";
import { EventCard, dayLabel } from "./EventsPanel";
import { useEventOccurrences } from "./hooks";
import type { EventOccurrence } from "./recurrence";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Ancho fijo del panel flotante: hace falta para poder centrarlo y recortarlo. */
const POPOVER_WIDTH = 264;
/** Margen mínimo con los bordes de la tarjeta del calendario. */
const EDGE_GAP = 8;

/**
 * Rejilla del mes: seis semanas completas empezando en lunes.
 *
 * Se devuelven siempre 42 celdas —incluidos los días de los meses vecinos—
 * para que la rejilla no cambie de alto al pasar de mes, que es lo que hace que
 * el calendario "salte" al navegar.
 */
function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  // getDay() cuenta desde el domingo; aquí la semana empieza el lunes.
  const lead = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - lead);
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

/** Día abierto y dónde estaba su celda, para anclar el panel flotante. */
type Anchor = { key: string; centerX: number; bottom: number };

/**
 * Calendario de eventos: un vistazo al mes, no una segunda agenda.
 *
 * Solo pinta eventos —ni tareas ni sesiones de tiempo—: el Timeline y el
 * tablero del Timer ya enseñan las fechas de las tareas, y mezclarlo todo aquí
 * llenaría la rejilla hasta dejar de servir para lo que sirve, que es ver de un
 * golpe qué días del mes tienen algo.
 *
 * Al pulsar un día, sus eventos salen en un panel flotante anclado a esa celda,
 * no en una lista debajo: así la rejilla no se mueve al abrir y cerrar, y se ve
 * de qué día se está hablando sin tener que leer el encabezado.
 */
export function EventsCalendar() {
  const today = new Date();
  const todayKey = toDateKey(today);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  // El ref envuelve la tarjeta ENTERA —rejilla y panel—, o el mismo click que
  // abre contaría como "click fuera" y lo cerraría al instante.
  const cardRef = useDismissable(anchor !== null, () => setAnchor(null));
  const gridRef = useRef<HTMLDivElement>(null);

  const days = useMemo(() => monthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor]);

  // La ventana es la rejilla entera, no el mes: así los días visibles del mes
  // anterior y el siguiente también muestran su punto.
  const { occurrences } = useEventOccurrences(toDateKey(days[0]), toDateKey(days[41]));

  const byDay = useMemo(() => {
    const map = new Map<string, EventOccurrence[]>();
    for (const occurrence of occurrences) {
      const list = map.get(occurrence.dateKey) ?? [];
      list.push(occurrence);
      map.set(occurrence.dateKey, list);
    }
    return map;
  }, [occurrences]);

  function shiftMonth(delta: number) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
    setAnchor(null);
  }

  function handleDayClick(e: MouseEvent<HTMLButtonElement>, key: string) {
    if (anchor?.key === key) {
      setAnchor(null);
      return;
    }
    // `offsetLeft`/`offsetTop` son relativos al ancestro posicionado más
    // cercano, que es el contenedor de la rejilla (`relative`). Medir así evita
    // getBoundingClientRect y su dependencia del scroll de la página.
    const cell = e.currentTarget;
    setAnchor({
      key,
      centerX: cell.offsetLeft + cell.offsetWidth / 2,
      bottom: cell.offsetTop + cell.offsetHeight,
    });
  }

  const selected = anchor ? (byDay.get(anchor.key) ?? []) : [];

  // El panel se centra en la celda, pero sin salirse de la tarjeta: en los días
  // de la primera y la última columna se desplaza y solo se mueve la flecha.
  const gridWidth = gridRef.current?.offsetWidth ?? 0;
  const half = POPOVER_WIDTH / 2;
  const clampedCenter = anchor
    ? Math.min(Math.max(anchor.centerX, half + EDGE_GAP), Math.max(gridWidth - half - EDGE_GAP, half + EDGE_GAP))
    : 0;
  const caretOffset = anchor ? anchor.centerX - (clampedCenter - half) : 0;

  return (
    <div className="flex flex-col gap-3" ref={cardRef}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">Calendario</h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label="Mes anterior"
            className="w-7 h-7 rounded-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high flex items-center justify-center transition-colors"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
              setAnchor(null);
            }}
            className="text-xs text-on-surface-variant hover:text-primary px-1.5"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="Mes siguiente"
            className="w-7 h-7 rounded-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high flex items-center justify-center transition-colors"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-surface-container rounded-lg p-3 flex flex-col gap-2">
        <p className="text-sm font-medium text-on-surface capitalize text-center">
          {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
        </p>

        <div className="relative grid grid-cols-7 gap-y-1" ref={gridRef}>
          {WEEKDAYS.map((w, i) => (
            <span key={i} className="text-[10px] font-bold uppercase text-on-surface-variant/60 text-center">
              {w}
            </span>
          ))}

          {days.map((day) => {
            const key = toDateKey(day);
            const inMonth = day.getMonth() === cursor.getMonth();
            const count = byDay.get(key)?.length ?? 0;
            const isToday = key === todayKey;
            const isOpen = key === anchor?.key;

            return (
              <button
                key={key}
                type="button"
                disabled={count === 0}
                onClick={(e) => handleDayClick(e, key)}
                aria-expanded={isOpen}
                aria-label={`${day.getDate()} de ${MONTHS[day.getMonth()]}${count > 0 ? `, ${count} evento(s)` : ""}`}
                className={`relative h-8 mx-auto w-8 rounded-full text-xs flex flex-col items-center justify-center transition-colors ${
                  isOpen
                    ? "bg-primary-container text-on-primary font-bold"
                    : isToday
                      ? "border border-primary text-primary font-medium"
                      : inMonth
                        ? "text-on-surface"
                        : "text-outline/50"
                } ${count > 0 && !isOpen ? "hover:bg-surface-container-high" : ""} ${
                  count === 0 ? "cursor-default" : ""
                }`}
              >
                {day.getDate()}
                {count > 0 && (
                  <span
                    className={`absolute bottom-1 w-1 h-1 rounded-full ${isOpen ? "bg-on-primary" : "bg-primary"}`}
                  />
                )}
              </button>
            );
          })}

          {anchor && (
            <div
              role="dialog"
              aria-label={dayLabel(anchor.key)}
              className="absolute z-30"
              style={{ width: POPOVER_WIDTH, left: clampedCenter - half, top: anchor.bottom + 8 }}
            >
              {/* La flecha apunta a la celda aunque el panel se haya recortado
                  contra un borde, por eso su posición se calcula aparte. Va
                  FUERA del contenedor con scroll: si estuviera dentro, el
                  `overflow` recortaría justo la parte que sobresale. */}
              <span
                className="absolute -top-[7px] w-3 h-3 rotate-45 bg-surface-container-lowest border-l border-t border-outline-variant/40"
                style={{ left: Math.min(Math.max(caretOffset - 6, 10), POPOVER_WIDTH - 22) }}
              />

              <div className="relative flex flex-col gap-2 bg-surface-container-lowest border border-outline-variant/40 rounded-lg p-3 max-h-64 overflow-y-auto">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/70 first-letter:uppercase">
                  {dayLabel(anchor.key)}
                </p>

                {selected.map((occurrence) => (
                  <EventCard key={occurrence.key} occurrence={occurrence} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
