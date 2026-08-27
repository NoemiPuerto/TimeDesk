import { useState } from "react";
import { CalendarIcon } from "../../components/icons";
import { useDismissable } from "../../lib/useDismissable";

const WEEKDAYS = ["do", "lu", "ma", "mi", "ju", "vi", "sá"];
const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function DueDatePicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseDateKey(value) : null;
  const [viewDate, setViewDate] = useState(() => selected ?? new Date());
  const containerRef = useDismissable(open, () => setOpen(false));

  function openPicker() {
    setViewDate(selected ?? new Date());
    setOpen((o) => !o);
  }

  const today = new Date();
  const todayKey = toDateKey(today);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: Date[] = [];
  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push(new Date(year, month - 1, daysInPrevMonth - i));
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d));
  }
  while (cells.length < 42) {
    const last = cells[cells.length - 1];
    cells.push(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1));
  }

  const label = selected
    ? `${String(selected.getDate()).padStart(2, "0")}/${String(selected.getMonth() + 1).padStart(2, "0")}/${selected.getFullYear()}`
    : "dd/mm/aaaa";

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={openPicker}
        className="w-full flex items-center justify-between gap-2 bg-surface-container-lowest border border-outline-variant/30 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-container"
      >
        <span className={selected ? "text-on-surface" : "text-outline"}>{label}</span>
        <CalendarIcon className="w-4 h-4 text-on-surface-variant shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-64 bg-surface-container-lowest border border-outline-variant/30 rounded-md shadow-lg z-20 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-on-surface capitalize">
              {MONTHS[month]} de {year}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                aria-label="Mes anterior"
                onClick={() => setViewDate(new Date(year, month - 1, 1))}
                className="w-6 h-6 rounded-sm text-on-surface-variant hover:text-primary hover:bg-surface-container-high flex items-center justify-center"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Mes siguiente"
                onClick={() => setViewDate(new Date(year, month + 1, 1))}
                className="w-6 h-6 rounded-sm text-on-surface-variant hover:text-primary hover:bg-surface-container-high flex items-center justify-center"
              >
                ›
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-y-1 text-center">
            {WEEKDAYS.map((w) => (
              <span key={w} className="text-[10px] font-bold uppercase text-on-surface-variant">
                {w}
              </span>
            ))}
            {cells.map((date) => {
              const key = toDateKey(date);
              const inMonth = date.getMonth() === month;
              const isSelected = value === key;
              const isToday = key === todayKey;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    onChange(key);
                    setOpen(false);
                  }}
                  className={`w-7 h-7 mx-auto rounded-full text-xs flex items-center justify-center transition-colors ${
                    isSelected
                      ? "bg-primary-container text-on-primary font-bold"
                      : isToday
                        ? "border border-primary text-primary"
                        : inMonth
                          ? "text-on-surface hover:bg-surface-container-high"
                          : "text-outline/50 hover:bg-surface-container-high"
                  }`}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-3 pt-2 border-t border-outline-variant/20">
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="text-xs text-on-surface-variant hover:text-error"
            >
              Borrar
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(todayKey);
                setViewDate(today);
                setOpen(false);
              }}
              className="text-xs text-primary font-medium hover:underline"
            >
              Hoy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
