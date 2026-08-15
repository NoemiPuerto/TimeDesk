import { useState, type FormEvent } from "react";
import { useAppStore } from "../../store/useAppStore";
import { useCreateProject, useMyProjects } from "./hooks";

export function ProjectSwitcher() {
  const { data: projects } = useMyProjects();
  const { selectedProjectId, selectProject } = useAppStore();
  const createProject = useCreateProject();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const selected = projects?.find((p) => p.id === selectedProjectId);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const project = await createProject.mutateAsync({ name: trimmed, description });
    selectProject(project.id);
    setName("");
    setDescription("");
    setCreating(false);
    setOpen(false);
  }

  return (
    <div className="relative px-2">
      <button
        type="button"
        className="w-full flex items-center gap-3 mt-6 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="w-10 h-10 rounded-md bg-primary-container flex items-center justify-center text-on-primary shrink-0">
          {selected ? selected.name.slice(0, 1).toUpperCase() : "+"}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-on-surface truncate">
            {selected ? selected.name : "Elige un proyecto"}
          </p>
          <p className="text-xs text-on-surface-variant">{projects?.length ?? 0} proyecto(s)</p>
        </div>
      </button>

      {open && (
        <div className="absolute left-2 right-2 mt-2 bg-surface-container-lowest border border-outline-variant/30 rounded-md shadow-lg z-50 p-2">
          {!creating ? (
            <>
              <ul className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                {projects?.map((project) => (
                  <li key={project.id}>
                    <button
                      type="button"
                      className={`w-full text-left px-2 py-1.5 rounded-sm text-sm hover:bg-surface-container-high transition-colors ${
                        project.id === selectedProjectId ? "text-primary font-medium" : "text-on-surface"
                      }`}
                      onClick={() => {
                        selectProject(project.id);
                        setOpen(false);
                      }}
                    >
                      {project.name}
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="w-full text-left px-2 py-1.5 rounded-sm text-sm text-primary font-medium hover:bg-surface-container-high transition-colors mt-1 border-t border-outline-variant/20 pt-2"
                onClick={() => setCreating(true)}
              >
                + Nuevo proyecto
              </button>
            </>
          ) : (
            <form onSubmit={handleCreate} className="flex flex-col gap-2 p-1">
              <input
                autoFocus
                className="bg-surface-container-low border border-outline-variant/30 rounded-sm px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-container"
                placeholder="Nombre del proyecto"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                className="bg-surface-container-low border border-outline-variant/30 rounded-sm px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-container"
                placeholder="Descripción (opcional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <div className="flex gap-2 justify-end mt-1">
                <button
                  type="button"
                  className="text-xs text-on-surface-variant px-2 py-1"
                  onClick={() => setCreating(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="text-xs bg-primary-container text-on-primary px-3 py-1.5 rounded-full font-medium hover:bg-primary transition-colors"
                >
                  Crear
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
