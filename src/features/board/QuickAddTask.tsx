import { useState, type FormEvent, type KeyboardEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PlusIcon, SlidersIcon } from "../../components/icons";
import { toDateKey } from "../analytics/utils";
import type { Column, Priority } from "./api";
import { DatePicker } from "./DatePicker";
import { useCreateTask, useUpdateTaskDetails } from "./hooks";
import * as subtasksApi from "./subtasks";

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: "high", label: "Alta", color: "#eb3619" },
  { value: "medium", label: "Media", color: "#f59e0b" },
  { value: "low", label: "Baja", color: "#a3a3a3" },
];

export function QuickAddTask({ projectId, columns }: { projectId: string; columns: Column[] }) {
  const [title, setTitle] = useState("");
  const [columnId, setColumnId] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [priority, setPriority] = useState<Priority | null>(null);
  // Hoy en hora LOCAL: es la fecha que se manda al crear, y la que se ve si
  // se abre "Más opciones" sin tocar nada.
  const [startDate, setStartDate] = useState<string>(() => toDateKey(new Date()));
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [subtaskDrafts, setSubtaskDrafts] = useState<string[]>([]);
  const [subtaskInput, setSubtaskInput] = useState("");

  const createTask = useCreateTask(projectId);
  const updateDetails = useUpdateTaskDetails(projectId);
  const queryClient = useQueryClient();

  // La columna destino se DERIVA, no se guarda a secas: al cambiar de proyecto
  // este componente no se desmonta, así que un `columnId` guardado seguiría
  // apuntando a una columna del proyecto anterior. El trigger
  // `tasks_set_project_id` saca el project_id de la COLUMNA, así que crear con
  // esa columna vieja metía la tarea (y después su tiempo) en el proyecto
  // anterior sin ningún error visible.
  const selectedColumn = columns.find((c) => c.id === columnId) ?? columns[0];
  const effectiveColumnId = selectedColumn?.id ?? "";

  function addSubtaskDraft() {
    const value = subtaskInput.trim();
    if (!value) return;
    setSubtaskDrafts((prev) => [...prev, value]);
    setSubtaskInput("");
  }

  function removeSubtaskDraft(index: number) {
    setSubtaskDrafts((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubtaskKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addSubtaskDraft();
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !effectiveColumnId) return;

    const task = await createTask.mutateAsync({
      columnId: effectiveColumnId,
      title: trimmedTitle,
      startDate,
    });

    if (priority || dueDate) {
      await updateDetails.mutateAsync({ taskId: task.id, details: { priority, due_date: dueDate } });
    }

    for (const subtaskTitle of subtaskDrafts) {
      await subtasksApi.createSubtask(task.id, subtaskTitle);
    }
    if (subtaskDrafts.length > 0) {
      queryClient.invalidateQueries({ queryKey: ["subtask-counts", projectId] });
    }

    setTitle("");
    setPriority(null);
    setStartDate(toDateKey(new Date()));
    setDueDate(null);
    setSubtaskDrafts([]);
    setSubtaskInput("");
    setExpanded(false);
  }

  return (
    <div className="bg-surface-container rounded-lg p-3 flex flex-col gap-3">
      <form onSubmit={handleSubmit} className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant shrink-0">
          <PlusIcon className="w-4 h-4" />
        </span>
        <input
          className="flex-1 min-w-0 bg-transparent text-sm text-on-surface placeholder-outline/60 focus:outline-none"
          placeholder={`Añadir tarea a ${selectedColumn?.name ?? "..."}...`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select
          value={effectiveColumnId}
          onChange={(e) => setColumnId(e.target.value)}
          aria-label="Columna destino"
          className="bg-surface-container-low border border-outline-variant/30 rounded-sm px-2 py-1.5 text-xs text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary-container shrink-0"
        >
          {columns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label="Más opciones"
          aria-pressed={expanded}
          title="Más opciones"
          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border transition-colors ${
            expanded
              ? "bg-primary-container text-on-primary border-primary-container"
              : "border-outline-variant/30 text-on-surface-variant hover:text-primary hover:border-primary"
          }`}
        >
          <SlidersIcon className="w-4 h-4" />
        </button>
        <button
          type="submit"
          disabled={!title.trim() || createTask.isPending}
          className="shrink-0 text-xs font-bold uppercase tracking-widest bg-primary-container text-on-primary px-4 py-2.5 rounded-md hover:bg-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Crear
        </button>
      </form>

      {expanded && (
        <div className="flex flex-wrap items-start gap-6 pt-3 border-t border-outline-variant/20">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Prioridad</span>
            <div className="flex gap-1.5">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority((cur) => (cur === p.value ? null : p.value))}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
                  style={
                    priority === p.value
                      ? { backgroundColor: p.color, borderColor: p.color, color: "#fff" }
                      : { borderColor: "var(--outline-variant)", color: "var(--on-surface-variant)" }
                  }
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Inicio</span>
            <div className="w-36">
              <DatePicker
                value={startDate}
                onChange={(v) => setStartDate(v ?? toDateKey(new Date()))}
                clearable={false}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Fecha límite
            </span>
            <div className="w-36">
              <DatePicker value={dueDate} onChange={setDueDate} />
            </div>
          </div>

          <div className="flex flex-col gap-2 flex-1 min-w-[220px]">
            <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Subtareas</span>
            {subtaskDrafts.length > 0 && (
              <ul className="flex flex-col gap-1">
                {subtaskDrafts.map((s, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 bg-surface-container-lowest rounded-sm px-2 py-1 text-sm text-on-surface"
                  >
                    <span className="truncate">{s}</span>
                    <button
                      type="button"
                      onClick={() => removeSubtaskDraft(i)}
                      aria-label={`Quitar subtarea ${s}`}
                      className="text-on-surface-variant hover:text-error text-xs shrink-0"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center gap-2">
              <input
                value={subtaskInput}
                onChange={(e) => setSubtaskInput(e.target.value)}
                onKeyDown={handleSubtaskKeyDown}
                placeholder="Añadir subtarea..."
                className="flex-1 min-w-0 bg-surface-container-lowest border border-outline-variant/30 rounded-sm px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-container"
              />
              <button
                type="button"
                onClick={addSubtaskDraft}
                className="text-xs text-primary font-medium px-2 shrink-0"
              >
                Añadir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
