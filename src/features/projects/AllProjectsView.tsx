import { useMemo, useState } from "react";
import { Avatar } from "../../components/Avatar";
import { PlusIcon, SearchIcon } from "../../components/icons";
import { useAppStore } from "../../store/useAppStore";
import { useAccessibleProjects } from "../dashboard/hooks";
import { useMyTeams } from "../teams/hooks";
import type { Project } from "./api";
import { CreateProjectForm } from "./CreateProjectForm";
import { useLastActivityForProjects, useMembersForProjects, useMyProjects } from "./hooks";
import { ProjectTile } from "./ProjectTile";

/**
 * Pestaña "Projects".
 *
 * Respeta el ámbito de la barra lateral: dentro de un equipo enseña solo sus
 * proyectos —sin secciones, porque ya sabes dónde estás— y en "Personal" los
 * enseña todos, partidos en "Personales" y una sección **por cada equipo**. El
 * cajón de sastre "De equipos" mezclaba proyectos de sitios distintos en una
 * misma rejilla y no dejaba ver de un vistazo qué hay en cada equipo.
 */
export function AllProjectsView({ userId }: { userId: string }) {
  const { selectProject, selectTeam, setActiveNav, selectedTeamId } = useAppStore();
  const { data: visibleProjects, isLoading } = useMyProjects();
  const { data: accessibleProjects } = useAccessibleProjects(userId);
  const { data: teams } = useMyTeams();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const accessibleIds = useMemo(
    () => new Set((accessibleProjects ?? []).map((p) => p.id)),
    [accessibleProjects],
  );
  const teamsById = useMemo(() => new Map((teams ?? []).map((t) => [t.id, t])), [teams]);

  const allIds = useMemo(
    () => (visibleProjects ?? []).filter((p) => accessibleIds.has(p.id)).map((p) => p.id),
    [visibleProjects, accessibleIds],
  );
  const { data: membersByProject } = useMembersForProjects(allIds);
  const { data: lastActivity } = useLastActivityForProjects(allIds);

  /**
   * Secciones a pintar, ya filtradas por búsqueda y por ámbito. Dentro de cada
   * una, lo más reciente arriba.
   */
  const sections = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matches = (p: Project) => {
      if (!query) return true;
      const teamName = p.team_id ? (teamsById.get(p.team_id)?.name ?? "") : "";
      // Buscar también en descripción y equipo: el nombre solo se queda corto
      // en cuanto tienes más de una decena de proyectos.
      return [p.name, p.description ?? "", p.category ?? "", teamName].some((field) =>
        field.toLowerCase().includes(query),
      );
    };

    const byRecency = (a: Project, b: Project) =>
      (lastActivity?.get(b.id) ?? "").localeCompare(lastActivity?.get(a.id) ?? "");

    const matching = (visibleProjects ?? []).filter(matches);

    if (selectedTeamId) {
      const team = teamsById.get(selectedTeamId);
      const list = matching.filter((p) => p.team_id === selectedTeamId).sort(byRecency);
      return list.length > 0
        ? [{ key: selectedTeamId, title: team?.name ?? "Equipo", avatarUrl: team?.avatar_url, projects: list }]
        : [];
    }

    const result: { key: string; title: string; avatarUrl?: string | null; projects: Project[] }[] = [];

    const personal = matching.filter((p) => !p.team_id).sort(byRecency);
    if (personal.length > 0) result.push({ key: "personal", title: "Personales", projects: personal });

    for (const team of teams ?? []) {
      const list = matching.filter((p) => p.team_id === team.id).sort(byRecency);
      if (list.length > 0) {
        result.push({ key: team.id, title: team.name, avatarUrl: team.avatar_url, projects: list });
      }
    }

    // Un proyecto de un equipo que ya no aparece en `teams` (te acaban de
    // sacar, o la lista aún no llegó) no puede desaparecer sin más.
    const placed = new Set(result.flatMap((s) => s.projects.map((p) => p.id)));
    const orphans = matching.filter((p) => !placed.has(p.id)).sort(byRecency);
    if (orphans.length > 0) result.push({ key: "otros", title: "Otros equipos", projects: orphans });

    return result;
  }, [visibleProjects, search, lastActivity, teams, teamsById, selectedTeamId]);

  const total = sections.reduce((sum, s) => sum + s.projects.length, 0);
  const scopeName = selectedTeamId ? (teamsById.get(selectedTeamId)?.name ?? "este equipo") : null;

  function open(project: Project) {
    // El ámbito tiene que seguir al proyecto, o al entrar no se vería nada.
    selectTeam(project.team_id ?? null);
    selectProject(project.id);
    setActiveNav("tasks");
  }


  if (isLoading) return <p className="text-on-surface-variant text-sm">Cargando proyectos...</p>;

  return (
    <div className="flex flex-col gap-6">
      {creating && (
        <CreateProjectForm
          teamId={selectedTeamId}
          // Dentro de un equipo el destino ya está decidido; en Personal hay
          // que preguntarlo, y por eso solo ahí se pasan las opciones.
          teamOptions={selectedTeamId ? undefined : (teams ?? []).map((t) => ({ id: t.id, name: t.name }))}
          onDone={() => setCreating(false)}
        />
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-on-surface">Proyectos</h2>
          <p className="text-sm text-on-surface-variant mt-0.5">
            {scopeName ? `En ${scopeName}` : "Personales y de todos tus equipos"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 bg-primary-container text-on-primary text-sm font-medium px-5 py-2.5 rounded-full hover:bg-primary transition-colors shrink-0"
        >
          <PlusIcon className="w-4 h-4" />
          Crear proyecto
        </button>
      </div>

      <div className="flex items-center gap-3">
        <label className="relative flex items-center flex-1">
          <SearchIcon className="w-5 h-5 absolute left-4 text-on-surface-variant pointer-events-none" />
          <span className="sr-only">Buscar proyecto</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, descripción, categoría o equipo..."
            className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg pl-12 pr-4 py-3 text-base text-on-surface placeholder-outline/60 focus:outline-none focus:ring-2 focus:ring-primary-container"
          />
        </label>
        {search.trim() && (
          <span className="text-sm text-on-surface-variant shrink-0">
            {total} {total === 1 ? "resultado" : "resultados"}
          </span>
        )}
      </div>

      {total === 0 ? (
        search.trim() ? (
          <p className="text-sm text-on-surface-variant">Ningún proyecto coincide con "{search}".</p>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 text-center py-20">
            <h3 className="text-xl font-bold text-on-surface">
              {scopeName ? `${scopeName} todavía no tiene proyectos` : "Todavía no tienes proyectos"}
            </h3>
            <p className="text-sm text-on-surface-variant max-w-sm">
              Un proyecto es donde viven tu tablero, tus tareas y el tiempo que registras.
            </p>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex items-center gap-2 bg-primary-container text-on-primary text-sm font-medium px-5 py-2.5 rounded-full hover:bg-primary transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Crear proyecto
            </button>
          </div>
        )
      ) : (
        sections.map((section) => (
          <section key={section.key} className="flex flex-col gap-3">
            <h3 className="flex items-center gap-2 text-sm font-bold text-on-surface">
              {section.key !== "personal" && section.key !== "otros" && (
                <Avatar url={section.avatarUrl} name={section.title} size="w-6 h-6" textSize="text-[10px]" />
              )}
              {section.title}
              <span className="font-normal text-on-surface-variant/60">{section.projects.length}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
              {section.projects.map((project) => (
                <ProjectTile
                  key={project.id}
                  id={project.id}
                  name={project.name}
                  description={project.description}
                  coverUrl={project.cover_url}
                  category={project.category}
                  // Dentro de un equipo la etiqueta sobra: son todos suyos.
                  teamName={
                    selectedTeamId || !project.team_id
                      ? null
                      : (teamsById.get(project.team_id)?.name ?? "Equipo")
                  }
                  lastActivity={lastActivity?.get(project.id)}
                  members={membersByProject?.get(project.id) ?? []}
                  hasAccess={accessibleIds.has(project.id)}
                  onOpen={() => open(project)}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
