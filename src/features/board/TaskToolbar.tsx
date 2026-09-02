import { useState, type ReactNode } from "react";
import { Avatar } from "../../components/Avatar";
import { SearchIcon, UsersIcon } from "../../components/icons";
import { useDismissable } from "../../lib/useDismissable";
import { useProjectMembers } from "../projects/hooks";
import type { Column } from "./api";
import type { SortBy, TaskFilters } from "./filters";
import { useProjectTags } from "./hooks";

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

const CONTROL_CLASS =
  "bg-surface-container-low border border-outline-variant/30 rounded-sm px-2 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container";

const PANEL_CLASS =
  "absolute z-30 mt-1 w-56 max-h-72 overflow-y-auto bg-surface-container border border-outline-variant/30 rounded-md p-1";

function FilterOption({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm text-left transition-colors ${
        selected
          ? "bg-surface-container-high text-on-surface"
          : "text-on-surface-variant hover:bg-surface-container-high"
      }`}
    >
      <span className="flex items-center gap-2 flex-1 min-w-0">{children}</span>
      {selected && <span className="text-primary text-xs shrink-0">✓</span>}
    </button>
  );
}

/**
 * Filtro por persona asignada. Es un panel propio y no un `<select>` nativo
 * porque la gracia está en ver la foto de perfil junto al nombre, y las
 * opciones nativas no admiten imágenes.
 */
function AssigneeFilter({
  projectId,
  filters,
  onChange,
}: {
  projectId: string;
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismissable(open, () => setOpen(false));
  const { data: members } = useProjectMembers(projectId);

  const selected = members?.find((m) => m.user_id === filters.assigneeId);

  function select(assigneeId: TaskFilters["assigneeId"]) {
    onChange({ ...filters, assigneeId });
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Filtrar por persona asignada"
        aria-expanded={open}
        className={`${CONTROL_CLASS} flex items-center gap-2 max-w-[200px] ${
          filters.assigneeId !== "all" ? "border-primary" : ""
        }`}
      >
        {selected ? (
          <Avatar
            url={selected.profile.avatar_url}
            name={selected.profile.display_name}
            size="w-5 h-5"
            textSize="text-[10px]"
          />
        ) : (
          <UsersIcon className="w-4 h-4 text-on-surface-variant shrink-0" />
        )}
        <span className="truncate">
          {selected ? selected.profile.display_name : filters.assigneeId === "none" ? "Sin asignar" : "Cualquiera"}
        </span>
      </button>

      {open && (
        <div className={PANEL_CLASS} role="listbox" aria-label="Personas del proyecto">
          <FilterOption selected={filters.assigneeId === "all"} onClick={() => select("all")}>
            <UsersIcon className="w-5 h-5 text-on-surface-variant shrink-0" />
            Cualquiera
          </FilterOption>
          <FilterOption selected={filters.assigneeId === "none"} onClick={() => select("none")}>
            <span className="w-5 h-5 rounded-full border border-dashed border-outline shrink-0" />
            Sin asignar
          </FilterOption>

          <div className="my-1 border-t border-outline-variant/20" />

          {(members ?? []).map((member) => (
            <FilterOption
              key={member.user_id}
              selected={filters.assigneeId === member.user_id}
              onClick={() => select(member.user_id)}
            >
              <Avatar
                url={member.profile.avatar_url}
                name={member.profile.display_name}
                size="w-5 h-5"
                textSize="text-[10px]"
              />
              <span className="truncate">{member.profile.display_name}</span>
            </FilterOption>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Filtro por etiqueta, de selección múltiple: con varias marcadas basta con que
 * la tarea tenga UNA (unión, no intersección) — es lo que se espera de "quiero
 * ver diseño y backend", mientras que exigir las dos a la vez dejaría el
 * tablero casi siempre vacío.
 */
function TagFilter({
  projectId,
  filters,
  onChange,
}: {
  projectId: string;
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismissable(open, () => setOpen(false));
  const { data: tags } = useProjectTags(projectId);

  function toggle(tagId: string) {
    const next = filters.tagIds.includes(tagId)
      ? filters.tagIds.filter((id) => id !== tagId)
      : [...filters.tagIds, tagId];
    onChange({ ...filters, tagIds: next });
  }

  const selectedTags = (tags ?? []).filter((t) => filters.tagIds.includes(t.id));
  const label =
    selectedTags.length === 0
      ? "Etiquetas: todas"
      : selectedTags.length === 1
        ? selectedTags[0].name
        : `${selectedTags.length} etiquetas`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Filtrar por etiquetas"
        aria-expanded={open}
        className={`${CONTROL_CLASS} flex items-center gap-2 max-w-[200px] ${
          selectedTags.length > 0 ? "border-primary" : ""
        }`}
      >
        {selectedTags.length > 0 && (
          <span className="flex -space-x-1 shrink-0">
            {selectedTags.slice(0, 3).map((tag) => (
              <span
                key={tag.id}
                className="w-2.5 h-2.5 rounded-full border border-surface-container-low"
                style={{ backgroundColor: tag.color }}
              />
            ))}
          </span>
        )}
        <span className="truncate">{label}</span>
      </button>

      {open && (
        <div className={PANEL_CLASS} role="listbox" aria-label="Etiquetas del proyecto">
          {(tags ?? []).length === 0 ? (
            <p className="px-2 py-2 text-xs text-on-surface-variant">
              Este proyecto todavía no tiene etiquetas. Se crean desde el detalle de una tarea.
            </p>
          ) : (
            <>
              {(tags ?? []).map((tag) => (
                <FilterOption
                  key={tag.id}
                  selected={filters.tagIds.includes(tag.id)}
                  onClick={() => toggle(tag.id)}
                >
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white truncate"
                    style={{ backgroundColor: tag.color }}
                  >
                    {tag.name}
                  </span>
                </FilterOption>
              ))}
              {filters.tagIds.length > 0 && (
                <>
                  <div className="my-1 border-t border-outline-variant/20" />
                  <button
                    type="button"
                    onClick={() => onChange({ ...filters, tagIds: [] })}
                    className="w-full text-left px-2 py-1.5 rounded-sm text-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                  >
                    Quitar filtro de etiquetas
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function TaskToolbar({
  projectId,
  columns,
  filters,
  onChange,
}: {
  projectId: string;
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
        className={CONTROL_CLASS}
      >
        <option value="all">Estado: Todos</option>
        {columns.map((c) => (
          <option key={c.id} value={c.id}>
            Estado: {c.name}
          </option>
        ))}
      </select>

      <AssigneeFilter projectId={projectId} filters={filters} onChange={onChange} />

      <TagFilter projectId={projectId} filters={filters} onChange={onChange} />

      <select
        value={filters.sortBy}
        onChange={(e) => onChange({ ...filters, sortBy: e.target.value as SortBy })}
        aria-label="Ordenar tareas"
        className={CONTROL_CLASS}
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
