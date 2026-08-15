import { SearchIcon } from "../../components/icons";
import type { Column } from "./api";
import type { SortBy, TaskFilters } from "./filters";

const PRIORITY_CHIPS: { key: TaskFilters["priority"]; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "high", label: "Alta" },
  { key: "medium", label: "Media" },
  { key: "low", label: "Baja" },
];

const SORT_OPTIONS: { key: SortBy; label: string }[] = [
  { key: "manual", label: "Manual" },
  { key: "due_date", label: "Fecha límite" },
  { key: "priority", label: "Prioridad" },
  { key: "title", label: "Título" },
];

export function TaskToolbar({
  columns,
  filters,
  onChange,
}: {
  columns: Column[];
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[180px] max-w-xs">
        <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
        <input
          type="text"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Buscar tareas..."
          aria-label="Buscar tareas"
          className="w-full bg-surface-container-low border border-outline-variant/30 rounded-sm pl-8 pr-2 py-1.5 text-sm placeholder-outline/60 focus:outline-none focus:ring-2 focus:ring-primary-container"
        />
      </div>

      <select
        value={filters.statusColumnId}
        onChange={(e) => onChange({ ...filters, statusColumnId: e.target.value })}
        aria-label="Filtrar por estado"
        className="bg-surface-container-low border border-outline-variant/30 rounded-sm px-2 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
      >
        <option value="all">Estado: Todos</option>
        {columns.map((c) => (
          <option key={c.id} value={c.id}>
            Estado: {c.name}
          </option>
        ))}
      </select>

      <select
        value={filters.sortBy}
        onChange={(e) => onChange({ ...filters, sortBy: e.target.value as SortBy })}
        aria-label="Ordenar tareas"
        className="bg-surface-container-low border border-outline-variant/30 rounded-sm px-2 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.key} value={opt.key}>
            Ordenar: {opt.label}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-1" role="group" aria-label="Filtro rápido de prioridad">
        {PRIORITY_CHIPS.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => onChange({ ...filters, priority: chip.key })}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              filters.priority === chip.key
                ? "bg-primary-container text-on-primary border-primary-container"
                : "border-outline-variant/30 text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}
