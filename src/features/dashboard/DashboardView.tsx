import { useMemo } from "react";
import { Avatar } from "../../components/Avatar";
import { AtSignIcon, KanbanIcon, UsersIcon } from "../../components/icons";
import { useAppStore } from "../../store/useAppStore";
import { startOfWeek, summarize } from "../analytics/utils";
import { mentionsToPlainText } from "../board/mentions";
import { EventsCalendar } from "../events/EventsCalendar";
import { EventsPanel } from "../events/EventsPanel";
import { useMyProfile } from "../profile/hooks";
import { WeeklyHighlight } from "./WeeklyHighlight";
import { useNotifications } from "../notifications/hooks";
import { useMyProjects } from "../projects/hooks";
import { useMyTeams } from "../teams/hooks";
import {
  useAccessibleProjects,
  useDashboardColumns,
  useDashboardSessions,
  useDashboardTasks,
  useMyAssignedTaskIds,
} from "./hooks";

const PRIORITY_STYLE: Record<string, { label: string; color: string }> = {
  high: { label: "Alta", color: "#eb3619" },
  medium: { label: "Media", color: "#f59e0b" },
  low: { label: "Baja", color: "#a3a3a3" },
};

function ProjectCard({
  name,
  done,
  total,
  hasAccess,
  onOpen,
}: {
  name: string;
  done: number;
  total: number;
  hasAccess: boolean;
  onOpen: () => void;
}) {
  if (!hasAccess) {
    return (
      <div
        title="Pídele acceso al administrador del equipo"
        className="flex flex-col gap-1.5 bg-surface-container/50 rounded-lg p-3 border border-dashed border-outline-variant/30"
      >
        <span className="flex items-center gap-1.5 text-sm text-on-surface-variant/60 truncate">
          <span aria-hidden>🔒</span>
          <span className="truncate">{name}</span>
        </span>
        <span className="text-[10px] text-on-surface-variant/50">Sin acceso</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col gap-1.5 bg-surface-container rounded-lg p-3 text-left hover:bg-surface-container-high transition-colors"
    >
      <span className="text-sm text-on-surface truncate">{name}</span>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
          <div
            className="h-full bg-primary rounded-full"
            style={{ width: total > 0 ? `${(done / total) * 100}%` : "0%" }}
          />
        </div>
        <span className="text-[10px] text-on-surface-variant shrink-0">
          {done}/{total}
        </span>
      </div>
    </button>
  );
}

function StatTile({ label, value, tone }: { label: string; value: string; tone?: "error" }) {
  return (
    <div className="bg-surface-container rounded-lg p-5 flex flex-col gap-1">
      <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{label}</span>
      <span className={`text-3xl font-bold ${tone === "error" ? "text-error" : "text-on-surface"}`}>{value}</span>
    </div>
  );
}

export function DashboardView({
  userId,
  onOpenProject,
}: {
  userId: string;
  onOpenProject: (project: { id: string; team_id: string | null }) => void;
}) {
  const { requestOpenTask, selectedTeamId, setActiveNav } = useAppStore();
  const { data: myProfile } = useMyProfile(userId);
  // Dos listas distintas a propósito:
  //  - `projects` (accesible): donde soy miembro de verdad. Es la base de las
  //    métricas, porque de estos sí puedo leer tareas y sesiones.
  //  - `visibleProjects`: además, los del equipo que puedo VER pero a los que
  //    todavía no me han dado acceso. Se pintan bloqueados.
  const { data: projects, isLoading: projectsLoading } = useAccessibleProjects(userId);
  const { data: visibleProjects } = useMyProjects();
  const { data: teams } = useMyTeams();
  const selectedTeam = useMemo(
    () => (teams ?? []).find((t) => t.id === selectedTeamId) ?? null,
    [teams, selectedTeamId],
  );

  /**
   * Con un equipo elegido, el dashboard es el DE ESE EQUIPO: métricas, "Mi
   * día" y menciones se calculan solo sobre sus proyectos. Antes daba igual
   * qué equipo tuvieras seleccionado, siempre mostraba todo lo tuyo.
   */
  const scopedProjects = useMemo(
    () => (selectedTeamId ? (projects ?? []).filter((p) => p.team_id === selectedTeamId) : (projects ?? [])),
    [projects, selectedTeamId],
  );

  const projectIds = useMemo(() => scopedProjects.map((p) => p.id), [scopedProjects]);

  const { data: tasks } = useDashboardTasks(projectIds);
  const { data: columns } = useDashboardColumns(projectIds);
  // Semana de calendario (lunes), no "últimos 7 días": la tarjeta dice "esta
  // semana" y tiene que coincidir con lo que muestra Analytics.
  const since = useMemo(() => startOfWeek(new Date()).toISOString(), []);
  const { data: sessions } = useDashboardSessions(projectIds, since);
  const { data: assignedIds } = useMyAssignedTaskIds(userId, projectIds);
  // Las menciones las resuelve un trigger al guardar el comentario, no un
  // escaneo de texto en el cliente — ver la migración de notificaciones.
  const { data: notifications } = useNotifications(userId);

  const now = Date.now();
  const todayKey = new Date().toISOString().slice(0, 10);

  const projectsById = useMemo(() => new Map((projects ?? []).map((p) => [p.id, p])), [projects]);

  const lastColumnByProject = useMemo(() => {
    const byProject = new Map<string, { id: string; position: number }[]>();
    for (const c of columns ?? []) {
      const list = byProject.get(c.project_id) ?? [];
      list.push(c);
      byProject.set(c.project_id, list);
    }
    const map = new Map<string, string>();
    for (const [projectId, cols] of byProject) {
      const sorted = [...cols].sort((a, b) => a.position - b.position);
      const last = sorted[sorted.length - 1];
      if (last) map.set(projectId, last.id);
    }
    return map;
  }, [columns]);

  function isDone(t: { project_id: string; column_id: string }): boolean {
    return lastColumnByProject.get(t.project_id) === t.column_id;
  }

  const totalTasks = tasks?.length ?? 0;
  const doneTasks = (tasks ?? []).filter(isDone).length;
  const completionRate = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0;
  const weekHours = sessions ? summarize(sessions, now).thisWeek : 0;

  const overdueTasks = useMemo(
    () => (tasks ?? []).filter((t) => t.due_date && t.due_date < todayKey && !isDone(t)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, todayKey, lastColumnByProject],
  );

  const myDayTasks = useMemo(
    () =>
      (tasks ?? [])
        .filter((t) => t.due_date && t.due_date <= todayKey && !isDone(t))
        .sort((a, b) => a.due_date!.localeCompare(b.due_date!))
        .slice(0, 8),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, todayKey, lastColumnByProject],
  );

  const accessibleIds = useMemo(() => new Set((projects ?? []).map((p) => p.id)), [projects]);

  /** Hechas/totales por proyecto, para la barra de cada tarjeta. */
  const statsFor = useMemo(() => {
    const map = new Map<string, { done: number; total: number }>();
    for (const t of tasks ?? []) {
      const entry = map.get(t.project_id) ?? { done: 0, total: 0 };
      entry.total += 1;
      if (isDone(t)) entry.done += 1;
      map.set(t.project_id, entry);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, lastColumnByProject]);

  const personalProjects = useMemo(
    () => (visibleProjects ?? []).filter((p) => !p.team_id),
    [visibleProjects],
  );

  const teamProjects = useMemo(
    () => (selectedTeamId ? (visibleProjects ?? []).filter((p) => p.team_id === selectedTeamId) : []),
    [visibleProjects, selectedTeamId],
  );
  const myTeamProjects = useMemo(
    () => teamProjects.filter((p) => accessibleIds.has(p.id)),
    [teamProjects, accessibleIds],
  );
  const lockedTeamProjects = useMemo(
    () => teamProjects.filter((p) => !accessibleIds.has(p.id)),
    [teamProjects, accessibleIds],
  );

  /** Un bloque por equipo, con sus proyectos (accesibles y bloqueados). */
  const teamGroups = useMemo(
    () =>
      (teams ?? []).map((team) => ({
        team,
        projects: (visibleProjects ?? []).filter((p) => p.team_id === team.id),
      })),
    [teams, visibleProjects],
  );

  /** Solo las tareas asignadas a mí: "cuánto HE avanzado", no cuánto avanzó el proyecto. */
  const myTasks = useMemo(
    () => (tasks ?? []).filter((t) => assignedIds?.has(t.id)),
    [tasks, assignedIds],
  );

  /** Mis tareas terminadas dentro de la semana en curso: las tarjetas del bloque. */
  const completedThisWeek = useMemo(() => {
    const weekStart = startOfWeek(new Date()).getTime();
    return myTasks
      .filter((t) => t.completed_at && new Date(t.completed_at).getTime() >= weekStart)
      .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
  }, [myTasks]);

  const mentions = useMemo(() => {
    const list = notifications ?? [];
    // Las menciones también se acotan al equipo elegido: si no, el dashboard
    // del equipo mostraría avisos de proyectos que no son suyos.
    const scoped = selectedTeamId
      ? list.filter((n) => n.project_id && projectIds.includes(n.project_id))
      : list;
    return scoped.slice(0, 5);
  }, [notifications, selectedTeamId, projectIds]);

  function openMention(projectId: string | null, taskId: string | null) {
    const project = projectId ? projectsById.get(projectId) : undefined;
    if (!project) return;
    requestOpenTask(taskId);
    onOpenProject(project);
  }

  if (projectsLoading) {
    return <p className="text-on-surface-variant text-sm">Cargando dashboard...</p>;
  }

  // Con un equipo elegido nunca es "no tienes nada": como mínimo se listan sus
  // proyectos, aunque estén todos bloqueados.
  if (!selectedTeamId && (projects ?? []).length === 0 && (teams ?? []).length === 0) {
    return (
      <p className="text-on-surface-variant text-sm">
        Todavía no tienes proyectos. Usa el selector de arriba a la izquierda para crear uno.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Tareas completadas" value={String(doneTasks)} />
        <StatTile label="Tasa de finalización" value={`${completionRate.toFixed(0)}%`} />
        <StatTile label="Horas esta semana" value={`${weekHours.toFixed(1)}h`} />
        <StatTile
          label="Tareas vencidas"
          value={String(overdueTasks.length)}
          tone={overdueTasks.length > 0 ? "error" : undefined}
        />
      </div>

      <WeeklyHighlight
        userName={myProfile?.display_name}
        tasks={completedThisWeek.map((t) => ({
          id: t.id,
          title: t.title,
          projectName: projectsById.get(t.project_id)?.name ?? "Proyecto",
        }))}
        onOpenStats={() => setActiveNav("analytics")}
        onOpenTask={(taskId) => {
          const task = completedThisWeek.find((t) => t.id === taskId);
          const project = task ? projectsById.get(task.project_id) : undefined;
          if (!project) return;
          requestOpenTask(taskId);
          onOpenProject(project);
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">Mi día</h3>
          {myDayTasks.length === 0 ? (
            <p className="text-sm text-on-surface-variant bg-surface-container rounded-lg p-6">
              No tienes tareas vencidas ni con fecha límite hoy.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {myDayTasks.map((t) => {
                const project = projectsById.get(t.project_id);
                const priority = t.priority ? PRIORITY_STYLE[t.priority] : null;
                const isOverdue = t.due_date! < todayKey;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => project && onOpenProject(project)}
                    className="flex items-center gap-3 bg-surface-container rounded-lg px-4 py-3 text-left hover:bg-surface-container-high transition-colors"
                  >
                    {priority && (
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: priority.color }}
                        title={priority.label}
                      />
                    )}
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-on-surface truncate">{t.title}</span>
                      <span className="block text-xs text-on-surface-variant truncate">
                        {project?.name ?? "Proyecto eliminado"}
                      </span>
                    </span>
                    <span className={`text-xs shrink-0 ${isOverdue ? "text-error font-medium" : "text-on-surface-variant"}`}>
                      {isOverdue ? "Vencida" : "Hoy"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h3 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-widest text-on-surface-variant">
              <AtSignIcon className="w-3.5 h-3.5" />
              Menciones recientes
            </h3>
            {mentions.length === 0 ? (
              <p className="text-xs text-on-surface-variant bg-surface-container rounded-lg p-4">
                Nadie te ha mencionado todavía. Escribe @tu-nombre en un comentario para probarlo.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {mentions.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => openMention(n.project_id, n.task_id)}
                    className="flex items-start gap-2 bg-surface-container rounded-lg p-3 text-left hover:bg-surface-container-high transition-colors"
                  >
                    <Avatar
                      url={n.actor?.avatar_url}
                      name={n.actor?.display_name ?? "?"}
                      size="w-6 h-6"
                      textSize="text-[10px]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-on-surface">
                        {n.actor?.display_name ?? "Alguien"}
                      </span>
                      <span className="block text-xs text-on-surface-variant truncate">
                        en "{n.task_title ?? "tarea eliminada"}"
                      </span>
                      <span className="block text-xs text-on-surface line-clamp-2 mt-0.5">
                        {mentionsToPlainText(n.body ?? "")}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* El calendario va primero: es el vistazo al mes, y la lista de
              debajo responde a "qué es lo siguiente". */}
          <EventsCalendar />

          <EventsPanel />

          {/* Dashboard DEL EQUIPO: solo sus proyectos, partidos entre los que
              tengo asignados y los que existen pero no puedo abrir. */}
          {selectedTeam ? (
            <div className="flex flex-col gap-3">
              <h3 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-widest text-on-surface-variant">
                <UsersIcon className="w-3.5 h-3.5" />
                <Avatar url={selectedTeam.avatar_url} name={selectedTeam.name} size="w-5 h-5" textSize="text-[9px]" />
                <span className="truncate">{selectedTeam.name}</span>
              </h3>

              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/70">
                Proyectos en los que participo
                <span className="ml-1.5 normal-case tracking-normal font-normal text-on-surface-variant/50">
                  {myTeamProjects.length}
                </span>
              </p>
              {myTeamProjects.length === 0 ? (
                <p className="text-xs text-on-surface-variant bg-surface-container rounded-lg p-3">
                  Todavía no te han asignado ningún proyecto de este equipo. Pídeselo a un administrador.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {myTeamProjects.map((project) => {
                    const stats = statsFor.get(project.id) ?? { done: 0, total: 0 };
                    return (
                      <ProjectCard
                        key={project.id}
                        name={project.name}
                        done={stats.done}
                        total={stats.total}
                        hasAccess
                        onOpen={() => onOpenProject(project)}
                      />
                    );
                  })}
                </div>
              )}

              {lockedTeamProjects.length > 0 && (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/70 mt-2">
                    Otros proyectos del equipo
                    <span className="ml-1.5 normal-case tracking-normal font-normal text-on-surface-variant/50">
                      {lockedTeamProjects.length}
                    </span>
                  </p>
                  <div className="flex flex-col gap-2">
                    {lockedTeamProjects.map((project) => (
                      <ProjectCard
                        key={project.id}
                        name={project.name}
                        done={0}
                        total={0}
                        hasAccess={false}
                        onOpen={() => {}}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
            {/* Los proyectos viven en esta columna lateral, no a lo ancho, pero
                separados en personales / equipos / proyectos de cada equipo. */}
            <div className="flex flex-col gap-3">
              <h3 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-widest text-on-surface-variant">
                <KanbanIcon className="w-3.5 h-3.5" />
                Proyectos personales
                <span className="text-on-surface-variant/50 normal-case tracking-normal font-normal">
                  {personalProjects.length}
                </span>
              </h3>
              {personalProjects.length === 0 ? (
                <p className="text-xs text-on-surface-variant bg-surface-container rounded-lg p-3">
                  No tienes proyectos personales todavía.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {personalProjects.map((project) => {
                    const stats = statsFor.get(project.id) ?? { done: 0, total: 0 };
                    return (
                      <ProjectCard
                        key={project.id}
                        name={project.name}
                        done={stats.done}
                        total={stats.total}
                        hasAccess={accessibleIds.has(project.id)}
                        onOpen={() => onOpenProject(project)}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-widest text-on-surface-variant">
                <UsersIcon className="w-3.5 h-3.5" />
                Mis equipos
                <span className="text-on-surface-variant/50 normal-case tracking-normal font-normal">
                  {teamGroups.length}
                </span>
              </h3>

              {teamGroups.length === 0 ? (
                <p className="text-xs text-on-surface-variant bg-surface-container rounded-lg p-3">
                  No perteneces a ningún equipo todavía.
                </p>
              ) : (
                teamGroups.map(({ team, projects: teamProjects }) => (
                  <div key={team.id} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 px-0.5">
                      <Avatar url={team.avatar_url} name={team.name} size="w-6 h-6" textSize="text-[10px]" />
                      <span className="text-xs font-bold text-on-surface truncate flex-1">{team.name}</span>
                      <span className="text-[10px] text-on-surface-variant shrink-0">{teamProjects.length}</span>
                    </div>
                    {teamProjects.length === 0 ? (
                      <p className="text-[11px] text-on-surface-variant/70 pl-8">Sin proyectos.</p>
                    ) : (
                      <div className="flex flex-col gap-2 pl-3 border-l border-outline-variant/20">
                        {teamProjects.map((project) => {
                          const stats = statsFor.get(project.id) ?? { done: 0, total: 0 };
                          return (
                            <ProjectCard
                              key={project.id}
                              name={project.name}
                              done={stats.done}
                              total={stats.total}
                              hasAccess={accessibleIds.has(project.id)}
                              onOpen={() => onOpenProject(project)}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
