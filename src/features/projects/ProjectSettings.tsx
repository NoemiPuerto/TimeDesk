import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { removeProjectCover, uploadProjectCover } from "../../lib/avatars";
import { useAppStore } from "../../store/useAppStore";
import type { Project } from "./api";
import { CategoryField } from "./categories";
import { useDeleteProject, useUpdateProject } from "./hooks";
import { ProjectCoverField } from "./ProjectCover";

export function ProjectSettings({ project, isOwner }: { project: Project; isOwner: boolean }) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [category, setCategory] = useState(project.category ?? "");
  const [doneLimit, setDoneLimit] = useState(
    project.done_display_limit === null ? "" : String(project.done_display_limit),
  );
  const updateProject = useUpdateProject(project.id);
  const deleteProject = useDeleteProject();
  const queryClient = useQueryClient();
  const { selectProject } = useAppStore();

  function commitName() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== project.name) updateProject.mutate({ name: trimmed });
    else setName(project.name);
  }

  function commitDescription() {
    if (description !== (project.description ?? "")) {
      updateProject.mutate({ description: description || null });
    }
  }

  function commitCategory() {
    const trimmed = category.trim();
    if (trimmed !== (project.category ?? "")) updateProject.mutate({ category: trimmed || null });
  }

  // `uploadProjectCover` ya escribe `cover_url` en la fila, así que aquí solo
  // queda refrescar las listas que pintan la portada.
  function refreshProjects() {
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["team-projects"] });
  }

  // La portada sí se sube en el momento: aquí el proyecto ya existe, así que
  // hay ruta de Storage a la que subirla (al crearlo todavía no la hay).
  async function handleCoverPick(file: File) {
    await uploadProjectCover(project.id, file);
    refreshProjects();
  }

  async function handleCoverRemove() {
    await removeProjectCover(project.id);
    refreshProjects();
  }

  function commitDoneLimit() {
    const trimmed = doneLimit.trim();
    // Vacío = sin límite. Cualquier otra cosa que no sea un entero positivo se
    // descarta y el campo vuelve a mostrar el valor guardado.
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed !== null && (!Number.isInteger(parsed) || parsed < 1)) {
      setDoneLimit(project.done_display_limit === null ? "" : String(project.done_display_limit));
      return;
    }
    if (parsed !== project.done_display_limit) updateProject.mutate({ done_display_limit: parsed });
  }

  function handleDelete() {
    if (
      !confirm(
        `¿Eliminar el proyecto "${project.name}"? Esta acción no se puede deshacer y borra sus columnas, tareas, comentarios y tiempo registrado para todos los miembros.`,
      )
    )
      return;
    deleteProject.mutate(project.id, { onSuccess: () => selectProject(null) });
  }

  return (
    <div className="max-w-xl flex flex-col gap-8">
      <div className="flex flex-col gap-2 max-w-sm">
        <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Portada</span>
        <ProjectCoverField
          coverUrl={project.cover_url}
          seed={project.id}
          name={project.name}
          disabled={!isOwner}
          onPick={handleCoverPick}
          onRemove={handleCoverRemove}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
          Nombre del proyecto
        </label>
        <input
          className="bg-surface-container-lowest border border-outline-variant/30 rounded-md px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container disabled:opacity-60"
          value={name}
          disabled={!isOwner}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Descripción</label>
        <textarea
          className="bg-surface-container-lowest border border-outline-variant/30 rounded-md px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container min-h-[80px] resize-y disabled:opacity-60"
          placeholder="Añade una descripción..."
          value={description}
          disabled={!isOwner}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={commitDescription}
        />
      </div>

      <div className="flex flex-col gap-2 max-w-xs">
        <label
          className="text-xs font-bold uppercase tracking-widest text-on-surface-variant"
          htmlFor="project-category"
        >
          Categoría
        </label>
        <CategoryField
          value={category}
          onChange={setCategory}
          onCommit={commitCategory}
          disabled={!isOwner}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant" htmlFor="done-limit">
          Tarjetas visibles en la columna de terminadas
        </label>
        <input
          id="done-limit"
          type="number"
          min={1}
          inputMode="numeric"
          placeholder="Sin límite"
          className="bg-surface-container-lowest border border-outline-variant/30 rounded-md px-3 py-2 text-sm text-on-surface w-40 focus:outline-none focus:ring-2 focus:ring-primary-container disabled:opacity-60"
          value={doneLimit}
          disabled={!isOwner}
          onChange={(e) => setDoneLimit(e.target.value)}
          onBlur={commitDoneLimit}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
        <p className="text-xs text-on-surface-variant">
          El tablero muestra solo las más recientes; el resto se consultan en la pestaña History. Déjalo vacío para
          mostrarlas todas.
        </p>
      </div>

      {isOwner ? (
        <div className="border-t border-outline-variant/20 pt-6 flex flex-col gap-3">
          <h3 className="text-sm font-bold text-error uppercase tracking-widest">Zona de peligro</h3>
          <p className="text-xs text-on-surface-variant">
            Eliminar este proyecto borra permanentemente sus columnas, tareas, comentarios, subtareas y tiempo
            registrado para todos los miembros.
          </p>
          <button
            type="button"
            onClick={handleDelete}
            className="self-start text-sm text-error px-4 py-2 rounded-md border border-error/40 hover:bg-error/10 transition-colors"
          >
            Eliminar proyecto
          </button>
        </div>
      ) : (
        <p className="text-xs text-on-surface-variant">
          Solo el dueño del proyecto puede editar estos datos o eliminarlo.
        </p>
      )}
    </div>
  );
}
