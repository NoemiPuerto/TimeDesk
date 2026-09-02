import { useMemo, useState } from "react";
import { PlusIcon, SearchIcon } from "../../components/icons";
import { useAppStore } from "../../store/useAppStore";
import { useTeamMembers, useTeamProjects } from "../teams/hooks";
import { useAuth } from "../auth/AuthProvider";
import { CreateProjectForm } from "./CreateProjectForm";
import { useLastActivityForProjects, useMembersForProjects, useMyProjects } from "./hooks";
import { ProjectTile } from "./ProjectTile";

/**
 * Pantalla de elección de proyecto para Timer, Tasks y Analytics.
 *
 * Sustituye al aviso de "elige un proyecto": en lugar de un desplegable, una
 * rejilla de tarjetas con lo que hace falta para decidir —nombre, cuándo se
 * trabajó por última vez y quién participa—, más buscador para equipos con
 * muchos proyectos.
 */
export function ProjectChooser() {
  const { user } = useAuth();
  const { selectProject, selectedTeamId } = useAppStore();
  const { data: personalProjects } = useMyProjects();
  const { data: teamProjects } = useTeamProjects(selectedTeamId);
  const { data: teamMembers } = useTeamMembers(selectedTeamId);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const projects = useMemo(() => {
    const shape = (p: {
      id: string;
      name: string;
      description: string | null;
      cover_url: string | null;
      category: string | null;
    }) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      coverUrl: p.cover_url,
      category: p.category,
    });

    if (selectedTeamId) {
      return (teamProjects ?? []).map((p) => ({ ...shape(p), hasAccess: p.has_access }));
    }
    return (personalProjects ?? [])
      .filter((p) => !p.team_id)
      .map((p) => ({ ...shape(p), hasAccess: true }));
  }, [selectedTeamId, teamProjects, personalProjects]);

  const accessibleIds = useMemo(() => projects.filter((p) => p.hasAccess).map((p) => p.id), [projects]);
  const { data: membersByProject } = useMembersForProjects(accessibleIds);
  const { data: lastActivity } = useLastActivityForProjects(accessibleIds);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return projects;
    return projects.filter((p) =>
      [p.name, p.description ?? "", p.category ?? ""].some((field) => field.toLowerCase().includes(query)),
    );
  }, [projects, search]);

  // En un equipo solo los admin crean proyectos; en Personal, siempre puedes.
  const isTeamAdmin = teamMembers?.some((m) => m.user_id === user?.id && m.role === "admin") ?? false;
  const canCreate = !selectedTeamId || isTeamAdmin;

  const createOverlay = creating ? (
    <CreateProjectForm teamId={selectedTeamId} onDone={() => setCreating(false)} />
  ) : null;

  // Sin ningún proyecto: el botón manda, centrado, sin buscador que estorbe.
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-center py-20">
        {createOverlay}
        <h2 className="text-xl font-bold text-on-surface">
          {selectedTeamId ? "Este equipo todavía no tiene proyectos" : "Todavía no tienes proyectos"}
        </h2>
        <p className="text-sm text-on-surface-variant max-w-sm">
          Un proyecto es donde viven tu tablero, tus tareas y el tiempo que registras.
        </p>
        {canCreate ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 bg-primary-container text-on-primary text-sm font-medium px-5 py-2.5 rounded-full hover:bg-primary transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Crear proyecto
          </button>
        ) : (
          <p className="text-sm text-on-surface-variant">Pídele a un administrador del equipo que cree uno.</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {createOverlay}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-on-surface">Elige un proyecto</h2>
        <div className="flex items-center gap-3">
          <label className="relative flex items-center">
            <SearchIcon className="w-4 h-4 absolute left-3.5 text-on-surface-variant pointer-events-none" />
            <span className="sr-only">Buscar proyecto</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar proyecto..."
              className="bg-surface-container-lowest border border-outline-variant/30 rounded-lg pl-10 pr-4 py-2.5 text-sm w-72 text-on-surface placeholder-outline/60 focus:outline-none focus:ring-2 focus:ring-primary-container"
            />
          </label>
          {canCreate && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex items-center gap-2 bg-primary-container text-on-primary text-sm font-medium px-4 py-2 rounded-full hover:bg-primary transition-colors shrink-0"
            >
              <PlusIcon className="w-4 h-4" />
              Crear proyecto
            </button>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-on-surface-variant">Ningún proyecto coincide con "{search}".</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
          {visible.map((project) => (
            <ProjectTile
              key={project.id}
              id={project.id}
              name={project.name}
              description={project.description}
              coverUrl={project.coverUrl}
              category={project.category}
              lastActivity={lastActivity?.get(project.id)}
              members={membersByProject?.get(project.id) ?? []}
              hasAccess={project.hasAccess}
              onOpen={() => selectProject(project.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
